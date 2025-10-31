import { query, transaction } from '../config/database.js';
import { createPaymentIntent, confirmPaymentIntent, createRefund } from '../config/stripe.js';
import { createPaddleTransaction, getPaddleTransaction } from '../config/paddle.js';
import { PAYMENT_STATUS, PAYMENT_GATEWAYS, REGIONAL_ZONES } from '../config/constants.js';
import { createBlockedAccount } from './walletService.js';

/**
 * Determine payment gateway based on user region
 */
export const getPaymentGateway = async (regionZone) => {
  const result = await query(
    `SELECT * FROM votteryy_payment_gateway_config WHERE region_zone = $1 AND is_active = true`,
    [regionZone]
  );

  if (result.rows.length === 0) {
    return { gateway: PAYMENT_GATEWAYS.STRIPE, splitPercentage: 100 };
  }

  const config = result.rows[0];
  
  if (config.gateway_name === PAYMENT_GATEWAYS.BOTH) {
    // 50-50 split - randomly choose
    return Math.random() < 0.5 
      ? { gateway: PAYMENT_GATEWAYS.STRIPE, splitPercentage: 50 }
      : { gateway: PAYMENT_GATEWAYS.PADDLE, splitPercentage: 50 };
  }

  return { gateway: config.gateway_name, splitPercentage: config.split_percentage };
};

/**
 * Calculate platform processing fee
 */
export const calculateProcessingFee = (amount, feePercentage, feeFixedAmount) => {
  const percentageFee = feePercentage ? (amount * feePercentage) / 100 : 0;
  const fixedFee = feeFixedAmount || 0;
  return Math.round((percentageFee + fixedFee) * 100) / 100;
};

/**
 * Create payment for election
 */
export const createElectionPayment = async (userId, electionId, electionData, userRegion) => {
  // Determine amount based on pricing type
  let amount = 0;
  
  if (electionData.pricing_type === 'paid_general') {
    amount = parseFloat(electionData.general_participation_fee);
  } else if (electionData.pricing_type === 'paid_regional') {
    // Get regional pricing
    const regionalResult = await query(
      `SELECT fee FROM votteryy_election_regional_pricing 
       WHERE election_id = $1 AND region_zone = $2`,
      [electionId, userRegion]
    );
    
    if (regionalResult.rows.length > 0) {
      amount = parseFloat(regionalResult.rows[0].fee);
    }
  }

  if (amount === 0) {
    throw new Error('Invalid election pricing configuration');
  }

  // Calculate platform fee
  const platformFee = calculateProcessingFee(
    amount,
    parseFloat(electionData.processing_fee_percentage) || 0,
    null
  );

  const totalAmount = amount + platformFee;

  // Get payment gateway
  const { gateway } = await getPaymentGateway(userRegion);

  let paymentIntent;
  
  try {
    if (gateway === PAYMENT_GATEWAYS.STRIPE) {
      paymentIntent = await createPaymentIntent(totalAmount, 'usd', {
        userId,
        electionId: electionId.toString(),
        electionFee: amount.toFixed(2),
        platformFee: platformFee.toFixed(2)
      });

      // Store payment record
      const result = await query(
        `INSERT INTO votteryy_election_payments 
         (user_id, election_id, payment_intent_id, gateway_used, amount, 
          platform_fee, currency, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId,
          electionId,
          paymentIntent.id,
          PAYMENT_GATEWAYS.STRIPE,
          amount,
          platformFee,
          'USD',
          PAYMENT_STATUS.PENDING,
          JSON.stringify({ stripePaymentIntent: paymentIntent.id })
        ]
      );

      return {
        paymentId: result.rows[0].payment_id,
        clientSecret: paymentIntent.client_secret,
        amount: totalAmount,
        gateway: PAYMENT_GATEWAYS.STRIPE
      };
    } else {
      // Paddle implementation
      paymentIntent = await createPaddleTransaction(
        [{ price_id: 'price_election', quantity: 1 }],
        userId,
        { electionId, userId, amount: totalAmount }
      );

      const result = await query(
        `INSERT INTO votteryy_election_payments 
         (user_id, election_id, payment_intent_id, gateway_used, amount, 
          platform_fee, currency, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          userId,
          electionId,
          paymentIntent.id,
          PAYMENT_GATEWAYS.PADDLE,
          amount,
          platformFee,
          'USD',
          PAYMENT_STATUS.PENDING,
          JSON.stringify({ paddleTransactionId: paymentIntent.id })
        ]
      );

      return {
        paymentId: result.rows[0].payment_id,
        transactionId: paymentIntent.id,
        amount: totalAmount,
        gateway: PAYMENT_GATEWAYS.PADDLE
      };
    }
  } catch (error) {
    console.error('Payment creation error:', error);
    throw new Error('Failed to create payment intent');
  }
};

/**
 * Confirm payment success
 */
export const confirmElectionPayment = async (paymentIntentId, gateway) => {
  return transaction(async (client) => {
    // Get payment record
    const paymentResult = await client.query(
      `SELECT * FROM votteryy_election_payments 
       WHERE payment_intent_id = $1`,
      [paymentIntentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment record not found');
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await client.query(
      `UPDATE votteryy_election_payments 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE payment_intent_id = $2`,
      [PAYMENT_STATUS.SUCCEEDED, paymentIntentId]
    );

    // Create blocked account entry (money held until election ends)
    const electionResult = await client.query(
      `SELECT end_date FROM votteryy_elections WHERE id = $1`,
      [payment.election_id]
    );

    if (electionResult.rows.length > 0) {
      await createBlockedAccount(
        payment.user_id,
        payment.election_id,
        parseFloat(payment.amount),
        parseFloat(payment.platform_fee),
        electionResult.rows[0].end_date
      );
    }

    return payment;
  });
};

/**
 * Process refund
 */
export const processRefund = async (paymentId, reason) => {
  return transaction(async (client) => {
    const paymentResult = await client.query(
      `SELECT * FROM votteryy_election_payments WHERE payment_id = $1`,
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
      throw new Error('Cannot refund non-successful payment');
    }

    // Process refund via gateway
    if (payment.gateway_used === PAYMENT_GATEWAYS.STRIPE) {
      await createRefund(payment.payment_intent_id, parseFloat(payment.amount) * 100);
    } else {
      // Paddle refund logic
    }

    // Update payment status
    await client.query(
      `UPDATE votteryy_election_payments 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE payment_id = $2`,
      [PAYMENT_STATUS.REFUNDED, paymentId]
    );

    return payment;
  });
};

export default {
  getPaymentGateway,
  calculateProcessingFee,
  createElectionPayment,
  confirmElectionPayment,
  processRefund
};
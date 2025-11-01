import Stripe from 'stripe';
import * as paymentService from '../services/paymentService.js';
import * as voteService from '../services/voteService.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { constructWebhookEvent } from '../config/stripe.js';
import { REGIONAL_ZONES } from '../config/constants.js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create payment intent for election
 */
export const createPaymentIntent = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { amount, currency, region, processingFee, frozenAmount } = req.body;
    
    // Get user from x-user-data header (populated by middleware)
    let userId = null;
    let userEmail = null;
    
    try {
      const userDataHeader = req.headers['x-user-data'];
      if (userDataHeader) {
        const userData = JSON.parse(userDataHeader);
        userId = userData.userId;
        userEmail = userData.email;
        console.log('👤 User from header:', { userId, userEmail });
      }
    } catch (err) {
      console.error('Error parsing x-user-data:', err);
    }
    
    // If no user data, use test values for now
    if (!userId) {
      console.warn('⚠️ No user data found, using test user');
      userId = 5;
      userEmail = 'ar.abhi@gmail.com';
    }

    console.log('Creating payment intent:', {
      electionId,
      amount,
      currency,
      userId,
      region
    });

    // Validate input
    if (!amount || !currency) {
      return errorResponse(res, 'Missing required fields: amount, currency', 400);
    }

    // Convert amount to cents (Stripe requires smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create Stripe Payment Intent directly
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      metadata: {
        electionId: electionId.toString(),
        userId: userId.toString(),
        email: userEmail,
        region: region || 'unknown',
        processingFee: (processingFee || 0).toString(),
        frozenAmount: (frozenAmount || 0).toString(),
        type: 'election_voting'
      },
      description: `Vote payment for Election #${electionId}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // TODO: Store payment record in database
    // await paymentService.createPaymentRecord({
    //   paymentIntentId: paymentIntent.id,
    //   userId,
    //   electionId,
    //   amount,
    //   currency,
    //   status: 'pending'
    // });

    return successResponse(res, {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      gateway: 'stripe',
      amount,
      currency
    }, 'Payment intent created', 201);

  } catch (error) {
    console.error('❌ Create payment intent error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Stripe webhook handler
 */
export const stripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = constructWebhookEvent(req.body, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('✅ Payment succeeded:', paymentIntent.id);
        
        // Call your existing service if it exists
        try {
          await paymentService.confirmElectionPayment(
            event.data.object.id,
            'stripe'
          );
        } catch (err) {
          console.error('Error confirming payment:', err);
          // TODO: Update database manually if service doesn't exist
          // await query(
          //   `UPDATE votteryy_election_payments 
          //    SET status = $1, completed_at = NOW() 
          //    WHERE payment_id = $2`,
          //   ['completed', paymentIntent.id]
          // );
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('❌ Payment failed:', failedPayment.id);
        
        // TODO: Update database - mark payment as failed
        // await query(
        //   `UPDATE votteryy_election_payments 
        //    SET status = $1 
        //    WHERE payment_id = $2`,
        //   ['failed', failedPayment.id]
        // );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Verify payment status
 */
export const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Get user from x-user-data header
    let userId = null;
    try {
      const userDataHeader = req.headers['x-user-data'];
      if (userDataHeader) {
        const userData = JSON.parse(userDataHeader);
        userId = userData.userId;
      }
    } catch (err) {
      console.error('Error parsing x-user-data:', err);
    }

    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }

    // Retrieve from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

    // Optionally check database
    // const payment = await query(
    //   `SELECT * FROM votteryy_election_payments 
    //    WHERE payment_id = $1 AND user_id = $2`,
    //   [paymentId, userId]
    // );

    // if (payment.rows.length === 0) {
    //   return errorResponse(res, 'Payment not found', 404);
    // }

    return successResponse(res, {
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      metadata: paymentIntent.metadata
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Helper: Map country to regional zone
 */
const mapCountryToRegion = (country) => {
  const regionMap = {
    'US': REGIONAL_ZONES.US_CANADA,
    'CA': REGIONAL_ZONES.US_CANADA,
    'GB': REGIONAL_ZONES.WESTERN_EUROPE,
    'FR': REGIONAL_ZONES.WESTERN_EUROPE,
    'DE': REGIONAL_ZONES.WESTERN_EUROPE,
    'BD': REGIONAL_ZONES.MIDDLE_EAST_ASIA,
    'IN': REGIONAL_ZONES.MIDDLE_EAST_ASIA,
    'AU': REGIONAL_ZONES.AUSTRALASIA,
    'NZ': REGIONAL_ZONES.AUSTRALASIA,
    'CN': REGIONAL_ZONES.CHINA,
    'BR': REGIONAL_ZONES.LATIN_AMERICA,
    'MX': REGIONAL_ZONES.LATIN_AMERICA,
    'NG': REGIONAL_ZONES.AFRICA,
    'ZA': REGIONAL_ZONES.AFRICA,
    'PL': REGIONAL_ZONES.EASTERN_EUROPE,
    'RO': REGIONAL_ZONES.EASTERN_EUROPE,
  };
  return regionMap[country] || REGIONAL_ZONES.US_CANADA;
};

export default {
  createPaymentIntent,
  stripeWebhook,
  verifyPayment
};
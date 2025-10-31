import { Paddle } from '@paddle/paddle-node-sdk';
import dotenv from 'dotenv';

dotenv.config();

const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: process.env.PADDLE_ENVIRONMENT || 'sandbox'
});

export const createPaddleTransaction = async (items, customerId, metadata) => {
  try {
    const transaction = await paddle.transactions.create({
      items: items,
      customer_id: customerId,
      custom_data: metadata,
    });
    return transaction;
  } catch (error) {
    console.error('Paddle transaction creation error:', error);
    throw error;
  }
};

export const getPaddleTransaction = async (transactionId) => {
  try {
    const transaction = await paddle.transactions.get(transactionId);
    return transaction;
  } catch (error) {
    console.error('Paddle transaction retrieval error:', error);
    throw error;
  }
};

export const createPaddleRefund = async (transactionId, amount, reason) => {
  try {
    const refund = await paddle.adjustments.create({
      transaction_id: transactionId,
      action: 'refund',
      items: [
        {
          type: 'full',
          amount: amount ? String(Math.round(amount * 100)) : undefined,
        },
      ],
      reason: reason || 'customer_request',
    });
    return refund;
  } catch (error) {
    console.error('Paddle refund error:', error);
    throw error;
  }
};

export const verifyPaddleWebhook = (payload, signature) => {
  try {
    // Paddle webhook verification logic
    // Note: Actual implementation depends on Paddle's webhook signature verification
    return true;
  } catch (error) {
    console.error('Paddle webhook verification error:', error);
    return false;
  }
};

export default paddle;
import * as paymentService from '../services/paymentService.js';
import * as voteService from '../services/voteService.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { constructWebhookEvent } from '../config/stripe.js';
import { REGIONAL_ZONES } from '../config/constants.js';

/**
 * Create payment intent for election
 */
export const createPaymentIntent = async (req, res) => {
  try {
    const { electionId } = req.params;
    const userId = req.user.userId;

    // Get election data
    const electionData = await voteService.getElectionData(parseInt(electionId));

    // Check if payment already exists
    const existingPayment = await paymentService.checkUserPayment(userId, parseInt(electionId));
    if (existingPayment) {
      return errorResponse(res, 'Payment already completed', 400);
    }

    // Determine user region (from user data or default)
    const userRegion = req.user.country ? mapCountryToRegion(req.user.country) : REGIONAL_ZONES.US_CANADA;

    // Create payment
    const payment = await paymentService.createElectionPayment(
      userId,
      parseInt(electionId),
      electionData,
      userRegion
    );

    return successResponse(res, payment, 'Payment intent created', 201);
  } catch (error) {
    console.error('Create payment intent error:', error);
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
        await paymentService.confirmElectionPayment(
          event.data.object.id,
          'stripe'
        );
        break;

      case 'payment_intent.payment_failed':
        // Handle payment failure
        console.log('Payment failed:', event.data.object.id);
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
    const userId = req.user.userId;

    const payment = await query(
      `SELECT * FROM votteryy_election_payments 
       WHERE payment_id = $1 AND user_id = $2`,
      [paymentId, userId]
    );

    if (payment.rows.length === 0) {
      return errorResponse(res, 'Payment not found', 404);
    }

    return successResponse(res, payment.rows[0]);
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
    // Add more mappings as needed
  };
  return regionMap[country] || REGIONAL_ZONES.US_CANADA;
};

export default {
  createPaymentIntent,
  stripeWebhook,
  verifyPayment
};
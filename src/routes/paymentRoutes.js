import express from 'express';
import { param } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import * as paymentController from '../controllers/paymentController.js';

const router = express.Router();

// Create payment intent
router.post(
  '/election/:electionId/create-intent',
  extractUserData,
  requireAuth,
  [param('electionId').isInt(), validate],
  paymentController.createPaymentIntent
);

// Stripe webhook (no auth)
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.stripeWebhook
);

// Verify payment
router.get(
  '/verify/:paymentId',
  extractUserData,
  requireAuth,
  [param('paymentId').isUUID(), validate],
  paymentController.verifyPayment
);

export default router;
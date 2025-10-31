import express from 'express';
import { body, param } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roleCheck.js';
import { validate } from '../middleware/validation.js';
import * as walletController from '../controllers/walletController.js';

const router = express.Router();

// Get balance
router.get(
  '/balance',
  extractUserData,
  requireAuth,
  walletController.getBalance
);

// Get transaction history
router.get(
  '/transactions',
  extractUserData,
  requireAuth,
  walletController.getTransactionHistory
);

// Request withdrawal
router.post(
  '/withdraw',
  extractUserData,
  requireAuth,
  [
    body('amount').isFloat({ min: 1 }).withMessage('Valid amount required'),
    body('paymentMethod').isString().withMessage('Payment method required'),
    body('paymentDetails').isObject().withMessage('Payment details required'),
    validate
  ],
  walletController.requestWithdrawal
);

// Admin: Get withdrawal requests
router.get(
  '/withdrawals',
  extractUserData,
  requireAuth,
  isAdmin,
  walletController.getWithdrawalRequests
);

// Admin: Approve withdrawal
router.post(
  '/withdrawals/:requestId/approve',
  extractUserData,
  requireAuth,
  isAdmin,
  [param('requestId').isUUID(), validate],
  walletController.approveWithdrawal
);

// Admin: Reject withdrawal
router.post(
  '/withdrawals/:requestId/reject',
  extractUserData,
  requireAuth,
  isAdmin,
  [
    param('requestId').isUUID(),
    body('notes').notEmpty().withMessage('Rejection reason required'),
    validate
  ],
  walletController.rejectWithdrawal
);

export default router;

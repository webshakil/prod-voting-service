import express from 'express';
import { param } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roleCheck.js';
import { validate } from '../middleware/validation.js';
import * as lotteryController from '../controllers/lotteryController.js';

const router = express.Router();

// Get user's lottery tickets
router.get(
  '/tickets',
  extractUserData,
  requireAuth,
  lotteryController.getMyTickets
);

// Get lottery statistics
router.get(
  '/:electionId/stats',
  [param('electionId').isInt(), validate],
  lotteryController.getLotteryStats
);

// Get winners
router.get(
  '/:electionId/winners',
  [param('electionId').isInt(), validate],
  lotteryController.getWinners
);

// Run lottery draw (Admin)
router.post(
  '/:electionId/draw',
  extractUserData,
  requireAuth,
  isAdmin,
  [param('electionId').isInt(), validate],
  lotteryController.runLotteryDraw
);

// Claim prize
router.post(
  '/claim/:winnerId',
  extractUserData,
  requireAuth,
  [param('winnerId').isUUID(), validate],
  lotteryController.claimPrize
);

export default router;

import express from 'express';
import { body, param } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import * as voteController from '../controllers/voteController.js';
import { voteRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Cast vote
router.post(
  '/submit',
  extractUserData,
  voteRateLimiter,
  requireAuth,
  [
    body('electionId').isInt().withMessage('Valid election ID required'),
    body('answers').isObject().withMessage('Answers must be an object'),
    validate
  ],
  voteController.castVote
);

// Edit vote
router.put(
  '/edit',
  extractUserData,
  requireAuth,
  [
    body('electionId').isInt().withMessage('Valid election ID required'),
    body('answers').isObject().withMessage('Answers must be an object'),
    validate
  ],
  voteController.editVote
);

// Get my vote for an election
router.get(
  '/my-vote/:electionId',
  extractUserData,
  requireAuth,
  [param('electionId').isInt(), validate],
  voteController.getMyVote
);

// Get voting history
router.get(
  '/history',
  extractUserData,
  requireAuth,
  voteController.getVotingHistory
);

// Verify receipt
router.get(
  '/verify/:receiptId',
  [param('receiptId').isUUID(), validate],
  voteController.verifyReceipt
);

// Get election results
router.get(
  '/results/:electionId',
  [param('electionId').isInt(), validate],
  voteController.getElectionResults
);

export default router;

// src/routes/votingRoutes.js
// This handles /api/voting/elections/:electionId/* routes
import express from 'express';
import { body, param, query } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import * as votingController from '../controllers/votingController.js';

const router = express.Router();

// ✅ Get election ballot (includes hasVoted check)
router.get(
  '/elections/:electionId/ballot',
  extractUserData,
  [param('electionId').isInt(), validate],
  votingController.getElectionBallot
);

// ✅ Cast vote for election
router.post(
  '/elections/:electionId/vote',
  extractUserData,
  [
    param('electionId').isInt(),
    body('answers').isObject().withMessage('Answers must be an object'),
    validate
  ],
  votingController.castElectionVote
);

// ✅ Get user's vote for election
router.get(
  '/elections/:electionId/my-vote',
  extractUserData,
  [param('electionId').isInt(), validate],
  votingController.getMyElectionVote
);

// ✅ Update video progress
router.post(
  '/elections/:electionId/video-progress',
  extractUserData,
  [
    param('electionId').isInt(),
    body('watchPercentage').isFloat({ min: 0, max: 100 }),
    body('lastPosition').optional().isInt({ min: 0 }),
    body('totalDuration').optional().isInt({ min: 1 }),
    validate
  ],
  votingController.updateVideoProgress
);

// ✅ Record abstention
router.post(
  '/elections/:electionId/abstain',
  extractUserData,
  [
    param('electionId').isInt(),
    body('questionId').optional(),
    body('reason').optional().isString(),
    validate
  ],
  votingController.recordAbstention
);

// ✅ Get live results
router.get(
  '/elections/:electionId/live-results',
  [param('electionId').isInt(), validate],
  votingController.getLiveResults
);

// ✅ Get audit logs for election
router.get(
  '/elections/:electionId/audit-logs',
  extractUserData,
  [
    param('electionId').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate
  ],
  votingController.getElectionAuditLogs
);

// ✅ Get voting history
router.get(
  '/history',
  extractUserData,
  votingController.getVotingHistory
);

export default router;

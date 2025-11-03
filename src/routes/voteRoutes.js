import express from 'express';
import { body, param,query } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import * as voteController from '../controllers/voteController.js';
import { voteRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Cast vote
router.post(
  '/submit',
  voteRateLimiter,
  [
    body('userId').notEmpty().withMessage('User ID is required'), // 🔥 ADD THIS
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
  //extractUserData,
  //requireAuth,
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

//new routes for audit trail
router.get(
  '/audit-trail',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('actionType').optional().isString(),
    query('electionId').optional().isInt(),
    validate
  ],
  voteController.getAuditTrail
);

// Get audit statistics
router.get(
  '/audit-stats',
  voteController.getAuditStats
);

// Get hash chain for election (blockchain-style verification)
router.get(
  '/hash-chain/:electionId',
  [param('electionId').isInt(), validate],
  voteController.getHashChain
);
router.get(
  '/public-bulletin/:electionId',
  [param('electionId').isInt(), validate],
  voteController.getPublicBulletinBoard
);
export default router;
// import express from 'express';
// import { body, param } from 'express-validator';
// import { extractUserData, requireAuth } from '../middleware/auth.js';
// import { validate } from '../middleware/validation.js';
// import * as voteController from '../controllers/voteController.js';
// import { voteRateLimiter } from '../middleware/rateLimiter.js';

// const router = express.Router();

// // Cast vote
// router.post(
//   '/submit',
//   //extractUserData,
//   voteRateLimiter,
//   //requireAuth,
//   [
//     body('electionId').isInt().withMessage('Valid election ID required'),
//     body('answers').isObject().withMessage('Answers must be an object'),
//     validate
//   ],
//   voteController.castVote
// );

// // Edit vote
// router.put(
//   '/edit',
//   extractUserData,
//   requireAuth,
//   [
//     body('electionId').isInt().withMessage('Valid election ID required'),
//     body('answers').isObject().withMessage('Answers must be an object'),
//     validate
//   ],
//   voteController.editVote
// );

// // Get my vote for an election
// router.get(
//   '/my-vote/:electionId',
//   extractUserData,
//   requireAuth,
//   [param('electionId').isInt(), validate],
//   voteController.getMyVote
// );

// // Get voting history
// router.get(
//   '/history',
//   extractUserData,
//   requireAuth,
//   voteController.getVotingHistory
// );

// // Verify receipt
// router.get(
//   '/verify/:receiptId',
//   [param('receiptId').isUUID(), validate],
//   voteController.verifyReceipt
// );

// // Get election results
// router.get(
//   '/results/:electionId',
//   [param('electionId').isInt(), validate],
//   voteController.getElectionResults
// );

// export default router;

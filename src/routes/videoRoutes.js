import express from 'express';
import { body, param } from 'express-validator';
import { extractUserData, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import * as videoController from '../controllers/videoController.js';

const router = express.Router();

// Update watch progress
router.post(
  '/:electionId/progress',
  extractUserData,
  requireAuth,
  [
    param('electionId').isInt(),
    body('watchPercentage').isFloat({ min: 0, max: 100 }),
    body('lastPosition').isInt({ min: 0 }),
    body('totalDuration').isInt({ min: 1 }),
    validate
  ],
  videoController.updateWatchProgress
);

// Get watch progress
router.get(
  '/:electionId/progress',
  extractUserData,
  requireAuth,
  [param('electionId').isInt(), validate],
  videoController.getWatchProgress
);

export default router;
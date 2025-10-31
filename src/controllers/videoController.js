import { query } from '../config/database.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { AUDIT_ACTIONS } from '../config/constants.js';

/**
 * Update video watch progress
 */
export const updateWatchProgress = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { watchPercentage, lastPosition, totalDuration } = req.body;
    const userId = req.user.userId;

    const completed = watchPercentage >= 80; // 80% threshold

    // Upsert progress
    const result = await query(
      `INSERT INTO votteryy_video_watch_progress 
       (user_id, election_id, watch_percentage, last_position, total_duration, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, election_id)
       DO UPDATE SET 
         watch_percentage = $3,
         last_position = $4,
         total_duration = $5,
         completed = $6,
         completed_at = CASE WHEN $6 = true THEN CURRENT_TIMESTAMP ELSE votteryy_video_watch_progress.completed_at END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        parseInt(electionId),
        parseFloat(watchPercentage),
        parseInt(lastPosition),
        parseInt(totalDuration),
        completed,
        completed ? new Date() : null
      ]
    );

    // Log video completion
    if (completed) {
      await query(
        `INSERT INTO votteryy_vote_audit_logs 
         (action_type, user_id, election_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          AUDIT_ACTIONS.VIDEO_COMPLETED,
          userId,
          parseInt(electionId),
          JSON.stringify({ watchPercentage, totalDuration })
        ]
      );
    }

    return successResponse(res, result.rows[0]);
  } catch (error) {
    console.error('Update watch progress error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get video watch progress
 */
export const getWatchProgress = async (req, res) => {
  try {
    const { electionId } = req.params;
    const userId = req.user.userId;

    const result = await query(
      `SELECT * FROM votteryy_video_watch_progress 
       WHERE user_id = $1 AND election_id = $2`,
      [userId, parseInt(electionId)]
    );

    if (result.rows.length === 0) {
      return successResponse(res, {
        watchPercentage: 0,
        completed: false,
        lastPosition: 0
      });
    }

    return successResponse(res, result.rows[0]);
  } catch (error) {
    console.error('Get watch progress error:', error);
    return errorResponse(res, error.message, 500);
  }
};

export default {
  updateWatchProgress,
  getWatchProgress
};
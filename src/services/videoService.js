import { query, transaction } from '../config/database.js';
import { AUDIT_ACTIONS } from '../config/constants.js';

/**
 * Video Watch Service
 * Handles video watch progress tracking and verification
 */

/**
 * Get video watch progress for user and election
 */
export const getWatchProgress = async (userId, electionId) => {
  const result = await query(
    `SELECT * FROM votteryy_video_watch_progress 
     WHERE user_id = $1 AND election_id = $2`,
    [userId, electionId]
  );

  if (result.rows.length === 0) {
    return {
      watchPercentage: 0,
      lastPosition: 0,
      completed: false,
      totalDuration: null
    };
  }

  return result.rows[0];
};

/**
 * Update watch progress
 */
export const updateWatchProgress = async (
  userId,
  electionId,
  watchPercentage,
  lastPosition,
  totalDuration
) => {
  return transaction(async (client) => {
    // Determine if completed (80% threshold by default)
    const completionThreshold = parseFloat(process.env.VIDEO_COMPLETION_THRESHOLD) || 80;
    const completed = watchPercentage >= completionThreshold;

    // Upsert progress
    const result = await client.query(
      `INSERT INTO votteryy_video_watch_progress 
       (user_id, election_id, watch_percentage, last_position, total_duration, 
        completed, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, election_id)
       DO UPDATE SET 
         watch_percentage = GREATEST(votteryy_video_watch_progress.watch_percentage, $3),
         last_position = $4,
         total_duration = $5,
         completed = CASE 
           WHEN votteryy_video_watch_progress.completed = true THEN true 
           ELSE $6 
         END,
         completed_at = CASE 
           WHEN votteryy_video_watch_progress.completed = true THEN votteryy_video_watch_progress.completed_at
           WHEN $6 = true THEN CURRENT_TIMESTAMP 
           ELSE NULL 
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        electionId,
        parseFloat(watchPercentage),
        parseInt(lastPosition),
        parseInt(totalDuration),
        completed,
        completed ? new Date() : null
      ]
    );

    // Log completion to audit trail
    if (completed) {
      const existingLog = await client.query(
        `SELECT id FROM votteryy_vote_audit_logs 
         WHERE user_id = $1 AND election_id = $2 AND action_type = $3`,
        [userId, electionId, AUDIT_ACTIONS.VIDEO_COMPLETED]
      );

      if (existingLog.rows.length === 0) {
        await client.query(
          `INSERT INTO votteryy_vote_audit_logs 
           (action_type, user_id, election_id, details)
           VALUES ($1, $2, $3, $4)`,
          [
            AUDIT_ACTIONS.VIDEO_COMPLETED,
            userId,
            electionId,
            JSON.stringify({
              watchPercentage: parseFloat(watchPercentage),
              totalDuration: parseInt(totalDuration),
              completedAt: new Date().toISOString()
            })
          ]
        );
      }
    }

    return result.rows[0];
  });
};

/**
 * Check if video watch requirement is met
 */
export const isWatchRequirementMet = async (userId, electionId) => {
  const progress = await getWatchProgress(userId, electionId);
  return progress.completed === true;
};

/**
 * Get video watch statistics for election
 */
export const getElectionWatchStats = async (electionId) => {
  const result = await query(
    `SELECT 
       COUNT(*) as total_viewers,
       COUNT(*) FILTER (WHERE completed = true) as completed_viewers,
       AVG(watch_percentage) as avg_watch_percentage,
       AVG(CASE WHEN completed = true THEN 
         EXTRACT(EPOCH FROM (completed_at - started_at)) 
       END) as avg_completion_time_seconds
     FROM votteryy_video_watch_progress
     WHERE election_id = $1`,
    [electionId]
  );

  const stats = result.rows[0];

  return {
    totalViewers: parseInt(stats.total_viewers) || 0,
    completedViewers: parseInt(stats.completed_viewers) || 0,
    avgWatchPercentage: parseFloat(stats.avg_watch_percentage) || 0,
    avgCompletionTime: parseFloat(stats.avg_completion_time_seconds) || 0,
    completionRate: stats.total_viewers > 0 
      ? ((stats.completed_viewers / stats.total_viewers) * 100).toFixed(2)
      : 0
  };
};

/**
 * Get watch progress for multiple users (admin)
 */
export const getBulkWatchProgress = async (electionId, page = 1, limit = 50) => {
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT * FROM votteryy_video_watch_progress
     WHERE election_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [electionId, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_video_watch_progress
     WHERE election_id = $1`,
    [electionId]
  );

  return {
    progress: result.rows,
    total: parseInt(countResult.rows[0].total)
  };
};

/**
 * Reset watch progress (admin only)
 */
export const resetWatchProgress = async (userId, electionId) => {
  const result = await query(
    `UPDATE votteryy_video_watch_progress
     SET watch_percentage = 0,
         last_position = 0,
         completed = false,
         completed_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND election_id = $2
     RETURNING *`,
    [userId, electionId]
  );

  return result.rows[0];
};

/**
 * Delete watch progress
 */
export const deleteWatchProgress = async (userId, electionId) => {
  await query(
    `DELETE FROM votteryy_video_watch_progress
     WHERE user_id = $1 AND election_id = $2`,
    [userId, electionId]
  );

  return { success: true };
};

/**
 * Get users who haven't completed video
 */
export const getIncompleteViewers = async (electionId) => {
  const result = await query(
    `SELECT user_id, watch_percentage, last_position, started_at, updated_at
     FROM votteryy_video_watch_progress
     WHERE election_id = $1 AND completed = false
     ORDER BY updated_at DESC`,
    [electionId]
  );

  return result.rows;
};

/**
 * Track video start (first time user starts watching)
 */
export const trackVideoStart = async (userId, electionId, videoUrl) => {
  return transaction(async (client) => {
    // Check if already started
    const existing = await client.query(
      `SELECT id FROM votteryy_video_watch_progress
       WHERE user_id = $1 AND election_id = $2`,
      [userId, electionId]
    );

    if (existing.rows.length === 0) {
      // Create initial record
      await client.query(
        `INSERT INTO votteryy_video_watch_progress
         (user_id, election_id, watch_percentage, last_position, completed)
         VALUES ($1, $2, 0, 0, false)`,
        [userId, electionId]
      );

      // Log to audit trail
      await client.query(
        `INSERT INTO votteryy_vote_audit_logs
         (action_type, user_id, election_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          AUDIT_ACTIONS.VIDEO_STARTED,
          userId,
          electionId,
          JSON.stringify({
            videoUrl,
            startedAt: new Date().toISOString()
          })
        ]
      );
    }

    return { success: true };
  });
};

/**
 * Get watch leaderboard (users who watched most)
 */
export const getWatchLeaderboard = async (electionId, limit = 10) => {
  const result = await query(
    `SELECT user_id, watch_percentage, completed, completed_at
     FROM votteryy_video_watch_progress
     WHERE election_id = $1
     ORDER BY watch_percentage DESC, completed_at ASC
     LIMIT $2`,
    [electionId, limit]
  );

  return result.rows;
};

/**
 * Validate video URL format
 */
export const validateVideoUrl = (url) => {
  if (!url) return { valid: false, error: 'Video URL is required' };

  // YouTube URL validation
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}(&.*)?$/;
  
  if (youtubeRegex.test(url)) {
    return { valid: true, platform: 'youtube' };
  }

  // Vimeo URL validation
  const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/;
  
  if (vimeoRegex.test(url)) {
    return { valid: true, platform: 'vimeo' };
  }

  return { valid: false, error: 'Invalid video URL format. Supported: YouTube, Vimeo' };
};

/**
 * Extract video ID from URL
 */
export const extractVideoId = (url) => {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (youtubeMatch) {
    return { platform: 'youtube', videoId: youtubeMatch[1] };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { platform: 'vimeo', videoId: vimeoMatch[1] };
  }

  return null;
};

export default {
  getWatchProgress,
  updateWatchProgress,
  isWatchRequirementMet,
  getElectionWatchStats,
  getBulkWatchProgress,
  resetWatchProgress,
  deleteWatchProgress,
  getIncompleteViewers,
  trackVideoStart,
  getWatchLeaderboard,
  validateVideoUrl,
  extractVideoId
};
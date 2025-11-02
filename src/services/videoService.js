// src/services/voteService.js
import pool from '../config/database.js';
import axios from 'axios';
import crypto from 'crypto';

const ELECTION_SERVICE_URL = process.env.ELECTION_SERVICE_URL || 'http://localhost:3005/api';

/**
 * Get election data from Election Service
 */
export const getElectionData = async (electionId) => {
  try {
    console.log('📥 Fetching election data for ID:', electionId);
    console.log('🔗 Election Service URL:', ELECTION_SERVICE_URL);
    
    const fullUrl = `${ELECTION_SERVICE_URL}/elections/${electionId}`;
    console.log('🔗 Full URL:', fullUrl);
    
    // Call Election Service API
    const response = await axios.get(fullUrl);
    
    // Handle different response structures
    const electionData = response.data?.data?.election || 
                        response.data?.election || 
                        response.data?.data || 
                        response.data;
    
    if (!electionData || !electionData.id) {
      throw new Error('Election not found');
    }
    
    console.log('✅ Election data fetched:', electionData.title);
    
    // Process and return election with parsed config
    return {
      ...electionData,
      lottery_config: electionData.lottery_config ? 
        (typeof electionData.lottery_config === 'string' ? 
          JSON.parse(electionData.lottery_config) : 
          electionData.lottery_config) : 
        null,
      is_free: Boolean(electionData.is_free),
      is_lotterized: Boolean(electionData.is_lotterized),
      video_required: Boolean(electionData.video_required),
    };
  } catch (error) {
    console.error('❌ Error fetching election data:', error.message);
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Election service not available at ${ELECTION_SERVICE_URL}`);
    }
    throw new Error(`Failed to get election data: ${error.message}`);
  }
};

/**
 * Validate voting eligibility
 */
/**
 * Validate voting eligibility
 */
export const validateVotingEligibility = async (userId, electionId, electionData) => {
  const errors = [];
  
  try {
    // Check if election is active
    if (electionData.status !== 'published' && electionData.status !== 'active') {
      errors.push(`Election is ${electionData.status}`);
    }
    
    // Check dates
    const now = new Date();
    const startDate = new Date(electionData.start_date);
    const endDate = new Date(electionData.end_date);
    
    if (now < startDate) {
      errors.push('Election has not started yet');
    }
    
    if (now > endDate) {
      errors.push('Election has ended');
    }
    
    // 🔥 FIX: Check if user already voted - don't destructure, use result.rows
    const result = await pool.query(
      `SELECT id FROM votteryy_votes 
       WHERE user_id = $1 AND election_id = $2 AND status = 'valid'`,
      [String(userId), electionId]
    );
    
    // 🔥 Use result.rows instead of destructuring
    if (result.rows.length > 0) {
      errors.push('You have already voted in this election');
    }
    
    console.log('✅ Validation complete:', { userId, electionId, errorsCount: errors.length });
    
    return errors;
  } catch (error) {
    console.error('❌ Error validating eligibility:', error);
    throw error;
  }
};

/**
 * Cast a new vote
 */
export const castVote = async (userId, electionId, answers, ipAddress, userAgent) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Generate vote ID and hash
    const votingId = generateUUID();
    const voteHash = generateVoteHash(userId, electionId, answers);
    
    // Encrypt vote data
    const encryptedVote = JSON.stringify({
      userId,
      electionId,
      answers,
      timestamp: new Date().toISOString()
    });
    
    console.log('📝 Inserting vote into database...');
    
    // Insert vote
    const voteResult = await client.query(
      `INSERT INTO votteryy_votes 
       (voting_id, user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'valid')
       RETURNING *`,
      [
        votingId, 
        String(userId), 
        electionId, 
        JSON.stringify(answers), 
        encryptedVote, 
        voteHash, 
        ipAddress || null, 
        userAgent || null
      ]
    );
    
    const vote = voteResult.rows[0];
    console.log('✅ Vote inserted with ID:', vote.id);
    
    // Create receipt
    const receiptId = generateUUID();
    const verificationCode = generateVerificationCode();
    
    await client.query(
      `INSERT INTO votteryy_vote_receipts 
       (voting_id, receipt_id, vote_hash, election_id, user_id, verification_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [votingId, receiptId, voteHash, electionId, String(userId), verificationCode]
    );
    
    console.log('✅ Receipt created:', receiptId);
    
    // Log audit trail
    await client.query(
      `INSERT INTO votteryy_vote_audit_logs 
       (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'vote_cast', 
        String(userId), 
        electionId, 
        vote.id, 
        votingId, 
        ipAddress || null, 
        userAgent || null, 
        JSON.stringify({ answers })
      ]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Vote cast successfully:', votingId);
    
    return {
      votingId,
      receiptId,
      voteHash,
      timestamp: vote.created_at,
      voting_id: votingId,
      receipt_id: receiptId,
      vote_hash: voteHash
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error casting vote:', error);
    console.error('❌ Error details:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get user's vote for an election
 */
export const getUserVote = async (userId, electionId) => {
  try {
    const result = await pool.query(
      `SELECT v.*, r.receipt_id, r.verification_code
       FROM votteryy_votes v
       LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
       WHERE v.user_id = $1 AND v.election_id = $2 AND v.status = 'valid'
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [String(userId), electionId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error getting user vote:', error);
    throw error;
  }
};

/**
 * Get user's voting history
 */
export const getUserVotingHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM votteryy_votes WHERE user_id = $1 AND status = $2',
      [String(userId), 'valid']
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Get votes with receipts and lottery info
    const result = await pool.query(
      `SELECT 
        v.*,
        r.receipt_id,
        r.verification_code,
        l.ticket_number as lottery_ticket_number,
        l.ball_number
       FROM votteryy_votes v
       LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
       LEFT JOIN votteryy_lottery_tickets l ON v.voting_id = l.voting_id
       WHERE v.user_id = $1 AND v.status = $2
       ORDER BY v.created_at DESC
       LIMIT $3 OFFSET $4`,
      [String(userId), 'valid', limit, offset]
    );
    
    // Get election titles from election service
    const votesWithTitles = await Promise.all(
      result.rows.map(async (vote) => {
        try {
          const electionData = await getElectionData(vote.election_id);
          return {
            ...vote,
            election_title: electionData.title
          };
        } catch (error) {
          return {
            ...vote,
            election_title: `Election #${vote.election_id}`
          };
        }
      })
    );
    
    return {
      votes: votesWithTitles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    };
  } catch (error) {
    console.error('❌ Error getting voting history:', error);
    throw error;
  }
};

/**
 * Verify vote receipt
 */
export const verifyReceipt = async (receiptId) => {
  try {
    const result = await pool.query(
      `SELECT r.*, v.vote_hash, v.status, v.created_at as vote_timestamp
       FROM votteryy_vote_receipts r
       JOIN votteryy_votes v ON r.voting_id = v.voting_id
       WHERE r.receipt_id = $1`,
      [receiptId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error verifying receipt:', error);
    throw error;
  }
};

/**
 * Get election results
 */
export const getElectionResults = async (electionId) => {
  try {
    // Get vote counts per option
    const result = await pool.query(
      `SELECT 
        jsonb_object_keys(answers) as question_id,
        jsonb_array_elements_text(answers->jsonb_object_keys(answers)) as option_id,
        COUNT(*) as vote_count
       FROM votteryy_votes
       WHERE election_id = $1 AND status = 'valid'
       GROUP BY question_id, option_id
       ORDER BY question_id, vote_count DESC`,
      [electionId]
    );
    
    // Get total votes
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM votteryy_votes WHERE election_id = $1 AND status = $2',
      [electionId, 'valid']
    );
    
    return {
      results: result.rows,
      totalVotes: parseInt(totalResult.rows[0].total)
    };
  } catch (error) {
    console.error('❌ Error getting election results:', error);
    throw error;
  }
};

/**
 * Edit existing vote
 */
export const editVote = async (userId, electionId, answers, ipAddress, userAgent) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get existing vote
    const existingResult = await client.query(
      'SELECT * FROM votteryy_votes WHERE user_id = $1 AND election_id = $2 AND status = $3',
      [String(userId), electionId, 'valid']
    );
    
    if (existingResult.rows.length === 0) {
      throw new Error('No existing vote found');
    }
    
    const oldVote = existingResult.rows[0];
    
    // Mark old vote as edited
    await client.query(
      'UPDATE votteryy_votes SET status = $1, is_edited = $2 WHERE id = $3',
      ['edited', true, oldVote.id]
    );
    
    // Create new vote
    const votingId = generateUUID();
    const voteHash = generateVoteHash(userId, electionId, answers);
    const encryptedVote = JSON.stringify({ userId, electionId, answers, timestamp: new Date().toISOString() });
    
    const newVoteResult = await client.query(
      `INSERT INTO votteryy_votes 
       (voting_id, user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status, is_edited, original_vote_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'valid', true, $9)
       RETURNING *`,
      [votingId, String(userId), electionId, JSON.stringify(answers), encryptedVote, voteHash, ipAddress, userAgent, oldVote.id]
    );
    
    // Log audit
    await client.query(
      `INSERT INTO votteryy_vote_audit_logs 
       (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ['vote_edited', String(userId), electionId, newVoteResult.rows[0].id, votingId, ipAddress, userAgent, JSON.stringify({ oldVoteId: oldVote.id, newAnswers: answers })]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Vote edited successfully:', votingId);
    
    return {
      votingId,
      voteHash,
      timestamp: newVoteResult.rows[0].created_at
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error editing vote:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Helper functions
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateVoteHash(userId, electionId, answers) {
  const data = `${userId}-${electionId}-${JSON.stringify(answers)}-${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

export default {
  getElectionData,
  validateVotingEligibility,
  castVote,
  getUserVote,
  getUserVotingHistory,
  verifyReceipt,
  getElectionResults,
  editVote
};
// import { query, transaction } from '../config/database.js';
// import { AUDIT_ACTIONS } from '../config/constants.js';

// /**
//  * Video Watch Service
//  * Handles video watch progress tracking and verification
//  */

// /**
//  * Get video watch progress for user and election
//  */
// export const getWatchProgress = async (userId, electionId) => {
//   const result = await query(
//     `SELECT * FROM votteryy_video_watch_progress 
//      WHERE user_id = $1 AND election_id = $2`,
//     [userId, electionId]
//   );

//   if (result.rows.length === 0) {
//     return {
//       watchPercentage: 0,
//       lastPosition: 0,
//       completed: false,
//       totalDuration: null
//     };
//   }

//   return result.rows[0];
// };

// /**
//  * Update watch progress
//  */
// export const updateWatchProgress = async (
//   userId,
//   electionId,
//   watchPercentage,
//   lastPosition,
//   totalDuration
// ) => {
//   return transaction(async (client) => {
//     // Determine if completed (80% threshold by default)
//     const completionThreshold = parseFloat(process.env.VIDEO_COMPLETION_THRESHOLD) || 80;
//     const completed = watchPercentage >= completionThreshold;

//     // Upsert progress
//     const result = await client.query(
//       `INSERT INTO votteryy_video_watch_progress 
//        (user_id, election_id, watch_percentage, last_position, total_duration, 
//         completed, completed_at, updated_at)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
//        ON CONFLICT (user_id, election_id)
//        DO UPDATE SET 
//          watch_percentage = GREATEST(votteryy_video_watch_progress.watch_percentage, $3),
//          last_position = $4,
//          total_duration = $5,
//          completed = CASE 
//            WHEN votteryy_video_watch_progress.completed = true THEN true 
//            ELSE $6 
//          END,
//          completed_at = CASE 
//            WHEN votteryy_video_watch_progress.completed = true THEN votteryy_video_watch_progress.completed_at
//            WHEN $6 = true THEN CURRENT_TIMESTAMP 
//            ELSE NULL 
//          END,
//          updated_at = CURRENT_TIMESTAMP
//        RETURNING *`,
//       [
//         userId,
//         electionId,
//         parseFloat(watchPercentage),
//         parseInt(lastPosition),
//         parseInt(totalDuration),
//         completed,
//         completed ? new Date() : null
//       ]
//     );

//     // Log completion to audit trail
//     if (completed) {
//       const existingLog = await client.query(
//         `SELECT id FROM votteryy_vote_audit_logs 
//          WHERE user_id = $1 AND election_id = $2 AND action_type = $3`,
//         [userId, electionId, AUDIT_ACTIONS.VIDEO_COMPLETED]
//       );

//       if (existingLog.rows.length === 0) {
//         await client.query(
//           `INSERT INTO votteryy_vote_audit_logs 
//            (action_type, user_id, election_id, details)
//            VALUES ($1, $2, $3, $4)`,
//           [
//             AUDIT_ACTIONS.VIDEO_COMPLETED,
//             userId,
//             electionId,
//             JSON.stringify({
//               watchPercentage: parseFloat(watchPercentage),
//               totalDuration: parseInt(totalDuration),
//               completedAt: new Date().toISOString()
//             })
//           ]
//         );
//       }
//     }

//     return result.rows[0];
//   });
// };

// /**
//  * Check if video watch requirement is met
//  */
// export const isWatchRequirementMet = async (userId, electionId) => {
//   const progress = await getWatchProgress(userId, electionId);
//   return progress.completed === true;
// };

// /**
//  * Get video watch statistics for election
//  */
// export const getElectionWatchStats = async (electionId) => {
//   const result = await query(
//     `SELECT 
//        COUNT(*) as total_viewers,
//        COUNT(*) FILTER (WHERE completed = true) as completed_viewers,
//        AVG(watch_percentage) as avg_watch_percentage,
//        AVG(CASE WHEN completed = true THEN 
//          EXTRACT(EPOCH FROM (completed_at - started_at)) 
//        END) as avg_completion_time_seconds
//      FROM votteryy_video_watch_progress
//      WHERE election_id = $1`,
//     [electionId]
//   );

//   const stats = result.rows[0];

//   return {
//     totalViewers: parseInt(stats.total_viewers) || 0,
//     completedViewers: parseInt(stats.completed_viewers) || 0,
//     avgWatchPercentage: parseFloat(stats.avg_watch_percentage) || 0,
//     avgCompletionTime: parseFloat(stats.avg_completion_time_seconds) || 0,
//     completionRate: stats.total_viewers > 0 
//       ? ((stats.completed_viewers / stats.total_viewers) * 100).toFixed(2)
//       : 0
//   };
// };

// /**
//  * Get watch progress for multiple users (admin)
//  */
// export const getBulkWatchProgress = async (electionId, page = 1, limit = 50) => {
//   const offset = (page - 1) * limit;

//   const result = await query(
//     `SELECT * FROM votteryy_video_watch_progress
//      WHERE election_id = $1
//      ORDER BY updated_at DESC
//      LIMIT $2 OFFSET $3`,
//     [electionId, limit, offset]
//   );

//   const countResult = await query(
//     `SELECT COUNT(*) as total FROM votteryy_video_watch_progress
//      WHERE election_id = $1`,
//     [electionId]
//   );

//   return {
//     progress: result.rows,
//     total: parseInt(countResult.rows[0].total)
//   };
// };

// /**
//  * Reset watch progress (admin only)
//  */
// export const resetWatchProgress = async (userId, electionId) => {
//   const result = await query(
//     `UPDATE votteryy_video_watch_progress
//      SET watch_percentage = 0,
//          last_position = 0,
//          completed = false,
//          completed_at = NULL,
//          updated_at = CURRENT_TIMESTAMP
//      WHERE user_id = $1 AND election_id = $2
//      RETURNING *`,
//     [userId, electionId]
//   );

//   return result.rows[0];
// };

// /**
//  * Delete watch progress
//  */
// export const deleteWatchProgress = async (userId, electionId) => {
//   await query(
//     `DELETE FROM votteryy_video_watch_progress
//      WHERE user_id = $1 AND election_id = $2`,
//     [userId, electionId]
//   );

//   return { success: true };
// };

// /**
//  * Get users who haven't completed video
//  */
// export const getIncompleteViewers = async (electionId) => {
//   const result = await query(
//     `SELECT user_id, watch_percentage, last_position, started_at, updated_at
//      FROM votteryy_video_watch_progress
//      WHERE election_id = $1 AND completed = false
//      ORDER BY updated_at DESC`,
//     [electionId]
//   );

//   return result.rows;
// };

// /**
//  * Track video start (first time user starts watching)
//  */
// export const trackVideoStart = async (userId, electionId, videoUrl) => {
//   return transaction(async (client) => {
//     // Check if already started
//     const existing = await client.query(
//       `SELECT id FROM votteryy_video_watch_progress
//        WHERE user_id = $1 AND election_id = $2`,
//       [userId, electionId]
//     );

//     if (existing.rows.length === 0) {
//       // Create initial record
//       await client.query(
//         `INSERT INTO votteryy_video_watch_progress
//          (user_id, election_id, watch_percentage, last_position, completed)
//          VALUES ($1, $2, 0, 0, false)`,
//         [userId, electionId]
//       );

//       // Log to audit trail
//       await client.query(
//         `INSERT INTO votteryy_vote_audit_logs
//          (action_type, user_id, election_id, details)
//          VALUES ($1, $2, $3, $4)`,
//         [
//           AUDIT_ACTIONS.VIDEO_STARTED,
//           userId,
//           electionId,
//           JSON.stringify({
//             videoUrl,
//             startedAt: new Date().toISOString()
//           })
//         ]
//       );
//     }

//     return { success: true };
//   });
// };

// /**
//  * Get watch leaderboard (users who watched most)
//  */
// export const getWatchLeaderboard = async (electionId, limit = 10) => {
//   const result = await query(
//     `SELECT user_id, watch_percentage, completed, completed_at
//      FROM votteryy_video_watch_progress
//      WHERE election_id = $1
//      ORDER BY watch_percentage DESC, completed_at ASC
//      LIMIT $2`,
//     [electionId, limit]
//   );

//   return result.rows;
// };

// /**
//  * Validate video URL format
//  */
// export const validateVideoUrl = (url) => {
//   if (!url) return { valid: false, error: 'Video URL is required' };

//   // YouTube URL validation
//   const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}(&.*)?$/;
  
//   if (youtubeRegex.test(url)) {
//     return { valid: true, platform: 'youtube' };
//   }

//   // Vimeo URL validation
//   const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/;
  
//   if (vimeoRegex.test(url)) {
//     return { valid: true, platform: 'vimeo' };
//   }

//   return { valid: false, error: 'Invalid video URL format. Supported: YouTube, Vimeo' };
// };

// /**
//  * Extract video ID from URL
//  */
// export const extractVideoId = (url) => {
//   // YouTube
//   const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
//   if (youtubeMatch) {
//     return { platform: 'youtube', videoId: youtubeMatch[1] };
//   }

//   // Vimeo
//   const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
//   if (vimeoMatch) {
//     return { platform: 'vimeo', videoId: vimeoMatch[1] };
//   }

//   return null;
// };

// export default {
//   getWatchProgress,
//   updateWatchProgress,
//   isWatchRequirementMet,
//   getElectionWatchStats,
//   getBulkWatchProgress,
//   resetWatchProgress,
//   deleteWatchProgress,
//   getIncompleteViewers,
//   trackVideoStart,
//   getWatchLeaderboard,
//   validateVideoUrl,
//   extractVideoId
// };
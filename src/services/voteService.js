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
    
    // Call Election Service API
    const response = await axios.get(`${ELECTION_SERVICE_URL}/elections/${electionId}`);
    
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
    
    // 🔥 FIX: Check if user already voted - DON'T destructure the result
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
// export const validateVotingEligibility = async (userId, electionId, electionData) => {
//   const errors = [];
  
//   try {
//     // Check if election is active
//     if (electionData.status !== 'published' && electionData.status !== 'active') {
//       errors.push(`Election is ${electionData.status}`);
//     }
    
//     // Check dates
//     const now = new Date();
//     const startDate = new Date(electionData.start_date);
//     const endDate = new Date(electionData.end_date);
    
//     if (now < startDate) {
//       errors.push('Election has not started yet');
//     }
    
//     if (now > endDate) {
//       errors.push('Election has ended');
//     }
    
//     // Check if user already voted
//     const [existingVotes] = await pool.query(
//       `SELECT id FROM votteryy_votes 
//        WHERE user_id = $1 AND election_id = $2 AND status = 'valid'`,
//       [userId, electionId]
//     );
    
//     if (existingVotes.length > 0) {
//       errors.push('You have already voted in this election');
//     }
    
//     return errors;
//   } catch (error) {
//     console.error('❌ Error validating eligibility:', error);
//     throw error;
//   }
// };

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
    
    // Insert vote - 🔥 Use $1, $2 syntax for PostgreSQL
    const voteResult = await client.query(
      `INSERT INTO votteryy_votes 
       (voting_id, user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'valid')
       RETURNING *`,
      [votingId, String(userId), electionId, JSON.stringify(answers), encryptedVote, voteHash, ipAddress, userAgent]
    );
    
    const vote = voteResult.rows[0]; // 🔥 PostgreSQL returns rows array
    
    // Create receipt
    const receiptId = generateUUID();
    const verificationCode = generateVerificationCode();
    
    await client.query(
      `INSERT INTO votteryy_vote_receipts 
       (voting_id, receipt_id, vote_hash, election_id, user_id, verification_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [votingId, receiptId, voteHash, electionId, String(userId), verificationCode]
    );
    
    // Log audit trail
    await client.query(
      `INSERT INTO votteryy_vote_audit_logs 
       (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ['vote_cast', String(userId), electionId, vote.id, votingId, ipAddress, userAgent, JSON.stringify({ answers })]
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
    throw error;
  } finally {
    client.release();
  }
};
// export const castVote = async (userId, electionId, answers, ipAddress, userAgent) => {
//   const client = await pool.connect();
  
//   try {
//     await client.query('BEGIN');
    
//     // Generate vote ID and hash
//     const votingId = generateUUID();
//     const voteHash = generateVoteHash(userId, electionId, answers);
    
//     // Encrypt vote data
//     const encryptedVote = JSON.stringify({
//       userId,
//       electionId,
//       answers,
//       timestamp: new Date().toISOString()
//     });
    
//     // Insert vote
//     const [vote] = await client.query(
//       `INSERT INTO votteryy_votes 
//        (voting_id, user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'valid')
//        RETURNING *`,
//       [votingId, userId, electionId, JSON.stringify(answers), encryptedVote, voteHash, ipAddress, userAgent]
//     );
    
//     // Create receipt
//     const receiptId = generateUUID();
//     const verificationCode = generateVerificationCode();
    
//     await client.query(
//       `INSERT INTO votteryy_vote_receipts 
//        (voting_id, receipt_id, vote_hash, election_id, user_id, verification_code)
//        VALUES ($1, $2, $3, $4, $5, $6)`,
//       [votingId, receiptId, voteHash, electionId, userId, verificationCode]
//     );
    
//     // Log audit trail
//     await client.query(
//       `INSERT INTO votteryy_vote_audit_logs 
//        (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//       ['vote_cast', userId, electionId, vote.id, votingId, ipAddress, userAgent, JSON.stringify({ answers })]
//     );
    
//     await client.query('COMMIT');
    
//     console.log('✅ Vote cast successfully:', votingId);
    
//     return {
//       votingId,
//       receiptId,
//       voteHash,
//       timestamp: vote.created_at,
//       voting_id: votingId,
//       receipt_id: receiptId,
//       vote_hash: voteHash
//     };
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('❌ Error casting vote:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// };

/**
 * Get user's vote for an election
 */
/**
 * Get user's vote for an election
 */
export const getUserVote = async (userId, electionId) => {
  try {
    console.log('🔍 Getting user vote:', { userId, electionId });
    
    // 🔥 FIX: DON'T destructure
    const result = await pool.query(
      `SELECT v.*, r.receipt_id, r.verification_code
       FROM votteryy_votes v
       LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
       WHERE v.user_id = $1 AND v.election_id = $2 AND v.status = 'valid'
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [String(userId), electionId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No vote found for user:', userId, 'election:', electionId);
      return null;
    }
    
    console.log('✅ Vote found for user:', userId);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error getting user vote:', error);
    throw error;
  }
};

/**
 * Get user's voting history
 */
/**
 * Get user's voting history
 */
/**
 * Get user's voting history
 */
export const getUserVotingHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    console.log(`🔍 Getting voting history for user: ${userId}`);
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM votteryy_votes WHERE user_id = $1 AND status = $2',
      [String(userId), 'valid']
    );
    const total = parseInt(countResult.rows[0].total);
    
    console.log(`📊 Found ${total} total votes for user ${userId}`);
    
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
    
    console.log(`✅ Found ${result.rows.length} votes for user ${userId} on page ${page}`);
    
    // Get election titles from election service
    const votesWithTitles = await Promise.all(
      result.rows.map(async (vote) => {
        try {
          const electionData = await getElectionData(vote.election_id);
          return {
            ...vote,
            election_title: electionData.title,
            election_status: electionData.status,
          };
        } catch (error) {
          console.error(`Error fetching election ${vote.election_id}:`, error.message);
          return {
            ...vote,
            election_title: `Election #${vote.election_id}`,
            election_status: 'unknown',
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
        currentPage: page,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      }
    };
  } catch (error) {
    console.error('❌ Error getting voting history:', error);
    throw error;
  }
};
// export const getUserVotingHistory = async (userId, page = 1, limit = 10) => {
//   try {
//     const offset = (page - 1) * limit;
    
//     // 🔥 FIX: Get total count - DON'T destructure
//     const countResult = await pool.query(
//       'SELECT COUNT(*) as total FROM votteryy_votes WHERE user_id = $1 AND status = $2',
//       [String(userId), 'valid']
//     );
//     const total = parseInt(countResult.rows[0].total);
    
//     // 🔥 FIX: Get votes with receipts and lottery info - DON'T destructure
//     const result = await pool.query(
//       `SELECT 
//         v.*,
//         r.receipt_id,
//         r.verification_code,
//         l.ticket_number as lottery_ticket_number,
//         l.ball_number
//        FROM votteryy_votes v
//        LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
//        LEFT JOIN votteryy_lottery_tickets l ON v.voting_id = l.voting_id
//        WHERE v.user_id = $1 AND v.status = $2
//        ORDER BY v.created_at DESC
//        LIMIT $3 OFFSET $4`,
//       [String(userId), 'valid', limit, offset]
//     );
    
//     console.log(`✅ Found ${result.rows.length} votes for user ${userId}`);
    
//     // Get election titles from election service
//     const votesWithTitles = await Promise.all(
//       result.rows.map(async (vote) => {
//         try {
//           const electionData = await getElectionData(vote.election_id);
//           return {
//             ...vote,
//             election_title: electionData.title,
//             election_status: electionData.status,
//           };
//         } catch (error) {
//           console.error(`Error fetching election ${vote.election_id}:`, error.message);
//           return {
//             ...vote,
//             election_title: `Election #${vote.election_id}`,
//             election_status: 'unknown',
//           };
//         }
//       })
//     );
    
//     return {
//       votes: votesWithTitles,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//         currentPage: page,
//         hasNextPage: page < Math.ceil(total / limit),
//         hasPrevPage: page > 1,
//       }
//     };
//   } catch (error) {
//     console.error('❌ Error getting voting history:', error);
//     throw error;
//   }
// };

/**
 * Verify vote receipt
 */
export const verifyReceipt = async (receiptId) => {
  try {
    console.log('🔍 Verifying receipt:', receiptId);
    
    // 🔥 FIX: DON'T destructure the query result
    const result = await pool.query(
      `SELECT r.*, v.vote_hash, v.status, v.created_at as vote_timestamp
       FROM votteryy_vote_receipts r
       JOIN votteryy_votes v ON r.voting_id = v.voting_id
       WHERE r.receipt_id = $1`,
      [receiptId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Receipt not found:', receiptId);
      return null;
    }
    
    const receipt = result.rows[0];
    console.log('✅ Receipt verified:', receiptId);
    
    return receipt;
  } catch (error) {
    console.error('❌ Error verifying receipt:', error);
    throw error;
  }
};

/**
 * Get election results
 */
/**
 * Get election results
 */
export const getElectionResults = async (electionId) => {
  try {
    console.log('📊 Getting election results for:', electionId);
    
    // 🔥 FIX: Get vote counts per option - DON'T destructure
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
    
    // 🔥 FIX: Get total votes - DON'T destructure
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM votteryy_votes WHERE election_id = $1 AND status = $2',
      [electionId, 'valid']
    );
    
    console.log('✅ Election results fetched');
    
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
/**
 * Edit existing vote
 */
export const editVote = async (userId, electionId, answers, ipAddress, userAgent) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 🔥 FIX: Get existing vote - DON'T destructure
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
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
// import { query, transaction } from '../config/database.js';
// import { 
//   encryptVote, 
//   decryptVote, 
//   generateVoteHash, 
//   generateVerificationCode,
//   verifyVoteHash 
// } from '../utils/cryptoUtils.js';
// import { 
//   VOTE_STATUS, 
//   AUDIT_ACTIONS, 
//   ERROR_MESSAGES 
// } from '../config/constants.js';
// import axios from 'axios';

// /**
//  * Check if user has already voted
//  */
// export const hasUserVoted = async (userId, electionId) => {
//   const result = await query(
//     `SELECT id, status FROM votteryy_votes 
//      WHERE user_id = $1 AND election_id = $2 AND status = $3`,
//     [userId, electionId, VOTE_STATUS.VALID]
//   );
//   return result.rows.length > 0;
// };

// /**
//  * Get election data from election service
//  */
// export const getElectionData = async (electionId) => {
//   try {
//     const response = await axios.get(
//       `${process.env.ELECTION_SERVICE_URL}/api/elections/${electionId}`,
//       { timeout: 5000 }
//     );
//     return response.data.data;
//   } catch (error) {
//     console.error('Error fetching election:', error);
//     throw new Error(ERROR_MESSAGES.ELECTION_NOT_FOUND);
//   }
// };

// /**
//  * Validate voting eligibility
//  */
// export const validateVotingEligibility = async (userId, electionId, electionData) => {
//   const errors = [];

//   // Check election status
//   if (electionData.status !== 'published') {
//     errors.push('Election is not active');
//   }

//   // Check dates
//   const now = new Date();
//   const startDate = new Date(electionData.start_date);
//   const endDate = new Date(electionData.end_date);

//   if (now < startDate) {
//     errors.push(ERROR_MESSAGES.ELECTION_NOT_STARTED);
//   }

//   if (now > endDate) {
//     errors.push(ERROR_MESSAGES.ELECTION_ENDED);
//   }

//   // Check if already voted
//   const alreadyVoted = await hasUserVoted(userId, electionId);
//   if (alreadyVoted) {
//     errors.push(ERROR_MESSAGES.ALREADY_VOTED);
//   }

//   // Check payment requirement
//   if (electionData.pricing_type !== 'free') {
//     const paymentExists = await checkUserPayment(userId, electionId);
//     if (!paymentExists) {
//       errors.push(ERROR_MESSAGES.PAYMENT_REQUIRED);
//     }
//   }

//   // Check video watch requirement
//   if (electionData.topic_video_url) {
//     const videoWatched = await checkVideoWatchCompleted(userId, electionId);
//     if (!videoWatched) {
//       errors.push(ERROR_MESSAGES.VIDEO_NOT_WATCHED);
//     }
//   }

//   return errors;
// };

// /**
//  * Check if user has completed payment
//  */
// export const checkUserPayment = async (userId, electionId) => {
//   const result = await query(
//     `SELECT id FROM votteryy_election_payments 
//      WHERE user_id = $1 AND election_id = $2 AND status = 'succeeded'`,
//     [userId, electionId]
//   );
//   return result.rows.length > 0;
// };

// /**
//  * Check if user has completed video watch
//  */
// export const checkVideoWatchCompleted = async (userId, electionId) => {
//   const result = await query(
//     `SELECT completed FROM votteryy_video_watch_progress 
//      WHERE user_id = $1 AND election_id = $2`,
//     [userId, electionId]
//   );
//   return result.rows.length > 0 && result.rows[0].completed;
// };

// /**
//  * Cast a new vote
//  */
// export const castVote = async (userId, electionId, answers, ipAddress, userAgent) => {
//   return transaction(async (client) => {
//     // Prepare vote data
//     const voteData = {
//       userId,
//       electionId,
//       answers,
//       timestamp: new Date().toISOString()
//     };

//     // Encrypt vote
//     const encryptedVote = encryptVote(voteData);
    
//     // Generate hash
//     const voteHash = generateVoteHash(voteData);

//     // Insert vote
//     const voteResult = await client.query(
//       `INSERT INTO votteryy_votes 
//        (user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//        RETURNING id, voting_id, created_at`,
//       [
//         userId,
//         electionId,
//         JSON.stringify(answers),
//         encryptedVote,
//         voteHash,
//         ipAddress,
//         userAgent,
//         VOTE_STATUS.VALID
//       ]
//     );

//     const vote = voteResult.rows[0];

//     // Generate receipt
//     const verificationCode = generateVerificationCode(vote.voting_id, userId);
    
//     await client.query(
//       `INSERT INTO votteryy_vote_receipts 
//        (voting_id, vote_hash, election_id, user_id, verification_code)
//        VALUES ($1, $2, $3, $4, $5)
//        RETURNING receipt_id`,
//       [vote.voting_id, voteHash, electionId, userId, verificationCode]
//     );

//     // Create audit log
//     await client.query(
//       `INSERT INTO votteryy_vote_audit_logs 
//        (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//       [
//         AUDIT_ACTIONS.VOTE_CAST,
//         userId,
//         electionId,
//         vote.id,
//         vote.voting_id,
//         ipAddress,
//         userAgent,
//         JSON.stringify({ answers })
//       ]
//     );

//     // Update analytics
//     await updateVoteAnalytics(client, electionId);

//     return {
//       voteId: vote.id,
//       votingId: vote.voting_id,
//       timestamp: vote.created_at,
//       verificationCode
//     };
//   });
// };

// /**
//  * Edit existing vote
//  */
// export const editVote = async (userId, electionId, answers, ipAddress, userAgent) => {
//   return transaction(async (client) => {
//     // Check if vote editing is allowed
//     const electionData = await getElectionData(electionId);
//     if (!electionData.vote_editing_allowed) {
//       throw new Error(ERROR_MESSAGES.VOTE_EDITING_NOT_ALLOWED);
//     }

//     // Get original vote
//     const originalVoteResult = await client.query(
//       `SELECT id, voting_id FROM votteryy_votes 
//        WHERE user_id = $1 AND election_id = $2 AND status = $3`,
//       [userId, electionId, VOTE_STATUS.VALID]
//     );

//     if (originalVoteResult.rows.length === 0) {
//       throw new Error(ERROR_MESSAGES.VOTE_NOT_FOUND);
//     }

//     const originalVote = originalVoteResult.rows[0];

//     // Mark original vote as edited
//     await client.query(
//       `UPDATE votteryy_votes SET status = $1, is_edited = true WHERE id = $2`,
//       [VOTE_STATUS.EDITED, originalVote.id]
//     );

//     // Prepare new vote data
//     const voteData = {
//       userId,
//       electionId,
//       answers,
//       timestamp: new Date().toISOString()
//     };

//     const encryptedVote = encryptVote(voteData);
//     const voteHash = generateVoteHash(voteData);

//     // Insert new vote
//     const newVoteResult = await client.query(
//       `INSERT INTO votteryy_votes 
//        (user_id, election_id, answers, encrypted_vote, vote_hash, 
//         ip_address, user_agent, status, original_vote_id)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
//        RETURNING id, voting_id, created_at`,
//       [
//         userId,
//         electionId,
//         JSON.stringify(answers),
//         encryptedVote,
//         voteHash,
//         ipAddress,
//         userAgent,
//         VOTE_STATUS.VALID,
//         originalVote.id
//       ]
//     );

//     const newVote = newVoteResult.rows[0];

//     // Create audit log
//     await client.query(
//       `INSERT INTO votteryy_vote_audit_logs 
//        (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//       [
//         AUDIT_ACTIONS.VOTE_EDITED,
//         userId,
//         electionId,
//         newVote.id,
//         newVote.voting_id,
//         ipAddress,
//         userAgent,
//         JSON.stringify({ originalVoteId: originalVote.id, newAnswers: answers })
//       ]
//     );

//     return {
//       voteId: newVote.id,
//       votingId: newVote.voting_id,
//       timestamp: newVote.created_at
//     };
//   });
// };

// /**
//  * Get user's vote for an election
//  */
// export const getUserVote = async (userId, electionId) => {
//   const result = await query(
//     `SELECT v.id, v.voting_id, v.answers, v.created_at, v.is_edited,
//             r.receipt_id, r.verification_code
//      FROM votteryy_votes v
//      LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
//      WHERE v.user_id = $1 AND v.election_id = $2 AND v.status = $3`,
//     [userId, electionId, VOTE_STATUS.VALID]
//   );

//   if (result.rows.length === 0) {
//     return null;
//   }

//   const vote = result.rows[0];
//   return {
//     voteId: vote.id,
//     votingId: vote.voting_id,
//     answers: vote.answers,
//     timestamp: vote.created_at,
//     isEdited: vote.is_edited,
//     receiptId: vote.receipt_id,
//     verificationCode: vote.verification_code
//   };
// };

// /**
//  * Verify vote receipt
//  */
// export const verifyReceipt = async (receiptId) => {
//   const result = await query(
//     `SELECT r.receipt_id, r.vote_hash, r.verification_code, r.timestamp,
//             v.election_id, v.status
//      FROM votteryy_vote_receipts r
//      JOIN votteryy_votes v ON r.voting_id = v.voting_id
//      WHERE r.receipt_id = $1`,
//     [receiptId]
//   );

//   if (result.rows.length === 0) {
//     return null;
//   }

//   return result.rows[0];
// };

// /**
//  * Get election results
//  */
// export const getElectionResults = async (electionId) => {
//   const result = await query(
//     `SELECT 
//        COUNT(DISTINCT user_id) as total_voters,
//        COUNT(*) as total_votes,
//        answers
//      FROM votteryy_votes
//      WHERE election_id = $1 AND status = $2
//      GROUP BY answers`,
//     [electionId, VOTE_STATUS.VALID]
//   );

//   // Aggregate results by question and option
//   const aggregatedResults = {};
  
//   result.rows.forEach(row => {
//     const answers = row.answers;
//     Object.keys(answers).forEach(questionId => {
//       if (!aggregatedResults[questionId]) {
//         aggregatedResults[questionId] = {};
//       }
//       const optionIds = answers[questionId];
//       optionIds.forEach(optionId => {
//         if (!aggregatedResults[questionId][optionId]) {
//           aggregatedResults[questionId][optionId] = 0;
//         }
//         aggregatedResults[questionId][optionId]++;
//       });
//     });
//   });

//   return {
//     totalVoters: result.rows.length > 0 ? parseInt(result.rows[0].total_voters) : 0,
//     results: aggregatedResults
//   };
// };

// /**
//  * Update vote analytics
//  */
// const updateVoteAnalytics = async (client, electionId) => {
//   // Get vote counts
//   const voteStats = await client.query(
//     `SELECT 
//        COUNT(*) as total_votes,
//        COUNT(DISTINCT user_id) as unique_voters
//      FROM votteryy_votes
//      WHERE election_id = $1 AND status = $2`,
//     [electionId, VOTE_STATUS.VALID]
//   );

//   const stats = voteStats.rows[0];

//   // Upsert analytics
//   await client.query(
//     `INSERT INTO votteryy_vote_analytics 
//      (election_id, total_votes, unique_voters, last_updated)
//      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
//      ON CONFLICT (election_id) 
//      DO UPDATE SET 
//        total_votes = $2,
//        unique_voters = $3,
//        last_updated = CURRENT_TIMESTAMP`,
//     [electionId, stats.total_votes, stats.unique_voters]
//   );
// };

// /**
//  * Get user's voting history
//  */
// export const getUserVotingHistory = async (userId, page = 1, limit = 10) => {
//   const offset = (page - 1) * limit;
  
//   const result = await query(
//     `SELECT v.voting_id, v.election_id, v.created_at, v.is_edited,
//             r.receipt_id, r.verification_code
//      FROM votteryy_votes v
//      LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
//      WHERE v.user_id = $1 AND v.status = $2
//      ORDER BY v.created_at DESC
//      LIMIT $3 OFFSET $4`,
//     [userId, VOTE_STATUS.VALID, limit, offset]
//   );

//   const countResult = await query(
//     `SELECT COUNT(*) as total 
//      FROM votteryy_votes 
//      WHERE user_id = $1 AND status = $2`,
//     [userId, VOTE_STATUS.VALID]
//   );

//   return {
//     votes: result.rows,
//     total: parseInt(countResult.rows[0].total)
//   };
// };

// export default {
//   hasUserVoted,
//   getElectionData,
//   validateVotingEligibility,
//   checkUserPayment,
//   checkVideoWatchCompleted,
//   castVote,
//   editVote,
//   getUserVote,
//   verifyReceipt,
//   getElectionResults,
//   getUserVotingHistory
// };
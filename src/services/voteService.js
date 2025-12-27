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

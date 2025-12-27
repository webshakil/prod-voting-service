// src/controllers/votingController.js
// Handles /api/voting/elections/:electionId/* endpoints
import pool from '../config/database.js';
import axios from 'axios';
import crypto from 'crypto';
import { successResponse, errorResponse } from '../utils/responseHandler.js';

const ELECTION_SERVICE_URL = process.env.ELECTION_SERVICE_URL || 'http://localhost:3005/api';

/**
 * ✅ Get Election Ballot - INCLUDES hasVoted CHECK
 */
export const getElectionBallot = async (req, res) => {
  try {
    const { electionId } = req.params;
    
    // Get userId from multiple sources
    let userId = null;
    
    // Try x-user-data header first
    if (req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {
        console.error('Error parsing x-user-data:', e);
      }
    }
    
    // Try x-user-id header
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }
    
    // Try req.user (from auth middleware)
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }
    
    console.log('📥 Getting ballot for election:', electionId, 'user:', userId);

    // 1. Get election data from Election Service
    let electionData;
    try {
      const response = await axios.get(`${ELECTION_SERVICE_URL}/elections/${electionId}`);
      electionData = response.data?.data?.election || 
                     response.data?.election || 
                     response.data?.data || 
                     response.data;
    } catch (error) {
      console.error('❌ Error fetching election:', error.message);
      return errorResponse(res, 'Election not found', 404);
    }

    if (!electionData || !electionData.id) {
      return errorResponse(res, 'Election not found', 404);
    }

    // 2. Get questions from Election Service
    let questions = [];
    try {
      const questionsResponse = await axios.get(`${ELECTION_SERVICE_URL}/elections/${electionId}/questions`);
      questions = questionsResponse.data?.data?.questions || 
                  questionsResponse.data?.questions || 
                  questionsResponse.data?.data || 
                  [];
    } catch (error) {
      console.error('⚠️ Error fetching questions:', error.message);
      // Don't fail, just use empty questions
    }

    // 3. ✅ CHECK IF USER HAS ALREADY VOTED - THIS IS THE KEY FIX
    let hasVoted = false;
    let existingVote = null;
    
    if (userId) {
      try {
        const voteResult = await pool.query(
          `SELECT voting_id, created_at, answers FROM votteryy_votes 
           WHERE user_id = $1 AND election_id = $2 AND status = 'valid'
           LIMIT 1`,
          [String(userId), parseInt(electionId)]
        );
        
        if (voteResult.rows.length > 0) {
          hasVoted = true;
          existingVote = voteResult.rows[0];
          console.log('🛑 User has already voted:', { userId, electionId, votingId: existingVote.voting_id });
        } else {
          console.log('✅ User has NOT voted yet:', { userId, electionId });
        }
      } catch (error) {
        console.error('⚠️ Error checking vote status:', error.message);
        // Don't fail, default to false
      }
    }

    // 4. Get video progress if user is logged in
    let videoProgress = null;
    if (userId && electionData.video_watch_required) {
      try {
        const progressResult = await pool.query(
          `SELECT watch_percentage, last_position, completed, total_duration 
           FROM votteryy_video_progress 
           WHERE user_id = $1 AND election_id = $2
           ORDER BY updated_at DESC LIMIT 1`,
          [String(userId), parseInt(electionId)]
        );
        
        if (progressResult.rows.length > 0) {
          videoProgress = progressResult.rows[0];
        }
      } catch (error) {
        console.error('⚠️ Error fetching video progress:', error.message);
      }
    }

    // 5. Parse lottery config
    let lotteryConfig = null;
    let lotteryEnabled = false;
    
    if (electionData.lottery_config) {
      try {
        lotteryConfig = typeof electionData.lottery_config === 'string' 
          ? JSON.parse(electionData.lottery_config) 
          : electionData.lottery_config;
        lotteryEnabled = lotteryConfig?.lottery_enabled || lotteryConfig?.is_lotterized || false;
      } catch (e) {
        console.error('Error parsing lottery config:', e);
      }
    }

    // 6. Build response
    const ballotResponse = {
      election: {
        id: electionData.id,
        title: electionData.title,
        description: electionData.description,
        startDate: electionData.start_date,
        endDate: electionData.end_date,
        status: electionData.status,
        videoUrl: electionData.topic_video_url || electionData.video_url,
        authentication_methods: electionData.authentication_methods || ['passkey'],
      },
      questions: questions.map(q => ({
        id: q.id || q.question_id,
        questionText: q.question_text,
        questionType: q.question_type || 'multiple_choice',
        isRequired: q.is_required !== false,
        maxSelections: q.max_selections || 1,
        options: (q.options || []).map(opt => ({
          id: opt.id || opt.option_id,
          optionText: opt.option_text,
          optionOrder: opt.option_order,
        })),
      })),
      
      // ✅ CRITICAL: hasVoted flag - this is what frontend checks
      hasVoted: hasVoted,
      votingId: existingVote?.voting_id || null,
      
      // Voting settings
      votingType: electionData.voting_type || 'plurality',
      voteEditingAllowed: electionData.vote_editing_allowed || false,
      anonymousVotingEnabled: electionData.anonymous_voting_enabled || false,
      liveResults: electionData.show_live_results || false,
      
      // Payment
      paymentRequired: !electionData.is_free && parseFloat(electionData.general_participation_fee || 0) > 0,
      participationFee: parseFloat(electionData.general_participation_fee || 0),
      
      // Video
      videoWatchRequired: electionData.video_watch_required || false,
      minimumWatchPercentage: parseFloat(electionData.minimum_watch_percentage || 80),
      videoProgress: videoProgress,
      
      // Lottery
      lotteryEnabled: lotteryEnabled,
      lotteryConfig: lotteryConfig,
    };

    console.log('✅ Ballot response ready:', { 
      electionId, 
      hasVoted: ballotResponse.hasVoted,
      questionsCount: ballotResponse.questions.length 
    });

    return successResponse(res, ballotResponse);
  } catch (error) {
    console.error('❌ Get ballot error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * ✅ Cast Vote for Election
 */
export const castElectionVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { answers, isAbstention } = req.body;
    
    // Get userId
    let userId = null;
    if (req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {}
    }
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }
    
    if (!userId) {
      return errorResponse(res, 'User authentication required', 401);
    }

    console.log('📥 Casting vote:', { userId, electionId, isAbstention });

    // ✅ Check if already voted
    const existingVote = await pool.query(
      `SELECT voting_id FROM votteryy_votes 
       WHERE user_id = $1 AND election_id = $2 AND status = 'valid'`,
      [String(userId), parseInt(electionId)]
    );

    if (existingVote.rows.length > 0) {
      return errorResponse(res, 'You have already voted in this election', 400);
    }

    // Generate vote data
    const votingId = generateUUID();
    const voteHash = generateVoteHash(userId, electionId, answers || {});
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Insert vote
    const voteResult = await pool.query(
      `INSERT INTO votteryy_votes 
       (voting_id, user_id, election_id, answers, encrypted_vote, vote_hash, ip_address, user_agent, status, is_abstention)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'valid', $9)
       RETURNING *`,
      [
        votingId, 
        String(userId), 
        parseInt(electionId), 
        JSON.stringify(answers || {}),
        JSON.stringify({ userId, electionId, answers, timestamp: new Date().toISOString() }),
        voteHash,
        ipAddress,
        userAgent,
        isAbstention || false
      ]
    );

    // Create receipt
    const receiptId = generateUUID();
    const verificationCode = generateVerificationCode();

    await pool.query(
      `INSERT INTO votteryy_vote_receipts 
       (voting_id, receipt_id, vote_hash, election_id, user_id, verification_code)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [votingId, receiptId, voteHash, parseInt(electionId), String(userId), verificationCode]
    );

    // Log audit
    await pool.query(
      `INSERT INTO votteryy_vote_audit_logs 
       (action_type, user_id, election_id, vote_id, voting_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        isAbstention ? 'abstention' : 'vote_cast', 
        String(userId), 
        parseInt(electionId), 
        voteResult.rows[0].id, 
        votingId, 
        ipAddress, 
        userAgent, 
        JSON.stringify({ answers, isAbstention })
      ]
    );

    // Create lottery ticket if election has lottery
    let lotteryTicket = null;
    try {
      // Check if election has lottery
      const electionResponse = await axios.get(`${ELECTION_SERVICE_URL}/elections/${electionId}`);
      const electionData = electionResponse.data?.data?.election || electionResponse.data?.data || electionResponse.data;
      
      const lotteryConfig = electionData.lottery_config ? 
        (typeof electionData.lottery_config === 'string' ? JSON.parse(electionData.lottery_config) : electionData.lottery_config) 
        : null;
      
      if (lotteryConfig?.lottery_enabled || lotteryConfig?.is_lotterized) {
        const ballNumber = generateBallNumber();
        const ticketNumber = `TIX-${electionId}-${ballNumber}`;
        
        const ticketResult = await pool.query(
          `INSERT INTO votteryy_lottery_tickets 
           (user_id, election_id, voting_id, ticket_number, ball_number)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [String(userId), parseInt(electionId), votingId, ticketNumber, ballNumber]
        );
        
        lotteryTicket = ticketResult.rows[0];
        console.log('🎫 Lottery ticket created:', ticketNumber);
      }
    } catch (e) {
      console.error('⚠️ Error creating lottery ticket:', e.message);
    }

    console.log('✅ Vote cast successfully:', votingId);

    return successResponse(res, {
      votingId,
      receiptId,
      voteHash,
      verificationCode,
      timestamp: voteResult.rows[0].created_at,
      ticket: lotteryTicket,
    }, 'Vote cast successfully', 201);
  } catch (error) {
    console.error('❌ Cast vote error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get user's vote for election
 */
export const getMyElectionVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    
    let userId = null;
    if (req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {}
    }
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }

    if (!userId) {
      return errorResponse(res, 'User authentication required', 401);
    }

    const result = await pool.query(
      `SELECT v.*, r.receipt_id, r.verification_code
       FROM votteryy_votes v
       LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
       WHERE v.user_id = $1 AND v.election_id = $2 AND v.status = 'valid'
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [String(userId), parseInt(electionId)]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 'No vote found', 404);
    }

    return successResponse(res, result.rows[0]);
  } catch (error) {
    console.error('❌ Get my vote error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update video watch progress
 */
export const updateVideoProgress = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { watchPercentage, lastPosition, totalDuration } = req.body;
    
    let userId = null;
    if (req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {}
    }
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }

    if (!userId) {
      return errorResponse(res, 'User authentication required', 401);
    }

    const completed = watchPercentage >= 80; // Default threshold

    // Upsert progress
    const result = await pool.query(
      `INSERT INTO votteryy_video_progress 
       (user_id, election_id, watch_percentage, last_position, total_duration, completed)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, election_id) 
       DO UPDATE SET 
         watch_percentage = GREATEST(votteryy_video_progress.watch_percentage, $3),
         last_position = $4,
         total_duration = COALESCE($5, votteryy_video_progress.total_duration),
         completed = votteryy_video_progress.completed OR $6,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [String(userId), parseInt(electionId), watchPercentage, lastPosition || 0, totalDuration || 0, completed]
    );

    return successResponse(res, result.rows[0]);
  } catch (error) {
    console.error('❌ Update video progress error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Record abstention
 */
export const recordAbstention = async (req, res) => {
  // This is handled by castElectionVote with isAbstention: true
  req.body.isAbstention = true;
  req.body.answers = {};
  return castElectionVote(req, res);
};

/**
 * Get live results
 */
export const getLiveResults = async (req, res) => {
  try {
    const { electionId } = req.params;

    // Get election info
    let electionTitle = `Election #${electionId}`;
    let votingType = 'plurality';
    
    try {
      const electionResponse = await axios.get(`${ELECTION_SERVICE_URL}/elections/${electionId}`);
      const electionData = electionResponse.data?.data?.election || electionResponse.data?.data || electionResponse.data;
      electionTitle = electionData.title || electionTitle;
      votingType = electionData.voting_type || votingType;
    } catch (e) {
      console.error('⚠️ Error fetching election for results:', e.message);
    }

    // Get total votes
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM votteryy_votes WHERE election_id = $1 AND status = 'valid'`,
      [parseInt(electionId)]
    );
    const totalVotes = parseInt(totalResult.rows[0].total);

    // Get vote counts per option (simplified)
    const resultsQuery = `
      SELECT 
        answers
      FROM votteryy_votes
      WHERE election_id = $1 AND status = 'valid'
    `;
    const votesResult = await pool.query(resultsQuery, [parseInt(electionId)]);

    // Aggregate results by question and option
    const questionResults = {};
    
    votesResult.rows.forEach(vote => {
      const answers = typeof vote.answers === 'string' ? JSON.parse(vote.answers) : vote.answers;
      
      Object.entries(answers || {}).forEach(([questionId, selectedOptions]) => {
        if (!questionResults[questionId]) {
          questionResults[questionId] = {};
        }
        
        const options = Array.isArray(selectedOptions) ? selectedOptions : [selectedOptions];
        options.forEach(optionId => {
          if (optionId) {
            questionResults[questionId][optionId] = (questionResults[questionId][optionId] || 0) + 1;
          }
        });
      });
    });

    return successResponse(res, {
      electionId: parseInt(electionId),
      electionTitle,
      votingType,
      totalVotes,
      questions: Object.entries(questionResults).map(([questionId, options]) => ({
        questionId,
        options: Object.entries(options).map(([optionId, count]) => ({
          optionId,
          voteCount: count,
          percentage: totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0,
        })),
      })),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get live results error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get election audit logs
 */
export const getElectionAuditLogs = async (req, res) => {
  try {
    const { electionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT * FROM votteryy_vote_audit_logs 
       WHERE election_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [parseInt(electionId), limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM votteryy_vote_audit_logs WHERE election_id = $1`,
      [parseInt(electionId)]
    );

    return successResponse(res, {
      logs: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    console.error('❌ Get audit logs error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get voting history
 */
export const getVotingHistory = async (req, res) => {
  try {
    let userId = req.query.userId;
    
    if (!userId && req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {}
    }
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }

    if (!userId) {
      return errorResponse(res, 'User ID required', 400);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT v.*, r.receipt_id, r.verification_code, l.ticket_number, l.ball_number
       FROM votteryy_votes v
       LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
       LEFT JOIN votteryy_lottery_tickets l ON v.voting_id = l.voting_id
       WHERE v.user_id = $1 AND v.status = 'valid'
       ORDER BY v.created_at DESC
       LIMIT $2 OFFSET $3`,
      [String(userId), limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM votteryy_votes WHERE user_id = $1 AND status = 'valid'`,
      [String(userId)]
    );

    // Get election titles
    const votesWithTitles = await Promise.all(
      result.rows.map(async (vote) => {
        try {
          const electionResponse = await axios.get(`${ELECTION_SERVICE_URL}/elections/${vote.election_id}`);
          const electionData = electionResponse.data?.data?.election || electionResponse.data?.data || electionResponse.data;
          return {
            ...vote,
            election_title: electionData.title,
            election_status: electionData.status,
          };
        } catch (e) {
          return {
            ...vote,
            election_title: `Election #${vote.election_id}`,
            election_status: 'unknown',
          };
        }
      })
    );

    return successResponse(res, {
      votes: votesWithTitles,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    console.error('❌ Get voting history error:', error);
    return errorResponse(res, error.message, 500);
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

function generateBallNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

export default {
  getElectionBallot,
  castElectionVote,
  getMyElectionVote,
  updateVideoProgress,
  recordAbstention,
  getLiveResults,
  getElectionAuditLogs,
  getVotingHistory,
};

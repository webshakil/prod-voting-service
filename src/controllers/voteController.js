// src/controllers/voteController.js
import * as voteService from '../services/voteService.js';
import * as lotteryService from '../services/lotteryService.js';
import crypto from 'node:crypto';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';
import pool from '../config/database.js';
import axios from 'axios';

const ELECTION_SERVICE_URL = process.env.ELECTION_SERVICE_URL || 'http://localhost:3005/api';

/**
 * ✅ NEW: Get Election Ballot - checks if user already voted from votteryyy_voter_participation
 */
export const getElectionBallot = async (req, res) => {
  try {
    const { electionId } = req.params;
    
    // Get userId from multiple sources
    let userId = null;
    
    if (req.headers['x-user-data']) {
      try {
        const userData = JSON.parse(req.headers['x-user-data']);
        userId = userData.userId;
      } catch (e) {
        console.error('Error parsing x-user-data:', e);
      }
    }
    
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }
    
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
    }

    // 3. ✅ CHECK IF USER HAS ALREADY VOTED - from votteryyy_voter_participation
    // This table tracks ALL votes (both normal and anonymous)
    let hasVoted = false;
    
    if (userId) {
      try {
        const participationResult = await pool.query(
          `SELECT id, has_voted, voted_at FROM votteryyy_voter_participation 
           WHERE user_id = $1 AND election_id = $2`,
          [String(userId), parseInt(electionId)]
        );
        
        if (participationResult.rows.length > 0 && participationResult.rows[0].has_voted) {
          hasVoted = true;
          console.log('🛑 User has already voted:', { userId, electionId, votedAt: participationResult.rows[0].voted_at });
        } else {
          console.log('✅ User has NOT voted yet:', { userId, electionId });
        }
      } catch (error) {
        console.error('⚠️ Error checking participation:', error.message);
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
      
      // ✅ CRITICAL: hasVoted flag
      hasVoted: hasVoted,
      
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
 * Cast a new vote
 */
export const castVote = async (req, res) => {
  try {
    const { electionId, answers, userId } = req.body;
    
    // Validate inputs
    if (!userId) {
      return errorResponse(res, 'User ID is required', 400);
    }
    
    if (!electionId) {
      return errorResponse(res, 'Election ID is required', 400);
    }
    
    if (!answers || typeof answers !== 'object') {
      return errorResponse(res, 'Answers must be an object', 400);
    }
    
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    console.log('📥 Casting vote:', { 
      userId, 
      electionId, 
      answersCount: Object.keys(answers).length 
    });

    // Get election data
    const electionData = await voteService.getElectionData(electionId);
    
    console.log('✅ Election data received:', electionData.title);

    // 🔥 SKIP payment check for now - assume payment is already done
    console.log('⚠️ Skipping payment verification (already verified via payment intent)');
    
    // 🔥 SKIP video check for now
    console.log('⚠️ Skipping video verification');

    // Validate voting eligibility
    const errors = await voteService.validateVotingEligibility(
      userId,
      electionId,
      electionData
    );

    if (errors.length > 0) {
      return errorResponse(res, 'Voting not allowed, you already voted', 400, errors);
    }

    // Cast vote
    const vote = await voteService.castVote(
      userId,
      electionId,
      answers,
      ipAddress,
      userAgent
    );

    console.log('✅ Vote cast successfully:', vote.votingId);

    // Create lottery ticket if election is lotterized
    let lotteryTicket = null;
    
    const isLotterized = electionData.is_lotterized || 
                        (electionData.lottery_config && electionData.lottery_config.is_lotterized);
    
    if (isLotterized) {
      try {
        lotteryTicket = await lotteryService.createLotteryTicket(
          userId, 
          electionId, 
          vote.votingId,
          electionData.lottery_config || { is_lotterized: true }
        );
        
        console.log('🎫 Lottery ticket created:', lotteryTicket.ticket_number);
        
        // Add lottery info to response
        vote.lotteryTicketNumber = lotteryTicket.ticket_number;
        vote.lotteryBallNumber = lotteryTicket.ball_number;
      } catch (lotteryError) {
        console.error('❌ Lottery ticket creation failed:', lotteryError.message);
        // Don't fail the vote if lottery creation fails
      }
    }

    return successResponse(
      res, 
      vote, 
      SUCCESS_MESSAGES?.VOTE_CAST || 'Vote cast successfully', 
      201
    );
  } catch (error) {
    console.error('❌ Cast vote error:', error);
    console.error('❌ Error stack:', error.stack);
    return errorResponse(res, error.message, 500);
  }
};

// Export other controller functions...
export const editVote = async (req, res) => {
  try {
    const { electionId, answers, userId } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await voteService.editVote(userId, electionId, answers, ipAddress, userAgent);
    return successResponse(res, result, 'Vote edited successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getMyVote = async (req, res) => {
  try {
    const userId = req.user?.userId || req.body.userId;
    const { electionId } = req.params;

    const vote = await voteService.getUserVote(userId, parseInt(electionId));
    
    if (!vote) {
      return errorResponse(res, 'No vote found', 404);
    }

    return successResponse(res, vote);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getVotingHistory = async (req, res) => {
  try {
    // Get userId from multiple sources
    let userId = req.query.userId || req.user?.userId || req.body.userId;
    
    // Also try to get from x-user-data header
    if (!userId) {
      try {
        const xUserData = req.headers['x-user-data'];
        if (xUserData) {
          const userData = JSON.parse(xUserData);
          userId = userData.userId;
        }
      } catch (err) {
        console.error('Error parsing x-user-data:', err);
      }
    }
    
    if (!userId) {
      return errorResponse(res, 'User ID is required. Please provide userId in query, header, or body.', 400);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    console.log('📊 Fetching voting history:', { userId, page, limit });

    const result = await voteService.getUserVotingHistory(userId, page, limit);

    return successResponse(res, result);
  } catch (error) {
    console.error('❌ Get voting history error:', error);
    return errorResponse(res, error.message, 500);
  }
};



export const verifyReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const receipt = await voteService.verifyReceipt(receiptId);

    if (!receipt) {
      return errorResponse(res, 'Receipt not found', 404);
    }

    return successResponse(res, receipt);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getElectionResults = async (req, res) => {
  try {
    const { electionId } = req.params;
    const results = await voteService.getElectionResults(parseInt(electionId));
    return successResponse(res, results);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};


/**
 * Get comprehensive audit trail for all elections
 */
export const getAuditTrail = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const actionType = req.query.actionType || null;
    const electionId = req.query.electionId || null;
    
    console.log('📊 Fetching audit trail:', { page, limit, actionType, electionId });

    // Build WHERE clause
    let whereClause = '';
    const params = [];
    let paramIndex = 1;
    
    if (actionType) {
      whereClause += ` AND al.action_type = $${paramIndex}`; // 🔥 Fixed: added al. prefix
      params.push(actionType);
      paramIndex++;
    }
    
    if (electionId) {
      whereClause += ` AND al.election_id = $${paramIndex}`; // 🔥 Fixed: added al. prefix
      params.push(parseInt(electionId));
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM votteryy_vote_audit_logs al
      WHERE 1=1 ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get audit logs with vote and receipt details
    const auditQuery = `
      SELECT 
        al.*,
        v.vote_hash,
        v.status as vote_status,
        v.is_edited,
        r.receipt_id,
        r.verification_code
      FROM votteryy_vote_audit_logs al
      LEFT JOIN votteryy_votes v ON al.voting_id = v.voting_id
      LEFT JOIN votteryy_vote_receipts r ON al.voting_id = r.voting_id
      WHERE 1=1 ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const result = await pool.query(auditQuery, [...params, limit, offset]);
    
    console.log(`✅ Found ${result.rows.length} audit logs`);

    return successResponse(res, {
      auditLogs: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      }
    });
  } catch (error) {
    console.error('❌ Error fetching audit trail:', error);
    return errorResponse(res, error.message, 500);
  }
};


/**
 * Get audit statistics
 */
export const getAuditStats = async (req, res) => {
  try {
    console.log('📊 Fetching audit statistics');

    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT election_id) as elections_with_activity,
        COUNT(DISTINCT DATE(created_at)) as days_with_activity,
        MIN(created_at) as first_action,
        MAX(created_at) as last_action
      FROM votteryy_vote_audit_logs
    `;
    const statsResult = await pool.query(statsQuery);

    // Get action type breakdown
    const actionTypesQuery = `
      SELECT 
        action_type,
        COUNT(*) as count
      FROM votteryy_vote_audit_logs
      GROUP BY action_type
      ORDER BY count DESC
    `;
    const actionTypesResult = await pool.query(actionTypesQuery);

    // Get recent activity (last 24 hours)
    const recentActivityQuery = `
      SELECT 
        COUNT(*) as actions_24h,
        COUNT(DISTINCT user_id) as active_users_24h
      FROM votteryy_vote_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;
    const recentActivityResult = await pool.query(recentActivityQuery);

    // Get votes statistics
    const votesStatsQuery = `
      SELECT 
        COUNT(*) as total_votes,
        COUNT(DISTINCT user_id) as unique_voters,
        COUNT(DISTINCT election_id) as elections_voted,
        COUNT(*) FILTER (WHERE is_edited = true) as edited_votes,
        COUNT(*) FILTER (WHERE status = 'valid') as valid_votes
      FROM votteryy_votes
    `;
    const votesStatsResult = await pool.query(votesStatsQuery);

    return successResponse(res, {
      overall: statsResult.rows[0],
      actionTypes: actionTypesResult.rows,
      recentActivity: recentActivityResult.rows[0],
      votes: votesStatsResult.rows[0],
    });
  } catch (error) {
    console.error('❌ Error fetching audit stats:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get blockchain-style hash chain for verification
 */
export const getHashChain = async (req, res) => {
  try {
    const { electionId } = req.params;
    console.log('🔗 Generating hash chain for election:', electionId);

    // Get all votes in chronological order
    const votesQuery = `
      SELECT 
        voting_id,
        vote_hash,
        created_at,
        user_id
      FROM votteryy_votes
      WHERE election_id = $1 AND status = 'valid'
      ORDER BY created_at ASC
    `;
    const result = await pool.query(votesQuery, [parseInt(electionId)]);

    // Build hash chain
    const hashChain = [];
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis block

    result.rows.forEach((vote, index) => {
      // 🔥 Fixed: Use crypto from node:crypto
      const blockData = `${previousHash}${vote.vote_hash}${vote.created_at}`;
      const blockHash = crypto.createHash('sha256').update(blockData).digest('hex');
      
      hashChain.push({
        blockNumber: index + 1,
        votingId: vote.voting_id,
        voteHash: vote.vote_hash,
        previousHash,
        blockHash,
        timestamp: vote.created_at,
        userId: vote.user_id.substring(0, 8) + '...', // Anonymize
      });

      previousHash = blockHash;
    });

    return successResponse(res, {
      electionId: parseInt(electionId),
      totalBlocks: hashChain.length,
      hashChain,
      latestBlockHash: previousHash,
    });
  } catch (error) {
    console.error('❌ Error generating hash chain:', error);
    return errorResponse(res, error.message, 500);
  }
};

export const getPublicBulletinBoard = async (req, res) => {
  try {
    const { electionId } = req.params;
    
    // Get anonymized votes for transparency
    const votesQuery = `
      SELECT 
        voting_id,
        vote_hash,
        created_at,
        'User-' || SUBSTRING(user_id, 1, 4) as anonymized_user
      FROM votteryy_votes
      WHERE election_id = $1 AND status = 'valid'
      ORDER BY created_at DESC
    `;
    const result = await pool.query(votesQuery, [parseInt(electionId)]);
    
    // Get hash chain for verification
    const hashChainQuery = `
      SELECT 
        voting_id,
        vote_hash,
        created_at
      FROM votteryy_votes
      WHERE election_id = $1 AND status = 'valid'
      ORDER BY created_at ASC
    `;
    const chainResult = await pool.query(hashChainQuery, [parseInt(electionId)]);
    
    // Build hash chain
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const hashChain = chainResult.rows.map((vote, index) => {
      const blockData = `${previousHash}${vote.vote_hash}${vote.created_at}`;
      const blockHash = crypto.createHash('sha256').update(blockData).digest('hex');
      previousHash = blockHash;
      
      return {
        blockNumber: index + 1,
        voteHash: vote.vote_hash,
        timestamp: vote.created_at,
        blockHash,
      };
    });
    
    return successResponse(res, {
      electionId: parseInt(electionId),
      totalVotes: result.rows.length,
      votes: result.rows,
      hashChain,
      verificationHash: previousHash,
    });
  } catch (error) {
    console.error('❌ Error fetching public bulletin:', error);
    return errorResponse(res, error.message, 500);
  }
};

export default {
  getElectionBallot,
  castVote,
  editVote,
  getMyVote,
  getVotingHistory,
  verifyReceipt,
  getElectionResults,
  getAuditTrail,
  getAuditStats,
  getHashChain,
  getPublicBulletinBoard
};
//last workable code only to add bllot above code
// // src/controllers/voteController.js
// import * as voteService from '../services/voteService.js';
// import * as lotteryService from '../services/lotteryService.js';
// import crypto from 'node:crypto';
// import { successResponse, errorResponse } from '../utils/responseHandler.js';
// import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';
// import pool from '../config/database.js';

// /**
//  * Cast a new vote
//  */
// export const castVote = async (req, res) => {
//   try {
//     const { electionId, answers, userId } = req.body;
    
//     // Validate inputs
//     if (!userId) {
//       return errorResponse(res, 'User ID is required', 400);
//     }
    
//     if (!electionId) {
//       return errorResponse(res, 'Election ID is required', 400);
//     }
    
//     if (!answers || typeof answers !== 'object') {
//       return errorResponse(res, 'Answers must be an object', 400);
//     }
    
//     const ipAddress = req.ip;
//     const userAgent = req.headers['user-agent'];

//     console.log('📥 Casting vote:', { 
//       userId, 
//       electionId, 
//       answersCount: Object.keys(answers).length 
//     });

//     // Get election data
//     const electionData = await voteService.getElectionData(electionId);
    
//     console.log('✅ Election data received:', electionData.title);

//     // 🔥 SKIP payment check for now - assume payment is already done
//     console.log('⚠️ Skipping payment verification (already verified via payment intent)');
    
//     // 🔥 SKIP video check for now
//     console.log('⚠️ Skipping video verification');

//     // Validate voting eligibility
//     const errors = await voteService.validateVotingEligibility(
//       userId,
//       electionId,
//       electionData
//     );

//     if (errors.length > 0) {
//       return errorResponse(res, 'Voting not allowed, you already voted', 400, errors);
//     }

//     // Cast vote
//     const vote = await voteService.castVote(
//       userId,
//       electionId,
//       answers,
//       ipAddress,
//       userAgent
//     );

//     console.log('✅ Vote cast successfully:', vote.votingId);

//     // Create lottery ticket if election is lotterized
//     let lotteryTicket = null;
    
//     const isLotterized = electionData.is_lotterized || 
//                         (electionData.lottery_config && electionData.lottery_config.is_lotterized);
    
//     if (isLotterized) {
//       try {
//         lotteryTicket = await lotteryService.createLotteryTicket(
//           userId, 
//           electionId, 
//           vote.votingId,
//           electionData.lottery_config || { is_lotterized: true }
//         );
        
//         console.log('🎫 Lottery ticket created:', lotteryTicket.ticket_number);
        
//         // Add lottery info to response
//         vote.lotteryTicketNumber = lotteryTicket.ticket_number;
//         vote.lotteryBallNumber = lotteryTicket.ball_number;
//       } catch (lotteryError) {
//         console.error('❌ Lottery ticket creation failed:', lotteryError.message);
//         // Don't fail the vote if lottery creation fails
//       }
//     }

//     return successResponse(
//       res, 
//       vote, 
//       SUCCESS_MESSAGES?.VOTE_CAST || 'Vote cast successfully', 
//       201
//     );
//   } catch (error) {
//     console.error('❌ Cast vote error:', error);
//     console.error('❌ Error stack:', error.stack);
//     return errorResponse(res, error.message, 500);
//   }
// };

// // Export other controller functions...
// export const editVote = async (req, res) => {
//   try {
//     const { electionId, answers, userId } = req.body;
//     const ipAddress = req.ip;
//     const userAgent = req.headers['user-agent'];

//     const result = await voteService.editVote(userId, electionId, answers, ipAddress, userAgent);
//     return successResponse(res, result, 'Vote edited successfully');
//   } catch (error) {
//     return errorResponse(res, error.message, 500);
//   }
// };

// export const getMyVote = async (req, res) => {
//   try {
//     const userId = req.user?.userId || req.body.userId;
//     const { electionId } = req.params;

//     const vote = await voteService.getUserVote(userId, parseInt(electionId));
    
//     if (!vote) {
//       return errorResponse(res, 'No vote found', 404);
//     }

//     return successResponse(res, vote);
//   } catch (error) {
//     return errorResponse(res, error.message, 500);
//   }
// };

// export const getVotingHistory = async (req, res) => {
//   try {
//     // Get userId from multiple sources
//     let userId = req.query.userId || req.user?.userId || req.body.userId;
    
//     // Also try to get from x-user-data header
//     if (!userId) {
//       try {
//         const xUserData = req.headers['x-user-data'];
//         if (xUserData) {
//           const userData = JSON.parse(xUserData);
//           userId = userData.userId;
//         }
//       } catch (err) {
//         console.error('Error parsing x-user-data:', err);
//       }
//     }
    
//     if (!userId) {
//       return errorResponse(res, 'User ID is required. Please provide userId in query, header, or body.', 400);
//     }

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;

//     console.log('📊 Fetching voting history:', { userId, page, limit });

//     const result = await voteService.getUserVotingHistory(userId, page, limit);

//     return successResponse(res, result);
//   } catch (error) {
//     console.error('❌ Get voting history error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };



// export const verifyReceipt = async (req, res) => {
//   try {
//     const { receiptId } = req.params;
//     const receipt = await voteService.verifyReceipt(receiptId);

//     if (!receipt) {
//       return errorResponse(res, 'Receipt not found', 404);
//     }

//     return successResponse(res, receipt);
//   } catch (error) {
//     return errorResponse(res, error.message, 500);
//   }
// };

// export const getElectionResults = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     const results = await voteService.getElectionResults(parseInt(electionId));
//     return successResponse(res, results);
//   } catch (error) {
//     return errorResponse(res, error.message, 500);
//   }
// };


// /**
//  * Get comprehensive audit trail for all elections
//  */
// export const getAuditTrail = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 50;
//     const offset = (page - 1) * limit;
//     const actionType = req.query.actionType || null;
//     const electionId = req.query.electionId || null;
    
//     console.log('📊 Fetching audit trail:', { page, limit, actionType, electionId });

//     // Build WHERE clause
//     let whereClause = '';
//     const params = [];
//     let paramIndex = 1;
    
//     if (actionType) {
//       whereClause += ` AND al.action_type = $${paramIndex}`; // 🔥 Fixed: added al. prefix
//       params.push(actionType);
//       paramIndex++;
//     }
    
//     if (electionId) {
//       whereClause += ` AND al.election_id = $${paramIndex}`; // 🔥 Fixed: added al. prefix
//       params.push(parseInt(electionId));
//       paramIndex++;
//     }

//     // Get total count
//     const countQuery = `
//       SELECT COUNT(*) as total 
//       FROM votteryy_vote_audit_logs al
//       WHERE 1=1 ${whereClause}
//     `;
//     const countResult = await pool.query(countQuery, params);
//     const total = parseInt(countResult.rows[0].total);

//     // Get audit logs with vote and receipt details
//     const auditQuery = `
//       SELECT 
//         al.*,
//         v.vote_hash,
//         v.status as vote_status,
//         v.is_edited,
//         r.receipt_id,
//         r.verification_code
//       FROM votteryy_vote_audit_logs al
//       LEFT JOIN votteryy_votes v ON al.voting_id = v.voting_id
//       LEFT JOIN votteryy_vote_receipts r ON al.voting_id = r.voting_id
//       WHERE 1=1 ${whereClause}
//       ORDER BY al.created_at DESC
//       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
//     `;
    
//     const result = await pool.query(auditQuery, [...params, limit, offset]);
    
//     console.log(`✅ Found ${result.rows.length} audit logs`);

//     return successResponse(res, {
//       auditLogs: result.rows,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//         hasNextPage: page < Math.ceil(total / limit),
//         hasPrevPage: page > 1,
//       }
//     });
//   } catch (error) {
//     console.error('❌ Error fetching audit trail:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };


// /**
//  * Get audit statistics
//  */
// export const getAuditStats = async (req, res) => {
//   try {
//     console.log('📊 Fetching audit statistics');

//     // Get overall stats
//     const statsQuery = `
//       SELECT 
//         COUNT(*) as total_actions,
//         COUNT(DISTINCT user_id) as unique_users,
//         COUNT(DISTINCT election_id) as elections_with_activity,
//         COUNT(DISTINCT DATE(created_at)) as days_with_activity,
//         MIN(created_at) as first_action,
//         MAX(created_at) as last_action
//       FROM votteryy_vote_audit_logs
//     `;
//     const statsResult = await pool.query(statsQuery);

//     // Get action type breakdown
//     const actionTypesQuery = `
//       SELECT 
//         action_type,
//         COUNT(*) as count
//       FROM votteryy_vote_audit_logs
//       GROUP BY action_type
//       ORDER BY count DESC
//     `;
//     const actionTypesResult = await pool.query(actionTypesQuery);

//     // Get recent activity (last 24 hours)
//     const recentActivityQuery = `
//       SELECT 
//         COUNT(*) as actions_24h,
//         COUNT(DISTINCT user_id) as active_users_24h
//       FROM votteryy_vote_audit_logs
//       WHERE created_at > NOW() - INTERVAL '24 hours'
//     `;
//     const recentActivityResult = await pool.query(recentActivityQuery);

//     // Get votes statistics
//     const votesStatsQuery = `
//       SELECT 
//         COUNT(*) as total_votes,
//         COUNT(DISTINCT user_id) as unique_voters,
//         COUNT(DISTINCT election_id) as elections_voted,
//         COUNT(*) FILTER (WHERE is_edited = true) as edited_votes,
//         COUNT(*) FILTER (WHERE status = 'valid') as valid_votes
//       FROM votteryy_votes
//     `;
//     const votesStatsResult = await pool.query(votesStatsQuery);

//     return successResponse(res, {
//       overall: statsResult.rows[0],
//       actionTypes: actionTypesResult.rows,
//       recentActivity: recentActivityResult.rows[0],
//       votes: votesStatsResult.rows[0],
//     });
//   } catch (error) {
//     console.error('❌ Error fetching audit stats:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get blockchain-style hash chain for verification
//  */
// export const getHashChain = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     console.log('🔗 Generating hash chain for election:', electionId);

//     // Get all votes in chronological order
//     const votesQuery = `
//       SELECT 
//         voting_id,
//         vote_hash,
//         created_at,
//         user_id
//       FROM votteryy_votes
//       WHERE election_id = $1 AND status = 'valid'
//       ORDER BY created_at ASC
//     `;
//     const result = await pool.query(votesQuery, [parseInt(electionId)]);

//     // Build hash chain
//     const hashChain = [];
//     let previousHash = '0000000000000000000000000000000000000000000000000000000000000000'; // Genesis block

//     result.rows.forEach((vote, index) => {
//       // 🔥 Fixed: Use crypto from node:crypto
//       const blockData = `${previousHash}${vote.vote_hash}${vote.created_at}`;
//       const blockHash = crypto.createHash('sha256').update(blockData).digest('hex');
      
//       hashChain.push({
//         blockNumber: index + 1,
//         votingId: vote.voting_id,
//         voteHash: vote.vote_hash,
//         previousHash,
//         blockHash,
//         timestamp: vote.created_at,
//         userId: vote.user_id.substring(0, 8) + '...', // Anonymize
//       });

//       previousHash = blockHash;
//     });

//     return successResponse(res, {
//       electionId: parseInt(electionId),
//       totalBlocks: hashChain.length,
//       hashChain,
//       latestBlockHash: previousHash,
//     });
//   } catch (error) {
//     console.error('❌ Error generating hash chain:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// export const getPublicBulletinBoard = async (req, res) => {
//   try {
//     const { electionId } = req.params;
    
//     // Get anonymized votes for transparency
//     const votesQuery = `
//       SELECT 
//         voting_id,
//         vote_hash,
//         created_at,
//         'User-' || SUBSTRING(user_id, 1, 4) as anonymized_user
//       FROM votteryy_votes
//       WHERE election_id = $1 AND status = 'valid'
//       ORDER BY created_at DESC
//     `;
//     const result = await pool.query(votesQuery, [parseInt(electionId)]);
    
//     // Get hash chain for verification
//     const hashChainQuery = `
//       SELECT 
//         voting_id,
//         vote_hash,
//         created_at
//       FROM votteryy_votes
//       WHERE election_id = $1 AND status = 'valid'
//       ORDER BY created_at ASC
//     `;
//     const chainResult = await pool.query(hashChainQuery, [parseInt(electionId)]);
    
//     // Build hash chain
//     let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
//     const hashChain = chainResult.rows.map((vote, index) => {
//       const blockData = `${previousHash}${vote.vote_hash}${vote.created_at}`;
//       const blockHash = crypto.createHash('sha256').update(blockData).digest('hex');
//       previousHash = blockHash;
      
//       return {
//         blockNumber: index + 1,
//         voteHash: vote.vote_hash,
//         timestamp: vote.created_at,
//         blockHash,
//       };
//     });
    
//     return successResponse(res, {
//       electionId: parseInt(electionId),
//       totalVotes: result.rows.length,
//       votes: result.rows,
//       hashChain,
//       verificationHash: previousHash,
//     });
//   } catch (error) {
//     console.error('❌ Error fetching public bulletin:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// export default {
//   castVote,
//   editVote,
//   getMyVote,
//   getVotingHistory,
//   verifyReceipt,
//   getElectionResults,
//   getAuditTrail,
//   getAuditStats,
//   getHashChain,
//   getPublicBulletinBoard
// };

// src/controllers/voteController.js
import * as voteService from '../services/voteService.js';
import * as lotteryService from '../services/lotteryService.js';
// 🔥 Keep these commented out for now
// import * as paymentService from '../services/paymentService.js';
// import * as videoService from '../services/videoService.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';

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

// export const getVotingHistory = async (req, res) => {
//   try {
//     //const userId = req.user?.userId || req.body.userId;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;

//     const result = await voteService.getUserVotingHistory(userId, page, limit);

//     return successResponse(res, result);
//   } catch (error) {
//     console.error('Get voting history error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

export const getVotingHistory = async (req, res) => {
  try {
    // 🔥 Get userId from x-user-data header
    let userId = req.user?.userId;
    
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
    
    // Fallback to query or body
    if (!userId) {
      userId = req.query.userId || req.body.userId;
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
    console.error('Get voting history error:', error);
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

export default {
  castVote,
  editVote,
  getMyVote,
  getVotingHistory,
  verifyReceipt,
  getElectionResults
};
// // src/controllers/voteController.js
// import * as voteService from '../services/voteService.js';
// import * as lotteryService from '../services/lotteryService.js';
// import * as paymentService from '../services/paymentService.js';
// import * as videoService from '../services/videoService.js';
// import * as walletService from '../services/walletService.js';
// import { successResponse, errorResponse } from '../utils/responseHandler.js';
// import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';


// //last working code
// // src/controllers/voteController.js
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

//     // Check if election requires payment
//     if (!electionData.is_free) {
//       const paymentVerified = await paymentService.verifyUserPayment(userId, electionId);
//       if (!paymentVerified) {
//         return errorResponse(res, 'Payment required before voting', 402);
//       }
//     }

//     // Check video watch requirement
//     if (electionData.video_required && electionData.topic_video_url) {
//       const videoCompleted = await videoService.checkVideoCompletion(
//         userId, 
//         electionId, 
//         electionData.minimum_video_watch_percentage || 80
//       );
      
//       if (!videoCompleted.completed) {
//         return errorResponse(
//           res, 
//           `You must watch at least ${electionData.minimum_video_watch_percentage || 80}% of the video before voting`,
//           403,
//           { 
//             currentPercentage: videoCompleted.watchPercentage,
//             requiredPercentage: electionData.minimum_video_watch_percentage || 80
//           }
//         );
//       }
//     }

//     // Validate voting eligibility
//     const errors = await voteService.validateVotingEligibility(
//       userId,
//       electionId,
//       electionData
//     );

//     if (errors.length > 0) {
//       return errorResponse(res, 'Voting not allowed', 400, errors);
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
    
//     // 🔥 FIX: Check lottery config properly
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

//     return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_CAST || 'Vote cast successfully', 201);
//   } catch (error) {
//     console.error('❌ Cast vote error:', error);
//     console.error('❌ Error stack:', error.stack);
//     return errorResponse(res, error.message, 500);
//   }
// };

// export const editVote = async (req, res) => {
//   try {
//     const { electionId, answers } = req.body;
//     const userId = req.user.userId;
//     const ipAddress = req.ip;
//     const userAgent = req.headers['user-agent'];

//     const vote = await voteService.editVote(
//       userId,
//       electionId,
//       answers,
//       ipAddress,
//       userAgent
//     );

//     return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_EDITED);
//   } catch (error) {
//     console.error('Edit vote error:', error);
//     return errorResponse(res, error.message, 400);
//   }
// };

// /**
//  * Get user's vote for an election
//  */
// export const getMyVote = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     const userId = req.user.userId;

//     const vote = await voteService.getUserVote(userId, parseInt(electionId));

//     if (!vote) {
//       return errorResponse(res, ERROR_MESSAGES.VOTE_NOT_FOUND, 404);
//     }

//     return successResponse(res, vote);
//   } catch (error) {
//     console.error('Get vote error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get user's voting history
//  */
// export const getVotingHistory = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;

//     const result = await voteService.getUserVotingHistory(userId, page, limit);

//     return successResponse(res, result);
//   } catch (error) {
//     console.error('Get voting history error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Verify vote receipt
//  */
// export const verifyReceipt = async (req, res) => {
//   try {
//     const { receiptId } = req.params;

//     const receipt = await voteService.verifyReceipt(receiptId);

//     if (!receipt) {
//       return errorResponse(res, 'Receipt not found', 404);
//     }

//     return successResponse(res, receipt);
//   } catch (error) {
//     console.error('Verify receipt error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get election results
//  */
// export const getElectionResults = async (req, res) => {
//   try {
//     const { electionId } = req.params;

//     const electionData = await voteService.getElectionData(parseInt(electionId));
    
//     if (!electionData.show_live_results) {
//       const now = new Date();
//       const endDate = new Date(electionData.end_date);
      
//       if (now < endDate) {
//         return errorResponse(res, 'Results not available yet', 403);
//       }
//     }

//     const results = await voteService.getElectionResults(parseInt(electionId));

//     return successResponse(res, results);
//   } catch (error) {
//     console.error('Get results error:', error);
//     return errorResponse(res, error.message, 500);
//   }


  
// };


// export default {
//   castVote,
//   editVote,
//   getMyVote,
//   getVotingHistory,
//   verifyReceipt,
//   getElectionResults
// };
// import * as voteService from '../services/voteService.js';
// import * as lotteryService from '../services/lotteryService.js';
// import { successResponse, errorResponse } from '../utils/responseHandler.js';
// import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';

// /**
//  * Cast a new vote
//  */
// export const castVote = async (req, res) => {
//   try {
//     const { electionId, answers } = req.body;
//     const userId = req.user.userId;
//     const ipAddress = req.ip;
//     const userAgent = req.headers['user-agent'];

//     // Get election data
//     const electionData = await voteService.getElectionData(electionId);

//     // Validate voting eligibility
//     const errors = await voteService.validateVotingEligibility(
//       userId,
//       electionId,
//       electionData
//     );

//     if (errors.length > 0) {
//       return errorResponse(res, 'Voting not allowed', 400, errors);
//     }

//     // Cast vote
//     const vote = await voteService.castVote(
//       userId,
//       electionId,
//       answers,
//       ipAddress,
//       userAgent
//     );

//     // Create lottery ticket if election is lotterized
//     if (electionData.lottery_config && electionData.lottery_config.is_lotterized) {
//       await lotteryService.createLotteryTicket(userId, electionId, vote.votingId);
//     }

//     return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_CAST, 201);
//   } catch (error) {
//     console.error('Cast vote error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Edit existing vote
//  */
// export const editVote = async (req, res) => {
//   try {
//     const { electionId, answers } = req.body;
//     const userId = req.user.userId;
//     const ipAddress = req.ip;
//     const userAgent = req.headers['user-agent'];

//     const vote = await voteService.editVote(
//       userId,
//       electionId,
//       answers,
//       ipAddress,
//       userAgent
//     );

//     return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_EDITED);
//   } catch (error) {
//     console.error('Edit vote error:', error);
//     return errorResponse(res, error.message, 400);
//   }
// };

// /**
//  * Get user's vote for an election
//  */
// export const getMyVote = async (req, res) => {
//   try {
//     const { electionId } = req.params;
//     const userId = req.user.userId;

//     const vote = await voteService.getUserVote(userId, parseInt(electionId));

//     if (!vote) {
//       return errorResponse(res, ERROR_MESSAGES.VOTE_NOT_FOUND, 404);
//     }

//     return successResponse(res, vote);
//   } catch (error) {
//     console.error('Get vote error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get user's voting history
//  */
// export const getVotingHistory = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;

//     const result = await voteService.getUserVotingHistory(userId, page, limit);

//     return successResponse(res, result);
//   } catch (error) {
//     console.error('Get voting history error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Verify vote receipt
//  */
// export const verifyReceipt = async (req, res) => {
//   try {
//     const { receiptId } = req.params;

//     const receipt = await voteService.verifyReceipt(receiptId);

//     if (!receipt) {
//       return errorResponse(res, 'Receipt not found', 404);
//     }

//     return successResponse(res, receipt);
//   } catch (error) {
//     console.error('Verify receipt error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get election results
//  */
// export const getElectionResults = async (req, res) => {
//   try {
//     const { electionId } = req.params;

//     // Check if election allows showing results
//     const electionData = await voteService.getElectionData(parseInt(electionId));
    
//     if (!electionData.show_live_results) {
//       const now = new Date();
//       const endDate = new Date(electionData.end_date);
      
//       if (now < endDate) {
//         return errorResponse(res, 'Results not available yet', 403);
//       }
//     }

//     const results = await voteService.getElectionResults(parseInt(electionId));

//     return successResponse(res, results);
//   } catch (error) {
//     console.error('Get results error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// export default {
//   castVote,
//   editVote,
//   getMyVote,
//   getVotingHistory,
//   verifyReceipt,
//   getElectionResults
// };
// src/controllers/voteController.js
import * as voteService from '../services/voteService.js';
import * as lotteryService from '../services/lotteryService.js';
import * as paymentService from '../services/paymentService.js';
import * as videoService from '../services/videoService.js';
import * as walletService from '../services/walletService.js';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/constants.js';

/**
 * Cast a new vote - ENHANCED with payment and video verification
 */
export const castVote = async (req, res) => {
  try {
    const { electionId, answers } = req.body;
    const userId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Get election data
    const electionData = await voteService.getElectionData(electionId);

    // ✅ NEW: Check if election requires payment
    if (!electionData.is_free) {
      const paymentVerified = await paymentService.verifyUserPayment(userId, electionId);
      if (!paymentVerified) {
        return errorResponse(res, 'Payment required before voting', 402);
      }
    }

    // ✅ NEW: Check video watch requirement
    if (electionData.video_required && electionData.topic_video_url) {
      const videoCompleted = await videoService.checkVideoCompletion(
        userId, 
        electionId, 
        electionData.minimum_video_watch_percentage || 80
      );
      
      if (!videoCompleted.completed) {
        return errorResponse(
          res, 
          `You must watch at least ${electionData.minimum_video_watch_percentage || 80}% of the video before voting`,
          403,
          { 
            currentPercentage: videoCompleted.watchPercentage,
            requiredPercentage: electionData.minimum_video_watch_percentage || 80
          }
        );
      }
    }

    // Validate voting eligibility
    const errors = await voteService.validateVotingEligibility(
      userId,
      electionId,
      electionData
    );

    if (errors.length > 0) {
      return errorResponse(res, 'Voting not allowed', 400, errors);
    }

    // Cast vote
    const vote = await voteService.castVote(
      userId,
      electionId,
      answers,
      ipAddress,
      userAgent
    );

    // ✅ NEW: Create lottery ticket if election is lotterized
    if (electionData.lottery_config && electionData.lottery_config.is_lotterized) {
      await lotteryService.createLotteryTicket(
        userId, 
        electionId, 
        vote.votingId,
        electionData.lottery_config
      );
    }

    return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_CAST, 201);
  } catch (error) {
    console.error('Cast vote error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Edit existing vote
 */
export const editVote = async (req, res) => {
  try {
    const { electionId, answers } = req.body;
    const userId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const vote = await voteService.editVote(
      userId,
      electionId,
      answers,
      ipAddress,
      userAgent
    );

    return successResponse(res, vote, SUCCESS_MESSAGES.VOTE_EDITED);
  } catch (error) {
    console.error('Edit vote error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * Get user's vote for an election
 */
export const getMyVote = async (req, res) => {
  try {
    const { electionId } = req.params;
    const userId = req.user.userId;

    const vote = await voteService.getUserVote(userId, parseInt(electionId));

    if (!vote) {
      return errorResponse(res, ERROR_MESSAGES.VOTE_NOT_FOUND, 404);
    }

    return successResponse(res, vote);
  } catch (error) {
    console.error('Get vote error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get user's voting history
 */
export const getVotingHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await voteService.getUserVotingHistory(userId, page, limit);

    return successResponse(res, result);
  } catch (error) {
    console.error('Get voting history error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Verify vote receipt
 */
export const verifyReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;

    const receipt = await voteService.verifyReceipt(receiptId);

    if (!receipt) {
      return errorResponse(res, 'Receipt not found', 404);
    }

    return successResponse(res, receipt);
  } catch (error) {
    console.error('Verify receipt error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get election results
 */
export const getElectionResults = async (req, res) => {
  try {
    const { electionId } = req.params;

    const electionData = await voteService.getElectionData(parseInt(electionId));
    
    if (!electionData.show_live_results) {
      const now = new Date();
      const endDate = new Date(electionData.end_date);
      
      if (now < endDate) {
        return errorResponse(res, 'Results not available yet', 403);
      }
    }

    const results = await voteService.getElectionResults(parseInt(electionId));

    return successResponse(res, results);
  } catch (error) {
    console.error('Get results error:', error);
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
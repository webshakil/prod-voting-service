// src/controllers/walletController.js
import * as walletService from '../services/walletService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responseHandler.js';

/**
 * Get wallet balance - ENHANCED with blocked/pending balance
 */
export const getBalance = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // ✅ Get complete wallet info including blocked balance
    const wallet = await walletService.getCompleteWalletInfo(userId);
    
    return successResponse(res, wallet);
  } catch (error) {
    console.error('Get balance error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const filters = {
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      electionId: req.query.electionId
    };

    const result = await walletService.getTransactionHistory(
      userId,
      filters,
      page,
      limit
    );

    return paginatedResponse(
      res,
      result.transactions,
      page,
      limit,
      result.total
    );
  } catch (error) {
    console.error('Get transactions error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Request withdrawal - ENHANCED with minimum balance check
 */
export const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod, paymentDetails } = req.body;

    // ✅ Check minimum withdrawal amount
    const MIN_WITHDRAWAL = 10.00;
    if (parseFloat(amount) < MIN_WITHDRAWAL) {
      return errorResponse(res, `Minimum withdrawal amount is $${MIN_WITHDRAWAL}`, 400);
    }

    const request = await walletService.requestWithdrawal(
      userId,
      parseFloat(amount),
      paymentMethod,
      paymentDetails
    );

    return successResponse(res, request, 'Withdrawal request submitted', 201);
  } catch (error) {
    console.error('Request withdrawal error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * Get withdrawal requests (Admin)
 */
export const getWithdrawalRequests = async (req, res) => {
  try {
    const status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await walletService.getWithdrawalRequests(status, page, limit);

    return paginatedResponse(
      res,
      result.requests,
      page,
      limit,
      result.total
    );
  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Approve withdrawal (Admin)
 */
export const approveWithdrawal = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminUserId = req.user.userId;
    const { notes } = req.body;

    const request = await walletService.approveWithdrawal(
      requestId,
      adminUserId,
      notes
    );

    return successResponse(res, request, 'Withdrawal approved');
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    return errorResponse(res, error.message, 400);
  }
};

/**
 * Reject withdrawal (Admin)
 */
export const rejectWithdrawal = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminUserId = req.user.userId;
    const { notes } = req.body;

    if (!notes) {
      return errorResponse(res, 'Rejection reason required', 400);
    }

    const request = await walletService.rejectWithdrawal(
      requestId,
      adminUserId,
      notes
    );

    return successResponse(res, request, 'Withdrawal rejected');
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    return errorResponse(res, error.message, 400);
  }
};

export default {
  getBalance,
  getTransactionHistory,
  requestWithdrawal,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal
};
// import * as walletService from '../services/walletService.js';
// import { successResponse, errorResponse, paginatedResponse } from '../utils/responseHandler.js';

// /**
//  * Get wallet balance
//  */
// export const getBalance = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const balance = await walletService.getWalletBalance(userId);
//     return successResponse(res, balance);
//   } catch (error) {
//     console.error('Get balance error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Get transaction history
//  */
// export const getTransactionHistory = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
    
//     const filters = {
//       type: req.query.type,
//       status: req.query.status,
//       startDate: req.query.startDate,
//       endDate: req.query.endDate,
//       electionId: req.query.electionId
//     };

//     const result = await walletService.getTransactionHistory(
//       userId,
//       filters,
//       page,
//       limit
//     );

//     return paginatedResponse(
//       res,
//       result.transactions,
//       page,
//       limit,
//       result.total
//     );
//   } catch (error) {
//     console.error('Get transactions error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Request withdrawal
//  */
// export const requestWithdrawal = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const { amount, paymentMethod, paymentDetails } = req.body;

//     const request = await walletService.requestWithdrawal(
//       userId,
//       parseFloat(amount),
//       paymentMethod,
//       paymentDetails
//     );

//     return successResponse(res, request, 'Withdrawal request submitted', 201);
//   } catch (error) {
//     console.error('Request withdrawal error:', error);
//     return errorResponse(res, error.message, 400);
//   }
// };

// /**
//  * Get withdrawal requests (Admin)
//  */
// export const getWithdrawalRequests = async (req, res) => {
//   try {
//     const status = req.query.status;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;

//     const result = await walletService.getWithdrawalRequests(status, page, limit);

//     return paginatedResponse(
//       res,
//       result.requests,
//       page,
//       limit,
//       result.total
//     );
//   } catch (error) {
//     console.error('Get withdrawal requests error:', error);
//     return errorResponse(res, error.message, 500);
//   }
// };

// /**
//  * Approve withdrawal (Admin)
//  */
// export const approveWithdrawal = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const adminUserId = req.user.userId;
//     const { notes } = req.body;

//     const request = await walletService.approveWithdrawal(
//       requestId,
//       adminUserId,
//       notes
//     );

//     return successResponse(res, request, 'Withdrawal approved');
//   } catch (error) {
//     console.error('Approve withdrawal error:', error);
//     return errorResponse(res, error.message, 400);
//   }
// };

// /**
//  * Reject withdrawal (Admin)
//  */
// export const rejectWithdrawal = async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const adminUserId = req.user.userId;
//     const { notes } = req.body;

//     if (!notes) {
//       return errorResponse(res, 'Rejection reason required', 400);
//     }

//     const request = await walletService.rejectWithdrawal(
//       requestId,
//       adminUserId,
//       notes
//     );

//     return successResponse(res, request, 'Withdrawal rejected');
//   } catch (error) {
//     console.error('Reject withdrawal error:', error);
//     return errorResponse(res, error.message, 400);
//   }
// };

// export default {
//   getBalance,
//   getTransactionHistory,
//   requestWithdrawal,
//   getWithdrawalRequests,
//   approveWithdrawal,
//   rejectWithdrawal
// };

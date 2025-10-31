import * as lotteryService from '../services/lotteryService.js';
import * as voteService from '../services/voteService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responseHandler.js';

/**
 * Get lottery tickets for user
 */
export const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await lotteryService.getUserLotteryTickets(userId, page, limit);

    return paginatedResponse(res, result.tickets, page, limit, result.total);
  } catch (error) {
    console.error('Get tickets error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get election lottery statistics
 */
export const getLotteryStats = async (req, res) => {
  try {
    const { electionId } = req.params;
    const stats = await lotteryService.getLotteryStatistics(parseInt(electionId));
    return successResponse(res, stats);
  } catch (error) {
    console.error('Get lottery stats error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get election winners
 */
export const getWinners = async (req, res) => {
  try {
    const { electionId } = req.params;
    const winners = await lotteryService.getElectionWinners(parseInt(electionId));
    return successResponse(res, winners);
  } catch (error) {
    console.error('Get winners error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Run lottery draw (Admin/Auto-trigger)
 */
export const runLotteryDraw = async (req, res) => {
  try {
    const { electionId } = req.params;

    // Get election and lottery config
    const electionData = await voteService.getElectionData(parseInt(electionId));
    const lotteryConfig = electionData.lottery_config;

    if (!lotteryConfig || !lotteryConfig.is_lotterized) {
      return errorResponse(res, 'Election is not lotterized', 400);
    }

    // Check if election has ended
    const now = new Date();
    const endDate = new Date(electionData.end_date);
    
    if (now < endDate) {
      return errorResponse(res, 'Cannot draw before election ends', 400);
    }

    // Run draw
    const result = await lotteryService.selectWinners(parseInt(electionId), lotteryConfig);

    return successResponse(res, result, 'Lottery draw completed successfully');
  } catch (error) {
    console.error('Run lottery draw error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Claim prize
 */
export const claimPrize = async (req, res) => {
  try {
    const { winnerId } = req.params;
    const userId = req.user.userId;

    const winner = await lotteryService.claimPrize(winnerId, userId);

    return successResponse(res, winner, 'Prize claimed successfully');
  } catch (error) {
    console.error('Claim prize error:', error);
    return errorResponse(res, error.message, 400);
  }
};

export default {
  getMyTickets,
  getLotteryStats,
  getWinners,
  runLotteryDraw,
  claimPrize
};
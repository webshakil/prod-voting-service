import * as analyticsService from '../services/analyticsService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/responseHandler.js';

/**
 * Get election analytics
 */
export const getElectionAnalytics = async (req, res) => {
  try {
    const { electionId } = req.params;

    const analytics = await analyticsService.getElectionAnalytics(parseInt(electionId));
    const voteDistribution = await analyticsService.getVoteDistribution(parseInt(electionId));
    const participationRate = await analyticsService.getParticipationRate(parseInt(electionId));
    const votingPatterns = await analyticsService.getVotingPatterns(parseInt(electionId));

    return successResponse(res, {
      analytics,
      voteDistribution,
      participationRate,
      votingPatterns
    });
  } catch (error) {
    console.error('Get election analytics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get voting time series
 */
export const getVotingTimeSeries = async (req, res) => {
  try {
    const { electionId } = req.params;
    const interval = req.query.interval || '1 hour'; // '1 hour', '1 day', etc.

    const timeSeries = await analyticsService.getVotingTimeSeries(
      parseInt(electionId),
      interval
    );

    return successResponse(res, timeSeries);
  } catch (error) {
    console.error('Get voting time series error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get revenue analytics
 */
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { electionId } = req.params;

    const revenue = await analyticsService.getElectionRevenueAnalytics(
      parseInt(electionId)
    );

    return successResponse(res, revenue);
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get platform analytics
 */
export const getPlatformAnalytics = async (req, res) => {
  try {
    const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = req.query.endDate || new Date().toISOString().split('T')[0];

    const analytics = await analyticsService.getPlatformAnalytics(startDate, endDate);

    return successResponse(res, analytics);
  } catch (error) {
    console.error('Get platform analytics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get question analytics
 */
export const getQuestionAnalytics = async (req, res) => {
  try {
    const { electionId, questionId } = req.params;

    const questionAnalytics = await analyticsService.getQuestionAnalytics(
      parseInt(electionId),
      parseInt(questionId)
    );

    return successResponse(res, questionAnalytics);
  } catch (error) {
    console.error('Get question analytics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Export election data
 */
export const exportElectionData = async (req, res) => {
  try {
    const { electionId } = req.params;
    const format = req.query.format || 'json'; // json or csv

    const data = await analyticsService.exportElectionData(
      parseInt(electionId),
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=election-${electionId}-data.csv`);
      
      // Convert to CSV string
      const csvContent = [
        data.headers.join(','),
        ...data.rows.map(row => row.join(','))
      ].join('\n');
      
      return res.send(csvContent);
    }

    return successResponse(res, data);
  } catch (error) {
    console.error('Export election data error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get audit trail
 */
export const getAuditTrail = async (req, res) => {
  try {
    const { electionId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await analyticsService.getElectionAuditTrail(
      parseInt(electionId),
      page,
      limit
    );

    return paginatedResponse(
      res,
      result.auditLogs,
      page,
      limit,
      result.total
    );
  } catch (error) {
    console.error('Get audit trail error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get voter demographics
 */
export const getVoterDemographics = async (req, res) => {
  try {
    const { electionId } = req.params;

    const demographics = await analyticsService.getVoterDemographics(
      parseInt(electionId)
    );

    return successResponse(res, demographics);
  } catch (error) {
    console.error('Get voter demographics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update platform analytics (admin/cron)
 */
export const updatePlatformAnalytics = async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];

    const result = await analyticsService.updatePlatformAnalytics(date);

    return successResponse(res, result, 'Platform analytics updated');
  } catch (error) {
    console.error('Update platform analytics error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get geographic distribution
 */
export const getGeographicDistribution = async (req, res) => {
  try {
    const { electionId } = req.params;

    const distribution = await analyticsService.getGeographicDistribution(
      parseInt(electionId)
    );

    return successResponse(res, distribution);
  } catch (error) {
    console.error('Get geographic distribution error:', error);
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get comprehensive election report
 */
export const getElectionReport = async (req, res) => {
  try {
    const { electionId } = req.params;

    // Gather all analytics data
    const [
      analytics,
      voteDistribution,
      participationRate,
      votingPatterns,
      revenue,
      timeSeries
    ] = await Promise.all([
      analyticsService.getElectionAnalytics(parseInt(electionId)),
      analyticsService.getVoteDistribution(parseInt(electionId)),
      analyticsService.getParticipationRate(parseInt(electionId)),
      analyticsService.getVotingPatterns(parseInt(electionId)),
      analyticsService.getElectionRevenueAnalytics(parseInt(electionId)),
      analyticsService.getVotingTimeSeries(parseInt(electionId), '1 hour')
    ]);

    const report = {
      analytics,
      voteDistribution,
      participationRate,
      votingPatterns,
      revenue,
      timeSeries,
      generatedAt: new Date().toISOString()
    };

    return successResponse(res, report);
  } catch (error) {
    console.error('Get election report error:', error);
    return errorResponse(res, error.message, 500);
  }
};

export default {
  getElectionAnalytics,
  getVotingTimeSeries,
  getRevenueAnalytics,
  getPlatformAnalytics,
  getQuestionAnalytics,
  exportElectionData,
  getAuditTrail,
  getVoterDemographics,
  updatePlatformAnalytics,
  getGeographicDistribution,
  getElectionReport
};
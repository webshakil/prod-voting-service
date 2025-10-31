import { query } from '../config/database.js';

/**
 * Get election analytics
 */
export const getElectionAnalytics = async (electionId) => {
  const result = await query(
    `SELECT * FROM votteryy_vote_analytics WHERE election_id = $1`,
    [electionId]
  );

  if (result.rows.length === 0) {
    return {
      totalVotes: 0,
      uniqueVoters: 0,
      participationRate: 0,
      votesByQuestion: {},
      votesByOption: {}
    };
  }

  return result.rows[0];
};

/**
 * Get detailed vote distribution
 */
export const getVoteDistribution = async (electionId) => {
  const result = await query(
    `SELECT 
       answers,
       COUNT(*) as vote_count,
       created_at
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'
     GROUP BY answers, created_at
     ORDER BY created_at ASC`,
    [electionId]
  );

  return result.rows;
};

/**
 * Get time-series voting data
 */
export const getVotingTimeSeries = async (electionId, interval = '1 hour') => {
  const result = await query(
    `SELECT 
       DATE_TRUNC($2, created_at) as time_bucket,
       COUNT(*) as vote_count,
       COUNT(DISTINCT user_id) as voter_count
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'
     GROUP BY time_bucket
     ORDER BY time_bucket ASC`,
    [electionId, interval]
  );

  return result.rows;
};

/**
 * Get geographic distribution (if tracking enabled)
 */
export const getGeographicDistribution = async (electionId) => {
  // This would require user location data
  // Placeholder for future implementation
  return [];
};

/**
 * Get participation rate
 */
export const getParticipationRate = async (electionId, totalEligibleVoters = null) => {
  const voteResult = await query(
    `SELECT COUNT(DISTINCT user_id) as actual_voters
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'`,
    [electionId]
  );

  const actualVoters = parseInt(voteResult.rows[0].actual_voters);

  if (!totalEligibleVoters) {
    return { actualVoters, participationRate: null };
  }

  const participationRate = (actualVoters / totalEligibleVoters) * 100;

  return {
    actualVoters,
    totalEligibleVoters,
    participationRate: participationRate.toFixed(2)
  };
};

/**
 * Get revenue analytics for paid elections
 */
export const getElectionRevenueAnalytics = async (electionId) => {
  const paymentsResult = await query(
    `SELECT 
       COUNT(*) as total_payments,
       SUM(amount) as total_revenue,
       SUM(platform_fee) as total_platform_fees,
       SUM(amount - platform_fee) as creator_revenue,
       AVG(amount) as avg_payment,
       gateway_used,
       COUNT(*) FILTER (WHERE status = 'succeeded') as successful_payments,
       COUNT(*) FILTER (WHERE status = 'failed') as failed_payments
     FROM votteryy_election_payments
     WHERE election_id = $1
     GROUP BY gateway_used`,
    [electionId]
  );

  const blockedAccountsResult = await query(
    `SELECT 
       COUNT(*) as voters_paid,
       SUM(amount) as locked_amount,
       SUM(platform_fee) as locked_fees,
       status
     FROM votteryy_blocked_accounts
     WHERE election_id = $1
     GROUP BY status`,
    [electionId]
  );

  return {
    payments: paymentsResult.rows,
    blockedAccounts: blockedAccountsResult.rows
  };
};

/**
 * Get platform-wide analytics
 */
export const getPlatformAnalytics = async (startDate, endDate) => {
  const result = await query(
    `SELECT 
       date,
       total_votes,
       total_elections,
       total_revenue,
       active_voters,
       new_voters
     FROM votteryy_platform_analytics
     WHERE date BETWEEN $1 AND $2
     ORDER BY date ASC`,
    [startDate, endDate]
  );

  return result.rows;
};

/**
 * Get voting patterns (peak times, etc.)
 */
export const getVotingPatterns = async (electionId) => {
  const hourlyPattern = await query(
    `SELECT 
       EXTRACT(HOUR FROM created_at) as hour,
       COUNT(*) as vote_count
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'
     GROUP BY hour
     ORDER BY hour ASC`,
    [electionId]
  );

  const dailyPattern = await query(
    `SELECT 
       EXTRACT(DOW FROM created_at) as day_of_week,
       COUNT(*) as vote_count
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'
     GROUP BY day_of_week
     ORDER BY day_of_week ASC`,
    [electionId]
  );

  return {
    hourlyPattern: hourlyPattern.rows,
    dailyPattern: dailyPattern.rows
  };
};

/**
 * Get answer distribution per question
 */
export const getQuestionAnalytics = async (electionId, questionId) => {
  const result = await query(
    `SELECT 
       answers->$2 as selected_options,
       COUNT(*) as count
     FROM votteryy_votes
     WHERE election_id = $1 AND status = 'valid'
     AND answers ? $2
     GROUP BY selected_options`,
    [electionId, questionId.toString()]
  );

  return result.rows;
};

/**
 * Get voter demographics (if available)
 */
export const getVoterDemographics = async (electionId) => {
  // This would require integration with user service
  // Placeholder for future implementation
  return {
    byAge: [],
    byGender: [],
    byLocation: []
  };
};

/**
 * Export election data for reporting
 */
export const exportElectionData = async (electionId, format = 'json') => {
  const votes = await query(
    `SELECT 
       v.id,
       v.voting_id,
       v.user_id,
       v.answers,
       v.created_at,
       v.is_edited,
       r.receipt_id,
       r.verification_code
     FROM votteryy_votes v
     LEFT JOIN votteryy_vote_receipts r ON v.voting_id = r.voting_id
     WHERE v.election_id = $1 AND v.status = 'valid'
     ORDER BY v.created_at ASC`,
    [electionId]
  );

  if (format === 'csv') {
    // Convert to CSV format
    const headers = ['Voting ID', 'User ID', 'Answers', 'Created At', 'Receipt ID'];
    const rows = votes.rows.map(v => [
      v.voting_id,
      v.user_id,
      JSON.stringify(v.answers),
      v.created_at,
      v.receipt_id
    ]);
    return { headers, rows };
  }

  return votes.rows;
};

/**
 * Get audit trail for election
 */
export const getElectionAuditTrail = async (electionId, page = 1, limit = 50) => {
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT * FROM votteryy_vote_audit_logs
     WHERE election_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [electionId, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_vote_audit_logs
     WHERE election_id = $1`,
    [electionId]
  );

  return {
    auditLogs: result.rows,
    total: parseInt(countResult.rows[0].total)
  };
};

/**
 * Update platform analytics (called daily via cron)
 */
export const updatePlatformAnalytics = async (date) => {
  const votesResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_votes 
     WHERE DATE(created_at) = $1 AND status = 'valid'`,
    [date]
  );

  const electionsResult = await query(
    `SELECT COUNT(DISTINCT election_id) as total FROM votteryy_votes 
     WHERE DATE(created_at) = $1`,
    [date]
  );

  const revenueResult = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM votteryy_wallet_transactions 
     WHERE DATE(created_at) = $1 AND status = 'success'`,
    [date]
  );

  const activeVotersResult = await query(
    `SELECT COUNT(DISTINCT user_id) as total FROM votteryy_votes 
     WHERE DATE(created_at) = $1`,
    [date]
  );

  await query(
    `INSERT INTO votteryy_platform_analytics 
     (date, total_votes, total_elections, total_revenue, active_voters, new_voters)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (date) 
     DO UPDATE SET 
       total_votes = $2,
       total_elections = $3,
       total_revenue = $4,
       active_voters = $5`,
    [
      date,
      parseInt(votesResult.rows[0].total),
      parseInt(electionsResult.rows[0].total),
      parseFloat(revenueResult.rows[0].total),
      parseInt(activeVotersResult.rows[0].total)
    ]
  );

  return { success: true, date };
};

export default {
  getElectionAnalytics,
  getVoteDistribution,
  getVotingTimeSeries,
  getGeographicDistribution,
  getParticipationRate,
  getElectionRevenueAnalytics,
  getPlatformAnalytics,
  getVotingPatterns,
  getQuestionAnalytics,
  getVoterDemographics,
  exportElectionData,
  getElectionAuditTrail,
  updatePlatformAnalytics
};
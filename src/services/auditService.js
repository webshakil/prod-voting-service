import { query } from '../config/database.js';
import { AUDIT_ACTIONS } from '../config/constants.js';

/**
 * Create comprehensive audit log entry
 */
export const createAuditLog = async ({
  actionType,
  userId,
  electionId = null,
  voteId = null,
  votingId = null,
  ipAddress = null,
  userAgent = null,
  details = null,
  severity = 'info'
}) => {
  try {
    await query(
      `INSERT INTO votteryy_vote_audit_logs 
       (action_type, user_id, election_id, vote_id, voting_id, 
        ip_address, user_agent, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
      [
        actionType,
        userId,
        electionId,
        voteId,
        votingId,
        ipAddress,
        userAgent,
        details ? JSON.stringify({ ...details, severity }) : null
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

/**
 * Log suspicious activity
 */
export const logSuspiciousActivity = async ({
  userId,
  electionId,
  activity,
  ipAddress,
  userAgent,
  reason
}) => {
  await createAuditLog({
    actionType: AUDIT_ACTIONS.SUSPICIOUS_ACTIVITY,
    userId,
    electionId,
    ipAddress,
    userAgent,
    severity: 'warning',
    details: {
      activity,
      reason,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Log failed vote attempt
 */
export const logFailedVoteAttempt = async ({
  userId,
  electionId,
  ipAddress,
  userAgent,
  reason,
  answers
}) => {
  await createAuditLog({
    actionType: AUDIT_ACTIONS.VOTE_ATTEMPT_FAILED,
    userId,
    electionId,
    ipAddress,
    userAgent,
    severity: 'warning',
    details: {
      reason,
      answersProvided: !!answers,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Get audit trail for user
 */
export const getUserAuditTrail = async (userId, limit = 100) => {
  const result = await query(
    `SELECT * FROM votteryy_vote_audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
};

/**
 * Get audit trail for election
 */
export const getElectionAuditTrail = async (electionId, limit = 100) => {
  const result = await query(
    `SELECT * FROM votteryy_vote_audit_logs
     WHERE election_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [electionId, limit]
  );

  return result.rows;
};

/**
 * Detect potential fraud patterns
 */
export const detectFraudPatterns = async (userId, electionId) => {
  const patterns = [];

  // Check for rapid voting attempts
  const rapidVotes = await query(
    `SELECT COUNT(*) as count FROM votteryy_vote_audit_logs
     WHERE user_id = $1 
     AND action_type IN ($2, $3)
     AND created_at > NOW() - INTERVAL '5 minutes'`,
    [userId, AUDIT_ACTIONS.VOTE_CAST, AUDIT_ACTIONS.VOTE_ATTEMPT_FAILED]
  );

  if (parseInt(rapidVotes.rows[0].count) > 5) {
    patterns.push({
      type: 'rapid_voting',
      severity: 'high',
      description: 'Multiple vote attempts in short timeframe'
    });
  }

  // Check for IP changes
  const ipChanges = await query(
    `SELECT COUNT(DISTINCT ip_address) as unique_ips
     FROM votteryy_vote_audit_logs
     WHERE user_id = $1
     AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );

  if (parseInt(ipChanges.rows[0].unique_ips) > 3) {
    patterns.push({
      type: 'ip_hopping',
      severity: 'medium',
      description: 'Multiple IP addresses in short timeframe'
    });
  }

  return patterns;
};

export default {
  createAuditLog,
  logSuspiciousActivity,
  logFailedVoteAttempt,
  getUserAuditTrail,
  getElectionAuditTrail,
  detectFraudPatterns
};
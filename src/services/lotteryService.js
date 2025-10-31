import { query, transaction } from '../config/database.js';
import { generateBallNumber, secureRandom, generateLotteryRandomSeed } from '../utils/cryptoUtils.js';
import { AUDIT_ACTIONS, TRANSACTION_TYPES, TRANSACTION_STATUS } from '../config/constants.js';

/**
 * Create lottery ticket when user votes
 */
export const createLotteryTicket = async (userId, electionId, votingId) => {
  const ballNumber = generateBallNumber(userId, electionId);
  const ticketNumber = `TIX-${electionId}-${ballNumber}`;

  const result = await query(
    `INSERT INTO votteryy_lottery_tickets 
     (user_id, election_id, voting_id, ticket_number, ball_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, electionId, votingId, ticketNumber, ballNumber]
  );

  return result.rows[0];
};

/**
 * Get lottery configuration from election
 */
export const getLotteryConfig = async (electionId) => {
  const result = await query(
    `SELECT lottery_config FROM votteryy_election_settings WHERE election_id = $1`,
    [electionId]
  );

  if (result.rows.length === 0 || !result.rows[0].lottery_config) {
    return null;
  }

  return result.rows[0].lottery_config;
};

/**
 * Get all tickets for an election
 */
export const getElectionTickets = async (electionId) => {
  const result = await query(
    `SELECT * FROM votteryy_lottery_tickets WHERE election_id = $1`,
    [electionId]
  );

  return result.rows;
};

/**
 * Select lottery winners using cryptographically secure RNG
 */
export const selectWinners = async (electionId, lotteryConfig) => {
  return transaction(async (client) => {
    // Get all tickets
    const ticketsResult = await client.query(
      `SELECT * FROM votteryy_lottery_tickets WHERE election_id = $1`,
      [electionId]
    );

    const tickets = ticketsResult.rows;
    
    if (tickets.length === 0) {
      throw new Error('No lottery tickets found');
    }

    const winnerCount = Math.min(
      parseInt(lotteryConfig.winner_count),
      tickets.length
    );

    // Generate random seed for transparency
    const randomSeed = generateLotteryRandomSeed();

    // Fisher-Yates shuffle using cryptographically secure random
    const shuffledTickets = [...tickets];
    for (let i = shuffledTickets.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1);
      [shuffledTickets[i], shuffledTickets[j]] = [shuffledTickets[j], shuffledTickets[i]];
    }

    // Select winners
    const winners = shuffledTickets.slice(0, winnerCount);

    // Calculate prize distribution
    const rewardAmount = parseFloat(lotteryConfig.reward_amount) || 0;
    const rewardType = lotteryConfig.reward_type;
    const prizeDescription = lotteryConfig.prize_description;

    // Insert winners
    for (let i = 0; i < winners.length; i++) {
      const rank = i + 1;
      let prizeAmount = 0;

      // Calculate individual prize amount
      if (rewardType === 'monetary' && rewardAmount > 0) {
        if (winnerCount === 1) {
          prizeAmount = rewardAmount;
        } else {
          // Progressive prize distribution: 1st gets more, 2nd less, etc.
          const weights = Array.from({ length: winnerCount }, (_, idx) => 
            winnerCount - idx
          );
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          prizeAmount = (rewardAmount * weights[i]) / totalWeight;
        }
      }

      await client.query(
        `INSERT INTO votteryy_lottery_winners 
         (election_id, user_id, ticket_id, rank, prize_amount, prize_description, prize_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          electionId,
          winners[i].user_id,
          winners[i].ticket_id,
          rank,
          prizeAmount.toFixed(2),
          prizeDescription,
          rewardType
        ]
      );

      // If monetary prize, credit to wallet (for small amounts)
      const autoApproveThreshold = parseFloat(process.env.WITHDRAWAL_AUTO_APPROVE_THRESHOLD) || 100;
      
      if (rewardType === 'monetary' && prizeAmount > 0 && prizeAmount <= autoApproveThreshold) {
        // Credit directly to wallet
        await client.query(
          `UPDATE votteryy_user_wallets 
           SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [prizeAmount, winners[i].user_id]
        );

        // Create transaction
        await client.query(
          `INSERT INTO votteryy_wallet_transactions 
           (user_id, transaction_type, amount, status, election_id, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            winners[i].user_id,
            TRANSACTION_TYPES.LOTTERY_PRIZE,
            prizeAmount,
            TRANSACTION_STATUS.SUCCESS,
            electionId,
            `Lottery prize - Rank ${rank}`
          ]
        );

        // Mark as claimed
        await client.query(
          `UPDATE votteryy_lottery_winners 
           SET claimed = true, claimed_at = CURRENT_TIMESTAMP
           WHERE election_id = $1 AND user_id = $2`,
          [electionId, winners[i].user_id]
        );
      }
    }

    // Create draw record
    const drawResult = await client.query(
      `INSERT INTO votteryy_lottery_draws 
       (election_id, total_participants, winner_count, random_seed, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        electionId,
        tickets.length,
        winnerCount,
        randomSeed,
        'completed',
        JSON.stringify({
          lotteryConfig,
          totalPrizePool: rewardAmount,
          rewardType
        })
      ]
    );

    return {
      draw: drawResult.rows[0],
      winners: winners.map((w, idx) => ({
        userId: w.user_id,
        ticketNumber: w.ticket_number,
        ballNumber: w.ball_number,
        rank: idx + 1
      }))
    };
  });
};

/**
 * Get lottery winners for an election
 */
export const getElectionWinners = async (electionId) => {
  const result = await query(
    `SELECT * FROM votteryy_lottery_winners 
     WHERE election_id = $1
     ORDER BY rank ASC`,
    [electionId]
  );

  return result.rows;
};

/**
 * Get user's lottery tickets
 */
export const getUserLotteryTickets = async (userId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT t.*, 
            w.rank, w.prize_amount, w.claimed,
            e.title as election_title
     FROM votteryy_lottery_tickets t
     LEFT JOIN votteryy_lottery_winners w ON t.ticket_id = w.ticket_id
     LEFT JOIN votteryy_elections e ON t.election_id = e.id
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_lottery_tickets WHERE user_id = $1`,
    [userId]
  );

  return {
    tickets: result.rows,
    total: parseInt(countResult.rows[0].total)
  };
};

/**
 * Claim prize (for manual review prizes)
 */
export const claimPrize = async (winnerId, userId) => {
  return transaction(async (client) => {
    const winnerResult = await client.query(
      `SELECT * FROM votteryy_lottery_winners 
       WHERE winner_id = $1 AND user_id = $2`,
      [winnerId, userId]
    );

    if (winnerResult.rows.length === 0) {
      throw new Error('Winner record not found');
    }

    const winner = winnerResult.rows[0];

    if (winner.claimed) {
      throw new Error('Prize already claimed');
    }

    // Mark as claimed
    await client.query(
      `UPDATE votteryy_lottery_winners 
       SET claimed = true, claimed_at = CURRENT_TIMESTAMP
       WHERE winner_id = $1`,
      [winnerId]
    );

    // For monetary prizes above threshold, create pending transaction
    if (winner.prize_type === 'monetary' && parseFloat(winner.prize_amount) > 0) {
      await client.query(
        `INSERT INTO votteryy_wallet_transactions 
         (user_id, transaction_type, amount, status, election_id, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          TRANSACTION_TYPES.LOTTERY_PRIZE,
          winner.prize_amount,
          TRANSACTION_STATUS.PENDING,
          winner.election_id,
          `Lottery prize claim - Rank ${winner.rank}`
        ]
      );
    }

    return winner;
  });
};

/**
 * Get lottery statistics for an election
 */
export const getLotteryStatistics = async (electionId) => {
  const ticketCount = await query(
    `SELECT COUNT(*) as total FROM votteryy_lottery_tickets WHERE election_id = $1`,
    [electionId]
  );

  const winnerCount = await query(
    `SELECT COUNT(*) as total FROM votteryy_lottery_winners WHERE election_id = $1`,
    [electionId]
  );

  const claimedCount = await query(
    `SELECT COUNT(*) as total FROM votteryy_lottery_winners 
     WHERE election_id = $1 AND claimed = true`,
    [electionId]
  );

  const drawInfo = await query(
    `SELECT * FROM votteryy_lottery_draws WHERE election_id = $1`,
    [electionId]
  );

  return {
    totalTickets: parseInt(ticketCount.rows[0].total),
    totalWinners: parseInt(winnerCount.rows[0].total),
    claimedPrizes: parseInt(claimedCount.rows[0].total),
    drawCompleted: drawInfo.rows.length > 0,
    drawInfo: drawInfo.rows[0] || null
  };
};

export default {
  createLotteryTicket,
  getLotteryConfig,
  getElectionTickets,
  selectWinners,
  getElectionWinners,
  getUserLotteryTickets,
  claimPrize,
  getLotteryStatistics
};
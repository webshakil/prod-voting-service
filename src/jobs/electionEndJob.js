import cron from 'node-cron';
import { query } from '../config/database.js';
import * as lotteryService from '../services/lotteryService.js';
import * as walletService from '../services/walletService.js';

/**
 * Process ended elections
 * Runs every hour to check for elections that have ended
 */
export const processEndedElections = async () => {
  try {
    console.log('[CRON] Checking for ended elections...');

    const endedElections = await query(
      `SELECT e.id, e.title, e.creator_user_id, e.lottery_config, e.end_date
       FROM votteryy_elections e
       WHERE e.end_date < NOW()
       AND e.end_date > NOW() - INTERVAL '2 hours'
       AND NOT EXISTS (
         SELECT 1 FROM votteryy_lottery_draws ld 
         WHERE ld.election_id = e.id
       )
       AND e.lottery_config IS NOT NULL
       AND (e.lottery_config->>'is_lotterized')::boolean = true`
    );

    console.log(`[CRON] Found ${endedElections.rows.length} elections to process`);

    for (const election of endedElections.rows) {
      try {
        console.log(`[CRON] Processing election: ${election.title} (ID: ${election.id})`);

        const lotteryConfig = election.lottery_config;
        const drawResult = await lotteryService.selectWinners(election.id, lotteryConfig);

        console.log(`[CRON] Lottery draw completed for election ${election.id}`);
        console.log(`[CRON] Winners: ${drawResult.winners.length}`);

        const releaseResult = await walletService.releaseBlockedAccounts(
          election.id,
          election.creator_user_id
        );

        console.log(`[CRON] Funds released for election ${election.id}`);
        console.log(`[CRON] Total amount: $${releaseResult.totalAmount}`);
        console.log(`[CRON] Creator amount: $${releaseResult.creatorAmount}`);
        console.log(`[CRON] Platform fee: $${releaseResult.platformFee}`);

      } catch (error) {
        console.error(`[CRON] Error processing election ${election.id}:`, error);
      }
    }

    console.log('[CRON] Election processing complete');
  } catch (error) {
    console.error('[CRON] Error in processEndedElections:', error);
  }
};

/**
 * Start the cron job
 */
export const startElectionEndCron = () => {
  console.log('[CRON] Starting election end processor...');
  
  cron.schedule('5 * * * *', processEndedElections);
  
  console.log('[CRON] Election end processor scheduled (runs every hour at minute 5)');
};

export default { processEndedElections, startElectionEndCron };
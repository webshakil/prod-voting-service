import { query, transaction } from '../config/database.js';
import { 
  TRANSACTION_TYPES, 
  TRANSACTION_STATUS,
  BLOCKED_ACCOUNT_STATUS,
  WITHDRAWAL_STATUS 
} from '../config/constants.js';

/**
 * Get or create user wallet
 */
export const getOrCreateWallet = async (userId) => {
  return transaction(async (client) => {
    // Check if wallet exists
    const walletResult = await client.query(
      `SELECT * FROM votteryy_user_wallets WHERE user_id = $1`,
      [userId]
    );

    if (walletResult.rows.length > 0) {
      return walletResult.rows[0];
    }

    // Create new wallet
    const newWalletResult = await client.query(
      `INSERT INTO votteryy_user_wallets (user_id, balance, blocked_balance, currency)
       VALUES ($1, 0.00, 0.00, 'USD')
       RETURNING *`,
      [userId]
    );

    return newWalletResult.rows[0];
  });
};

/**
 * Get wallet balance
 */
export const getWalletBalance = async (userId) => {
  const result = await query(
    `SELECT balance, blocked_balance, currency FROM votteryy_user_wallets 
     WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    // Create wallet if doesn't exist
    return await getOrCreateWallet(userId);
  }

  return result.rows[0];
};

/**
 * Add transaction
 */
export const addTransaction = async (
  userId,
  type,
  amount,
  status,
  electionId = null,
  paymentIntentId = null,
  description = null,
  metadata = null
) => {
  const result = await query(
    `INSERT INTO votteryy_wallet_transactions 
     (user_id, transaction_type, amount, status, election_id, 
      payment_intent_id, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      type,
      amount,
      status,
      electionId,
      paymentIntentId,
      description,
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return result.rows[0];
};

/**
 * Update wallet balance
 */
export const updateWalletBalance = async (userId, amount, isBlocked = false) => {
  return transaction(async (client) => {
    // Get current wallet
    await getOrCreateWallet(userId);

    // Update balance
    const column = isBlocked ? 'blocked_balance' : 'balance';
    const result = await client.query(
      `UPDATE votteryy_user_wallets 
       SET ${column} = ${column} + $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING *`,
      [amount, userId]
    );

    return result.rows[0];
  });
};

/**
 * Process deposit
 */
export const processDeposit = async (userId, amount, paymentIntentId, metadata) => {
  return transaction(async (client) => {
    // Create transaction record
    await client.query(
      `INSERT INTO votteryy_wallet_transactions 
       (user_id, transaction_type, amount, status, payment_intent_id, 
        description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        TRANSACTION_TYPES.DEPOSIT,
        amount,
        TRANSACTION_STATUS.SUCCESS,
        paymentIntentId,
        'Wallet deposit',
        JSON.stringify(metadata)
      ]
    );

    // Update wallet balance
    await client.query(
      `UPDATE votteryy_user_wallets 
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Get updated balance
    const balanceResult = await client.query(
      `SELECT balance FROM votteryy_user_wallets WHERE user_id = $1`,
      [userId]
    );

    return balanceResult.rows[0];
  });
};

/**
 * Request withdrawal
 */
export const requestWithdrawal = async (
  userId,
  amount,
  paymentMethod,
  paymentDetails
) => {
  return transaction(async (client) => {
    // Check balance
    const walletResult = await client.query(
      `SELECT balance FROM votteryy_user_wallets WHERE user_id = $1`,
      [userId]
    );

    if (walletResult.rows.length === 0 || walletResult.rows[0].balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from balance
    await client.query(
      `UPDATE votteryy_user_wallets 
       SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Create withdrawal request
    const autoApproveThreshold = parseFloat(process.env.WITHDRAWAL_AUTO_APPROVE_THRESHOLD) || 100;
    const initialStatus = amount <= autoApproveThreshold 
      ? WITHDRAWAL_STATUS.APPROVED 
      : WITHDRAWAL_STATUS.PENDING;

    const requestResult = await client.query(
      `INSERT INTO votteryy_withdrawal_requests 
       (user_id, amount, status, payment_method, payment_details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, amount, initialStatus, paymentMethod, JSON.stringify(paymentDetails)]
    );

    // Create transaction record
    await client.query(
      `INSERT INTO votteryy_wallet_transactions 
       (user_id, transaction_type, amount, status, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        TRANSACTION_TYPES.WITHDRAW,
        amount,
        initialStatus === WITHDRAWAL_STATUS.APPROVED 
          ? TRANSACTION_STATUS.SUCCESS 
          : TRANSACTION_STATUS.PENDING,
        `Withdrawal request - ${paymentMethod}`
      ]
    );

    return requestResult.rows[0];
  });
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (userId, filters = {}, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let whereConditions = ['user_id = $1'];
  let params = [userId];
  let paramIndex = 2;

  // Apply filters
  if (filters.type) {
    whereConditions.push(`transaction_type = $${paramIndex}`);
    params.push(filters.type);
    paramIndex++;
  }

  if (filters.status) {
    whereConditions.push(`status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.startDate) {
    whereConditions.push(`created_at >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    whereConditions.push(`created_at <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  if (filters.electionId) {
    whereConditions.push(`election_id = $${paramIndex}`);
    params.push(filters.electionId);
    paramIndex++;
  }

  const whereClause = whereConditions.join(' AND ');

  // Get transactions
  const result = await query(
    `SELECT * FROM votteryy_wallet_transactions 
     WHERE ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_wallet_transactions 
     WHERE ${whereClause}`,
    params
  );

  return {
    transactions: result.rows,
    total: parseInt(countResult.rows[0].total)
  };
};

/**
 * Get withdrawal requests (admin)
 */
export const getWithdrawalRequests = async (status = null, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  let whereClause = status ? 'WHERE status = $1' : '';
  let params = status ? [status, limit, offset] : [limit, offset];

  const result = await query(
    `SELECT * FROM votteryy_withdrawal_requests 
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM votteryy_withdrawal_requests ${whereClause}`,
    status ? [status] : []
  );

  return {
    requests: result.rows,
    total: parseInt(countResult.rows[0].total)
  };
};

/**
 * Approve withdrawal (admin)
 */
export const approveWithdrawal = async (requestId, adminUserId, notes = null) => {
  return transaction(async (client) => {
    // Get request
    const requestResult = await client.query(
      `SELECT * FROM votteryy_withdrawal_requests WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Withdrawal request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== WITHDRAWAL_STATUS.PENDING) {
      throw new Error('Withdrawal request is not pending');
    }

    // Update request status
    await client.query(
      `UPDATE votteryy_withdrawal_requests 
       SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, 
           admin_notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $4`,
      [WITHDRAWAL_STATUS.APPROVED, adminUserId, notes, requestId]
    );

    // Update transaction status
    await client.query(
      `UPDATE votteryy_wallet_transactions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND transaction_type = $3 AND amount = $4 
       AND status = $5
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        TRANSACTION_STATUS.SUCCESS,
        request.user_id,
        TRANSACTION_TYPES.WITHDRAW,
        request.amount,
        TRANSACTION_STATUS.PENDING
      ]
    );

    return requestResult.rows[0];
  });
};

/**
 * Reject withdrawal (admin)
 */
export const rejectWithdrawal = async (requestId, adminUserId, notes) => {
  return transaction(async (client) => {
    // Get request
    const requestResult = await client.query(
      `SELECT * FROM votteryy_withdrawal_requests WHERE request_id = $1`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      throw new Error('Withdrawal request not found');
    }

    const request = requestResult.rows[0];

    // Refund to wallet
    await client.query(
      `UPDATE votteryy_user_wallets 
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [request.amount, request.user_id]
    );

    // Update request status
    await client.query(
      `UPDATE votteryy_withdrawal_requests 
       SET status = $1, approved_by = $2, admin_notes = $3, 
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $4`,
      [WITHDRAWAL_STATUS.REJECTED, adminUserId, notes, requestId]
    );

    // Update transaction status
    await client.query(
      `UPDATE votteryy_wallet_transactions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND transaction_type = $3 AND amount = $4 
       AND status = $5
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        TRANSACTION_STATUS.CANCELLED,
        request.user_id,
        TRANSACTION_TYPES.WITHDRAW,
        request.amount,
        TRANSACTION_STATUS.PENDING
      ]
    );

    return requestResult.rows[0];
  });
};

/**
 * Create blocked account entry
 */
export const createBlockedAccount = async (
  userId,
  electionId,
  amount,
  platformFee,
  lockedUntil
) => {
  const result = await query(
    `INSERT INTO votteryy_blocked_accounts 
     (user_id, election_id, amount, platform_fee, status, locked_until)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, electionId, amount, platformFee, BLOCKED_ACCOUNT_STATUS.LOCKED, lockedUntil]
  );

  // Update wallet blocked balance
  await updateWalletBalance(userId, amount, true);

  return result.rows[0];
};

/**
 * Release blocked accounts for completed election
 */
export const releaseBlockedAccounts = async (electionId, creatorUserId) => {
  return transaction(async (client) => {
    // Get all blocked accounts for this election
    const blockedAccounts = await client.query(
      `SELECT * FROM votteryy_blocked_accounts 
       WHERE election_id = $1 AND status = $2`,
      [electionId, BLOCKED_ACCOUNT_STATUS.LOCKED]
    );

    let totalAmount = 0;
    let totalPlatformFee = 0;

    for (const account of blockedAccounts.rows) {
      totalAmount += parseFloat(account.amount);
      totalPlatformFee += parseFloat(account.platform_fee);

      // Update blocked account status
      await client.query(
        `UPDATE votteryy_blocked_accounts 
         SET status = $1, released_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [BLOCKED_ACCOUNT_STATUS.RELEASED, account.id]
      );

      // Reduce blocked balance
      await client.query(
        `UPDATE votteryy_user_wallets 
         SET blocked_balance = blocked_balance - $1
         WHERE user_id = $2`,
        [account.amount, account.user_id]
      );
    }

    // Transfer to creator (minus platform fee)
    const creatorAmount = totalAmount - totalPlatformFee;
    
    await client.query(
      `UPDATE votteryy_user_wallets 
       SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [creatorAmount, creatorUserId]
    );

    // Create transaction for creator
    await client.query(
      `INSERT INTO votteryy_wallet_transactions 
       (user_id, transaction_type, amount, status, election_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        creatorUserId,
        TRANSACTION_TYPES.ELECTION_PAYMENT,
        creatorAmount,
        TRANSACTION_STATUS.SUCCESS,
        electionId,
        'Election revenue payment'
      ]
    );

    // Platform fee transaction (for accounting)
    await client.query(
      `INSERT INTO votteryy_wallet_transactions 
       (user_id, transaction_type, amount, status, election_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'platform',
        TRANSACTION_TYPES.PLATFORM_FEE,
        totalPlatformFee,
        TRANSACTION_STATUS.SUCCESS,
        electionId,
        'Platform processing fee'
      ]
    );

    return {
      totalAmount,
      creatorAmount,
      platformFee: totalPlatformFee,
      participantCount: blockedAccounts.rows.length
    };
  });
};

/**
 * Refund blocked accounts for cancelled election
 */
export const refundBlockedAccounts = async (electionId) => {
  return transaction(async (client) => {
    // Get all blocked accounts
    const blockedAccounts = await client.query(
      `SELECT * FROM votteryy_blocked_accounts 
       WHERE election_id = $1 AND status = $2`,
      [electionId, BLOCKED_ACCOUNT_STATUS.LOCKED]
    );

    for (const account of blockedAccounts.rows) {
      // Update status
      await client.query(
        `UPDATE votteryy_blocked_accounts 
         SET status = $1
         WHERE id = $2`,
        [BLOCKED_ACCOUNT_STATUS.REFUNDED, account.id]
      );

      // Refund to user balance
      await client.query(
        `UPDATE votteryy_user_wallets 
         SET balance = balance + $1, 
             blocked_balance = blocked_balance - $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3`,
        [account.amount, account.amount, account.user_id]
      );

      // Create refund transaction
      await client.query(
        `INSERT INTO votteryy_wallet_transactions 
         (user_id, transaction_type, amount, status, election_id, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          account.user_id,
          TRANSACTION_TYPES.REFUND,
          account.amount,
          TRANSACTION_STATUS.SUCCESS,
          electionId,
          'Election cancelled - refund'
        ]
      );
    }

    return {
      refundedCount: blockedAccounts.rows.length
    };
  });
};

export default {
  getOrCreateWallet,
  getWalletBalance,
  addTransaction,
  updateWalletBalance,
  processDeposit,
  requestWithdrawal,
  getTransactionHistory,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
  createBlockedAccount,
  releaseBlockedAccounts,
  refundBlockedAccounts
};
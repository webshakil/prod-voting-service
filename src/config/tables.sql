

-- Main votes table
CREATE TABLE IF NOT EXISTS votteryy_votes (
  id SERIAL PRIMARY KEY,
  voting_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  answers JSONB NOT NULL, -- {question_id: [option_ids]}
  encrypted_vote TEXT NOT NULL,
  vote_hash VARCHAR(64) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'valid', -- valid, edited, flagged, invalid
  is_edited BOOLEAN DEFAULT FALSE,
  original_vote_id INTEGER REFERENCES votteryy_votes(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, election_id, status) -- One valid vote per user per election
);

-- Vote receipts for verification
CREATE TABLE IF NOT EXISTS votteryy_vote_receipts (
  id SERIAL PRIMARY KEY,
  voting_id UUID NOT NULL REFERENCES votteryy_votes(voting_id),
  receipt_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  vote_hash VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  election_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  verification_code VARCHAR(100) NOT NULL
);

-- Vote audit logs (immutable)
CREATE TABLE IF NOT EXISTS votteryy_vote_audit_logs (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL, -- vote_cast, vote_edited, vote_verified, vote_flagged
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  vote_id INTEGER REFERENCES votteryy_votes(id),
  voting_id UUID,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS votteryy_video_watch_progress (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  watch_percentage DECIMAL(5, 2) DEFAULT 0, -- 0.00 to 100.00
  last_position INTEGER DEFAULT 0, -- seconds
  total_duration INTEGER, -- seconds
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, election_id)
);



-- User wallets
CREATE TABLE IF NOT EXISTS votteryy_user_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  blocked_balance DECIMAL(12, 2) DEFAULT 0.00, -- Money in blocked accounts
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS votteryy_wallet_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- deposit, withdraw, election_payment, prize_won, refund, platform_fee
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed, cancelled
  election_id INTEGER,
  payment_intent_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocked accounts (hold voter payments until election ends)
CREATE TABLE IF NOT EXISTS votteryy_blocked_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  platform_fee DECIMAL(12, 2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'locked', -- locked, released, refunded
  locked_until TIMESTAMP,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, election_id)
);

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS votteryy_withdrawal_requests (
  id SERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
  payment_method VARCHAR(50), -- stripe, paddle, bank_transfer
  payment_details JSONB,
  admin_notes TEXT,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Election payments
CREATE TABLE IF NOT EXISTS votteryy_election_payments (
  id SERIAL PRIMARY KEY,
  payment_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  payment_intent_id VARCHAR(255), -- Stripe/Paddle payment ID
  gateway_used VARCHAR(50), -- stripe, paddle
  amount DECIMAL(12, 2) NOT NULL,
  platform_fee DECIMAL(12, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending', -- pending, succeeded, failed, refunded
  payment_method VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, election_id, status) -- One successful payment per user per election
);

-- Payment gateway configurations (for regional switching)
CREATE TABLE IF NOT EXISTS votteryy_payment_gateway_config (
  id SERIAL PRIMARY KEY,
  region_zone INTEGER NOT NULL, -- 1-8 for 8 regions
  gateway_name VARCHAR(50) NOT NULL, -- stripe, paddle, both
  split_percentage INTEGER DEFAULT 100, -- 100 for single, 50 for both
  is_active BOOLEAN DEFAULT TRUE,
  stripe_enabled BOOLEAN DEFAULT TRUE,
  paddle_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(region_zone)
);



-- Lottery tickets (auto-created on vote)
CREATE TABLE IF NOT EXISTS votteryy_lottery_tickets (
  id SERIAL PRIMARY KEY,
  ticket_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  election_id INTEGER NOT NULL,
  voting_id UUID NOT NULL REFERENCES votteryy_votes(voting_id),
  ticket_number VARCHAR(50) NOT NULL,
  ball_number INTEGER NOT NULL, -- Deterministic from user ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, election_id)
);

-- Lottery winners
CREATE TABLE IF NOT EXISTS votteryy_lottery_winners (
  id SERIAL PRIMARY KEY,
  winner_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  election_id INTEGER NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  ticket_id UUID NOT NULL REFERENCES votteryy_lottery_tickets(ticket_id),
  rank INTEGER NOT NULL, -- 1st, 2nd, 3rd, etc.
  prize_amount DECIMAL(12, 2),
  prize_description TEXT,
  prize_type VARCHAR(50), -- monetary, coupon, voucher, experience
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP,
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lottery draws (execution log)
CREATE TABLE IF NOT EXISTS votteryy_lottery_draws (
  id SERIAL PRIMARY KEY,
  draw_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  election_id INTEGER NOT NULL,
  total_participants INTEGER NOT NULL,
  winner_count INTEGER NOT NULL,
  draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  random_seed VARCHAR(255), -- For transparency
  status VARCHAR(50) DEFAULT 'completed', -- completed, failed
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Vote analytics (aggregated data)
CREATE TABLE IF NOT EXISTS votteryy_vote_analytics (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL UNIQUE,
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  votes_by_question JSONB, -- {question_id: count}
  votes_by_option JSONB, -- {option_id: count}
  participation_rate DECIMAL(5, 2),
  geographic_distribution JSONB,
  time_series_data JSONB,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform analytics
CREATE TABLE IF NOT EXISTS votteryy_platform_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_votes INTEGER DEFAULT 0,
  total_elections INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0.00,
  active_voters INTEGER DEFAULT 0,
  new_voters INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Voting indexes
CREATE INDEX idx_votes_user_election ON votteryy_votes(user_id, election_id);
CREATE INDEX idx_votes_election_status ON votteryy_votes(election_id, status);
CREATE INDEX idx_votes_created_at ON votteryy_votes(created_at DESC);
CREATE INDEX idx_vote_receipts_receipt_id ON votteryy_vote_receipts(receipt_id);
CREATE INDEX idx_vote_audit_election ON votteryy_vote_audit_logs(election_id);
CREATE INDEX idx_vote_audit_user ON votteryy_vote_audit_logs(user_id);

-- Video watch indexes
CREATE INDEX idx_video_watch_user_election ON votteryy_video_watch_progress(user_id, election_id);
CREATE INDEX idx_video_watch_completed ON votteryy_video_watch_progress(completed);

-- Wallet indexes
CREATE INDEX idx_wallet_user ON votteryy_user_wallets(user_id);
CREATE INDEX idx_transactions_user ON votteryy_wallet_transactions(user_id);
CREATE INDEX idx_transactions_election ON votteryy_wallet_transactions(election_id);
CREATE INDEX idx_transactions_status ON votteryy_wallet_transactions(status);
CREATE INDEX idx_transactions_created ON votteryy_wallet_transactions(created_at DESC);
CREATE INDEX idx_blocked_accounts_election ON votteryy_blocked_accounts(election_id);
CREATE INDEX idx_withdrawal_status ON votteryy_withdrawal_requests(status);

-- Payment indexes
CREATE INDEX idx_payments_user_election ON votteryy_election_payments(user_id, election_id);
CREATE INDEX idx_payments_status ON votteryy_election_payments(status);
CREATE INDEX idx_payments_created ON votteryy_election_payments(created_at DESC);

-- Lottery indexes
CREATE INDEX idx_lottery_tickets_election ON votteryy_lottery_tickets(election_id);
CREATE INDEX idx_lottery_tickets_user ON votteryy_lottery_tickets(user_id);
CREATE INDEX idx_lottery_winners_election ON votteryy_lottery_winners(election_id);
CREATE INDEX idx_lottery_winners_user ON votteryy_lottery_winners(user_id);
CREATE INDEX idx_lottery_draws_election ON votteryy_lottery_draws(election_id);

-- Analytics indexes
CREATE INDEX idx_vote_analytics_election ON votteryy_vote_analytics(election_id);
CREATE INDEX idx_platform_analytics_date ON votteryy_platform_analytics(date DESC);

-- ===========================
-- 8. FUNCTIONS & TRIGGERS
-- ===========================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp triggers
CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON votteryy_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_watch_updated_at BEFORE UPDATE ON votteryy_video_watch_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON votteryy_user_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON votteryy_wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON votteryy_election_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- 9. INITIAL DATA
-- ===========================

-- Insert default payment gateway configs for 8 regions
INSERT INTO votteryy_payment_gateway_config (region_zone, gateway_name, stripe_enabled, paddle_enabled, split_percentage)
VALUES 
  (1, 'stripe', true, false, 100), -- US & Canada
  (2, 'stripe', true, false, 100), -- Western Europe
  (3, 'stripe', true, false, 100), -- Eastern Europe
  (4, 'stripe', true, false, 100), -- Africa
  (5, 'stripe', true, false, 100), -- Latin America
  (6, 'stripe', true, false, 100), -- Middle East/Asia
  (7, 'stripe', true, false, 100), -- Australasia
  (8, 'stripe', true, false, 100)  -- China/HK/Macau
ON CONFLICT (region_zone) DO NOTHING;

-- ===========================
-- SCHEMA COMPLETE
-- ===========================
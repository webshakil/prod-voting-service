// src/config/constants.js

// User Roles
export const USER_ROLES = {
  VOTER: 'Voter',
  CONTENT_CREATOR: 'Content_Creator',
  CONTENT_CREATOR_SUBSCRIBED: 'Content_Creator_Subscribed',
  ORGANIZATION_CREATOR: 'Organization_Creator',
  ORGANIZATION_CREATOR_SUBSCRIBED: 'Organization_Creator_Subscribed',
  PLATFORM_ADMIN: 'Platform_Admin',
  MANAGER: 'Manager',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  AUDITOR: 'Auditor',
  EDITOR: 'Editor',
  ADVERTISER: 'Advertiser',
  ANALYST: 'Analyst',
  SPONSOR: 'Sponsor'
};

// Admin roles for quick checking
export const ADMIN_ROLES = [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.ADMIN,
  USER_ROLES.MODERATOR,
  USER_ROLES.AUDITOR,
  USER_ROLES.EDITOR,
  USER_ROLES.ADVERTISER,
  USER_ROLES.ANALYST,
  USER_ROLES.SPONSOR
];

// Creator roles
export const CREATOR_ROLES = [
  USER_ROLES.CONTENT_CREATOR,
  USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
  USER_ROLES.ORGANIZATION_CREATOR,
  USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
];

// Vote Status
export const VOTE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  EDITED: 'edited',
  FLAGGED: 'flagged'
};

// Transaction Types
export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  ELECTION_PAYMENT: 'election_payment',
  PRIZE_WON: 'prize_won',
  REFUND: 'refund',
  PROCESSING_FEE: 'processing_fee',
  PLATFORM_FEE: 'platform_fee'
};

// Transaction Status
export const TRANSACTION_STATUS = {
  SUCCESS: 'success',
  PENDING: 'pending',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Payment Status
// export const PAYMENT_STATUS = {
//   PENDING: 'pending',
//   PROCESSING: 'processing',
//   SUCCEEDED: 'succeeded',
//   FAILED: 'failed',
//   CANCELLED: 'cancelled',
//   REFUNDED: 'refunded'
// };

// Wallet Status
export const WALLET_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  SUSPENDED: 'suspended'
};

// Blocked Account Status
// export const BLOCKED_ACCOUNT_STATUS = {
//   LOCKED: 'locked',
//   PENDING_RELEASE: 'pending_release',
//   RELEASED: 'released',
//   REFUNDED: 'refunded'
// };

// Withdrawal Status
// export const WITHDRAWAL_STATUS = {
//   PENDING: 'pending',
//   PROCESSING: 'processing',
//   APPROVED: 'approved',
//   COMPLETED: 'completed',
//   REJECTED: 'rejected',
//   CANCELLED: 'cancelled',
//   FAILED: 'failed'
// };

// Lottery Prize Types
export const PRIZE_TYPES = {
  MONETARY: 'monetary',
  COUPON: 'coupon',
  VOUCHER: 'voucher',
  EXPERIENCE: 'experience'
};

// Lottery Funding Sources
export const FUNDING_SOURCES = {
  CREATOR_FUNDED: 'creator_funded',
  PROJECTED_REVENUE: 'projected_revenue',
  SPONSOR_FUNDED: 'sponsor_funded'
};

// Audit Actions
// export const AUDIT_ACTIONS = {
//   VOTE_CAST: 'vote_cast',
//   VOTE_EDITED: 'vote_edited',
//   VOTE_VERIFIED: 'vote_verified',
//   VOTE_FLAGGED: 'vote_flagged',
//   PAYMENT_INITIATED: 'payment_initiated',
//   PAYMENT_COMPLETED: 'payment_completed',
//   PAYMENT_FAILED: 'payment_failed',
//   WALLET_DEPOSIT: 'wallet_deposit',
//   WALLET_WITHDRAW: 'wallet_withdraw',
//   LOTTERY_DRAWN: 'lottery_drawn',
//   PRIZE_CLAIMED: 'prize_claimed',
//   PRIZE_DISTRIBUTED: 'prize_distributed'
// };

// Video Watch Requirements
export const VIDEO_WATCH_REQUIREMENTS = {
  FULL_VIDEO: 100,
  MINIMUM_PERCENTAGE: 50,
  DEFAULT_PERCENTAGE: 80
};

// Regional Zones
export const REGIONAL_ZONES = {
  ZONE_1: 'us_canada',
  ZONE_2: 'western_europe',
  ZONE_3: 'eastern_europe',
  ZONE_4: 'africa',
  ZONE_5: 'latin_america',
  ZONE_6: 'middle_east_asia',
  ZONE_7: 'australasia',
  ZONE_8: 'china_hk_macau'
};

// Payment Gateways
export const PAYMENT_GATEWAYS = {
  STRIPE: 'stripe',
  PADDLE: 'paddle'
};

// Currency
export const DEFAULT_CURRENCY = 'USD';

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

// Rate Limiting
export const RATE_LIMITS = {
  VOTE_SUBMIT: 5, // 5 attempts per hour
  PAYMENT_CREATE: 10, // 10 payment attempts per hour
  WALLET_WITHDRAW: 3, // 3 withdrawal requests per hour
  VIDEO_PROGRESS: 100 // 100 updates per hour
};

// Encryption
export const ENCRYPTION = {
  ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  AUTH_TAG_LENGTH: 16,
  HASH_ALGORITHM: 'sha256'
};

// Lottery Settings
export const LOTTERY_SETTINGS = {
  MIN_WINNERS: 1,
  MAX_WINNERS: 100,
  DEFAULT_WINNERS: 1,
  AUTO_APPROVE_THRESHOLD: 100, // Auto-approve prizes under $100
  DRAW_DELAY_SECONDS: 5 // Delay after election ends
};

// Voting Types
export const VOTING_TYPES = {
  PLURALITY: 'plurality',
  RANKED_CHOICE: 'ranked_choice',
  APPROVAL: 'approval'
};

// Question Formats
export const QUESTION_FORMATS = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TEXT_ANSWER: 'text_answer',
  IMAGE_BASED: 'image_based'
};

// Election States
export const ELECTION_STATES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  ELECTION_NOT_FOUND: 'Election not found',
  ALREADY_VOTED: 'You have already voted in this election',
  ELECTION_NOT_ACTIVE: 'Election is not currently active',
  PAYMENT_REQUIRED: 'Payment required to vote',
  VIDEO_NOT_WATCHED: 'Video watch requirement not met',
  INVALID_VOTE_DATA: 'Invalid vote data',
  INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
  INVALID_TRANSACTION: 'Invalid transaction',
  LOTTERY_NOT_ENABLED: 'Lottery is not enabled for this election',
  PRIZE_ALREADY_CLAIMED: 'Prize has already been claimed',
  VOTE_EDITING_NOT_ALLOWED: 'Vote editing is not allowed for this election',
  INVALID_PAYMENT_INTENT: 'Invalid payment intent',
  WITHDRAWAL_LIMIT_EXCEEDED: 'Withdrawal limit exceeded',
  BLOCKED_ACCOUNT: 'Account is blocked'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  VOTE_SUBMITTED: 'Vote submitted successfully',
  VOTE_UPDATED: 'Vote updated successfully',
  PAYMENT_SUCCESSFUL: 'Payment successful',
  WALLET_CREDITED: 'Wallet credited successfully',
  WITHDRAWAL_INITIATED: 'Withdrawal initiated successfully',
  LOTTERY_DRAWN: 'Lottery drawn successfully',
  PRIZE_CLAIMED: 'Prize claimed successfully'
};

// Time Constants (in milliseconds)
export const TIME_CONSTANTS = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000
};

// Blocked Account Duration
export const BLOCKED_ACCOUNT_DURATION = {
  DEFAULT_DAYS: 30,
  EXTENSION_DAYS: 60
};

// File Upload Limits
export const FILE_LIMITS = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm']
};

export const AUDIT_ACTIONS = {
  VOTE_CAST: 'vote_cast',
  VOTE_EDITED: 'vote_edited',
  VOTE_VERIFIED: 'vote_verified',
  VOTE_FLAGGED: 'vote_flagged',
  VIDEO_STARTED: 'video_started',
  VIDEO_COMPLETED: 'video_completed',
  LOTTERY_TICKET_CREATED: 'lottery_ticket_created',
  LOTTERY_DRAW_COMPLETED: 'lottery_draw_completed',
  PAYMENT_COMPLETED: 'payment_completed',
  WITHDRAWAL_REQUESTED: 'withdrawal_requested',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  VOTE_ATTEMPT_FAILED: 'vote_attempt_failed',
  IP_CHANGE_DETECTED: 'ip_change_detected',
  FRAUD_PATTERN_DETECTED: 'fraud_pattern_detected'
};

export const BLOCKED_ACCOUNT_STATUS = {
  LOCKED: 'locked',
  RELEASED: 'released',
  REFUNDED: 'refunded'
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed'
};

export default {
  USER_ROLES,
  ADMIN_ROLES,
  CREATOR_ROLES,
  VOTE_STATUS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  PAYMENT_STATUS,
  WALLET_STATUS,
  BLOCKED_ACCOUNT_STATUS,
  WITHDRAWAL_STATUS,
  PRIZE_TYPES,
  FUNDING_SOURCES,
  AUDIT_ACTIONS,
  VIDEO_WATCH_REQUIREMENTS,
  REGIONAL_ZONES,
  PAYMENT_GATEWAYS,
  DEFAULT_CURRENCY,
  PAGINATION,
  RATE_LIMITS,
  ENCRYPTION,
  LOTTERY_SETTINGS,
  VOTING_TYPES,
  QUESTION_FORMATS,
  ELECTION_STATES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TIME_CONSTANTS,
  BLOCKED_ACCOUNT_DURATION,
  FILE_LIMITS
};
// // src/config/constants.js

// // User Roles
// export const USER_ROLES = {
//   VOTER: 'Voter',
//   CONTENT_CREATOR: 'Content_Creator',
//   CONTENT_CREATOR_SUBSCRIBED: 'Content_Creator_Subscribed',
//   ORGANIZATION_CREATOR: 'Organization_Creator',
//   ORGANIZATION_CREATOR_SUBSCRIBED: 'Organization_Creator_Subscribed',
//   PLATFORM_ADMIN: 'Platform_Admin',
//   MANAGER: 'Manager',
//   ADMIN: 'Admin',
//   MODERATOR: 'Moderator',
//   AUDITOR: 'Auditor',
//   EDITOR: 'Editor',
//   ADVERTISER: 'Advertiser',
//   ANALYST: 'Analyst',
//   SPONSOR: 'Sponsor'
// };

// // Admin roles for quick checking
// export const ADMIN_ROLES = [
//   USER_ROLES.PLATFORM_ADMIN,
//   USER_ROLES.MANAGER,
//   USER_ROLES.ADMIN,
//   USER_ROLES.MODERATOR,
//   USER_ROLES.AUDITOR,
//   USER_ROLES.EDITOR,
//   USER_ROLES.ADVERTISER,
//   USER_ROLES.ANALYST,
//   USER_ROLES.SPONSOR
// ];

// // Creator roles
// export const CREATOR_ROLES = [
//   USER_ROLES.CONTENT_CREATOR,
//   USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
//   USER_ROLES.ORGANIZATION_CREATOR,
//   USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
// ];

// // Vote Status
// export const VOTE_STATUS = {
//   PENDING: 'pending',
//   COMPLETED: 'completed',
//   EDITED: 'edited',
//   FLAGGED: 'flagged'
// };

// // Transaction Types
// export const TRANSACTION_TYPES = {
//   DEPOSIT: 'deposit',
//   WITHDRAW: 'withdraw',
//   ELECTION_PAYMENT: 'election_payment',
//   PRIZE_WON: 'prize_won',
//   REFUND: 'refund',
//   PROCESSING_FEE: 'processing_fee',
//   PLATFORM_FEE: 'platform_fee'
// };

// // Transaction Status
// export const TRANSACTION_STATUS = {
//   SUCCESS: 'success',
//   PENDING: 'pending',
//   FAILED: 'failed',
//   CANCELLED: 'cancelled',
//   REFUNDED: 'refunded'
// };

// // Payment Status
// export const PAYMENT_STATUS = {
//   PENDING: 'pending',
//   PROCESSING: 'processing',
//   SUCCEEDED: 'succeeded',
//   FAILED: 'failed',
//   CANCELLED: 'cancelled',
//   REFUNDED: 'refunded'
// };

// // Wallet Status
// export const WALLET_STATUS = {
//   ACTIVE: 'active',
//   BLOCKED: 'blocked',
//   SUSPENDED: 'suspended'
// };

// // Blocked Account Status
// export const BLOCKED_ACCOUNT_STATUS = {
//   LOCKED: 'locked',
//   PENDING_RELEASE: 'pending_release',
//   RELEASED: 'released',
//   REFUNDED: 'refunded'
// };

// // Lottery Prize Types
// export const PRIZE_TYPES = {
//   MONETARY: 'monetary',
//   COUPON: 'coupon',
//   VOUCHER: 'voucher',
//   EXPERIENCE: 'experience'
// };

// // Lottery Funding Sources
// export const FUNDING_SOURCES = {
//   CREATOR_FUNDED: 'creator_funded',
//   PROJECTED_REVENUE: 'projected_revenue',
//   SPONSOR_FUNDED: 'sponsor_funded'
// };

// // Audit Actions
// export const AUDIT_ACTIONS = {
//   VOTE_CAST: 'vote_cast',
//   VOTE_EDITED: 'vote_edited',
//   VOTE_VERIFIED: 'vote_verified',
//   VOTE_FLAGGED: 'vote_flagged',
//   PAYMENT_INITIATED: 'payment_initiated',
//   PAYMENT_COMPLETED: 'payment_completed',
//   PAYMENT_FAILED: 'payment_failed',
//   WALLET_DEPOSIT: 'wallet_deposit',
//   WALLET_WITHDRAW: 'wallet_withdraw',
//   LOTTERY_DRAWN: 'lottery_drawn',
//   PRIZE_CLAIMED: 'prize_claimed',
//   PRIZE_DISTRIBUTED: 'prize_distributed'
// };

// // Video Watch Requirements
// export const VIDEO_WATCH_REQUIREMENTS = {
//   FULL_VIDEO: 100,
//   MINIMUM_PERCENTAGE: 50,
//   DEFAULT_PERCENTAGE: 80
// };

// // Regional Zones
// export const REGIONAL_ZONES = {
//   ZONE_1: 'us_canada',
//   ZONE_2: 'western_europe',
//   ZONE_3: 'eastern_europe',
//   ZONE_4: 'africa',
//   ZONE_5: 'latin_america',
//   ZONE_6: 'middle_east_asia',
//   ZONE_7: 'australasia',
//   ZONE_8: 'china_hk_macau'
// };

// // Payment Gateways
// export const PAYMENT_GATEWAYS = {
//   STRIPE: 'stripe',
//   PADDLE: 'paddle'
// };

// // Currency
// export const DEFAULT_CURRENCY = 'USD';

// // Pagination
// export const PAGINATION = {
//   DEFAULT_PAGE: 1,
//   DEFAULT_LIMIT: 20,
//   MAX_LIMIT: 100
// };

// // Rate Limiting
// export const RATE_LIMITS = {
//   VOTE_SUBMIT: 5, // 5 attempts per hour
//   PAYMENT_CREATE: 10, // 10 payment attempts per hour
//   WALLET_WITHDRAW: 3, // 3 withdrawal requests per hour
//   VIDEO_PROGRESS: 100 // 100 updates per hour
// };

// // Encryption
// export const ENCRYPTION = {
//   ALGORITHM: 'aes-256-gcm',
//   KEY_LENGTH: 32,
//   IV_LENGTH: 16,
//   AUTH_TAG_LENGTH: 16,
//   HASH_ALGORITHM: 'sha256'
// };

// // Lottery Settings
// export const LOTTERY_SETTINGS = {
//   MIN_WINNERS: 1,
//   MAX_WINNERS: 100,
//   DEFAULT_WINNERS: 1,
//   AUTO_APPROVE_THRESHOLD: 100, // Auto-approve prizes under $100
//   DRAW_DELAY_SECONDS: 5 // Delay after election ends
// };

// // Voting Types
// export const VOTING_TYPES = {
//   PLURALITY: 'plurality',
//   RANKED_CHOICE: 'ranked_choice',
//   APPROVAL: 'approval'
// };

// // Question Formats
// export const QUESTION_FORMATS = {
//   MULTIPLE_CHOICE: 'multiple_choice',
//   TEXT_ANSWER: 'text_answer',
//   IMAGE_BASED: 'image_based'
// };

// // Election States
// export const ELECTION_STATES = {
//   DRAFT: 'draft',
//   SCHEDULED: 'scheduled',
//   ACTIVE: 'active',
//   COMPLETED: 'completed',
//   CANCELLED: 'cancelled'
// };

// // Error Messages
// export const ERROR_MESSAGES = {
//   UNAUTHORIZED: 'Unauthorized access',
//   INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
//   ELECTION_NOT_FOUND: 'Election not found',
//   ALREADY_VOTED: 'You have already voted in this election',
//   ELECTION_NOT_ACTIVE: 'Election is not currently active',
//   PAYMENT_REQUIRED: 'Payment required to vote',
//   VIDEO_NOT_WATCHED: 'Video watch requirement not met',
//   INVALID_VOTE_DATA: 'Invalid vote data',
//   INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
//   INVALID_TRANSACTION: 'Invalid transaction',
//   LOTTERY_NOT_ENABLED: 'Lottery is not enabled for this election',
//   PRIZE_ALREADY_CLAIMED: 'Prize has already been claimed',
//   VOTE_EDITING_NOT_ALLOWED: 'Vote editing is not allowed for this election',
//   INVALID_PAYMENT_INTENT: 'Invalid payment intent',
//   WITHDRAWAL_LIMIT_EXCEEDED: 'Withdrawal limit exceeded',
//   BLOCKED_ACCOUNT: 'Account is blocked'
// };

// // Success Messages
// export const SUCCESS_MESSAGES = {
//   VOTE_SUBMITTED: 'Vote submitted successfully',
//   VOTE_UPDATED: 'Vote updated successfully',
//   PAYMENT_SUCCESSFUL: 'Payment successful',
//   WALLET_CREDITED: 'Wallet credited successfully',
//   WITHDRAWAL_INITIATED: 'Withdrawal initiated successfully',
//   LOTTERY_DRAWN: 'Lottery drawn successfully',
//   PRIZE_CLAIMED: 'Prize claimed successfully'
// };

// // Time Constants (in milliseconds)
// export const TIME_CONSTANTS = {
//   ONE_HOUR: 60 * 60 * 1000,
//   ONE_DAY: 24 * 60 * 60 * 1000,
//   ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
//   ONE_MONTH: 30 * 24 * 60 * 60 * 1000
// };

// // Blocked Account Duration
// export const BLOCKED_ACCOUNT_DURATION = {
//   DEFAULT_DAYS: 30,
//   EXTENSION_DAYS: 60
// };

// // File Upload Limits
// export const FILE_LIMITS = {
//   MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
//   MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
//   ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
//   ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm']
// };

// export default {
//   USER_ROLES,
//   ADMIN_ROLES,
//   CREATOR_ROLES,
//   VOTE_STATUS,
//   TRANSACTION_TYPES,
//   TRANSACTION_STATUS,
//   PAYMENT_STATUS,
//   WALLET_STATUS,
//   BLOCKED_ACCOUNT_STATUS,
//   PRIZE_TYPES,
//   FUNDING_SOURCES,
//   AUDIT_ACTIONS,
//   VIDEO_WATCH_REQUIREMENTS,
//   REGIONAL_ZONES,
//   PAYMENT_GATEWAYS,
//   DEFAULT_CURRENCY,
//   PAGINATION,
//   RATE_LIMITS,
//   ENCRYPTION,
//   LOTTERY_SETTINGS,
//   VOTING_TYPES,
//   QUESTION_FORMATS,
//   ELECTION_STATES,
//   ERROR_MESSAGES,
//   SUCCESS_MESSAGES,
//   TIME_CONSTANTS,
//   BLOCKED_ACCOUNT_DURATION,
//   FILE_LIMITS
// };
// // src/config/constants.js

// // User Roles
// export const USER_ROLES = {
//   VOTER: 'Voter',
//   CONTENT_CREATOR: 'Content_Creator',
//   CONTENT_CREATOR_SUBSCRIBED: 'Content_Creator_Subscribed',
//   ORGANIZATION_CREATOR: 'Organization_Creator',
//   ORGANIZATION_CREATOR_SUBSCRIBED: 'Organization_Creator_Subscribed',
//   PLATFORM_ADMIN: 'Platform_Admin',
//   MANAGER: 'Manager',
//   ADMIN: 'Admin',
//   MODERATOR: 'Moderator',
//   AUDITOR: 'Auditor',
//   EDITOR: 'Editor',
//   ADVERTISER: 'Advertiser',
//   ANALYST: 'Analyst',
//   SPONSOR: 'Sponsor'
// };

// // Admin roles for quick checking
// export const ADMIN_ROLES = [
//   USER_ROLES.PLATFORM_ADMIN,
//   USER_ROLES.MANAGER,
//   USER_ROLES.ADMIN,
//   USER_ROLES.MODERATOR,
//   USER_ROLES.AUDITOR,
//   USER_ROLES.EDITOR,
//   USER_ROLES.ADVERTISER,
//   USER_ROLES.ANALYST,
//   USER_ROLES.SPONSOR
// ];

// // Creator roles
// export const CREATOR_ROLES = [
//   USER_ROLES.CONTENT_CREATOR,
//   USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
//   USER_ROLES.ORGANIZATION_CREATOR,
//   USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
// ];

// // Vote Status
// export const VOTE_STATUS = {
//   PENDING: 'pending',
//   COMPLETED: 'completed',
//   EDITED: 'edited',
//   FLAGGED: 'flagged'
// };

// // Transaction Types
// export const TRANSACTION_TYPES = {
//   DEPOSIT: 'deposit',
//   WITHDRAW: 'withdraw',
//   ELECTION_PAYMENT: 'election_payment',
//   PRIZE_WON: 'prize_won',
//   REFUND: 'refund',
//   PROCESSING_FEE: 'processing_fee',
//   PLATFORM_FEE: 'platform_fee'
// };

// // Transaction Status
// export const TRANSACTION_STATUS = {
//   SUCCESS: 'success',
//   PENDING: 'pending',
//   FAILED: 'failed',
//   CANCELLED: 'cancelled',
//   REFUNDED: 'refunded'
// };

// // Payment Status
// export const PAYMENT_STATUS = {
//   PENDING: 'pending',
//   PROCESSING: 'processing',
//   SUCCEEDED: 'succeeded',
//   FAILED: 'failed',
//   CANCELLED: 'cancelled',
//   REFUNDED: 'refunded'
// };

// // Wallet Status
// export const WALLET_STATUS = {
//   ACTIVE: 'active',
//   BLOCKED: 'blocked',
//   SUSPENDED: 'suspended'
// };

// // Lottery Prize Types
// export const PRIZE_TYPES = {
//   MONETARY: 'monetary',
//   COUPON: 'coupon',
//   VOUCHER: 'voucher',
//   EXPERIENCE: 'experience'
// };

// // Lottery Funding Sources
// export const FUNDING_SOURCES = {
//   CREATOR_FUNDED: 'creator_funded',
//   PROJECTED_REVENUE: 'projected_revenue',
//   SPONSOR_FUNDED: 'sponsor_funded'
// };

// // Audit Actions
// export const AUDIT_ACTIONS = {
//   VOTE_CAST: 'vote_cast',
//   VOTE_EDITED: 'vote_edited',
//   VOTE_VERIFIED: 'vote_verified',
//   VOTE_FLAGGED: 'vote_flagged',
//   PAYMENT_INITIATED: 'payment_initiated',
//   PAYMENT_COMPLETED: 'payment_completed',
//   PAYMENT_FAILED: 'payment_failed',
//   WALLET_DEPOSIT: 'wallet_deposit',
//   WALLET_WITHDRAW: 'wallet_withdraw',
//   LOTTERY_DRAWN: 'lottery_drawn',
//   PRIZE_CLAIMED: 'prize_claimed',
//   PRIZE_DISTRIBUTED: 'prize_distributed'
// };

// // Video Watch Requirements
// export const VIDEO_WATCH_REQUIREMENTS = {
//   FULL_VIDEO: 100,
//   MINIMUM_PERCENTAGE: 50,
//   DEFAULT_PERCENTAGE: 80
// };

// // Regional Zones
// export const REGIONAL_ZONES = {
//   ZONE_1: 'us_canada',
//   ZONE_2: 'western_europe',
//   ZONE_3: 'eastern_europe',
//   ZONE_4: 'africa',
//   ZONE_5: 'latin_america',
//   ZONE_6: 'middle_east_asia',
//   ZONE_7: 'australasia',
//   ZONE_8: 'china_hk_macau'
// };

// // Payment Gateways
// export const PAYMENT_GATEWAYS = {
//   STRIPE: 'stripe',
//   PADDLE: 'paddle'
// };

// // Currency
// export const DEFAULT_CURRENCY = 'USD';

// // Pagination
// export const PAGINATION = {
//   DEFAULT_PAGE: 1,
//   DEFAULT_LIMIT: 20,
//   MAX_LIMIT: 100
// };

// // Rate Limiting
// export const RATE_LIMITS = {
//   VOTE_SUBMIT: 5, // 5 attempts per hour
//   PAYMENT_CREATE: 10, // 10 payment attempts per hour
//   WALLET_WITHDRAW: 3, // 3 withdrawal requests per hour
//   VIDEO_PROGRESS: 100 // 100 updates per hour
// };

// // Encryption
// export const ENCRYPTION = {
//   ALGORITHM: 'aes-256-gcm',
//   KEY_LENGTH: 32,
//   IV_LENGTH: 16,
//   AUTH_TAG_LENGTH: 16,
//   HASH_ALGORITHM: 'sha256'
// };

// // Lottery Settings
// export const LOTTERY_SETTINGS = {
//   MIN_WINNERS: 1,
//   MAX_WINNERS: 100,
//   DEFAULT_WINNERS: 1,
//   AUTO_APPROVE_THRESHOLD: 100, // Auto-approve prizes under $100
//   DRAW_DELAY_SECONDS: 5 // Delay after election ends
// };

// // Voting Types
// export const VOTING_TYPES = {
//   PLURALITY: 'plurality',
//   RANKED_CHOICE: 'ranked_choice',
//   APPROVAL: 'approval'
// };

// // Question Formats
// export const QUESTION_FORMATS = {
//   MULTIPLE_CHOICE: 'multiple_choice',
//   TEXT_ANSWER: 'text_answer',
//   IMAGE_BASED: 'image_based'
// };

// // Election States
// export const ELECTION_STATES = {
//   DRAFT: 'draft',
//   SCHEDULED: 'scheduled',
//   ACTIVE: 'active',
//   COMPLETED: 'completed',
//   CANCELLED: 'cancelled'
// };

// // Error Messages
// export const ERROR_MESSAGES = {
//   UNAUTHORIZED: 'Unauthorized access',
//   INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
//   ELECTION_NOT_FOUND: 'Election not found',
//   ALREADY_VOTED: 'You have already voted in this election',
//   ELECTION_NOT_ACTIVE: 'Election is not currently active',
//   PAYMENT_REQUIRED: 'Payment required to vote',
//   VIDEO_NOT_WATCHED: 'Video watch requirement not met',
//   INVALID_VOTE_DATA: 'Invalid vote data',
//   INSUFFICIENT_BALANCE: 'Insufficient wallet balance',
//   INVALID_TRANSACTION: 'Invalid transaction',
//   LOTTERY_NOT_ENABLED: 'Lottery is not enabled for this election',
//   PRIZE_ALREADY_CLAIMED: 'Prize has already been claimed',
//   VOTE_EDITING_NOT_ALLOWED: 'Vote editing is not allowed for this election',
//   INVALID_PAYMENT_INTENT: 'Invalid payment intent',
//   WITHDRAWAL_LIMIT_EXCEEDED: 'Withdrawal limit exceeded',
//   BLOCKED_ACCOUNT: 'Account is blocked'
// };

// // Success Messages
// export const SUCCESS_MESSAGES = {
//   VOTE_SUBMITTED: 'Vote submitted successfully',
//   VOTE_UPDATED: 'Vote updated successfully',
//   PAYMENT_SUCCESSFUL: 'Payment successful',
//   WALLET_CREDITED: 'Wallet credited successfully',
//   WITHDRAWAL_INITIATED: 'Withdrawal initiated successfully',
//   LOTTERY_DRAWN: 'Lottery drawn successfully',
//   PRIZE_CLAIMED: 'Prize claimed successfully'
// };

// // Time Constants (in milliseconds)
// export const TIME_CONSTANTS = {
//   ONE_HOUR: 60 * 60 * 1000,
//   ONE_DAY: 24 * 60 * 60 * 1000,
//   ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
//   ONE_MONTH: 30 * 24 * 60 * 60 * 1000
// };

// // Blocked Account Duration
// export const BLOCKED_ACCOUNT_DURATION = {
//   DEFAULT_DAYS: 30,
//   EXTENSION_DAYS: 60
// };

// // File Upload Limits
// export const FILE_LIMITS = {
//   MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
//   MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
//   ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
//   ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm']
// };

// export default {
//   USER_ROLES,
//   ADMIN_ROLES,
//   CREATOR_ROLES,
//   VOTE_STATUS,
//   TRANSACTION_TYPES,
//   TRANSACTION_STATUS,
//   PAYMENT_STATUS,
//   WALLET_STATUS,
//   PRIZE_TYPES,
//   FUNDING_SOURCES,
//   AUDIT_ACTIONS,
//   VIDEO_WATCH_REQUIREMENTS,
//   REGIONAL_ZONES,
//   PAYMENT_GATEWAYS,
//   DEFAULT_CURRENCY,
//   PAGINATION,
//   RATE_LIMITS,
//   ENCRYPTION,
//   LOTTERY_SETTINGS,
//   VOTING_TYPES,
//   QUESTION_FORMATS,
//   ELECTION_STATES,
//   ERROR_MESSAGES,
//   SUCCESS_MESSAGES,
//   TIME_CONSTANTS,
//   BLOCKED_ACCOUNT_DURATION,
//   FILE_LIMITS
// };
import rateLimit from 'express-rate-limit';

/**
 * Vote submission rate limiter
 * Prevents rapid vote submissions
 */
export const voteRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 votes per minute
  message: 'Too many vote attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip,
});

/**
 * Payment rate limiter
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 payment attempts per minute
  message: 'Too many payment attempts. Please try again later.',
  keyGenerator: (req) => req.user?.userId || req.ip,
});

/**
 * Video progress rate limiter
 */
export const videoProgressRateLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // Max 20 progress updates per 10 seconds
  message: 'Too many video progress updates.',
  keyGenerator: (req) => req.user?.userId || req.ip,
  skipSuccessfulRequests: false
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes
  message: 'Too many requests from this IP.',
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  voteRateLimiter,
  paymentRateLimiter,
  videoProgressRateLimiter,
  apiRateLimiter
};
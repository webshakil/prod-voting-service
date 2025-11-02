// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Routes - env vars already loaded in server.js
import voteRoutes from './routes/voteRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import lotteryRoutes from './routes/lotteryRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

const app = express();
const PORT = process.env.PORT || 5004;

// ✅ Define allowed frontend origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'https://prod-client-omega.vercel.app',
];

console.log('✅ App initialized with environment:');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST ? '***' + process.env.DB_HOST.slice(-20) : 'MISSING');

// ✅ Enhanced CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`❌ CORS blocked request from: ${origin}`);
        return callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-data',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  })
);

// Security middleware
app.use(helmet());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  },
});
app.use('/api/', limiter);

// ✅ Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Vottery Voting Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      votes: '/api/votes',
      lottery: '/api/lottery',
      wallet: '/api/wallet',
      payments: '/api/payments',
      video: '/api/video',
      analytics: '/api/analytics',
    },
  });
});

// ✅ Health check route
app.get('/health', async (req, res) => {
  try {
    // Dynamic import to ensure env vars are loaded
    const { healthCheck } = await import('./config/database.js');
    const dbHealth = await healthCheck();
    
    res.status(200).json({
      success: true,
      status: 'OK',
      service: 'voting-service',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: PORT,
        dbHost: process.env.DB_HOST ? 'configured' : 'not configured',
        dbUser: process.env.DB_USER || 'not configured',
      },
      database: dbHealth,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'ERROR',
      service: 'voting-service',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// ✅ API Routes
app.use('/api/votes', voteRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/analytics', analyticsRoutes);

// ✅ 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// ✅ Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    }),
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Voting Service Started Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST ? 'Connected' : 'Not configured'}`);
  console.log(`🔐 Encryption: ${process.env.ENCRYPTION_KEY ? 'Enabled' : 'Disabled'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ✅ Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  try {
    const { closePool } = await import('./config/database.js');
    await closePool();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ✅ Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
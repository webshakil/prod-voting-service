

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Routes
import voteRoutes from './routes/voteRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import lotteryRoutes from './routes/lotteryRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

dotenv.config();
console.log('✅ ENCRYPTION_KEY loaded:', process.env.ENCRYPTION_KEY ? 'YES' : 'NO');
const app = express();
const PORT = process.env.PORT || 5004;

// ✅ Define allowed frontend origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000', // for Next.js dev
];

// ✅ Enhanced CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser clients
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn(`❌ CORS blocked request from: ${origin}`);
        return callback(new Error('Not allowed by CORS: ' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // ✅ FIXED LINE: include your custom header here
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-data',  // 👈 your custom header must be allowed
    ],
  })
);

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ✅ Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'voting-service',
    timestamp: new Date().toISOString(),
  });
});

// ✅ API Routes
app.use('/api/votes', voteRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/lottery', lotteryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/analytics', analyticsRoutes);

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Voting Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Allowed Origins: ${allowedOrigins.join(', ')}`);
});

// export default app;


// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';
// import dotenv from 'dotenv';

// // Routes
// import voteRoutes from './routes/voteRoutes.js';
// import walletRoutes from './routes/walletRoutes.js';
// import lotteryRoutes from './routes/lotteryRoutes.js';
// import paymentRoutes from './routes/paymentRoutes.js';
// import videoRoutes from './routes/videoRoutes.js';
// import analyticsRoutes from './routes/analyticsRoutes.js';

// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5004;

// // Middleware
// app.use(helmet());
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:5173',
//   credentials: true
// }));
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api/', limiter);

// // Health check
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'OK', service: 'voting-service', timestamp: new Date().toISOString() });
// });

// // API Routes
// app.use('/api/votes', voteRoutes);
// app.use('/api/wallet', walletRoutes);
// app.use('/api/lottery', lotteryRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/video', videoRoutes);
// app.use('/api/analytics', analyticsRoutes);

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Endpoint not found'
//   });
// });

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Internal server error',
//     ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
//   });
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Voting Service running on port ${PORT}`);
//   console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
// });

// export default app;
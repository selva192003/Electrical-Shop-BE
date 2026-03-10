const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { initCronJobs } = require('./utils/cronJobs');

// Load env
dotenv.config();

// Connect DB
connectDB();

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io Setup ────────────────────────────────────────────────────────
// Build allowed origins from env — set CLIENT_URL to your production frontend URL
// Optionally add comma-separated extra origins via EXTRA_CORS_ORIGINS env var
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.EXTRA_CORS_ORIGINS ? process.env.EXTRA_CORS_ORIGINS.split(',').map(o => o.trim()) : []),
].filter(Boolean);

// Build a regex from CLIENT_URL to also allow Vercel preview deployments
// e.g. CLIENT_URL=https://my-app.vercel.app  →  allows https://my-app-*.vercel.app
const clientUrlPattern = (() => {
  try {
    const { hostname } = new URL(process.env.CLIENT_URL || '');
    const base = hostname.replace(/\.vercel\.app$/, '');
    return base ? new RegExp(`^https:\\/\\/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*\\.vercel\\.app$`) : null;
  } catch { return null; }
})();

const corsOriginFn = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, Postman)
  if (!origin) return callback(null, true);
  if (
    allowedOrigins.includes(origin) ||
    (clientUrlPattern && clientUrlPattern.test(origin))
  ) {
    return callback(null, true);
  }
  callback(new Error('Not allowed by CORS'));
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginFn,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to app so controllers can emit events
app.set('io', io);

io.on('connection', (socket) => {
  // User joins their personal room for private notifications
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
    }
  });

  // Admin room for live dashboard
  socket.on('joinAdmin', () => {
    socket.join('admin_room');
  });

  socket.on('disconnect', () => {});
});

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: corsOriginFn,
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests, please try again in 15 minutes.' },
});

app.use('/api', limiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users/forgot-password', otpLimiter);
app.use('/api/users/verify-otp', otpLimiter);
app.use('/api/users/resend-verification', otpLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Existing routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));
app.use('/api/returns', require('./routes/returnRoutes'));

// ── New feature routes ──
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/calculator', require('./routes/calculatorRoutes'));
app.use('/api/qna', require('./routes/qnaRoutes'));
app.use('/api/products', require('./routes/flashSaleRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

// ─── Initialize cron jobs (only in persistent/non-serverless environments) ───
if (!process.env.VERCEL) {
  initCronJobs(io);
}

// ─── Start server (skip in Vercel serverless) ────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Socket.io ready on port ${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;


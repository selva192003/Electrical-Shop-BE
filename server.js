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
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
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
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
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
app.use('/api/coupons', require('./routes/couponRoutes'));

// ── New feature routes ──
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/loyalty', require('./routes/loyaltyRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/calculator', require('./routes/calculatorRoutes'));
app.use('/api/qna', require('./routes/qnaRoutes'));
app.use('/api/products', require('./routes/flashSaleRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

// ─── Initialize cron jobs ────────────────────────────────────────────────────
initCronJobs();

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Socket.io ready on port ${PORT}`);
});


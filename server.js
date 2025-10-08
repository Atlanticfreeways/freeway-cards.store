const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// SSL and HTTPS redirect (optional for production)
let getSSLOptions, httpsRedirect;
try {
  ({ getSSLOptions } = require('./config/ssl'));
  ({ httpsRedirect } = require('./middleware/httpsRedirect'));
} catch (e) {
  getSSLOptions = () => null;
  httpsRedirect = (req, res, next) => next();
}
require('dotenv').config();

// Environment validation
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'GOOGLE_CLIENT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Load routes and middleware with error handling
let authRoutes, walletRoutes, cardRoutes, transactionRoutes;
try {
  authRoutes = require('./routes/auth');
  walletRoutes = require('./routes/wallet');
  cardRoutes = require('./routes/cards');
  transactionRoutes = require('./routes/transactions');
} catch (e) {
  console.warn('Some routes not available:', e.message);
  // Create dummy routes
  authRoutes = express.Router();
  walletRoutes = express.Router();
  cardRoutes = express.Router();
  transactionRoutes = express.Router();
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const app = express();

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://freewaycards-store.netlify.app', 'https://freeway-cards-backend.onrender.com']
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
app.use('/api', apiLimiter);

// Simple database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Running without database - demo mode');
  }
};
connectDB();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/transactions', transactionRoutes);

// Serve frontend - secure path handling
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'frontend/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'frontend/dashboard.html'));
});

// Catch-all for invalid routes
app.get('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Page not found' });
});

// Simple error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 10000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// Simple server startup for deployment
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

// Enhanced graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('HTTP server closed');
    
    mongoose.connection.close(false, (err) => {
      if (err) {
        console.error('Error during database shutdown:', err);
        process.exit(1);
      }
      
      console.log('Database connection closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

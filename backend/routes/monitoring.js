const express = require('express');
const mongoose = require('mongoose');
const { QueryOptimizer } = require('../utils/queryOptimizer');
const { ModuleLoader } = require('../utils/moduleLoader');
const auth = require('../middleware/auth');
const router = express.Router();

// Performance metrics endpoint (admin only)
router.get('/performance', async (req, res) => {
  try {
    // Check if user is admin (you may need to adjust this based on your user model)
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const memUsage = process.memoryUsage();
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    
    const metrics = {
      server: {
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
      },
      database: {
        status: dbStates[dbState],
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        readyState: dbState
      },
      cache: QueryOptimizer.getCacheStats(),
      modules: ModuleLoader.getStats(),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

// Database performance metrics
router.get('/database-stats', async (req, res) => {
  try {
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const User = require('../models/User');
    const Card = require('../models/Card');
    
    const [userCount, cardCount, activeCards] = await Promise.all([
      User.countDocuments(),
      Card.countDocuments(),
      Card.countDocuments({ status: 'active' })
    ]);

    const stats = {
      collections: {
        users: userCount,
        cards: cardCount,
        activeCards
      },
      indexes: {
        // You can add index statistics here if needed
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve database stats',
      error: error.message
    });
  }
});

// Clear cache endpoint
router.post('/clear-cache', async (req, res) => {
  try {
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { pattern } = req.body;
    QueryOptimizer.clearCache(pattern);

    res.json({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
});

// Force garbage collection (development only)
router.post('/gc', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Not available in production' });
    }

    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const before = process.memoryUsage();
    
    if (global.gc) {
      global.gc();
      const after = process.memoryUsage();
      
      res.json({
        success: true,
        message: 'Garbage collection completed',
        data: {
          before: Math.round(before.heapUsed / 1024 / 1024),
          after: Math.round(after.heapUsed / 1024 / 1024),
          freed: Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024)
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Garbage collection not available. Start with --expose-gc flag.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to perform garbage collection',
      error: error.message
    });
  }
});

module.exports = router;
const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const healthMonitor = require('../utils/healthMonitor');
const router = express.Router();

// Get logs endpoint
router.get('/:type', async (req, res) => {
  try {
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { type } = req.params;
    const { lines = 100 } = req.query;
    const logsDir = path.join(__dirname, '../logs');
    const logFile = path.join(logsDir, `${type}.log`);

    if (!fs.existsSync(logFile)) {
      return res.status(404).json({ success: false, message: 'Log file not found' });
    }

    const logContent = fs.readFileSync(logFile, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim()).slice(-lines);

    res.json({
      success: true,
      data: {
        type,
        lines: logLines.length,
        logs: logLines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        })
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs',
      error: error.message
    });
  }
});

// System alerts endpoint
router.get('/alerts/current', async (req, res) => {
  try {
    if (req.user.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const alerts = [];
    const healthStatus = healthMonitor.getHealthStatus();

    // Memory alerts
    if (healthStatus.memoryUsage.heapUsed > 400) {
      alerts.push({
        type: 'warning',
        message: `High memory usage: ${healthStatus.memoryUsage.heapUsed}MB`,
        timestamp: new Date().toISOString()
      });
    }

    // Database alerts
    if (healthStatus.dbStatus !== 1) {
      alerts.push({
        type: 'critical',
        message: 'Database connection issue',
        timestamp: new Date().toISOString()
      });
    }

    // Error rate alerts
    const errorRate = healthMonitor.getErrorRate();
    if (errorRate > 0.05) {
      alerts.push({
        type: 'warning',
        message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts',
      error: error.message
    });
  }
});

module.exports = router;
const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const KYC = require('../models/KYC');
const cardIssuerConfig = require('../config/cardIssuer');
const productionCardService = require('../services/productionCardService');
const webhookProcessor = require('../services/webhookProcessor');
const fraudDetectionService = require('../services/fraudDetectionService');
const kycValidationService = require('../services/kycValidationService');
const monitoringService = require('../services/monitoringService');
const featureFlagService = require('../services/featureFlagService');

const router = express.Router();

// Admin middleware
const adminAuth = async (req, res, next) => {
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Enhanced dashboard stats with card issuer metrics
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Basic stats
    const stats = {
      users: {
        total: await User.countDocuments(),
        verified: await User.countDocuments({ kycStatus: 'approved' }),
        pending: await User.countDocuments({ kycStatus: 'pending' }),
        rejected: await User.countDocuments({ kycStatus: 'rejected' }),
        newToday: await User.countDocuments({ createdAt: { $gte: today } })
      },
      cards: {
        total: await VirtualCard.countDocuments(),
        active: await VirtualCard.countDocuments({ status: 'active' }),
        frozen: await VirtualCard.countDocuments({ status: 'frozen' }),
        pending: await VirtualCard.countDocuments({ status: 'pending' }),
        closed: await VirtualCard.countDocuments({ status: 'closed' }),
        byProvider: {
          marqeta: await VirtualCard.countDocuments({ issuerProvider: 'marqeta' }),
          stripe: await VirtualCard.countDocuments({ issuerProvider: 'stripe' }),
          mock: await VirtualCard.countDocuments({ issuerProvider: 'mock' })
        },
        createdToday: await VirtualCard.countDocuments({ createdAt: { $gte: today } }),
        createdThisMonth: await VirtualCard.countDocuments({ createdAt: { $gte: thisMonth } })
      },
      transactions: {
        total: await Transaction.countDocuments(),
        volume: await Transaction.aggregate([
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        today: await Transaction.countDocuments({ createdAt: { $gte: today } }),
        thisMonth: await Transaction.countDocuments({ createdAt: { $gte: thisMonth } }),
        volumeToday: await Transaction.aggregate([
          { $match: { createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        volumeThisMonth: await Transaction.aggregate([
          { $match: { createdAt: { $gte: thisMonth } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        byStatus: {
          completed: await Transaction.countDocuments({ status: 'completed' }),
          pending: await Transaction.countDocuments({ status: 'pending' }),
          failed: await Transaction.countDocuments({ status: 'failed' })
        }
      },
      compliance: {
        fraudAlerts: await VirtualCard.countDocuments({ 
          complianceFlags: { $in: ['fraud_alert'] } 
        }),
        highRiskCards: await VirtualCard.countDocuments({ 
          complianceFlags: { $in: ['high_risk'] } 
        }),
        manualReview: await VirtualCard.countDocuments({ 
          complianceFlags: { $in: ['manual_review'] } 
        })
      },
      system: {
        cardIssuerProvider: cardIssuerConfig.defaultProvider,
        useRealCards: cardIssuerConfig.featureFlags.useRealCards,
        webhooksEnabled: cardIssuerConfig.featureFlags.enableWebhooks,
        fraudDetectionEnabled: cardIssuerConfig.featureFlags.enableFraudDetection,
        webhookStats: webhookProcessor.getStats(),
        uptime: process.uptime()
      }
    };

    // Format volume data
    stats.transactions.volume = stats.transactions.volume.length > 0 ? 
      stats.transactions.volume[0].total : 0;
    stats.transactions.volumeToday = stats.transactions.volumeToday.length > 0 ? 
      stats.transactions.volumeToday[0].total : 0;
    stats.transactions.volumeThisMonth = stats.transactions.volumeThisMonth.length > 0 ? 
      stats.transactions.volumeThisMonth[0].total : 0;

    res.json({
      success: true,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch stats',
      error: error.message 
    });
  }
});

// User management
router.get('/users', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find()
      .select('-password')
      .populate('kyc')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Update KYC status
router.patch('/kyc/:userId', [auth, adminAuth], async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    const kyc = await KYC.findOneAndUpdate(
      { userId: req.params.userId },
      { 
        status, 
        rejectionReason,
        verificationDate: status === 'approved' ? new Date() : undefined
      },
      { new: true }
    );

    await User.findByIdAndUpdate(req.params.userId, { kycStatus: status });

    res.json({ success: true, kyc });
  } catch (error) {
    res.status(500).json({ message: 'KYC update failed' });
  }
});

// Card management
router.get('/cards', [auth, adminAuth], async (req, res) => {
  try {
    const cards = await VirtualCard.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ cards });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cards' });
  }
});

// Enhanced transaction monitoring
router.get('/transactions', [auth, adminAuth], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      type, 
      cardId, 
      userId,
      startDate,
      endDate,
      minAmount,
      maxAmount
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (cardId) query.cardId = cardId;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    const transactions = await Transaction.find(query)
      .populate('userId', 'name email kycStatus')
      .populate('cardId', 'cardName cardType issuerProvider last4Digits')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Transaction.countDocuments(query);

    res.json({ 
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin transactions error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message 
    });
  }
});

// Card issuer configuration management
router.get('/card-issuer/config', [auth, adminAuth], async (req, res) => {
  try {
    const config = cardIssuerConfig.getStatus();
    
    res.json({
      success: true,
      config: {
        currentProvider: config.defaultProvider,
        featureFlags: config.featureFlags,
        availableProviders: config.providers,
        environment: config.environment
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get card issuer config' 
    });
  }
});

// Update card issuer configuration
router.post('/card-issuer/config', [auth, adminAuth], async (req, res) => {
  try {
    const { provider, featureFlags } = req.body;

    if (provider && cardIssuerConfig.isProviderAvailable(provider)) {
      cardIssuerConfig.switchProvider(provider);
    }

    if (featureFlags) {
      // Update feature flags (this would need to be implemented in cardIssuerConfig)
      Object.assign(cardIssuerConfig.featureFlags, featureFlags);
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      config: cardIssuerConfig.getStatus()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to update configuration',
      error: error.message 
    });
  }
});

// Webhook monitoring
router.get('/webhooks/stats', [auth, adminAuth], async (req, res) => {
  try {
    const stats = webhookProcessor.getStats();
    
    res.json({
      success: true,
      webhookStats: stats,
      configuration: cardIssuerConfig.getWebhookConfig()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get webhook stats' 
    });
  }
});

// Fraud detection management
router.get('/fraud/stats', [auth, adminAuth], async (req, res) => {
  try {
    const stats = await fraudDetectionService.getFraudStats();
    
    // Get cards with fraud flags
    const fraudCards = await VirtualCard.find({
      complianceFlags: { $in: ['fraud_alert', 'high_risk'] }
    })
    .populate('userId', 'name email')
    .select('cardName cardType status complianceFlags createdAt')
    .sort({ updatedAt: -1 })
    .limit(20);

    res.json({
      success: true,
      fraudStats: stats,
      recentFraudCards: fraudCards,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get fraud stats' 
    });
  }
});

// Update fraud detection rules
router.post('/fraud/rules', [auth, adminAuth], async (req, res) => {
  try {
    const { rules } = req.body;
    const result = fraudDetectionService.updateRules(rules);
    
    res.json({
      success: result.success,
      message: result.message || 'Fraud rules updated',
      rules: result.rules
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to update fraud rules',
      error: error.message 
    });
  }
});

// Manual card actions
router.post('/cards/:cardId/action', [auth, adminAuth], async (req, res) => {
  try {
    const { cardId } = req.params;
    const { action, reason } = req.body;

    const card = await VirtualCard.findById(cardId);
    if (!card) {
      return res.status(404).json({ 
        success: false,
        message: 'Card not found' 
      });
    }

    let result;
    const useRealCards = cardIssuerConfig.featureFlags.useRealCards;

    switch (action) {
      case 'freeze':
        if (useRealCards && card.issuerProvider !== 'mock') {
          result = await productionCardService.freezeCard(cardId, reason || 'Admin action');
        } else {
          card.updateStatus('frozen', reason || 'Admin action');
          await card.save();
          result = { success: true, status: 'frozen' };
        }
        break;

      case 'unfreeze':
        if (useRealCards && card.issuerProvider !== 'mock') {
          result = await productionCardService.unfreezeCard(cardId, reason || 'Admin action');
        } else {
          card.updateStatus('active', reason || 'Admin action');
          await card.save();
          result = { success: true, status: 'active' };
        }
        break;

      case 'close':
        card.updateStatus('closed', reason || 'Admin closure');
        await card.save();
        result = { success: true, status: 'closed' };
        break;

      case 'clear_fraud_flags':
        const fraudFlags = ['fraud_alert', 'high_risk', 'manual_review'];
        fraudFlags.forEach(flag => card.removeComplianceFlag(flag));
        await card.save();
        result = { success: true, message: 'Fraud flags cleared' };
        break;

      default:
        return res.status(400).json({ 
          success: false,
          message: 'Invalid action' 
        });
    }

    res.json({
      success: true,
      message: `Card ${action} completed successfully`,
      result,
      card: {
        id: card._id,
        status: card.status,
        complianceFlags: card.complianceFlags
      }
    });

  } catch (error) {
    console.error('Admin card action error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Card action failed',
      error: error.message 
    });
  }
});

// KYC management with enhanced features
router.get('/kyc/pending', [auth, adminAuth], async (req, res) => {
  try {
    const pendingKYC = await KYC.find({ status: 'pending' })
      .populate('userId', 'name email createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      pendingKYC,
      count: pendingKYC.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch pending KYC' 
    });
  }
});

// Bulk KYC actions
router.post('/kyc/bulk-action', [auth, adminAuth], async (req, res) => {
  try {
    const { userIds, action, reason } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'User IDs array is required' 
      });
    }

    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await kycValidationService.updateKYCStatus(userId, action, reason);
        results.push({ userId, success: true, result });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Bulk KYC action completed: ${successCount}/${userIds.length} successful`,
      results
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Bulk KYC action failed',
      error: error.message 
    });
  }
});

// System health check
router.get('/health', [auth, adminAuth], async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'connected',
        cardIssuer: cardIssuerConfig.defaultProvider,
        webhooks: cardIssuerConfig.featureFlags.enableWebhooks ? 'enabled' : 'disabled',
        fraudDetection: cardIssuerConfig.featureFlags.enableFraudDetection ? 'enabled' : 'disabled'
      },
      metrics: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version
      }
    };

    res.json({
      success: true,
      health
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Health check failed',
      error: error.message 
    });
  }
});

// Monitoring dashboard
router.get('/monitoring/dashboard', [auth, adminAuth], async (req, res) => {
  try {
    const dashboardData = monitoringService.getDashboardData();
    
    res.json({
      success: true,
      dashboard: dashboardData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get monitoring dashboard',
      error: error.message 
    });
  }
});

// Get alerts
router.get('/monitoring/alerts', [auth, adminAuth], async (req, res) => {
  try {
    const { status = 'all', severity, limit = 50 } = req.query;
    
    let alerts = monitoringService.alertHistory;
    
    // Filter by status
    if (status === 'unacknowledged') {
      alerts = alerts.filter(alert => !alert.acknowledged);
    } else if (status === 'acknowledged') {
      alerts = alerts.filter(alert => alert.acknowledged);
    }
    
    // Filter by severity
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Sort by timestamp (newest first) and limit
    alerts = alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      alerts,
      total: alerts.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get alerts',
      error: error.message 
    });
  }
});

// Acknowledge alert
router.post('/monitoring/alerts/:alertId/acknowledge', [auth, adminAuth], async (req, res) => {
  try {
    const { alertId } = req.params;
    const acknowledgedBy = req.user.email || req.user.id;
    
    const result = monitoringService.acknowledgeAlert(alertId, acknowledgedBy);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        alert: result.alert
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message 
    });
  }
});

// Performance metrics
router.get('/monitoring/performance', [auth, adminAuth], async (req, res) => {
  try {
    const { timeRange = '1h' } = req.query;
    
    // Get performance data based on time range
    const dashboardData = monitoringService.getDashboardData();
    
    res.json({
      success: true,
      performance: {
        current: dashboardData.performance,
        metrics: dashboardData.metrics,
        timeRange
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get performance metrics',
      error: error.message 
    });
  }
});

// System metrics
router.get('/monitoring/system', [auth, adminAuth], async (req, res) => {
  try {
    const systemStats = monitoringService.getSystemStats();
    
    res.json({
      success: true,
      system: systemStats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get system metrics',
      error: error.message 
    });
  }
});

// Trigger test alert (for testing purposes)
router.post('/monitoring/test-alert', [auth, adminAuth], async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false,
        message: 'Test alerts not available in production' 
      });
    }

    const { type = 'test_alert', message = 'This is a test alert' } = req.body;
    
    const alert = monitoringService.triggerAlert(type, {
      message,
      triggeredBy: req.user.email || req.user.id,
      testAlert: true
    });
    
    res.json({
      success: true,
      message: 'Test alert triggered successfully',
      alert
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to trigger test alert',
      error: error.message 
    });
  }
});

// Feature flag management
router.get('/feature-flags', [auth, adminAuth], async (req, res) => {
  try {
    const flags = featureFlagService.getFlags();
    const stats = featureFlagService.getStats();
    
    res.json({
      success: true,
      flags,
      stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get feature flags',
      error: error.message 
    });
  }
});

// Get specific feature flag
router.get('/feature-flags/:flagName', [auth, adminAuth], async (req, res) => {
  try {
    const { flagName } = req.params;
    const flag = featureFlagService.getFlags(flagName);
    
    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }
    
    res.json({
      success: true,
      flag: { [flagName]: flag }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get feature flag',
      error: error.message 
    });
  }
});

// Update feature flag
router.put('/feature-flags/:flagName', [auth, adminAuth], async (req, res) => {
  try {
    const { flagName } = req.params;
    const updates = req.body;
    
    // Validate configuration
    const validation = featureFlagService.validateFlagConfig(updates);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag configuration',
        errors: validation.errors
      });
    }
    
    const result = featureFlagService.updateFlag(flagName, updates);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        flag: result.flag
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to update feature flag',
      error: error.message 
    });
  }
});

// Create feature flag
router.post('/feature-flags', [auth, adminAuth], async (req, res) => {
  try {
    const { flagName, ...config } = req.body;
    
    if (!flagName) {
      return res.status(400).json({
        success: false,
        message: 'Flag name is required'
      });
    }
    
    // Validate configuration
    const validation = featureFlagService.validateFlagConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature flag configuration',
        errors: validation.errors
      });
    }
    
    const result = featureFlagService.createFlag(flagName, config);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        flag: result.flag
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to create feature flag',
      error: error.message 
    });
  }
});

// Delete feature flag
router.delete('/feature-flags/:flagName', [auth, adminAuth], async (req, res) => {
  try {
    const { flagName } = req.params;
    const result = featureFlagService.deleteFlag(flagName);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete feature flag',
      error: error.message 
    });
  }
});

// Export feature flags configuration
router.get('/feature-flags/export/config', [auth, adminAuth], async (req, res) => {
  try {
    const config = featureFlagService.exportConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to export feature flags',
      error: error.message 
    });
  }
});

// Import feature flags configuration
router.post('/feature-flags/import/config', [auth, adminAuth], async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration is required'
      });
    }
    
    const result = featureFlagService.importConfig(config);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        importedFlags: result.importedFlags
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to import feature flags',
      error: error.message 
    });
  }
});

module.exports = router;
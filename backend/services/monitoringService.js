const VirtualCard = require('../models/VirtualCard');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const cardIssuerConfig = require('../config/cardIssuer');

/**
 * Monitoring and Alerting Service
 * Provides system monitoring, performance tracking, and alerting capabilities
 */
class MonitoringService {
  constructor() {
    this.logger = require('../utils/logger');
    
    // Monitoring configuration
    this.config = {
      alertThresholds: {
        errorRate: 0.05, // 5% error rate
        responseTime: 5000, // 5 seconds
        transactionVolume: 1000, // transactions per hour
        fraudRate: 0.02, // 2% fraud rate
        apiFailureRate: 0.1, // 10% API failure rate
        webhookFailureRate: 0.05 // 5% webhook failure rate
      },
      checkIntervals: {
        health: 60000, // 1 minute
        performance: 300000, // 5 minutes
        alerts: 60000 // 1 minute
      }
    };

    // Metrics storage (in production, this would use Redis or similar)
    this.metrics = {
      apiCalls: new Map(),
      errors: new Map(),
      responseTimes: [],
      transactionCounts: new Map(),
      fraudEvents: [],
      webhookEvents: []
    };

    // Alert history
    this.alertHistory = [];
    
    // Start monitoring intervals
    this.startMonitoring();
  }

  /**
   * Start monitoring intervals
   */
  startMonitoring() {
    // Health check interval
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkIntervals.health);

    // Performance monitoring interval
    setInterval(() => {
      this.performPerformanceCheck();
    }, this.config.checkIntervals.performance);

    // Alert checking interval
    setInterval(() => {
      this.checkAlerts();
    }, this.config.checkIntervals.alerts);

    this.logger.info('Monitoring service started', {
      healthInterval: this.config.checkIntervals.health,
      performanceInterval: this.config.checkIntervals.performance,
      alertInterval: this.config.checkIntervals.alerts
    });
  }

  /**
   * Record API call metrics
   * @param {string} endpoint - API endpoint
   * @param {number} responseTime - Response time in ms
   * @param {boolean} success - Whether call was successful
   */
  recordApiCall(endpoint, responseTime, success = true) {
    const now = Date.now();
    const key = `${endpoint}_${Math.floor(now / 60000)}`; // Per minute

    // Record API call count
    if (!this.metrics.apiCalls.has(key)) {
      this.metrics.apiCalls.set(key, { total: 0, errors: 0, responseTimes: [] });
    }
    
    const metric = this.metrics.apiCalls.get(key);
    metric.total++;
    metric.responseTimes.push(responseTime);
    
    if (!success) {
      metric.errors++;
    }

    // Keep only last hour of data
    this.cleanupOldMetrics(this.metrics.apiCalls, 60);

    // Record response time for global tracking
    this.metrics.responseTimes.push({
      endpoint,
      responseTime,
      timestamp: now
    });

    // Keep only last 1000 response times
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes = this.metrics.responseTimes.slice(-1000);
    }
  }

  /**
   * Record transaction metrics
   * @param {Object} transaction - Transaction data
   */
  recordTransaction(transaction) {
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000); // Per hour

    if (!this.metrics.transactionCounts.has(hourKey)) {
      this.metrics.transactionCounts.set(hourKey, {
        total: 0,
        volume: 0,
        byStatus: { completed: 0, failed: 0, pending: 0 },
        byType: {}
      });
    }

    const metric = this.metrics.transactionCounts.get(hourKey);
    metric.total++;
    metric.volume += transaction.amount || 0;
    metric.byStatus[transaction.status] = (metric.byStatus[transaction.status] || 0) + 1;
    metric.byType[transaction.type] = (metric.byType[transaction.type] || 0) + 1;

    // Keep only last 24 hours
    this.cleanupOldMetrics(this.metrics.transactionCounts, 24);
  }

  /**
   * Record fraud event
   * @param {Object} fraudEvent - Fraud detection event
   */
  recordFraudEvent(fraudEvent) {
    this.metrics.fraudEvents.push({
      ...fraudEvent,
      timestamp: Date.now()
    });

    // Keep only last 1000 fraud events
    if (this.metrics.fraudEvents.length > 1000) {
      this.metrics.fraudEvents = this.metrics.fraudEvents.slice(-1000);
    }
  }

  /**
   * Record webhook event
   * @param {Object} webhookEvent - Webhook processing event
   */
  recordWebhookEvent(webhookEvent) {
    this.metrics.webhookEvents.push({
      ...webhookEvent,
      timestamp: Date.now()
    });

    // Keep only last 1000 webhook events
    if (this.metrics.webhookEvents.length > 1000) {
      this.metrics.webhookEvents = this.metrics.webhookEvents.slice(-1000);
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date(),
        status: 'healthy',
        checks: {}
      };

      // Database connectivity check
      try {
        await User.findOne().limit(1);
        health.checks.database = { status: 'healthy', responseTime: Date.now() };
      } catch (error) {
        health.checks.database = { status: 'unhealthy', error: error.message };
        health.status = 'unhealthy';
      }

      // Card issuer connectivity check
      try {
        const adapter = cardIssuerConfig.getAdapter();
        if (adapter && typeof adapter.testConnection === 'function') {
          await adapter.testConnection();
          health.checks.cardIssuer = { status: 'healthy' };
        } else {
          health.checks.cardIssuer = { status: 'unknown', message: 'No test method available' };
        }
      } catch (error) {
        health.checks.cardIssuer = { status: 'unhealthy', error: error.message };
        if (cardIssuerConfig.featureFlags.useRealCards) {
          health.status = 'degraded';
        }
      }

      // Memory usage check
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
      };

      health.checks.memory = {
        status: memUsageMB.heapUsed > 500 ? 'warning' : 'healthy',
        usage: memUsageMB
      };

      // Store health check result
      this.lastHealthCheck = health;

      if (health.status === 'unhealthy') {
        this.triggerAlert('system_unhealthy', {
          message: 'System health check failed',
          details: health.checks
        });
      }

    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
    }
  }

  /**
   * Perform performance check
   */
  async performPerformanceCheck() {
    try {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Calculate API performance metrics
      const recentApiCalls = Array.from(this.metrics.apiCalls.values());
      const totalCalls = recentApiCalls.reduce((sum, metric) => sum + metric.total, 0);
      const totalErrors = recentApiCalls.reduce((sum, metric) => sum + metric.errors, 0);
      const errorRate = totalCalls > 0 ? totalErrors / totalCalls : 0;

      // Calculate average response time
      const recentResponseTimes = this.metrics.responseTimes
        .filter(rt => rt.timestamp > oneHourAgo)
        .map(rt => rt.responseTime);
      
      const avgResponseTime = recentResponseTimes.length > 0 
        ? recentResponseTimes.reduce((sum, rt) => sum + rt, 0) / recentResponseTimes.length
        : 0;

      // Calculate transaction metrics
      const recentTransactions = Array.from(this.metrics.transactionCounts.values());
      const totalTransactions = recentTransactions.reduce((sum, metric) => sum + metric.total, 0);

      // Calculate fraud rate
      const recentFraudEvents = this.metrics.fraudEvents
        .filter(event => event.timestamp > oneHourAgo);
      const fraudRate = totalTransactions > 0 ? recentFraudEvents.length / totalTransactions : 0;

      const performance = {
        timestamp: new Date(),
        metrics: {
          errorRate,
          avgResponseTime,
          totalTransactions,
          fraudRate,
          apiCallsPerHour: totalCalls
        }
      };

      // Store performance metrics
      this.lastPerformanceCheck = performance;

      // Check for performance alerts
      if (errorRate > this.config.alertThresholds.errorRate) {
        this.triggerAlert('high_error_rate', {
          message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold`,
          errorRate,
          threshold: this.config.alertThresholds.errorRate
        });
      }

      if (avgResponseTime > this.config.alertThresholds.responseTime) {
        this.triggerAlert('slow_response_time', {
          message: `Average response time (${avgResponseTime}ms) exceeds threshold`,
          avgResponseTime,
          threshold: this.config.alertThresholds.responseTime
        });
      }

      if (fraudRate > this.config.alertThresholds.fraudRate) {
        this.triggerAlert('high_fraud_rate', {
          message: `Fraud rate (${(fraudRate * 100).toFixed(2)}%) exceeds threshold`,
          fraudRate,
          threshold: this.config.alertThresholds.fraudRate
        });
      }

    } catch (error) {
      this.logger.error('Performance check failed', { error: error.message });
    }
  }

  /**
   * Check for alerts
   */
  async checkAlerts() {
    try {
      // Check for stuck transactions
      const stuckTransactions = await Transaction.find({
        status: 'pending',
        createdAt: { $lt: new Date(Date.now() - 3600000) } // Older than 1 hour
      }).limit(10);

      if (stuckTransactions.length > 0) {
        this.triggerAlert('stuck_transactions', {
          message: `${stuckTransactions.length} transactions stuck in pending status`,
          count: stuckTransactions.length,
          transactions: stuckTransactions.map(tx => tx._id)
        });
      }

      // Check for frozen cards due to fraud
      const frozenCards = await VirtualCard.countDocuments({
        status: 'frozen',
        statusReason: { $regex: /fraud/i },
        updatedAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
      });

      if (frozenCards > 10) {
        this.triggerAlert('mass_card_freezing', {
          message: `${frozenCards} cards frozen due to fraud in the last hour`,
          count: frozenCards
        });
      }

      // Check for high KYC rejection rate
      const recentKYCRejections = await User.countDocuments({
        kycStatus: 'rejected',
        updatedAt: { $gte: new Date(Date.now() - 86400000) } // Last 24 hours
      });

      const totalKYCSubmissions = await User.countDocuments({
        kycStatus: { $in: ['approved', 'rejected'] },
        updatedAt: { $gte: new Date(Date.now() - 86400000) }
      });

      if (totalKYCSubmissions > 0) {
        const rejectionRate = recentKYCRejections / totalKYCSubmissions;
        if (rejectionRate > 0.5) { // 50% rejection rate
          this.triggerAlert('high_kyc_rejection_rate', {
            message: `KYC rejection rate (${(rejectionRate * 100).toFixed(1)}%) is unusually high`,
            rejectionRate,
            rejections: recentKYCRejections,
            total: totalKYCSubmissions
          });
        }
      }

    } catch (error) {
      this.logger.error('Alert check failed', { error: error.message });
    }
  }

  /**
   * Trigger an alert
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   */
  triggerAlert(type, data) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.getAlertSeverity(type),
      timestamp: new Date(),
      data,
      acknowledged: false
    };

    // Store alert
    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    // Log alert
    this.logger.warn('Alert triggered', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: data.message
    });

    // In production, this would send notifications via email, Slack, etc.
    this.sendAlertNotification(alert);

    return alert;
  }

  /**
   * Get alert severity based on type
   * @param {string} type - Alert type
   * @returns {string} Severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      system_unhealthy: 'critical',
      high_error_rate: 'high',
      slow_response_time: 'medium',
      high_fraud_rate: 'high',
      stuck_transactions: 'medium',
      mass_card_freezing: 'high',
      high_kyc_rejection_rate: 'medium'
    };

    return severityMap[type] || 'low';
  }

  /**
   * Send alert notification
   * @param {Object} alert - Alert object
   */
  async sendAlertNotification(alert) {
    try {
      // In production, integrate with notification services
      // For now, just log the notification
      this.logger.info('Alert notification sent', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.data.message
      });

      // TODO: Integrate with email service, Slack, PagerDuty, etc.
      // await emailService.sendAlert(alert);
      // await slackService.sendAlert(alert);

    } catch (error) {
      this.logger.error('Failed to send alert notification', {
        alertId: alert.id,
        error: error.message
      });
    }
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} acknowledgedBy - User who acknowledged
   * @returns {Object} Acknowledgment result
   */
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.alertHistory.find(a => a.id === alertId);
    
    if (!alert) {
      return { success: false, message: 'Alert not found' };
    }

    if (alert.acknowledged) {
      return { success: false, message: 'Alert already acknowledged' };
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
      type: alert.type
    });

    return { success: true, alert };
  }

  /**
   * Get monitoring dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    return {
      timestamp: new Date(),
      health: this.lastHealthCheck,
      performance: this.lastPerformanceCheck,
      alerts: {
        recent: this.alertHistory
          .filter(alert => alert.timestamp.getTime() > oneHourAgo)
          .sort((a, b) => b.timestamp - a.timestamp),
        unacknowledged: this.alertHistory.filter(alert => !alert.acknowledged).length,
        total: this.alertHistory.length
      },
      metrics: {
        apiCalls: this.getRecentApiMetrics(),
        transactions: this.getRecentTransactionMetrics(),
        fraud: this.getRecentFraudMetrics(),
        webhooks: this.getRecentWebhookMetrics()
      }
    };
  }

  /**
   * Get recent API metrics
   * @returns {Object} API metrics
   */
  getRecentApiMetrics() {
    const recentCalls = Array.from(this.metrics.apiCalls.values());
    const totalCalls = recentCalls.reduce((sum, metric) => sum + metric.total, 0);
    const totalErrors = recentCalls.reduce((sum, metric) => sum + metric.errors, 0);

    return {
      totalCalls,
      errorRate: totalCalls > 0 ? totalErrors / totalCalls : 0,
      avgResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * Get recent transaction metrics
   * @returns {Object} Transaction metrics
   */
  getRecentTransactionMetrics() {
    const recentTransactions = Array.from(this.metrics.transactionCounts.values());
    return {
      total: recentTransactions.reduce((sum, metric) => sum + metric.total, 0),
      volume: recentTransactions.reduce((sum, metric) => sum + metric.volume, 0)
    };
  }

  /**
   * Get recent fraud metrics
   * @returns {Object} Fraud metrics
   */
  getRecentFraudMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    const recentEvents = this.metrics.fraudEvents.filter(event => event.timestamp > oneHourAgo);
    
    return {
      events: recentEvents.length,
      highRiskEvents: recentEvents.filter(event => event.riskLevel === 'high').length
    };
  }

  /**
   * Get recent webhook metrics
   * @returns {Object} Webhook metrics
   */
  getRecentWebhookMetrics() {
    const oneHourAgo = Date.now() - 3600000;
    const recentEvents = this.metrics.webhookEvents.filter(event => event.timestamp > oneHourAgo);
    
    return {
      total: recentEvents.length,
      successful: recentEvents.filter(event => event.success).length,
      failed: recentEvents.filter(event => !event.success).length
    };
  }

  /**
   * Calculate average response time
   * @returns {number} Average response time in ms
   */
  calculateAverageResponseTime() {
    const oneHourAgo = Date.now() - 3600000;
    const recentTimes = this.metrics.responseTimes
      .filter(rt => rt.timestamp > oneHourAgo)
      .map(rt => rt.responseTime);

    return recentTimes.length > 0 
      ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
      : 0;
  }

  /**
   * Clean up old metrics
   * @param {Map} metricsMap - Metrics map to clean
   * @param {number} maxAge - Maximum age in time units
   */
  cleanupOldMetrics(metricsMap, maxAge) {
    const cutoff = Math.floor(Date.now() / 60000) - maxAge;
    
    for (const [key, value] of metricsMap.entries()) {
      const keyTime = parseInt(key.split('_').pop());
      if (keyTime < cutoff) {
        metricsMap.delete(key);
      }
    }
  }

  /**
   * Get system statistics
   * @returns {Object} System statistics
   */
  getSystemStats() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    };
  }
}

module.exports = new MonitoringService();
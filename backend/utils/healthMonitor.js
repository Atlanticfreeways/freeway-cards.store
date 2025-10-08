const mongoose = require('mongoose');
const { logger, performanceLogger } = require('./logger');

class HealthMonitor {
  constructor() {
    this.metrics = {
      uptime: 0,
      requests: 0,
      errors: 0,
      dbConnections: 0,
      memoryUsage: {},
      lastCheck: new Date()
    };
    
    this.thresholds = {
      memory: 500, // MB
      responseTime: 1000, // ms
      errorRate: 0.05 // 5%
    };
    
    this.startMonitoring();
  }

  startMonitoring() {
    // Monitor every 30 seconds
    setInterval(() => {
      this.collectMetrics();
      this.checkHealth();
    }, 30000);
  }

  collectMetrics() {
    const memUsage = process.memoryUsage();
    
    this.metrics = {
      uptime: Math.floor(process.uptime()),
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024)
      },
      dbStatus: mongoose.connection.readyState,
      lastCheck: new Date(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  checkHealth() {
    const issues = [];
    
    // Memory check
    if (this.metrics.memoryUsage.heapUsed > this.thresholds.memory) {
      issues.push(`High memory usage: ${this.metrics.memoryUsage.heapUsed}MB`);
    }
    
    // Database check
    if (this.metrics.dbStatus !== 1) {
      issues.push('Database connection issue');
    }
    
    // Log health status
    if (issues.length > 0) {
      logger.warn('Health check issues detected', { issues, metrics: this.metrics });
    } else {
      performanceLogger.info('Health check passed', this.metrics);
    }
  }

  getHealthStatus() {
    this.collectMetrics();
    
    const isHealthy = this.metrics.dbStatus === 1 && 
                     this.metrics.memoryUsage.heapUsed < this.thresholds.memory;
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      ...this.metrics
    };
  }

  incrementRequests() {
    this.metrics.requests++;
  }

  incrementErrors() {
    this.metrics.errors++;
  }

  getErrorRate() {
    return this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0;
  }
}

module.exports = new HealthMonitor();
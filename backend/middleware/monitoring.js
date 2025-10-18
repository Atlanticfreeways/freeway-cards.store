const monitoringService = require('../services/monitoringService');

/**
 * Monitoring Middleware
 * Tracks API performance and records metrics
 */
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response
  res.send = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const success = res.statusCode < 400;
    
    // Record API call metrics
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    monitoringService.recordApiCall(endpoint, responseTime, success);
    
    // Log slow requests
    if (responseTime > 5000) { // 5 seconds
      console.warn('Slow API request detected', {
        endpoint,
        responseTime,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
    
    // Call original send
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Transaction Monitoring Middleware
 * Records transaction-related metrics
 */
const transactionMonitoringMiddleware = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this is a transaction-related endpoint
    if (req.path.includes('/transactions') || 
        req.path.includes('/cards') && req.method === 'POST') {
      
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        
        // Record transaction if response contains transaction data
        if (responseData.transaction) {
          monitoringService.recordTransaction(responseData.transaction);
        }
        
        // Record card creation
        if (responseData.card && req.method === 'POST' && req.path.includes('/create')) {
          monitoringService.recordTransaction({
            type: 'card_creation',
            status: 'completed',
            amount: 0,
            cardId: responseData.card.id
          });
        }
        
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error Monitoring Middleware
 * Captures and records application errors
 */
const errorMonitoringMiddleware = (err, req, res, next) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  // Record error metrics
  monitoringService.recordApiCall(endpoint, 0, false);
  
  // Log error details
  console.error('API Error captured by monitoring', {
    endpoint,
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date()
  });
  
  // Trigger alert for critical errors
  if (!err.statusCode || err.statusCode >= 500) {
    monitoringService.triggerAlert('api_error', {
      message: `API Error: ${err.message}`,
      endpoint,
      statusCode: err.statusCode || 500,
      error: err.message,
      userId: req.user?.id
    });
  }
  
  next(err);
};

/**
 * Webhook Monitoring Middleware
 * Records webhook processing metrics
 */
const webhookMonitoringMiddleware = (req, res, next) => {
  if (req.path.includes('/webhooks/')) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const success = res.statusCode < 400;
      
      // Record webhook event
      monitoringService.recordWebhookEvent({
        provider: req.path.includes('/marqeta') ? 'marqeta' : 
                 req.path.includes('/stripe') ? 'stripe' : 'unknown',
        success,
        responseTime,
        statusCode: res.statusCode,
        eventType: req.body?.type || 'unknown'
      });
      
      originalSend.call(this, data);
    };
  }
  
  next();
};

/**
 * Fraud Monitoring Middleware
 * Records fraud detection events
 */
const fraudMonitoringMiddleware = (fraudResult) => {
  if (fraudResult && fraudResult.fraudScore !== undefined) {
    monitoringService.recordFraudEvent({
      fraudScore: fraudResult.fraudScore,
      riskLevel: fraudResult.riskLevel,
      indicators: fraudResult.indicators || [],
      fraudDetected: fraudResult.fraudDetected || false,
      cardFrozen: fraudResult.cardFrozen || false
    });
  }
};

/**
 * Request Rate Limiting Monitoring
 * Tracks rate limiting events
 */
const rateLimitMonitoringMiddleware = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this is a rate limit response
    if (res.statusCode === 429) {
      monitoringService.triggerAlert('rate_limit_exceeded', {
        message: 'Rate limit exceeded',
        endpoint: `${req.method} ${req.path}`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  monitoringMiddleware,
  transactionMonitoringMiddleware,
  errorMonitoringMiddleware,
  webhookMonitoringMiddleware,
  fraudMonitoringMiddleware,
  rateLimitMonitoringMiddleware
};
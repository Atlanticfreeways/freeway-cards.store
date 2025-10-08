const { logAudit, logSecurity } = require('../utils/logger');

// Audit logging middleware
const auditLogger = (req, res, next) => {
  const originalSend = res.send;
  const startTime = Date.now();
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const user = req.user ? req.user._id : 'anonymous';
    
    // Log all API requests
    if (req.url.startsWith('/api/')) {
      logAudit('api_request', user, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    // Log sensitive operations
    if (req.method !== 'GET' && req.url.startsWith('/api/')) {
      logSecurity('sensitive_operation', {
        user,
        action: `${req.method} ${req.url}`,
        statusCode: res.statusCode,
        ip: req.ip
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Security event logger
const securityEventLogger = {
  loginAttempt: (email, success, ip) => {
    logSecurity('login_attempt', {
      email,
      success,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  
  loginSuccess: (userId, email, ip) => {
    logSecurity('login_success', {
      userId,
      email,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  
  loginFailure: (email, reason, ip) => {
    logSecurity('login_failure', {
      email,
      reason,
      ip,
      timestamp: new Date().toISOString()
    });
  },
  
  rateLimitExceeded: (ip, endpoint) => {
    logSecurity('rate_limit_exceeded', {
      ip,
      endpoint,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (details) => {
    logSecurity('suspicious_activity', {
      ...details,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { auditLogger, securityEventLogger };
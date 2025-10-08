const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({ timestamp, level, message, ...meta });
  })
);

// Main application logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'cardsfreeways-api', pid: process.pid },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

// Security event logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: { service: 'security', pid: process.pid },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'security.log'),
      maxsize: 10485760,
      maxFiles: 15
    })
  ]
});

// Performance logger
const performanceLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: { service: 'performance', pid: process.pid },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Audit logger for compliance
const auditLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: { service: 'audit', pid: process.pid },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 20
    })
  ]
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  });
  
  logger.add(consoleTransport);
  securityLogger.add(consoleTransport);
}

// Log helper functions
const logSecurity = (event, details = {}) => {
  securityLogger.info(event, { ...details, timestamp: new Date().toISOString() });
};

const logPerformance = (metric, value, details = {}) => {
  performanceLogger.info(metric, { value, ...details, timestamp: new Date().toISOString() });
};

const logAudit = (action, user, details = {}) => {
  auditLogger.info(action, { user, ...details, timestamp: new Date().toISOString() });
};

module.exports = { 
  logger, 
  securityLogger, 
  performanceLogger, 
  auditLogger,
  logSecurity,
  logPerformance,
  logAudit
};
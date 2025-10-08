const logger = require('../utils/logger');

// Performance monitoring middleware
const performanceMonitoring = (req, res, next) => {
  const start = Date.now();
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        memoryDelta: `${Math.round(memoryDelta / 1024)}KB`
      });
    }
    
    // Log performance metrics
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
};

// Cache headers middleware
const cacheHeaders = (req, res, next) => {
  if (req.method === 'GET') {
    // Different cache strategies based on route
    if (req.url.includes('/api/health')) {
      res.set('Cache-Control', 'no-cache');
    } else if (req.url.includes('/api/')) {
      res.set('Cache-Control', 'private, max-age=60');
    } else if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    } else {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
  }
  next();
};

// Memory monitoring
const memoryMonitoring = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // Alert if memory usage is high
  if (heapUsedMB > 500) {
    logger.warn('High memory usage detected', {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    });
  }
  
  next();
};

// Request size monitoring
const requestSizeMonitoring = (req, res, next) => {
  const contentLength = req.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    logger.warn('Large request detected', {
      size: `${Math.round(contentLength / 1024 / 1024)}MB`,
      url: req.url,
      method: req.method
    });
  }
  next();
};

module.exports = { 
  performanceMonitoring, 
  cacheHeaders, 
  memoryMonitoring, 
  requestSizeMonitoring 
};
const path = require('path');
const logger = require('./logger');

// Module cache for lazy loading
const moduleCache = new Map();
const loadTimes = new Map();

// Lazy loading utility
class ModuleLoader {
  static lazyRequire(modulePath, basePath = __dirname) {
    const fullPath = path.resolve(basePath, modulePath);
    
    if (moduleCache.has(fullPath)) {
      return moduleCache.get(fullPath);
    }
    
    const start = Date.now();
    try {
      const module = require(fullPath);
      const loadTime = Date.now() - start;
      
      moduleCache.set(fullPath, module);
      loadTimes.set(fullPath, loadTime);
      
      if (loadTime > 100) {
        logger.warn('Slow module load', {
          module: modulePath,
          loadTime: `${loadTime}ms`
        });
      }
      
      return module;
    } catch (error) {
      logger.error('Module load failed', {
        module: modulePath,
        error: error.message
      });
      throw error;
    }
  }
  
  // Preload critical modules
  static async preloadModules(modules) {
    const promises = modules.map(async (modulePath) => {
      try {
        await this.lazyRequire(modulePath);
        logger.debug('Module preloaded', { module: modulePath });
      } catch (error) {
        logger.error('Module preload failed', {
          module: modulePath,
          error: error.message
        });
      }
    });
    
    await Promise.all(promises);
  }
  
  // Get loading statistics
  static getStats() {
    const stats = {
      cachedModules: moduleCache.size,
      totalLoadTime: Array.from(loadTimes.values()).reduce((sum, time) => sum + time, 0),
      slowModules: []
    };
    
    for (const [module, time] of loadTimes.entries()) {
      if (time > 100) {
        stats.slowModules.push({ module, loadTime: `${time}ms` });
      }
    }
    
    return stats;
  }
  
  // Clear module cache (for development)
  static clearCache() {
    moduleCache.clear();
    loadTimes.clear();
  }
}

// Route lazy loader
class RouteLoader {
  constructor() {
    this.routes = new Map();
  }
  
  // Register route for lazy loading
  register(path, routeFile) {
    this.routes.set(path, {
      file: routeFile,
      loaded: false,
      router: null
    });
  }
  
  // Load route when needed
  load(path) {
    const route = this.routes.get(path);
    if (!route) {
      throw new Error(`Route not found: ${path}`);
    }
    
    if (!route.loaded) {
      const start = Date.now();
      route.router = ModuleLoader.lazyRequire(route.file);
      route.loaded = true;
      
      const loadTime = Date.now() - start;
      logger.debug('Route loaded', {
        path,
        loadTime: `${loadTime}ms`
      });
    }
    
    return route.router;
  }
  
  // Get all registered routes
  getRoutes() {
    return Array.from(this.routes.keys());
  }
}

// Memory optimization utilities
class MemoryOptimizer {
  // Force garbage collection if available
  static forceGC() {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      logger.debug('Garbage collection completed', {
        before: `${Math.round(before.heapUsed / 1024 / 1024)}MB`,
        after: `${Math.round(after.heapUsed / 1024 / 1024)}MB`,
        freed: `${Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024)}MB`
      });
    }
  }
  
  // Monitor memory usage
  static startMemoryMonitoring(interval = 60000) {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      if (heapUsedMB > 500) {
        logger.warn('High memory usage detected', {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(usage.external / 1024 / 1024)}MB`,
          rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
        });
        
        // Force GC if memory is very high
        if (heapUsedMB > 800) {
          this.forceGC();
        }
      }
    }, interval);
  }
  
  // Object pool for frequently created objects
  static createObjectPool(createFn, resetFn, maxSize = 100) {
    const pool = [];
    
    return {
      acquire: () => {
        if (pool.length > 0) {
          return pool.pop();
        }
        return createFn();
      },
      
      release: (obj) => {
        if (pool.length < maxSize) {
          resetFn(obj);
          pool.push(obj);
        }
      },
      
      size: () => pool.length
    };
  }
}

// Startup optimization
class StartupOptimizer {
  static async optimizeStartup() {
    const start = Date.now();
    
    // Preload critical modules
    const criticalModules = [
      '../models/User',
      '../models/Card',
      '../utils/sanitizer',
      '../utils/logger'
    ];
    
    await ModuleLoader.preloadModules(criticalModules);
    
    // Start memory monitoring
    MemoryOptimizer.startMemoryMonitoring();
    
    const duration = Date.now() - start;
    logger.info('Startup optimization completed', {
      duration: `${duration}ms`,
      moduleStats: ModuleLoader.getStats()
    });
  }
}

module.exports = {
  ModuleLoader,
  RouteLoader,
  MemoryOptimizer,
  StartupOptimizer
};
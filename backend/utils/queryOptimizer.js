const logger = require('./logger');

// Simple in-memory cache for frequently accessed data
class QueryCache {
  constructor(maxSize = 100, ttl = 300000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global cache instance
const queryCache = new QueryCache();

// Query optimization helpers
const QueryOptimizer = {
  // Paginate queries efficiently
  paginate: (query, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return query.skip(skip).limit(Math.min(limit, 100)); // Max 100 items per page
  },

  // Add common projections to reduce data transfer
  selectFields: (query, fields) => {
    if (fields && Array.isArray(fields)) {
      return query.select(fields.join(' '));
    }
    return query;
  },

  // Optimize user queries
  optimizeUserQuery: (query) => {
    return query
      .select('-password -verificationToken') // Exclude sensitive fields
      .lean(); // Return plain objects for better performance
  },

  // Optimize card queries
  optimizeCardQuery: (query) => {
    return query
      .select('-cvv') // Exclude sensitive CVV
      .lean();
  },

  // Cache frequently accessed data
  withCache: async (key, queryFn, ttl = 300000) => {
    const cached = queryCache.get(key);
    if (cached) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    const result = await queryFn();
    queryCache.set(key, result);
    logger.debug('Cache miss - data cached', { key });
    return result;
  },

  // Analyze query performance
  analyzeQuery: async (queryFn, context = '') => {
    const start = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await queryFn();
      const duration = Date.now() - start;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;
      
      if (duration > 500) { // Log slow queries
        logger.warn('Slow query detected', {
          context,
          duration: `${duration}ms`,
          memoryUsed: `${Math.round(memoryUsed / 1024)}KB`
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', {
        context,
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  },

  // Batch operations for better performance
  batchUpdate: async (Model, updates) => {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update._id },
        update: { $set: update.data }
      }
    }));
    
    return await Model.bulkWrite(bulkOps);
  },

  // Clear cache for specific patterns
  clearCache: (pattern) => {
    if (pattern) {
      for (const key of queryCache.cache.keys()) {
        if (key.includes(pattern)) {
          queryCache.cache.delete(key);
        }
      }
    } else {
      queryCache.clear();
    }
  },

  // Get cache statistics
  getCacheStats: () => {
    return {
      size: queryCache.size(),
      maxSize: queryCache.maxSize,
      ttl: queryCache.ttl
    };
  }
};

// Common query patterns
const CommonQueries = {
  // Get user with cards (optimized)
  getUserWithCards: async (User, Card, userId) => {
    return await QueryOptimizer.withCache(
      `user_cards_${userId}`,
      async () => {
        const user = await QueryOptimizer.optimizeUserQuery(
          User.findById(userId)
        );
        
        if (!user) return null;
        
        const cards = await QueryOptimizer.optimizeCardQuery(
          Card.find({ userId, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(10)
        );
        
        return { ...user, cards };
      },
      60000 // 1 minute cache
    );
  },

  // Get user cards with pagination
  getUserCardsPaginated: async (Card, userId, page = 1, limit = 10) => {
    const cacheKey = `user_cards_page_${userId}_${page}_${limit}`;
    
    return await QueryOptimizer.withCache(
      cacheKey,
      async () => {
        const query = Card.find({ userId })
          .sort({ createdAt: -1 });
        
        const [cards, total] = await Promise.all([
          QueryOptimizer.optimizeCardQuery(
            QueryOptimizer.paginate(query.clone(), page, limit)
          ),
          Card.countDocuments({ userId })
        ]);
        
        return {
          cards,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        };
      },
      30000 // 30 seconds cache
    );
  }
};

module.exports = {
  QueryOptimizer,
  CommonQueries,
  queryCache
};
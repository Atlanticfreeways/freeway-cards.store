// Analytics and Tracking Manager
class AnalyticsManager {
  constructor() {
    this.events = [];
    this.sessionId = this.generateSessionId();
    this.userId = localStorage.getItem('userId') || 'anonymous';
    this.init();
  }

  init() {
    this.trackPageView();
    this.setupEventTracking();
    this.trackUserBehavior();
    this.setupPerformanceTracking();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  trackPageView() {
    const pageData = {
      event: 'page_view',
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId
    };
    
    this.sendEvent(pageData);
  }

  trackEvent(eventName, properties = {}) {
    const eventData = {
      event: eventName,
      properties: {
        ...properties,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: this.userId
      }
    };
    
    this.sendEvent(eventData);
  }

  setupEventTracking() {
    // Track button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('button, .btn, a[href]')) {
        this.trackEvent('button_click', {
          element: e.target.tagName.toLowerCase(),
          text: e.target.textContent?.trim().substring(0, 50),
          href: e.target.href || null,
          className: e.target.className
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      this.trackEvent('form_submit', {
        formId: form.id || 'unknown',
        action: form.action || window.location.pathname,
        method: form.method || 'GET'
      });
    });

    // Track input focus (for conversion funnel analysis)
    document.addEventListener('focus', (e) => {
      if (e.target.matches('input, textarea, select')) {
        this.trackEvent('input_focus', {
          inputType: e.target.type || e.target.tagName.toLowerCase(),
          inputName: e.target.name || e.target.id,
          formId: e.target.closest('form')?.id || 'unknown'
        });
      }
    }, true);
  }

  trackUserBehavior() {
    // Track scroll depth
    let maxScroll = 0;
    const trackScroll = this.throttle(() => {
      const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        if (maxScroll % 25 === 0) { // Track at 25%, 50%, 75%, 100%
          this.trackEvent('scroll_depth', { percent: maxScroll });
        }
      }
    }, 1000);

    window.addEventListener('scroll', trackScroll);

    // Track time on page
    const startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const timeOnPage = Math.round((Date.now() - startTime) / 1000);
      this.trackEvent('time_on_page', { seconds: timeOnPage });
    });

    // Track user engagement
    let engagementScore = 0;
    const engagementEvents = ['click', 'scroll', 'keydown', 'mousemove'];
    
    engagementEvents.forEach(event => {
      document.addEventListener(event, this.throttle(() => {
        engagementScore++;
      }, 1000));
    });

    // Send engagement score every 30 seconds
    setInterval(() => {
      if (engagementScore > 0) {
        this.trackEvent('engagement', { score: engagementScore });
        engagementScore = 0;
      }
    }, 30000);
  }

  setupPerformanceTracking() {
    // Track page load performance
    window.addEventListener('load', () => {
      if ('performance' in window) {
        const perfData = performance.getEntriesByType('navigation')[0];
        
        this.trackEvent('performance', {
          loadTime: Math.round(perfData.loadEventEnd - perfData.fetchStart),
          domContentLoaded: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
          firstPaint: Math.round(performance.getEntriesByType('paint')[0]?.startTime || 0),
          connectionType: navigator.connection?.effectiveType || 'unknown'
        });
      }
    });

    // Track JavaScript errors
    window.addEventListener('error', (e) => {
      this.trackEvent('javascript_error', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        stack: e.error?.stack?.substring(0, 500)
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      this.trackEvent('promise_rejection', {
        reason: e.reason?.toString().substring(0, 500)
      });
    });
  }

  // E-commerce specific tracking
  trackPurchase(orderData) {
    this.trackEvent('purchase', {
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency || 'USD',
      items: orderData.items,
      paymentMethod: orderData.paymentMethod
    });
  }

  trackAddToCart(item) {
    this.trackEvent('add_to_cart', {
      itemId: item.id,
      itemName: item.name,
      amount: item.amount,
      category: item.category
    });
  }

  trackSearch(query, results) {
    this.trackEvent('search', {
      query: query,
      resultsCount: results
    });
  }

  // Conversion funnel tracking
  trackFunnelStep(step, data = {}) {
    this.trackEvent('funnel_step', {
      step: step,
      ...data
    });
  }

  sendEvent(eventData) {
    // Store events locally
    this.events.push(eventData);
    
    // Send to analytics service (replace with actual endpoint)
    if (navigator.onLine) {
      this.flushEvents();
    }
    
    // Log for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', eventData);
    }
  }

  flushEvents() {
    if (this.events.length === 0) return;
    
    // Simulate sending to analytics service
    const eventsToSend = [...this.events];
    this.events = [];
    
    // In production, replace with actual API call
    fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: eventsToSend })
    }).catch(error => {
      console.error('Analytics error:', error);
      // Re-add events to queue on failure
      this.events.unshift(...eventsToSend);
    });
  }

  // Utility function for throttling
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // GDPR compliance
  setConsentStatus(hasConsent) {
    localStorage.setItem('analyticsConsent', hasConsent.toString());
    if (!hasConsent) {
      this.events = [];
      localStorage.removeItem('userId');
    }
  }

  hasConsent() {
    return localStorage.getItem('analyticsConsent') === 'true';
  }
}

// Initialize analytics if consent is given
if (localStorage.getItem('analyticsConsent') !== 'false') {
  const analytics = new AnalyticsManager();
  
  // Make available globally for manual tracking
  window.analytics = analytics;
}
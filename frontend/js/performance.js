// Performance Optimizations
class PerformanceManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupLazyLoading();
    this.setupIntersectionObserver();
    this.preloadCriticalResources();
    this.optimizeImages();
  }

  setupLazyLoading() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  setupIntersectionObserver() {
    // Animate elements when they come into view
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
        }
      });
    }, { threshold: 0.1 });

    animateElements.forEach(el => observer.observe(el));
  }

  preloadCriticalResources() {
    // Preload critical pages
    const criticalPages = [
      '/dashboard/index.html',
      '/wallet/index.html',
      '/css/main.css'
    ];

    criticalPages.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  optimizeImages() {
    // Convert images to WebP if supported
    const supportsWebP = this.checkWebPSupport();
    if (supportsWebP) {
      document.documentElement.classList.add('webp');
    }
  }

  checkWebPSupport() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  // Debounce function for performance
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function for scroll events
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

  // Measure performance
  measurePerformance() {
    if ('performance' in window) {
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0];
        console.log('Page Load Time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
        
        // Send to analytics (if implemented)
        this.sendPerformanceData({
          loadTime: perfData.loadEventEnd - perfData.fetchStart,
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
        });
      });
    }
  }

  sendPerformanceData(data) {
    // Send performance data to analytics service
    console.log('Performance Data:', data);
  }
}

// Initialize performance manager
const performanceManager = new PerformanceManager();

// Add CSS for animations
const animationStyles = document.createElement('style');
animationStyles.textContent = `
  .animate-on-scroll {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  
  .animate-on-scroll.animated {
    opacity: 1;
    transform: translateY(0);
  }
  
  .lazy {
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .lazy.loaded {
    opacity: 1;
  }
`;
document.head.appendChild(animationStyles);
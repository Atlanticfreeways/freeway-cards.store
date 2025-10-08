// Production Monitoring & Analytics
class ProductionMonitoring {
    constructor() {
        this.isEnabled = window.config && window.config.get('enableAnalytics');
        this.errorReporting = window.config && window.config.get('enableErrorReporting');
        
        if (this.isEnabled) {
            this.initializeAnalytics();
        }
        
        if (this.errorReporting) {
            this.initializeErrorReporting();
        }
    }

    initializeAnalytics() {
        // Google Analytics 4 (replace with your GA4 ID)
        if (window.config.isProduction()) {
            const script = document.createElement('script');
            script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
            document.head.appendChild(script);
            
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GA_MEASUREMENT_ID');
            
            window.gtag = gtag;
        }
    }

    initializeErrorReporting() {
        window.addEventListener('error', (event) => {
            this.reportError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.reportError({
                message: 'Unhandled Promise Rejection',
                error: event.reason
            });
        });
    }

    trackEvent(eventName, parameters = {}) {
        if (this.isEnabled && window.gtag) {
            window.gtag('event', eventName, parameters);
        }
        
        // Console log for development
        if (window.config.isDevelopment()) {
            console.log('Analytics Event:', eventName, parameters);
        }
    }

    trackPageView(pageName) {
        this.trackEvent('page_view', {
            page_title: pageName,
            page_location: window.location.href
        });
    }

    trackUserAction(action, category = 'user_interaction') {
        this.trackEvent(action, {
            event_category: category,
            event_label: window.location.pathname
        });
    }

    reportError(errorData) {
        if (!this.errorReporting) return;
        
        // Send to error reporting service (e.g., Sentry, LogRocket)
        console.error('Production Error:', errorData);
        
        // You can integrate with services like:
        // - Sentry: Sentry.captureException(errorData)
        // - LogRocket: LogRocket.captureException(errorData)
        // - Custom endpoint: fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorData) })
    }

    trackPerformance() {
        if (!this.isEnabled) return;
        
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                
                this.trackEvent('page_performance', {
                    load_time: Math.round(perfData.loadEventEnd - perfData.fetchStart),
                    dom_content_loaded: Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart),
                    first_paint: Math.round(performance.getEntriesByType('paint')[0]?.startTime || 0)
                });
            }, 0);
        });
    }
}

// Initialize monitoring
window.monitoring = new ProductionMonitoring();

// Track page performance
window.monitoring.trackPerformance();

// Auto-track page views
document.addEventListener('DOMContentLoaded', () => {
    window.monitoring.trackPageView(document.title);
});

// Export for global use
window.trackEvent = (event, params) => window.monitoring.trackEvent(event, params);
window.trackUserAction = (action) => window.monitoring.trackUserAction(action);
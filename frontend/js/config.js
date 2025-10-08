// Production Configuration Manager
class Config {
    constructor() {
        this.environment = this.detectEnvironment();
        this.config = this.loadConfig();
    }

    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        if (hostname.includes('netlify.app') || hostname.includes('vercel.app')) {
            return 'staging';
        }
        
        return 'production';
    }

    loadConfig() {
        const configs = {
            development: {
                apiBaseUrl: 'http://localhost:3000/api',
                googleClientId: 'localhost-client-id.apps.googleusercontent.com',
                enableAnalytics: false,
                enableErrorReporting: false,
                logLevel: 'debug'
            },
            staging: {
                apiBaseUrl: 'https://freeway-cards-backend.onrender.com/api',
                googleClientId: '804228968611-lcsqnvmgfabs4s9445d0d3lsikqupet3.apps.googleusercontent.com',
                enableAnalytics: true,
                enableErrorReporting: true,
                logLevel: 'info'
            },
            production: {
                apiBaseUrl: (window.ENV && window.ENV.API_BASE_URL_PROD) || 'https://freeway-cards-backend.onrender.com/api',
                googleClientId: (window.ENV && window.ENV.GOOGLE_CLIENT_ID_PROD) || '804228968611-lcsqnvmgfabs4s9445d0d3lsikqupet3.apps.googleusercontent.com',
                enableAnalytics: true,
                enableErrorReporting: true,
                logLevel: 'error'
            }
        };

        return configs[this.environment];
    }

    get(key) {
        return this.config[key];
    }

    isProduction() {
        return this.environment === 'production';
    }

    isDevelopment() {
        return this.environment === 'development';
    }
}

// Global configuration instance
window.config = new Config();
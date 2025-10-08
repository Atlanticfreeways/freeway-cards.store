// Production Security Enhancements
class SecurityManager {
    constructor() {
        this.initializeSecurityHeaders();
        this.setupCSRFProtection();
        this.initializeContentSecurityPolicy();
        this.setupSecureStorage();
    }

    initializeSecurityHeaders() {
        // Add security meta tags if not present
        this.addMetaTag('X-Content-Type-Options', 'nosniff');
        this.addMetaTag('X-Frame-Options', 'DENY');
        this.addMetaTag('X-XSS-Protection', '1; mode=block');
        this.addMetaTag('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    addMetaTag(name, content) {
        if (!document.querySelector(`meta[http-equiv="${name}"]`)) {
            const meta = document.createElement('meta');
            meta.httpEquiv = name;
            meta.content = content;
            document.head.appendChild(meta);
        }
    }

    setupCSRFProtection() {
        // Generate CSRF token for forms
        this.csrfToken = this.generateToken();
        
        // Add CSRF token to all API requests
        const originalFetch = window.fetch;
        window.fetch = (url, options = {}) => {
            if (url.includes('/api/') && options.method !== 'GET') {
                options.headers = {
                    ...options.headers,
                    'X-CSRF-Token': this.csrfToken
                };
            }
            return originalFetch(url, options);
        };
    }

    initializeContentSecurityPolicy() {
        // Add CSP meta tag for additional security
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.qrserver.com https://*.railway.app https://*.herokuapp.com",
            "frame-src https://accounts.google.com"
        ].join('; ');
        
        this.addMetaTag('Content-Security-Policy', csp);
    }

    setupSecureStorage() {
        // Encrypt sensitive data in localStorage
        const originalSetItem = localStorage.setItem;
        const originalGetItem = localStorage.getItem;
        
        localStorage.setItem = (key, value) => {
            if (this.isSensitiveKey(key)) {
                value = this.encrypt(value);
            }
            return originalSetItem.call(localStorage, key, value);
        };
        
        localStorage.getItem = (key) => {
            let value = originalGetItem.call(localStorage, key);
            if (value && this.isSensitiveKey(key)) {
                value = this.decrypt(value);
            }
            return value;
        };
    }

    isSensitiveKey(key) {
        const sensitiveKeys = ['authToken', 'userProfile', 'paymentInfo'];
        return sensitiveKeys.some(k => key.includes(k));
    }

    encrypt(data) {
        // Simple encryption for demo (use proper encryption in production)
        try {
            return btoa(encodeURIComponent(data));
        } catch (e) {
            return data;
        }
    }

    decrypt(data) {
        try {
            return decodeURIComponent(atob(data));
        } catch (e) {
            return data;
        }
    }

    generateToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    checkPasswordStrength(password) {
        let score = 0;
        let feedback = [];

        if (password.length >= 8) score++;
        else feedback.push('At least 8 characters');

        if (/[a-z]/.test(password)) score++;
        else feedback.push('Lowercase letter');

        if (/[A-Z]/.test(password)) score++;
        else feedback.push('Uppercase letter');

        if (/\d/.test(password)) score++;
        else feedback.push('Number');

        if (/[@$!%*?&]/.test(password)) score++;
        else feedback.push('Special character');

        const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
        
        return {
            score,
            strength,
            feedback: feedback.length > 0 ? 'Missing: ' + feedback.join(', ') : 'Strong password!'
        };
    }
}

// Initialize security manager
window.security = new SecurityManager();

// Export security functions
window.sanitizeInput = (input) => window.security.sanitizeInput(input);
window.validateEmail = (email) => window.security.validateEmail(email);
window.validatePassword = (password) => window.security.validatePassword(password);
window.checkPasswordStrength = (password) => window.security.checkPasswordStrength(password);
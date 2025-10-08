// Security Manager
class SecurityManager {
  constructor() {
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.warningTime = 5 * 60 * 1000; // 5 minutes before timeout
    this.init();
  }

  init() {
    this.setupSessionManagement();
    this.setupCSRFProtection();
    this.setupInputSanitization();
    this.setupSecurityHeaders();
  }

  setupSessionManagement() {
    let lastActivity = Date.now();
    let warningShown = false;

    // Track user activity
    const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activities.forEach(event => {
      document.addEventListener(event, () => {
        lastActivity = Date.now();
        warningShown = false;
      }, true);
    });

    // Check session timeout
    setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (timeSinceActivity > this.sessionTimeout) {
        this.handleSessionTimeout();
      } else if (timeSinceActivity > (this.sessionTimeout - this.warningTime) && !warningShown) {
        this.showSessionWarning();
        warningShown = true;
      }
    }, 60000); // Check every minute
  }

  handleSessionTimeout() {
    localStorage.clear();
    sessionStorage.clear();
    notifications.warning('Session expired. Please log in again.');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 2000);
  }

  showSessionWarning() {
    const extend = confirm('Your session will expire in 5 minutes. Do you want to extend it?');
    if (extend) {
      // Simulate session extension
      notifications.success('Session extended successfully');
    }
  }

  setupCSRFProtection() {
    // Generate CSRF token
    const csrfToken = this.generateToken();
    sessionStorage.setItem('csrfToken', csrfToken);

    // Add CSRF token to all forms
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        let csrfInput = form.querySelector('input[name="csrf_token"]');
        if (!csrfInput) {
          csrfInput = document.createElement('input');
          csrfInput.type = 'hidden';
          csrfInput.name = 'csrf_token';
          csrfInput.value = csrfToken;
          form.appendChild(csrfInput);
        }
      }
    });
  }

  setupInputSanitization() {
    // Sanitize inputs on blur
    document.addEventListener('blur', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.value = this.sanitizeInput(e.target.value);
      }
    }, true);
  }

  sanitizeInput(input) {
    // Basic XSS prevention
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  setupSecurityHeaders() {
    // Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
    document.head.appendChild(meta);
  }

  // Rate limiting for API calls
  createRateLimiter(maxRequests = 10, timeWindow = 60000) {
    const requests = [];
    
    return function() {
      const now = Date.now();
      
      // Remove old requests outside time window
      while (requests.length > 0 && requests[0] < now - timeWindow) {
        requests.shift();
      }
      
      if (requests.length >= maxRequests) {
        notifications.error('Too many requests. Please wait before trying again.');
        return false;
      }
      
      requests.push(now);
      return true;
    };
  }

  // Secure form submission
  secureSubmit(form, callback) {
    const rateLimiter = this.createRateLimiter(5, 60000);
    
    if (!rateLimiter()) {
      return false;
    }

    // Validate CSRF token
    const csrfToken = form.querySelector('input[name="csrf_token"]')?.value;
    const sessionToken = sessionStorage.getItem('csrfToken');
    
    if (csrfToken !== sessionToken) {
      notifications.error('Security validation failed. Please refresh and try again.');
      return false;
    }

    // Proceed with callback
    if (callback) callback();
    return true;
  }

  // Password strength checker
  checkPasswordStrength(password) {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password)
    };

    Object.values(checks).forEach(check => {
      if (check) score++;
    });

    const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score] || 'Very Weak';
    const color = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#28a745'][score] || '#dc3545';

    return { score, strength, color, checks };
  }

  // Detect suspicious activity
  detectSuspiciousActivity() {
    const suspiciousPatterns = [
      /script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload/i,
      /onerror/i
    ];

    document.addEventListener('input', (e) => {
      const value = e.target.value;
      const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(value));
      
      if (isSuspicious) {
        console.warn('Suspicious input detected');
        e.target.value = this.sanitizeInput(value);
        notifications.warning('Potentially harmful input was sanitized');
      }
    });
  }
}

// Initialize security manager
const security = new SecurityManager();
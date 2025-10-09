// Google OAuth Integration
class GoogleOAuth {
    constructor() {
        this.clientId = this.getClientId();
        this.isInitialized = false;
    }

    getClientId() {
        if (window.config) {
            const clientId = window.config.get('googleClientId');
            // Decode any HTML entities
            const div = document.createElement('div');
            div.innerHTML = clientId;
            return div.textContent || div.innerText || clientId;
        }
        return '804228968611-lcsqnvmgfabs4s9445d0d3lsikqupet3.apps.googleusercontent.com';
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            // Validate client ID
            if (!this.clientId || this.clientId.includes('&quot;') || this.clientId.length < 20) {
                throw new Error('Invalid Google Client ID configuration');
            }
            
            console.log('Client ID validation passed:', this.clientId.substring(0, 20) + '...');
            
            // Load Google Identity Services
            await this.loadGoogleScript();
            
            // Initialize Google OAuth
            google.accounts.id.initialize({
                client_id: this.clientId,
                callback: this.handleCredentialResponse.bind(this)
            });

            this.isInitialized = true;
            console.log('Google OAuth initialized with client ID:', this.clientId.substring(0, 20) + '...');
        } catch (error) {
            console.error('Google OAuth initialization failed:', error);
            // Show user-friendly error
            if (document.getElementById('google-signin-error')) {
                document.getElementById('google-signin-error').textContent = 'Google Sign-In temporarily unavailable';
            }
        }
    }

    loadGoogleScript() {
        return new Promise((resolve, reject) => {
            if (window.google) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async handleCredentialResponse(response) {
        try {
            // Send Google token to backend for verification
            const result = await api.request('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ token: response.credential })
            });

            if (result.token) {
                api.setAuthToken(result.token);
                localStorage.setItem('userEmail', result.user.email);
                localStorage.setItem('isLoggedIn', 'true');
                
                // Redirect to dashboard
                window.location.href = '/dashboard.html';
            }
        } catch (error) {
            console.error('Google OAuth login failed:', error);
            alert('Google login failed. Please try again.');
        }
    }

    renderSignInButton(elementId) {
        if (!this.isInitialized) {
            console.error('Google OAuth not initialized');
            return;
        }

        google.accounts.id.renderButton(
            document.getElementById(elementId),
            {
                theme: 'outline',
                size: 'large',
                width: '100%',
                text: 'signin_with'
            }
        );
    }

    renderSignUpButton(elementId) {
        if (!this.isInitialized) {
            console.error('Google OAuth not initialized');
            return;
        }

        google.accounts.id.renderButton(
            document.getElementById(elementId),
            {
                theme: 'filled_blue',
                size: 'large',
                width: '100%',
                text: 'signup_with'
            }
        );
    }

    // Fallback for custom buttons
    async signIn() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // Fallback to popup
                this.showPopup();
            }
        });
    }

    showPopup() {
        // Fallback popup method
        const popup = window.open(
            `https://accounts.google.com/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/google-callback.html')}&response_type=code&scope=email profile`,
            'google-oauth',
            'width=500,height=600'
        );

        // Listen for popup completion
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                // Check if authentication was successful
                this.checkAuthStatus();
            }
        }, 1000);
    }

    async checkAuthStatus() {
        try {
            const response = await api.getProfile();
            if (response.user) {
                window.location.reload();
            }
        } catch (error) {
            // Authentication failed or not completed
        }
    }
}

// Global Google OAuth instance
window.googleOAuth = new GoogleOAuth();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    googleOAuth.initialize();
});

// Global functions for button clicks
window.signInWithGoogle = () => googleOAuth.signIn();
window.signUpWithGoogle = () => googleOAuth.signIn();
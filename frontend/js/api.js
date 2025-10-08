// API Configuration and Integration
class API {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = localStorage.getItem('authToken');
    }

    getBaseURL() {
        return window.config ? window.config.get('apiBaseUrl') : '/api';
    }

    setAuthToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    clearAuthToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication APIs
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.token) {
            this.setAuthToken(response.token);
        }
        
        return response;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.clearAuthToken();
        }
    }

    async verifyEmail(token) {
        return this.request('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    }

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async resetPassword(token, password) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    }

    // User Profile APIs
    async getProfile() {
        return this.request('/user/profile');
    }

    async updateProfile(profileData) {
        return this.request('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async uploadKYCDocument(formData) {
        return this.request('/user/kyc/upload', {
            method: 'POST',
            headers: {}, // Remove Content-Type for FormData
            body: formData
        });
    }

    // Card Management APIs
    async getCards() {
        return this.request('/cards');
    }

    async createCard(cardData) {
        return this.request('/cards', {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
    }

    async getCard(cardId) {
        return this.request(`/cards/${cardId}`);
    }

    async updateCard(cardId, cardData) {
        return this.request(`/cards/${cardId}`, {
            method: 'PUT',
            body: JSON.stringify(cardData)
        });
    }

    async freezeCard(cardId) {
        return this.request(`/cards/${cardId}/freeze`, {
            method: 'POST'
        });
    }

    async unfreezeCard(cardId) {
        return this.request(`/cards/${cardId}/unfreeze`, {
            method: 'POST'
        });
    }

    async deleteCard(cardId) {
        return this.request(`/cards/${cardId}`, {
            method: 'DELETE'
        });
    }

    // Wallet APIs
    async getWallet() {
        return this.request('/wallet');
    }

    async getTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/wallet/transactions${query ? '?' + query : ''}`);
    }

    async addFunds(fundingData) {
        return this.request('/wallet/add-funds', {
            method: 'POST',
            body: JSON.stringify(fundingData)
        });
    }

    async withdraw(withdrawalData) {
        return this.request('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify(withdrawalData)
        });
    }

    // Gift Card APIs
    async purchaseGiftCard(giftCardData) {
        return this.request('/gift-cards/purchase', {
            method: 'POST',
            body: JSON.stringify(giftCardData)
        });
    }

    async redeemGiftCard(code) {
        return this.request('/gift-cards/redeem', {
            method: 'POST',
            body: JSON.stringify({ code })
        });
    }

    // Support APIs
    async createSupportTicket(ticketData) {
        return this.request('/support/tickets', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });
    }

    async getSupportTickets() {
        return this.request('/support/tickets');
    }
}

// Global API instance
window.api = new API();

// Auth helper functions
window.authHelpers = {
    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    },

    logout() {
        api.logout().finally(() => {
            localStorage.clear();
            window.location.href = '/index.html';
        });
    }
};

// Auto-redirect if not authenticated (for protected pages)
if (window.location.pathname.includes('/dashboard') || 
    window.location.pathname.includes('/cards') || 
    window.location.pathname.includes('/wallet') ||
    window.location.pathname.includes('/profile')) {
    
    if (!authHelpers.isAuthenticated()) {
        window.location.href = '/login.html';
    }
}
// Offline Manager
class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    this.init();
  }

  init() {
    this.setupConnectionListeners();
    this.setupOfflineUI();
    this.processOfflineQueue();
  }

  setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.hideOfflineBanner();
      this.processOfflineQueue();
      notifications.success('Connection restored');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineBanner();
      notifications.warning('You are now offline. Some features may be limited.');
    });
  }

  setupOfflineUI() {
    // Create offline banner
    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff6b6b;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 10001;
      transform: translateY(-100%);
      transition: transform 0.3s ease;
    `;
    banner.innerHTML = `
      <span>📡 You're offline. Changes will be saved when connection is restored.</span>
    `;
    document.body.appendChild(banner);

    // Show offline banner if already offline
    if (!this.isOnline) {
      this.showOfflineBanner();
    }
  }

  showOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (banner) {
      banner.style.transform = 'translateY(0)';
      document.body.style.paddingTop = '48px';
    }
  }

  hideOfflineBanner() {
    const banner = document.getElementById('offlineBanner');
    if (banner) {
      banner.style.transform = 'translateY(-100%)';
      document.body.style.paddingTop = '0';
    }
  }

  // Queue actions for when online
  queueAction(action) {
    this.offlineQueue.push({
      ...action,
      timestamp: Date.now(),
      id: this.generateId()
    });
    
    localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
    
    notifications.info('Action saved. Will sync when online.');
  }

  async processOfflineQueue() {
    if (!this.isOnline || this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));

    for (const action of queue) {
      try {
        await this.executeAction(action);
        notifications.success(`Synced: ${action.type}`);
      } catch (error) {
        console.error('Failed to sync action:', error);
        // Re-queue failed actions
        this.offlineQueue.push(action);
      }
    }

    if (this.offlineQueue.length > 0) {
      localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
    }
  }

  async executeAction(action) {
    switch (action.type) {
      case 'form_submit':
        return this.submitForm(action.data);
      case 'profile_update':
        return this.updateProfile(action.data);
      case 'preference_change':
        return this.updatePreferences(action.data);
      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  async submitForm(formData) {
    // Simulate form submission
    const response = await fetch(formData.action, {
      method: formData.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData.data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }

  async updateProfile(profileData) {
    // Simulate profile update
    return fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData)
    });
  }

  async updatePreferences(preferences) {
    // Simulate preferences update
    return fetch('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences)
    });
  }

  // Offline data management
  saveOfflineData(key, data) {
    const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
    offlineData[key] = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem('offlineData', JSON.stringify(offlineData));
  }

  getOfflineData(key) {
    const offlineData = JSON.parse(localStorage.getItem('offlineData') || '{}');
    return offlineData[key]?.data || null;
  }

  // Cache management
  cacheUserData() {
    const userData = {
      profile: this.getCurrentUserProfile(),
      wallet: this.getWalletData(),
      transactions: this.getRecentTransactions(),
      giftCards: this.getUserGiftCards()
    };
    
    this.saveOfflineData('userData', userData);
  }

  getCurrentUserProfile() {
    // Get current user profile data
    return {
      name: document.getElementById('userName')?.textContent || '',
      email: document.getElementById('userEmail')?.textContent || '',
      // Add other profile fields
    };
  }

  getWalletData() {
    return {
      balance: document.getElementById('walletBalance')?.textContent || '$0.00',
      // Add other wallet data
    };
  }

  getRecentTransactions() {
    // Get recent transactions from DOM or local storage
    return [];
  }

  getUserGiftCards() {
    // Get user's gift cards
    return [];
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Offline form handling
  handleOfflineForm(form) {
    if (this.isOnline) return true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    this.queueAction({
      type: 'form_submit',
      data: {
        action: form.action,
        method: form.method,
        data: data
      }
    });

    return false; // Prevent normal form submission
  }
}

// Initialize offline manager
const offlineManager = new OfflineManager();

// Intercept form submissions when offline
document.addEventListener('submit', (e) => {
  if (!navigator.onLine) {
    e.preventDefault();
    offlineManager.handleOfflineForm(e.target);
  }
});
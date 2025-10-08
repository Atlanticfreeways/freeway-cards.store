class SecureDashboard {
  constructor() {
    this.apiBase = window.location.protocol === 'https:' ? 'https://' : 'http://';
    this.apiBase += window.location.host + '/api';
    this.token = localStorage.getItem('authToken');
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialData();
    this.startAutoRefresh();
  }

  // Secure API request wrapper
  async apiRequest(endpoint, options = {}) {
    try {
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          ...options.headers
        },
        ...options
      };

      const response = await fetch(`${this.apiBase}${endpoint}`, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.handleAuthError();
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      this.showError('Network error occurred');
      return null;
    }
  }

  // Sanitize HTML content
  sanitizeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Show section with validation
  showSection(sectionId) {
    const validSections = ['overview', 'cards', 'wallet', 'transactions', 'settings'];
    if (!validSections.includes(sectionId)) return;

    document.querySelectorAll('.dashboard-section').forEach(section => {
      section.classList.remove('active');
    });
    
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    const targetLink = document.querySelector(`a[href="#${sectionId}"]`);
    
    if (targetSection) targetSection.classList.add('active');
    if (targetLink) targetLink.classList.add('active');
  }

  // Create card with validation
  async createCard(cardType) {
    const validTypes = ['visa', 'mastercard'];
    if (!validTypes.includes(cardType)) {
      this.showError('Invalid card type');
      return;
    }

    const data = await this.apiRequest('/cards/create', {
      method: 'POST',
      body: JSON.stringify({ type: cardType })
    });

    if (data?.success) {
      this.showSuccess(`${cardType} card created successfully!`);
      this.loadUserCards();
    }
  }

  // Load and display cards securely
  async loadUserCards() {
    const data = await this.apiRequest('/cards/user');
    if (data?.success) {
      this.displayCards(data.cards);
    }
  }

  displayCards(cards) {
    const cardList = document.querySelector('.card-list');
    if (!cardList) return;

    cardList.innerHTML = '';
    
    cards.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.className = 'virtual-card';
      
      // Secure template with sanitized data
      cardElement.innerHTML = `
        <div class="card-info">
          <h4>${this.sanitizeHtml(card.type)} **** ${this.sanitizeHtml(card.lastFour)}</h4>
          <p>Expires: ${this.sanitizeHtml(card.expiryDate)}</p>
          <p>Balance: $${parseFloat(card.balance || 0).toFixed(2)}</p>
        </div>
        <div class="card-actions">
          <button class="btn-view" data-card-id="${this.sanitizeHtml(card.id)}">View Details</button>
          <button class="btn-freeze" data-card-id="${this.sanitizeHtml(card.id)}">
            ${card.status === 'active' ? 'Freeze' : 'Unfreeze'}
          </button>
        </div>
      `;
      
      cardList.appendChild(cardElement);
    });

    // Add event listeners to new buttons
    this.attachCardEventListeners();
  }

  attachCardEventListeners() {
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cardId = e.target.dataset.cardId;
        if (cardId) this.viewCardDetails(cardId);
      });
    });

    document.querySelectorAll('.btn-freeze').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cardId = e.target.dataset.cardId;
        if (cardId) this.freezeCard(cardId);
      });
    });
  }

  async viewCardDetails(cardId) {
    const data = await this.apiRequest(`/cards/${encodeURIComponent(cardId)}`);
    if (data?.success) {
      this.showCardDetailsModal(data.card);
    }
  }

  async freezeCard(cardId) {
    const data = await this.apiRequest(`/cards/${encodeURIComponent(cardId)}/freeze`, {
      method: 'POST'
    });

    if (data?.success) {
      this.showSuccess('Card status updated successfully');
      this.loadUserCards();
    }
  }

  async loadWalletBalance() {
    const data = await this.apiRequest('/wallet/balance');
    if (data?.success) {
      const balanceElement = document.querySelector('.wallet-balance h3');
      if (balanceElement) {
        balanceElement.textContent = `$${parseFloat(data.balance || 0).toFixed(2)}`;
      }
    }
  }

  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const sectionId = link.getAttribute('href')?.substring(1);
        if (sectionId) this.showSection(sectionId);
      });
    });
  }

  loadInitialData() {
    this.loadWalletBalance();
    this.loadUserCards();
  }

  startAutoRefresh() {
    setInterval(() => {
      this.loadWalletBalance();
    }, 30000);
  }

  handleAuthError() {
    localStorage.removeItem('authToken');
    window.location.href = '/index.html';
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/index.html';
  }
}

// Initialize secure dashboard
document.addEventListener('DOMContentLoaded', () => {
  new SecureDashboard();
});
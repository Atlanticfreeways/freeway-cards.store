// Demo Mode Controller
class DemoMode {
  constructor() {
    this.isDemoMode = true;
    this.initializeDemoMode();
  }

  initializeDemoMode() {
    // Override API calls with mock data
    this.overrideAPICalls();
    
    // Add demo banner
    this.addDemoBanner();
    
    // Auto-populate demo credentials
    this.setupDemoCredentials();
  }

  overrideAPICalls() {
    // Override fetch for API calls
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (this.isDemoMode && url.startsWith('/api/')) {
        return this.handleMockAPI(url, options);
      }
      return originalFetch(url, options);
    };
  }

  async handleMockAPI(url, options) {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body) : null;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    try {
      let response;
      
      if (url.includes('/auth/login') && method === 'POST') {
        response = await window.mockupData.simulateLogin(body.email, body.password);
      } else if (url.includes('/cards') && method === 'GET') {
        response = await window.mockupData.simulateGetCards();
      } else if (url.includes('/cards/create') && method === 'POST') {
        response = await window.mockupData.simulateCreateCard(body);
      } else if (url.includes('/cards/') && url.includes('/fund') && method === 'POST') {
        const cardId = url.split('/cards/')[1].split('/fund')[0];
        response = await window.mockupData.simulateFundCard(cardId, body.amount);
      } else if (url.includes('/transactions') && method === 'GET') {
        response = await window.mockupData.simulateGetTransactions();
      } else if (url.includes('/funding/') && method === 'POST') {
        const method = url.includes('crypto') ? 'crypto' : 'bank';
        response = await window.mockupData.simulateAddFunds(method, body.amount);
      } else if (url.includes('/kyc/status') && method === 'GET') {
        response = window.mockupData.getKYC();
      } else {
        response = { success: true, message: 'Demo API call' };
      }

      return {
        ok: true,
        status: 200,
        json: async () => response
      };
    } catch (error) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ message: error.message })
      };
    }
  }

  addDemoBanner() {
    const banner = document.createElement('div');
    banner.id = 'demo-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
        color: white;
        text-align: center;
        padding: 8px;
        font-weight: bold;
        z-index: 10000;
        font-size: 14px;
      ">
        🎭 DEMO MODE - Use: demo@freeway.cards / demo123 | All data is simulated
        <button onclick="demoMode.toggleMode()" style="
          margin-left: 15px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        ">Exit Demo</button>
      </div>
    `;
    document.body.prepend(banner);
    
    // Adjust body padding
    document.body.style.paddingTop = '40px';
  }

  setupDemoCredentials() {
    // Auto-fill login form if present
    setTimeout(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      
      if (emailInput && passwordInput) {
        emailInput.value = 'demo@freeway.cards';
        passwordInput.value = 'demo123';
        
        // Add demo hint
        const hint = document.createElement('div');
        hint.innerHTML = `
          <div style="
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            font-size: 14px;
            color: #1976d2;
          ">
            💡 Demo credentials pre-filled. Click login to explore the platform!
          </div>
        `;
        emailInput.parentNode.insertBefore(hint, emailInput);
      }
    }, 500);
  }

  toggleMode() {
    this.isDemoMode = !this.isDemoMode;
    const banner = document.getElementById('demo-banner');
    if (banner) {
      banner.style.display = this.isDemoMode ? 'block' : 'none';
    }
    
    if (!this.isDemoMode) {
      alert('Demo mode disabled. API calls will now go to real backend.');
    } else {
      alert('Demo mode enabled. Using mock data.');
    }
  }

  // Demo dashboard population
  populateDashboard() {
    if (!this.isDemoMode) return;

    const user = window.mockupData.getUser();
    const cards = window.mockupData.getCards();
    const transactions = window.mockupData.getTransactions();

    // Update user info
    this.updateElement('.user-name', user.name);
    this.updateElement('.user-email', user.email);
    this.updateElement('.wallet-balance', `$${user.walletBalance.toFixed(2)}`);

    // Update cards display
    this.renderCards(cards);
    
    // Update recent transactions
    this.renderTransactions(transactions.slice(0, 5));
  }

  updateElement(selector, content) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = content;
    }
  }

  renderCards(cards) {
    const container = document.querySelector('.cards-container');
    if (!container) return;

    container.innerHTML = cards.map(card => `
      <div class="card-item ${card.status}" data-card-id="${card.id}">
        <div class="card-header">
          <span class="card-name">${card.cardName}</span>
          <span class="card-type">${card.cardType.toUpperCase()}</span>
        </div>
        <div class="card-number">**** **** **** ${card.lastFour}</div>
        <div class="card-balance">$${card.balance.toFixed(2)} / $${card.spendingLimit}</div>
        <div class="card-status status-${card.status}">${card.status.toUpperCase()}</div>
      </div>
    `).join('');
  }

  renderTransactions(transactions) {
    const container = document.querySelector('.transactions-container');
    if (!container) return;

    container.innerHTML = transactions.map(tx => `
      <div class="transaction-item">
        <div class="tx-description">${tx.description}</div>
        <div class="tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
          ${tx.amount > 0 ? '+' : ''}$${Math.abs(tx.amount).toFixed(2)}
        </div>
        <div class="tx-date">${new Date(tx.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  // Demo card creation
  showCreateCardDemo() {
    const modal = document.createElement('div');
    modal.className = 'demo-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h3>Create Virtual Card - Demo</h3>
          <form id="demo-card-form">
            <input type="text" name="cardName" placeholder="Card Name" value="Demo Card" required>
            <select name="cardType" required>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
            </select>
            <input type="number" name="spendingLimit" placeholder="Spending Limit" value="1000" required>
            <button type="submit">Create Card</button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('demo-card-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const cardData = {
        cardName: formData.get('cardName'),
        cardType: formData.get('cardType'),
        spendingLimit: parseInt(formData.get('spendingLimit'))
      };

      try {
        const result = await window.mockupData.simulateCreateCard(cardData);
        modal.remove();
        alert(`Card created successfully! Number: ${result.card.cardNumber}`);
        this.populateDashboard();
      } catch (error) {
        alert('Card creation failed: ' + error.message);
      }
    });
  }
}

// Initialize demo mode
window.demoMode = new DemoMode();

// Auto-populate dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.demoMode.populateDashboard();
  }, 1000);
});
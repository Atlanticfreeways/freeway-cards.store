// Mockup Data for Virtual Card Platform Demo
class MockupData {
  constructor() {
    this.initializeMockData();
  }

  initializeMockData() {
    // Mock user data
    this.mockUser = {
      id: 'user_123456',
      name: 'John Doe',
      email: 'john.doe@example.com',
      walletBalance: 2450.75,
      kycStatus: 'approved',
      joinDate: '2024-01-15',
      totalSpent: 8750.25
    };

    // Mock virtual cards
    this.mockCards = [
      {
        id: 'card_001',
        cardName: 'Shopping Card',
        cardType: 'visa',
        cardNumber: '4532 1234 5678 9012',
        lastFour: '9012',
        expiryMonth: '12',
        expiryYear: '27',
        cvv: '123',
        balance: 850.00,
        spendingLimit: 2000,
        status: 'active',
        createdAt: '2024-01-20',
        merchantCategories: ['online', 'retail']
      },
      {
        id: 'card_002',
        cardName: 'Travel Card',
        cardType: 'mastercard',
        cardNumber: '5555 4444 3333 2222',
        lastFour: '2222',
        expiryMonth: '08',
        expiryYear: '26',
        cvv: '456',
        balance: 1200.50,
        spendingLimit: 5000,
        status: 'active',
        createdAt: '2024-02-01',
        merchantCategories: ['all']
      },
      {
        id: 'card_003',
        cardName: 'Business Card',
        cardType: 'visa',
        cardNumber: '4111 1111 1111 1111',
        lastFour: '1111',
        expiryMonth: '06',
        expiryYear: '28',
        cvv: '789',
        balance: 0.00,
        spendingLimit: 10000,
        status: 'frozen',
        createdAt: '2024-02-15',
        merchantCategories: ['business', 'online']
      }
    ];

    // Mock transactions
    this.mockTransactions = [
      {
        id: 'tx_001',
        type: 'card_purchase',
        amount: -45.99,
        description: 'Amazon Purchase',
        cardId: 'card_001',
        merchant: 'Amazon.com',
        status: 'completed',
        createdAt: '2024-03-15T10:30:00Z'
      },
      {
        id: 'tx_002',
        type: 'crypto_deposit',
        amount: 500.00,
        description: 'Bitcoin deposit',
        paymentMethod: 'bitcoin',
        status: 'completed',
        createdAt: '2024-03-14T15:45:00Z'
      },
      {
        id: 'tx_003',
        type: 'card_funding',
        amount: -200.00,
        description: 'Funded Shopping Card',
        cardId: 'card_001',
        status: 'completed',
        createdAt: '2024-03-14T16:00:00Z'
      },
      {
        id: 'tx_004',
        type: 'bank_transfer',
        amount: 1000.00,
        description: 'Bank transfer from Chase',
        paymentMethod: 'bank_transfer',
        status: 'completed',
        createdAt: '2024-03-13T09:15:00Z'
      },
      {
        id: 'tx_005',
        type: 'card_purchase',
        amount: -125.50,
        description: 'Uber Ride',
        cardId: 'card_002',
        merchant: 'Uber Technologies',
        status: 'completed',
        createdAt: '2024-03-12T18:20:00Z'
      }
    ];

    // Mock KYC data
    this.mockKYC = {
      status: 'approved',
      level: 'enhanced',
      limits: {
        dailySpending: 5000,
        monthlySpending: 25000,
        cardCount: 5
      },
      verificationDate: '2024-01-16',
      documents: {
        idDocument: { verified: true },
        proofOfAddress: { verified: true }
      }
    };

    // Mock funding methods
    this.mockFundingMethods = [
      {
        type: 'bank_transfer',
        name: 'Instant Bank Transfer',
        fee: 0,
        minAmount: 10,
        maxAmount: 10000,
        processingTime: 'Instant',
        icon: '🏦'
      },
      {
        type: 'crypto',
        name: 'Cryptocurrency',
        fee: 0,
        minAmount: 10,
        maxAmount: 50000,
        processingTime: '1-3 confirmations',
        supportedCoins: ['bitcoin', 'ethereum', 'usdc', 'usdt'],
        icon: '₿'
      }
    ];
  }

  // API simulation methods
  async simulateLogin(email, password) {
    await this.delay(800);
    if (email === 'demo@freeway.cards' && password === 'demo123') {
      return {
        success: true,
        token: 'mock_jwt_token_' + Date.now(),
        user: this.mockUser
      };
    }
    throw new Error('Invalid credentials');
  }

  async simulateGetCards() {
    await this.delay(500);
    return { cards: this.mockCards };
  }

  async simulateCreateCard(cardData) {
    await this.delay(1200);
    const newCard = {
      id: 'card_' + Date.now(),
      cardName: cardData.cardName,
      cardType: cardData.cardType,
      cardNumber: this.generateMockCardNumber(cardData.cardType),
      lastFour: '0000',
      expiryMonth: '12',
      expiryYear: '29',
      cvv: '123',
      balance: 0,
      spendingLimit: cardData.spendingLimit || 1000,
      status: 'active',
      createdAt: new Date().toISOString(),
      merchantCategories: ['all']
    };
    this.mockCards.push(newCard);
    return { card: newCard };
  }

  async simulateFundCard(cardId, amount) {
    await this.delay(600);
    const card = this.mockCards.find(c => c.id === cardId);
    if (card) {
      card.balance += amount;
      this.mockUser.walletBalance -= amount;
    }
    return { 
      success: true, 
      newCardBalance: card.balance,
      newWalletBalance: this.mockUser.walletBalance 
    };
  }

  async simulateGetTransactions() {
    await this.delay(400);
    return { transactions: this.mockTransactions };
  }

  async simulateAddFunds(method, amount) {
    await this.delay(1500);
    this.mockUser.walletBalance += amount;
    const transaction = {
      id: 'tx_' + Date.now(),
      type: method === 'crypto' ? 'crypto_deposit' : 'bank_transfer',
      amount: amount,
      description: method === 'crypto' ? 'Cryptocurrency deposit' : 'Bank transfer',
      paymentMethod: method,
      status: 'completed',
      createdAt: new Date().toISOString()
    };
    this.mockTransactions.unshift(transaction);
    return { success: true, newBalance: this.mockUser.walletBalance };
  }

  generateMockCardNumber(cardType) {
    const prefix = cardType === 'visa' ? '4' : '5';
    const random = Math.random().toString().slice(2, 15);
    return prefix + random.padEnd(15, '0');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Demo data getters
  getUser() { return this.mockUser; }
  getCards() { return this.mockCards; }
  getTransactions() { return this.mockTransactions; }
  getKYC() { return this.mockKYC; }
  getFundingMethods() { return this.mockFundingMethods; }
}

// Initialize global mockup data
window.mockupData = new MockupData();
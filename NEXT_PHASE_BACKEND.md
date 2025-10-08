# Phase 6: Backend Integration - Implementation Plan

## 🎯 Overview
Connect the completed frontend to a production-ready backend with MongoDB, payment processing, and real-time features.

## 📋 Phase 6 Tasks (Week 4)

### Day 1-2: Database & Authentication
- [ ] **MongoDB Atlas Setup**
  - Create production cluster
  - Configure security settings
  - Set up connection strings
  - Test database connectivity

- [ ] **Authentication API Implementation**
  - JWT token generation/validation
  - User registration endpoint
  - Login/logout endpoints
  - Password reset functionality
  - Email verification system

### Day 3-4: Core APIs
- [ ] **User Management API**
  - Profile CRUD operations
  - Settings management
  - Account preferences
  - Security settings

- [ ] **Wallet API Development**
  - Balance retrieval
  - Transaction history
  - Fund addition endpoints
  - Transaction filtering

### Day 5-7: Payment Integration
- [ ] **Stripe Integration**
  - Payment intent creation
  - Card processing
  - Webhook handling
  - Refund processing

- [ ] **PayPal Integration**
  - PayPal SDK setup
  - Payment processing
  - Order management
  - Webhook validation

- [ ] **Bitnob Crypto Integration**
  - API connection (config exists)
  - Crypto payment processing
  - Balance conversion
  - Transaction tracking

## 🔧 Technical Implementation

### Database Schema Updates
```javascript
// Enhanced User Model
{
  _id: ObjectId,
  email: String,
  password: String (hashed),
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    dateOfBirth: Date,
    accountType: String
  },
  wallet: {
    balance: Number,
    currency: String,
    lastUpdated: Date
  },
  preferences: {
    language: String,
    theme: String,
    notifications: Object
  },
  security: {
    twoFactorEnabled: Boolean,
    lastLogin: Date,
    loginAttempts: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### API Endpoints Structure
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/verify-email/:token

GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/settings
PUT    /api/user/settings

GET    /api/wallet/balance
GET    /api/wallet/transactions
POST   /api/wallet/add-funds
GET    /api/wallet/transaction/:id

POST   /api/gift-cards/purchase
POST   /api/gift-cards/redeem
GET    /api/gift-cards/balance/:code
GET    /api/gift-cards/orders

POST   /api/payments/stripe/create-intent
POST   /api/payments/stripe/webhook
POST   /api/payments/paypal/create-order
POST   /api/payments/paypal/webhook
```

### Environment Variables Needed
```
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=freeway_cards

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
PAYPAL_WEBHOOK_ID=your_webhook_id

# Bitnob
BITNOB_PUBLIC_KEY=existing_config
BITNOB_SECRET_KEY=existing_config

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password

# App
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
```

## 🔗 Frontend Integration Points

### API Client Setup
```javascript
// frontend/js/api.js
class APIClient {
  constructor() {
    this.baseURL = '/api';
    this.token = localStorage.getItem('authToken');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` })
      },
      ...options
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }

  // Auth methods
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    this.token = response.token;
    localStorage.setItem('authToken', this.token);
    return response;
  }

  // Wallet methods
  async getWalletBalance() {
    return this.request('/wallet/balance');
  }

  async addFunds(amount, paymentMethod) {
    return this.request('/wallet/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod })
    });
  }

  // Gift card methods
  async purchaseGiftCard(cardData) {
    return this.request('/gift-cards/purchase', {
      method: 'POST',
      body: JSON.stringify(cardData)
    });
  }
}

const api = new APIClient();
```

### Form Integration Updates
```javascript
// Update existing forms to use real API
loginForm.onSubmit = async function() {
  try {
    const formData = new FormData(this.form);
    const response = await api.login(
      formData.get('email'),
      formData.get('password')
    );
    
    notifications.success('Login successful!');
    window.location.href = 'dashboard/index.html';
  } catch (error) {
    notifications.error('Login failed: ' + error.message);
  }
};
```

## 🚀 Deployment Strategy

### Backend Hosting Options
1. **Render** (Recommended)
   - Easy deployment
   - Auto-scaling
   - Built-in SSL
   - Environment variables

2. **Railway**
   - Git-based deployment
   - Database hosting
   - Simple configuration

3. **Heroku**
   - Established platform
   - Add-on ecosystem
   - Easy scaling

### Database Hosting
- **MongoDB Atlas** (Recommended)
  - Managed service
  - Built-in security
  - Global clusters
  - Automatic backups

## 📊 Success Metrics

### Phase 6 Completion Criteria
- [ ] All API endpoints functional
- [ ] Database operations working
- [ ] Payment processing active
- [ ] Frontend-backend integration complete
- [ ] Authentication flow working
- [ ] Real transactions processing
- [ ] Email notifications sending
- [ ] Error handling implemented

### Performance Targets
- API response time < 200ms
- Database queries < 100ms
- Payment processing < 3 seconds
- 99.9% uptime target
- Zero data loss tolerance

## 🔄 Next Steps After Phase 6

### Phase 7: Production Deployment
- Infrastructure setup
- Security hardening
- Performance optimization
- Monitoring implementation

### Phase 8: Launch Preparation
- End-to-end testing
- User acceptance testing
- Marketing preparation
- Support documentation

**Ready to begin Phase 6: Backend Integration!** 🚀
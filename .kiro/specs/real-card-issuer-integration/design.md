# Real Card Issuer Integration - Design Document

## Overview

This design outlines the integration of a production card issuer API (Marqeta or Stripe Issuing) to replace the current mock card generation system. The integration will enable real virtual Mastercard/Visa card issuance while maintaining the existing user experience and adding production-grade security, compliance, and transaction processing capabilities.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │  Card Issuer    │
│   (Existing)    │◄──►│   (Enhanced)     │◄──►│   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   MongoDB        │    │   Webhooks      │
                       │   (Enhanced)     │    │   Processor     │
                       └──────────────────┘    └─────────────────┘
```

### Integration Strategy

**Phase 1: Dual System Approach**
- Maintain existing mock system for development/testing
- Add production card issuer integration alongside
- Use feature flags to switch between mock and real cards

**Phase 2: Production Cutover**
- Migrate existing demo cards to real cards (where applicable)
- Disable mock system in production
- Maintain mock system for development environments

## Components and Interfaces

### 1. Card Issuer Adapter Layer

**Purpose**: Abstract card issuer operations to support multiple providers

```javascript
// CardIssuerAdapter Interface
class CardIssuerAdapter {
  async createCard(userProfile, cardConfig)
  async updateCardStatus(cardId, status)
  async setSpendingLimits(cardId, limits)
  async getCardDetails(cardId)
  async getTransactionHistory(cardId, filters)
}

// Implementations
class MarqetaAdapter extends CardIssuerAdapter
class StripeIssuingAdapter extends CardIssuerAdapter
```

**Configuration**:
- Environment-based provider selection
- API credentials management via secure environment variables
- Fallback mechanisms for API failures

### 2. Enhanced Card Service

**Current**: `backend/services/cardIssuer.js` (mock implementation)
**Enhanced**: Production-ready service with real API integration

**Key Methods**:
```javascript
class ProductionCardService {
  async createVirtualCard(userId, cardType, fundingAmount)
  async activateCard(cardId)
  async freezeCard(cardId, reason)
  async unfreezeCard(cardId)
  async updateSpendingLimits(cardId, limits)
  async fundCard(cardId, amount, source)
  async processWebhookEvent(webhookData)
}
```

### 3. Webhook Processing System

**New Component**: Real-time transaction processing

```javascript
class WebhookProcessor {
  async processTransactionEvent(event)
  async processCardStatusEvent(event)
  async processAuthorizationEvent(event)
  async validateWebhookSignature(payload, signature)
}
```

**Webhook Endpoints**:
- `POST /api/webhooks/marqeta` - Marqeta transaction events
- `POST /api/webhooks/stripe-issuing` - Stripe Issuing events
- Signature validation for security
- Idempotency handling for duplicate events

### 4. Enhanced Security Layer

**PCI DSS Compliance Enhancements**:
- Card data encryption at rest and in transit
- Secure key management using environment variables
- Audit logging for all card operations
- Access control for sensitive card data

**Implementation**:
```javascript
class SecureCardStorage {
  async encryptCardData(cardData)
  async decryptCardData(encryptedData)
  async maskCardNumber(cardNumber)
  async logCardAccess(userId, cardId, operation)
}
```

## Data Models

### Enhanced VirtualCard Model

```javascript
// backend/models/VirtualCard.js (Enhanced)
const VirtualCardSchema = new mongoose.Schema({
  // Existing fields
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cardType: { type: String, enum: ['mastercard', 'visa'], required: true },
  
  // New production fields
  issuerProvider: { type: String, enum: ['marqeta', 'stripe', 'mock'], required: true },
  issuerCardId: { type: String, required: true }, // External card ID
  issuerCardToken: { type: String, required: true }, // External card token
  
  // Enhanced card data (encrypted)
  encryptedCardNumber: { type: String, required: true },
  encryptedCvv: { type: String, required: true },
  expiryMonth: { type: Number, required: true },
  expiryYear: { type: Number, required: true },
  
  // Production features
  spendingLimits: {
    daily: { type: Number, default: 1000 },
    monthly: { type: Number, default: 5000 },
    perTransaction: { type: Number, default: 500 }
  },
  
  // Enhanced status tracking
  status: { 
    type: String, 
    enum: ['pending', 'active', 'frozen', 'suspended', 'closed'], 
    default: 'pending' 
  },
  
  // Compliance and audit
  kycVerified: { type: Boolean, required: true },
  complianceFlags: [String],
  lastSyncedAt: { type: Date, default: Date.now },
  
  // Existing fields
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

### New Transaction Model Enhancement

```javascript
// Enhanced Transaction tracking
const TransactionSchema = new mongoose.Schema({
  // Existing fields
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'VirtualCard', required: true },
  
  // New issuer integration fields
  issuerTransactionId: { type: String, required: true },
  issuerEventType: { type: String, required: true },
  
  // Enhanced transaction data
  merchantInfo: {
    name: String,
    category: String,
    location: String,
    mcc: String // Merchant Category Code
  },
  
  // Authorization vs Settlement
  transactionType: { 
    type: String, 
    enum: ['authorization', 'settlement', 'reversal', 'chargeback'],
    required: true 
  },
  
  // Enhanced status tracking
  authorizationCode: String,
  processingStatus: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'settled'],
    required: true
  }
});
```

## Error Handling

### API Failure Management

**Retry Strategy**:
- Exponential backoff for transient failures
- Circuit breaker pattern for sustained outages
- Graceful degradation to read-only mode

**Error Categories**:
1. **Network Errors**: Retry with backoff
2. **Authentication Errors**: Alert administrators, refresh tokens
3. **Rate Limiting**: Implement queue with delays
4. **Business Logic Errors**: Log and return user-friendly messages

### Fallback Mechanisms

```javascript
class CardServiceWithFallback {
  async createCard(userProfile, cardConfig) {
    try {
      return await this.primaryIssuer.createCard(userProfile, cardConfig);
    } catch (error) {
      if (this.isTransientError(error)) {
        return await this.retryWithBackoff(() => 
          this.primaryIssuer.createCard(userProfile, cardConfig)
        );
      }
      
      // Log error and potentially use backup issuer
      this.logger.error('Card creation failed', { error, userProfile });
      throw new CardCreationError('Unable to create card at this time');
    }
  }
}
```

## Testing Strategy

### Integration Testing

**Mock API Server**:
- Create mock Marqeta/Stripe Issuing servers for testing
- Simulate various response scenarios (success, failures, delays)
- Test webhook delivery and processing

**Test Scenarios**:
1. **Happy Path**: Successful card creation and transaction processing
2. **Error Scenarios**: API failures, network issues, invalid responses
3. **Security Testing**: Webhook signature validation, encryption/decryption
4. **Performance Testing**: High-volume card creation and transaction processing
5. **Compliance Testing**: KYC validation, spending limit enforcement

### Production Monitoring

**Key Metrics**:
- Card creation success rate (target: >99%)
- Transaction processing latency (target: <5 seconds)
- API response times (target: <2 seconds)
- Webhook processing success rate (target: >99.9%)

**Alerting**:
- Failed card creations
- Webhook processing failures
- API rate limit approaching
- Unusual transaction patterns

### Security Testing

**Penetration Testing Focus**:
- Card data encryption validation
- Webhook signature verification
- API authentication security
- PCI DSS compliance verification

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Set up card issuer API credentials and sandbox environments
- Implement CardIssuerAdapter interface
- Create Marqeta and Stripe Issuing adapters
- Enhance VirtualCard model with production fields

### Phase 2: Core Integration (Week 2)
- Implement production card creation flow
- Add webhook processing system
- Enhance security and encryption layers
- Update existing API endpoints

### Phase 3: Advanced Features (Week 3)
- Implement card management operations (freeze/unfreeze, limits)
- Add real-time transaction processing
- Implement fraud detection hooks
- Add comprehensive error handling

### Phase 4: Testing & Deployment (Week 4)
- Comprehensive integration testing
- Security audit and penetration testing
- Performance testing and optimization
- Production deployment with feature flags
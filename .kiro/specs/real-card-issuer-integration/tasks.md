# Implementation Plan

- [x] 1. Set up card issuer API foundation
  - Create environment configuration for Marqeta and Stripe Issuing API credentials
  - Implement base CardIssuerAdapter interface class
  - Set up API client configurations with proper authentication
  - _Requirements: 1.1, 5.3_

- [x] 1.1 Create CardIssuerAdapter interface
  - Write abstract base class defining card issuer operations
  - Define standard method signatures for card creation, management, and transactions
  - Implement error handling interfaces for consistent error management
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 1.2 Implement Marqeta API adapter
  - Create MarqetaAdapter class extending CardIssuerAdapter
  - Implement Marqeta-specific API calls for card creation and management
  - Add Marqeta webhook signature validation
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 1.3 Implement Stripe Issuing adapter
  - Create StripeIssuingAdapter class extending CardIssuerAdapter
  - Implement Stripe Issuing API calls for card operations
  - Add Stripe webhook signature validation
  - _Requirements: 1.1, 2.1, 3.1_

- [ ]* 1.4 Write unit tests for adapter implementations
  - Create unit tests for CardIssuerAdapter interface
  - Test Marqeta and Stripe adapter implementations with mock responses
  - Validate error handling and edge cases
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Enhance VirtualCard model and security
  - Update VirtualCard schema with production fields (issuerProvider, issuerCardId, encryptedCardNumber)
  - Implement card data encryption/decryption methods
  - Add PCI DSS compliant card storage mechanisms
  - _Requirements: 1.3, 4.1_

- [x] 2.1 Create secure card storage utilities
  - Implement SecureCardStorage class with encryption methods
  - Add card number masking functionality for display purposes
  - Create audit logging for all card data access operations
  - _Requirements: 1.3, 4.1, 4.2_

- [x] 2.2 Update VirtualCard model schema
  - Add new fields for issuer integration (issuerProvider, issuerCardId, issuerCardToken)
  - Add encrypted card data fields (encryptedCardNumber, encryptedCvv)
  - Implement spending limits and enhanced status tracking
  - _Requirements: 1.3, 3.4, 4.1_

- [ ]* 2.3 Write model validation tests
  - Create tests for VirtualCard model validation rules
  - Test encryption/decryption functionality
  - Validate spending limits and status transitions
  - _Requirements: 1.3, 3.4, 4.1_

- [x] 3. Implement production card service
  - Replace mock CardIssuerService with ProductionCardService
  - Implement real card creation using selected issuer adapter
  - Add KYC validation before card creation
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 3.1 Create ProductionCardService class
  - Implement createVirtualCard method with real API integration
  - Add card activation and status management methods
  - Implement spending limit management functionality
  - _Requirements: 1.1, 3.1, 3.4_

- [x] 3.2 Add KYC validation integration
  - Implement KYC status checking before card creation
  - Add compliance validation for card operations
  - Create rejection handling for insufficient verification
  - _Requirements: 1.2, 1.5, 4.5_

- [x] 3.3 Update card creation API endpoint
  - Modify POST /api/cards/create to use ProductionCardService
  - Add feature flag support to switch between mock and real cards
  - Implement proper error handling and user feedback
  - _Requirements: 1.1, 1.4, 5.3_

- [ ]* 3.4 Write integration tests for card service
  - Create tests for card creation with real API calls (sandbox)
  - Test KYC validation and rejection scenarios
  - Validate error handling and fallback mechanisms
  - _Requirements: 1.1, 1.2, 1.5_

- [x] 4. Implement webhook processing system
  - Create WebhookProcessor class for real-time transaction events
  - Add webhook endpoints for Marqeta and Stripe Issuing
  - Implement transaction processing and balance updates
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4.1 Create WebhookProcessor class
  - Implement processTransactionEvent method for real-time updates
  - Add webhook signature validation for security
  - Create idempotency handling to prevent duplicate processing
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 4.2 Add webhook API endpoints
  - Create POST /api/webhooks/marqeta endpoint
  - Create POST /api/webhooks/stripe-issuing endpoint
  - Implement proper authentication and validation
  - _Requirements: 2.1, 2.2, 4.1_

- [x] 4.3 Implement real-time balance updates
  - Update user wallet balance when transactions are processed
  - Create transaction history records from webhook events
  - Add spending limit enforcement during authorization
  - _Requirements: 2.2, 2.3, 2.4_

- [ ]* 4.4 Write webhook processing tests
  - Create tests for webhook signature validation
  - Test transaction processing and balance updates
  - Validate idempotency and error handling
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Implement card management operations
  - Add card freeze/unfreeze functionality with real API calls
  - Implement spending limit updates via issuer API
  - Create card status synchronization mechanisms
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 5.1 Update card management API endpoints
  - Modify card freeze/unfreeze endpoints to use real issuer APIs
  - Add spending limit update functionality
  - Implement card status synchronization
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 5.2 Add fraud detection integration hooks
  - Implement suspicious activity detection triggers
  - Add automatic card freezing for fraud prevention
  - Create compliance reporting mechanisms
  - _Requirements: 4.2, 4.3, 4.4_

- [ ]* 5.3 Write card management tests
  - Test card freeze/unfreeze operations with real APIs
  - Validate spending limit updates and synchronization
  - Test fraud detection and automatic responses
  - _Requirements: 3.1, 3.2, 4.2_

- [x] 6. Add monitoring and admin features
  - Create admin dashboard for card program management
  - Implement API performance monitoring and alerting
  - Add compliance reporting and audit capabilities
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 6.1 Create admin dashboard interface
  - Build admin panel for card program configuration
  - Add real-time metrics dashboard for card issuance
  - Implement user and card management tools
  - _Requirements: 5.1, 5.4_

- [x] 6.2 Implement monitoring and alerting
  - Add API performance monitoring for card issuer services
  - Create alerting for failed operations and compliance violations
  - Implement health checks and status monitoring
  - _Requirements: 5.2, 5.5_

- [ ]* 6.3 Write monitoring and admin tests
  - Test admin dashboard functionality and access controls
  - Validate monitoring metrics and alerting systems
  - Test compliance reporting and audit trails
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 7. Production deployment and configuration
  - Set up production environment variables and API credentials
  - Configure feature flags for gradual rollout
  - Implement production monitoring and logging
  - _Requirements: 5.3, 5.5_

- [x] 7.1 Configure production environment
  - Set up Marqeta and Stripe Issuing production API credentials
  - Configure secure environment variable management
  - Implement production database connections and indexing
  - _Requirements: 5.3_

- [x] 7.2 Implement feature flag system
  - Add feature flags to control mock vs real card creation
  - Create gradual rollout mechanisms for testing
  - Implement rollback capabilities for production issues
  - _Requirements: 5.3_

- [ ]* 7.3 Write deployment and configuration tests
  - Test production environment configuration
  - Validate feature flag functionality and rollback mechanisms
  - Test production monitoring and alerting systems
  - _Requirements: 5.3, 5.5_
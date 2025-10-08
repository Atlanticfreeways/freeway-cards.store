# Freeway Cards Store API Documentation

## Authentication

### POST /api/auth/signup
Register new user
```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "accountType": "individual|business"
}
```

### POST /api/auth/login
User login
```json
{
  "email": "string",
  "password": "string"
}
```

### POST /api/auth/logout
User logout (requires auth)

## Cards

### GET /api/cards
Get user cards (requires auth)

### POST /api/cards/create
Create new card (requires auth)
```json
{
  "type": "visa|mastercard",
  "subscriptionType": "instant|subscription"
}
```

## Wallet

### GET /api/wallet/balance
Get wallet balance (requires auth)

### POST /api/wallet/fund
Fund wallet (requires auth)
```json
{
  "amount": "number"
}
```

## Monitoring (Admin Only)

### GET /api/monitoring/performance
Get system performance metrics

### GET /api/logs/{type}
Get system logs (app, security, performance, audit)

### GET /api/health
System health check

## Error Responses
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info"
}
```

## Rate Limits
- API: 100 requests/15 minutes
- Auth: 5 requests/15 minutes
- Cards: 10 requests/hour
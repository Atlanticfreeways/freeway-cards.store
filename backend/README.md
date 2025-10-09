# Freeway Cards Backend API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

3. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Gift Cards
- `POST /api/giftcards/purchase` - Purchase gift card
- `GET /api/giftcards/my-cards` - Get user's gift cards
- `POST /api/giftcards/redeem` - Redeem gift card

### Wallet
- `GET /api/wallet/balance` - Get wallet balance
- `POST /api/wallet/add-funds` - Add funds to wallet
- `GET /api/wallet/transactions` - Get transaction history

### Health
- `GET /api/health` - Health check

## Development

Start with MongoDB running locally or update MONGODB_URI in .env for cloud database.
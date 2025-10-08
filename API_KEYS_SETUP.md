# API Keys & Setup Guide

## 🔑 Required API Keys & Services

### 1. MongoDB Atlas (Database)
**What**: Cloud database hosting
**Cost**: Free tier available (512MB)

**Steps**:
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free account
3. Create new cluster (M0 Sandbox - Free)
4. Create database user
5. Whitelist IP addresses (0.0.0.0/0 for development)
6. Get connection string

**Keys Needed**:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/freeway_cards
```

### 2. Stripe (Payment Processing)
**What**: Credit card processing
**Cost**: 2.9% + 30¢ per transaction

**Steps**:
1. Go to [stripe.com](https://stripe.com)
2. Create account
3. Complete business verification
4. Go to Developers → API Keys
5. Copy publishable and secret keys
6. Set up webhooks endpoint

**Keys Needed**:
```
STRIPE_PUBLIC_KEY=pk_test_... (or pk_live_...)
STRIPE_SECRET_KEY=sk_test_... (or sk_live_...)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. PayPal (Alternative Payment)
**What**: PayPal payment processing
**Cost**: 2.9% + fixed fee per transaction

**Steps**:
1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Create developer account
3. Create new app
4. Get client ID and secret
5. Set up webhook notifications

**Keys Needed**:
```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
```

### 4. Email Service (Notifications)
**What**: Send emails (receipts, notifications)
**Cost**: Free tier available

**Option A - Gmail SMTP**:
1. Enable 2FA on Gmail account
2. Generate app password
3. Use Gmail SMTP settings

**Option B - SendGrid**:
1. Go to [sendgrid.com](https://sendgrid.com)
2. Create free account (100 emails/day)
3. Create API key
4. Verify sender identity

**Keys Needed**:
```
# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# OR SendGrid
SENDGRID_API_KEY=SG.your_api_key
```

### 5. Bitnob (Crypto Payments) - Optional
**What**: Bitcoin/crypto payment processing
**Cost**: Variable fees

**Steps**:
1. Go to [bitnob.com](https://bitnob.com)
2. Create business account
3. Complete KYC verification
4. Get API credentials

**Keys Needed**:
```
BITNOB_PUBLIC_KEY=your_public_key
BITNOB_SECRET_KEY=your_secret_key
```

### 6. JWT Secret (Authentication)
**What**: Secure token generation
**Cost**: Free

**Steps**:
1. Generate random string (32+ characters)
2. Use online generator or command:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

**Keys Needed**:
```
JWT_SECRET=your_random_32_character_string
```

## 🚀 Hosting Services

### Backend Hosting - Choose One:

#### Option A: Render (Recommended)
**Cost**: Free tier available
1. Go to [render.com](https://render.com)
2. Connect GitHub account
3. Create new web service
4. Select repository
5. Add environment variables

#### Option B: Railway
**Cost**: $5/month after free trial
1. Go to [railway.app](https://railway.app)
2. Connect GitHub account
3. Deploy from repository
4. Add environment variables

#### Option C: Heroku
**Cost**: $7/month (no free tier)
1. Go to [heroku.com](https://heroku.com)
2. Create account
3. Install Heroku CLI
4. Deploy via Git

## 📋 Complete Environment Variables

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/freeway_cards

# Authentication
JWT_SECRET=your_32_character_random_string
JWT_EXPIRES_IN=7d

# Stripe Payments
STRIPE_PUBLIC_KEY=pk_test_or_live_key
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret

# PayPal Payments
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
PAYPAL_WEBHOOK_ID=your_webhook_id

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Bitnob Crypto (Optional)
BITNOB_PUBLIC_KEY=your_bitnob_public_key
BITNOB_SECRET_KEY=your_bitnob_secret_key

# Application
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
FRONTEND_URL=https://your-netlify-site.netlify.app
```

## 💰 Cost Breakdown

### Free Tier Setup:
- **MongoDB Atlas**: Free (512MB)
- **Render Hosting**: Free (750 hours/month)
- **Gmail SMTP**: Free
- **Stripe**: Pay per transaction only
- **PayPal**: Pay per transaction only

**Total Monthly Cost**: $0 (pay only transaction fees)

### Paid Tier (Recommended for Production):
- **MongoDB Atlas**: $9/month (M2 cluster)
- **Render Hosting**: $7/month (starter plan)
- **SendGrid**: $15/month (40k emails)

**Total Monthly Cost**: ~$31/month + transaction fees

## ⚡ Quick Setup Order

1. **MongoDB Atlas** (5 minutes)
2. **JWT Secret** (1 minute)
3. **Gmail SMTP** (5 minutes)
4. **Stripe Account** (15 minutes)
5. **Render Hosting** (10 minutes)
6. **PayPal** (optional, 15 minutes)
7. **Bitnob** (optional, 30 minutes)

**Total Setup Time**: 30-60 minutes

## 🔒 Security Notes

- Never commit API keys to Git
- Use environment variables only
- Rotate keys regularly
- Use test keys for development
- Enable webhook signature verification
- Set up proper CORS origins

**Ready to get your API keys and deploy!** 🚀
# Production Keys & Environment Variables Required

## 🔑 **Backend Environment Variables**

### **Required for Backend (.env)**
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/freeway-cards

# Authentication
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (choose one)
SENDGRID_API_KEY=SG.your-sendgrid-api-key
# OR
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain.com

# Crypto Payment (optional)
BITCOIN_WALLET_ADDRESS=your-bitcoin-wallet-address
USDT_WALLET_ADDRESS=your-usdt-wallet-address

# Server
PORT=3000
NODE_ENV=production
```

## 🌐 **Frontend Environment Variables**

### **Required for Frontend (Netlify/Vercel)**
```env
# Google OAuth
GOOGLE_CLIENT_ID_PROD=your-production-google-client-id.apps.googleusercontent.com

# API Endpoints
API_BASE_URL_PROD=https://your-backend-domain.herokuapp.com/api
```

## 📋 **Keys You Need to Obtain**

### **1. MongoDB Atlas** (Free Tier Available)
- Sign up at: https://www.mongodb.com/atlas
- Create cluster → Get connection string
- **Needed**: `MONGODB_URI`

### **2. Google OAuth** (Free)
- Go to: https://console.cloud.google.com/
- Create project → Enable Google+ API → Create OAuth credentials
- **Needed**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### **3. Email Service** (Choose One)
**SendGrid** (Free tier: 100 emails/day)
- Sign up at: https://sendgrid.com/
- **Needed**: `SENDGRID_API_KEY`

**OR Mailgun** (Free tier: 5,000 emails/month)
- Sign up at: https://www.mailgun.com/
- **Needed**: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`

### **4. JWT Secret** (Generate)
```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🚀 **Deployment Platforms**

### **Backend Options** (Choose One)
- **Railway** (Recommended) - https://railway.app/
- **Heroku** - https://heroku.com/
- **DigitalOcean App Platform** - https://www.digitalocean.com/products/app-platform/

### **Frontend Options** (Choose One)
- **Netlify** (Recommended) - https://netlify.com/
- **Vercel** - https://vercel.com/
- **GitHub Pages** - https://pages.github.com/

## ⚡ **Quick Setup Priority**

1. **MongoDB Atlas** - Database (5 minutes)
2. **JWT Secret** - Generate random string (1 minute)
3. **Email Service** - SendGrid or Mailgun (5 minutes)
4. **Google OAuth** - Console setup (10 minutes)
5. **Deploy Backend** - Railway/Heroku (5 minutes)
6. **Deploy Frontend** - Netlify (2 minutes)

**Total Setup Time: ~30 minutes**
# Freeway Cards Store - Deployment Guide

## 🚀 **Production Deployment Steps**

### **Phase 1: Google OAuth Setup** ✅ COMPLETED

#### 1. Google Cloud Console Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing project
3. Enable Google+ API and Google Identity Services
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen with your domain
6. Add authorized redirect URIs:
   - `https://your-domain.com/auth/google-callback.html`
   - `https://your-netlify-app.netlify.app/auth/google-callback.html`

#### 2. Update Client IDs
Replace in `js/google-oauth.js`:
```javascript
// Development
GOOGLE_CLIENT_ID_DEV=your-dev-client-id.apps.googleusercontent.com

// Production  
GOOGLE_CLIENT_ID_PROD=your-prod-client-id.apps.googleusercontent.com
```

### **Phase 2: Backend Deployment**

#### 1. Deploy Backend Server
```bash
# Deploy to your preferred platform (Heroku, Railway, DigitalOcean, etc.)
git push heroku main
# or
railway up
# or 
docker build -t freeway-cards-backend .
```

#### 2. Environment Variables
Set these in your backend deployment:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/freeway-cards
JWT_SECRET=your-super-secure-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
EMAIL_SERVICE_API_KEY=your-email-service-key
```

### **Phase 3: Frontend Configuration**

#### 1. Update API Endpoints
In `js/api.js`, set production backend URL:
```javascript
API_BASE_URL_PROD=https://your-backend-domain.herokuapp.com/api
```

#### 2. Netlify Deployment
```bash
# Build command (if using build process)
npm run build

# Publish directory
frontend

# Environment variables in Netlify dashboard:
GOOGLE_CLIENT_ID_PROD=your-production-client-id
API_BASE_URL_PROD=https://your-backend-url.com/api
```

### **Phase 4: Final Testing**

#### 1. Test All User Flows
- [ ] Registration and email verification
- [ ] Google OAuth login
- [ ] Card creation and management
- [ ] Wallet funding and transactions
- [ ] Profile and KYC verification
- [ ] Business features (if applicable)

#### 2. Performance & Security
- [ ] SSL certificate configured
- [ ] HTTPS redirect enabled
- [ ] Security headers configured
- [ ] Performance monitoring setup

## 🔧 **Quick Deploy Commands**

### Netlify Deploy
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy to Netlify
netlify deploy --prod --dir=frontend
```

### Backend Deploy (Railway)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy backend
railway login
railway link
railway up
```

## 📋 **Pre-Launch Checklist**

- [ ] Google OAuth configured and tested
- [ ] Backend deployed with MongoDB connection
- [ ] Frontend deployed with correct API endpoints
- [ ] SSL certificates configured
- [ ] Email service configured for verification
- [ ] Payment processing configured (if needed)
- [ ] All user flows tested end-to-end
- [ ] Performance optimization completed
- [ ] Security audit completed

## 🎯 **Launch Ready**

Once all phases are complete, the Freeway Cards Store will be fully operational in production with:
- Complete virtual card platform
- Google OAuth authentication
- Real-time API integration
- Mobile-optimized interface
- Business enterprise features
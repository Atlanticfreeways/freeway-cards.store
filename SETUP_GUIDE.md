# Step-by-Step Production Setup Guide

## 🚀 **Complete Setup in 30 Minutes**

### **Step 1: MongoDB Atlas (5 minutes)**

1. **Register**: Go to https://www.mongodb.com/atlas
2. **Sign up** with email or Google account
3. **Create Organization**: Name it "Freeway Cards"
4. **Create Project**: Name it "freeway-cards-prod"
5. **Build Database**: 
   - Choose "M0 Sandbox" (FREE)
   - Select "AWS" provider
   - Choose closest region
   - Name cluster: "freeway-cards"
6. **Create User**:
   - Username: `freeway-admin`
   - Password: Generate secure password
   - Save credentials!
7. **Network Access**: Add IP `0.0.0.0/0` (allow all)
8. **Connect**: Copy connection string
   ```
   mongodb+srv://freeway-admin:<password>@freeway-cards.xxxxx.mongodb.net/freeway-cards
   ```

### **Step 2: Generate JWT Secret (1 minute)**

Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output - this is your `JWT_SECRET`

### **Step 3: SendGrid Email Service (5 minutes)**

1. **Register**: Go to https://sendgrid.com/
2. **Sign up** with email
3. **Verify email** address
4. **Skip** marketing questions
5. **Create API Key**:
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Name: "Freeway Cards Production"
   - Permissions: "Full Access"
   - Copy API key (starts with `SG.`)

### **Step 4: Google OAuth (10 minutes)**

1. **Go to**: https://console.cloud.google.com/
2. **Sign in** with Google account
3. **Create Project**:
   - Click "Select Project" → "New Project"
   - Name: "Freeway Cards"
   - Click "Create"
4. **Enable APIs**:
   - Go to "APIs & Services" → "Library"
   - Search "Google+ API" → Enable
   - Search "Google Identity" → Enable
5. **OAuth Consent Screen**:
   - Click "OAuth consent screen"
   - Choose "External"
   - App name: "Freeway Cards"
   - User support email: your email
   - Developer email: your email
   - Save
6. **Create Credentials**:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "Freeway Cards Web"
   - Authorized redirect URIs:
     ```
     https://your-domain.netlify.app/auth/google-callback.html
     http://localhost:3000/auth/google-callback.html
     ```
   - Click "Create"
   - Copy Client ID and Client Secret

### **Step 5: Deploy Backend - Railway (5 minutes)**

1. **Register**: Go to https://railway.app/
2. **Sign up** with GitHub account
3. **New Project**: Click "New Project" → "Deploy from GitHub repo"
4. **Connect Repository**: Select your freeway-cards repo
5. **Add Variables**: Click project → Variables tab
   ```
   MONGODB_URI=your-mongodb-connection-string
   JWT_SECRET=your-generated-jwt-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   SENDGRID_API_KEY=your-sendgrid-api-key
   NODE_ENV=production
   PORT=3000
   ```
6. **Deploy**: Railway auto-deploys
7. **Copy URL**: Copy the generated railway.app URL

### **Step 6: Deploy Frontend - Netlify (2 minutes)**

1. **Register**: Go to https://netlify.com/
2. **Sign up** with GitHub account
3. **New Site**: "Add new site" → "Import from Git"
4. **Connect Repository**: Select your freeway-cards repo
5. **Build Settings**:
   - Build command: `echo 'Static deployment'`
   - Publish directory: `frontend`
6. **Environment Variables**: Site settings → Environment variables
   ```
   GOOGLE_CLIENT_ID_PROD=your-google-client-id
   API_BASE_URL_PROD=https://your-railway-url.railway.app/api
   ```
7. **Deploy**: Click "Deploy site"
8. **Update Domain**: Site settings → Change site name

### **Step 7: Update Configuration (2 minutes)**

1. **Update Google OAuth**:
   - Go back to Google Console → Credentials
   - Edit your OAuth client
   - Add your Netlify URL to authorized redirect URIs:
     ```
     https://your-site-name.netlify.app/auth/google-callback.html
     ```

2. **Update netlify.toml**:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-railway-url.railway.app/api/:splat"
     status = 200
   ```

## ✅ **Verification Checklist**

Test these URLs:
- [ ] `https://your-site.netlify.app` - Landing page loads
- [ ] `https://your-site.netlify.app/login.html` - Login page works
- [ ] `https://your-railway-url.railway.app/api/health` - Backend responds
- [ ] Google OAuth login works
- [ ] Email verification works

## 🎯 **You're Live!**

Your Freeway Cards Store is now live in production with:
- ✅ Database connected
- ✅ Authentication working
- ✅ Email service active
- ✅ Frontend deployed
- ✅ Backend deployed

**Total time**: ~30 minutes
**Total cost**: $0 (all free tiers)
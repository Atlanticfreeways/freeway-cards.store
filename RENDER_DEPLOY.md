# Render Deployment Guide

## 🚀 **Deploy to Render (5 minutes)**

### **Step 1: Deploy Backend**
1. Go to https://render.com/
2. Sign up with GitHub
3. **New** → **Blueprint**
4. Connect your GitHub repo
5. **Deploy** - Render will use `render.yaml` automatically

### **Step 2: Update Google OAuth**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Add to **Authorized redirect URIs**:
   ```
   https://freeway-cards-backend.onrender.com/auth/google-callback.html
   ```

### **Step 3: Deploy Frontend (Netlify)**
1. Go to https://netlify.com/
2. **New site from Git**
3. Connect GitHub repo
4. **Build settings**:
   - Build command: `echo 'Static deployment'`
   - Publish directory: `frontend`
5. **Environment variables**:
   ```
   GOOGLE_CLIENT_ID_PROD=804228968611-lcsqnvmgfabs4s9445d0d3lsikqupet3.apps.googleusercontent.com
   API_BASE_URL_PROD=https://freeway-cards-backend.onrender.com/api
   ```

## ✅ **Ready to Deploy**

**Backend**: Render (free tier)
**Frontend**: Netlify (free tier)
**Database**: MongoDB Atlas (free tier)

**Total cost**: $0

All environment variables are pre-configured in `render.yaml`!
# 🚀 Production Deployment Guide - Real Card Issuer Integration

This guide covers deploying the Freeway Cards platform with real card issuer integration to production.

## 📋 Pre-Deployment Checklist

### 1. Card Issuer Setup
- [ ] **Marqeta Account**: Production API credentials obtained
- [ ] **Stripe Issuing Account**: Production API keys configured
- [ ] **Card Programs**: Created and approved by card issuer
- [ ] **Webhook Endpoints**: Configured in card issuer dashboard
- [ ] **Compliance**: PCI DSS assessment completed

### 2. Infrastructure Requirements
- [ ] **Database**: MongoDB Atlas production cluster
- [ ] **SSL Certificates**: Valid certificates for all domains
- [ ] **Load Balancer**: Configured for high availability
- [ ] **CDN**: CloudFlare or similar for static assets
- [ ] **Monitoring**: Application monitoring service (DataDog, New Relic)

### 3. Security Requirements
- [ ] **Encryption Keys**: Generated and stored securely
- [ ] **API Keys**: All production keys configured
- [ ] **Firewall**: Network security rules configured
- [ ] **Access Control**: Admin access restricted
- [ ] **Audit Logging**: Enabled and configured

## 🔧 Environment Configuration

### Production Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://prod-user:password@cluster.mongodb.net/freeway-cards-prod
MONGODB_ATLAS_URI=mongodb+srv://prod-user:password@cluster.mongodb.net/freeway-cards-prod

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum
JWT_EXPIRES_IN=7d

# Card Issuer Configuration
CARD_ISSUER_PROVIDER=marqeta
USE_REAL_CARDS=true
ENABLE_CARD_WEBHOOKS=true
ENABLE_FRAUD_DETECTION=true

# Card Data Encryption (CRITICAL - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CARD_ENCRYPTION_KEY=your-64-character-hex-encryption-key-here

# Marqeta Production Configuration
MARQETA_BASE_URL=https://api.marqeta.com/v3
MARQETA_APPLICATION_TOKEN=your-marqeta-application-token
MARQETA_ADMIN_ACCESS_TOKEN=your-marqeta-admin-access-token
MARQETA_WEBHOOK_SECRET=your-marqeta-webhook-secret
MARQETA_VISA_PRODUCT_TOKEN=your-visa-card-product-token
MARQETA_MC_PRODUCT_TOKEN=your-mastercard-product-token

# Stripe Production Configuration
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Admin Configuration
ADMIN_EMAIL=admin@yourcompany.com

# Email Service (Optional)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourcompany.com

# Monitoring (Optional)
DATADOG_API_KEY=your-datadog-api-key
NEW_RELIC_LICENSE_KEY=your-newrelic-license-key

# Security
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/freeway-cards/app.log
```

### Generate Encryption Key

**CRITICAL**: Generate a secure encryption key for card data:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store this key securely and never change it after cards are created.

## 🏗️ Infrastructure Setup

### 1. MongoDB Atlas Production Cluster

```javascript
// Recommended MongoDB Atlas Configuration
{
  "clusterType": "REPLICASET",
  "replicationSpecs": [{
    "numShards": 1,
    "regionsConfig": {
      "US_EAST_1": {
        "electableNodes": 3,
        "priority": 7,
        "readOnlyNodes": 0
      }
    }
  }],
  "providerSettings": {
    "providerName": "AWS",
    "instanceSizeName": "M30", // Minimum for production
    "regionName": "US_EAST_1"
  },
  "diskSizeGB": 100,
  "mongoDBMajorVersion": "6.0",
  "backupEnabled": true,
  "pitEnabled": true
}
```

### 2. Required Database Indexes

Run these commands in MongoDB to create performance indexes:

```javascript
// Users collection
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "kycStatus": 1 })
db.users.createIndex({ "createdAt": -1 })

// VirtualCards collection
db.virtualcards.createIndex({ "userId": 1, "status": 1 })
db.virtualcards.createIndex({ "issuerProvider": 1, "issuerCardId": 1 })
db.virtualcards.createIndex({ "last4Digits": 1 })
db.virtualcards.createIndex({ "createdAt": -1 })
db.virtualcards.createIndex({ "complianceFlags": 1 })

// Transactions collection
db.transactions.createIndex({ "userId": 1, "createdAt": -1 })
db.transactions.createIndex({ "cardId": 1, "createdAt": -1 })
db.transactions.createIndex({ "issuerTransactionId": 1 }, { unique: true, sparse: true })
db.transactions.createIndex({ "type": 1, "status": 1 })
db.transactions.createIndex({ "createdAt": -1 })

// KYC collection
db.kycs.createIndex({ "userId": 1 }, { unique: true })
db.kycs.createIndex({ "status": 1 })
```

### 3. SSL Certificate Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Webhook endpoints (no caching)
    location /api/webhooks/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
}
```

## 🚀 Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install nginx
sudo apt install nginx

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx
```

### 2. Application Deployment

```bash
# Clone repository
git clone https://github.com/yourusername/freeway-cards.git
cd freeway-cards

# Install dependencies
npm install --production

# Copy production environment file
cp .env.production .env

# Build frontend (if applicable)
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'freeway-cards-api',
    script: 'server.js',
    cwd: './backend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/freeway-cards/error.log',
    out_file: '/var/log/freeway-cards/out.log',
    log_file: '/var/log/freeway-cards/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. Application Security

```javascript
// Add to server.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Stricter rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many requests for this endpoint'
});
app.use('/api/cards/create', strictLimiter);
app.use('/api/auth/login', strictLimiter);
```

## 📊 Monitoring Setup

### 1. Application Monitoring

```javascript
// Add to server.js
const { monitoringMiddleware, errorMonitoringMiddleware } = require('./middleware/monitoring');

// Apply monitoring middleware
app.use(monitoringMiddleware);
app.use(errorMonitoringMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});
```

### 2. Log Management

```bash
# Create log directory
sudo mkdir -p /var/log/freeway-cards
sudo chown $USER:$USER /var/log/freeway-cards

# Configure log rotation
sudo tee /etc/logrotate.d/freeway-cards << EOF
/var/log/freeway-cards/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## 🧪 Production Testing

### 1. Smoke Tests

```bash
# Test basic endpoints
curl -f https://yourdomain.com/health
curl -f https://yourdomain.com/api/cards/config/status

# Test webhook endpoints
curl -X POST https://yourdomain.com/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"provider":"marqeta","event":{"type":"test"}}'
```

### 2. Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

Create `load-test.yml`:

```yaml
config:
  target: 'https://yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer your-test-token'

scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/cards"
      - post:
          url: "/api/cards/create"
          json:
            cardName: "Test Card"
            cardType: "visa"
```

## 🔄 Backup and Recovery

### 1. Database Backup

```bash
# MongoDB Atlas automatic backups are enabled
# Additional manual backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backup/freeway-cards-$DATE"
tar -czf "/backup/freeway-cards-$DATE.tar.gz" "/backup/freeway-cards-$DATE"
rm -rf "/backup/freeway-cards-$DATE"

# Keep only last 7 days of backups
find /backup -name "freeway-cards-*.tar.gz" -mtime +7 -delete
```

### 2. Application Backup

```bash
# Backup application and configuration
tar -czf "/backup/app-$(date +%Y%m%d).tar.gz" \
  --exclude=node_modules \
  --exclude=.git \
  /path/to/freeway-cards
```

## 📈 Performance Optimization

### 1. Database Optimization

```javascript
// Connection pooling
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  bufferMaxEntries: 0
});
```

### 2. Caching Strategy

```javascript
// Redis caching (optional)
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

// Cache frequently accessed data
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = req.originalUrl;
    const cached = await client.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      client.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

## 🚨 Incident Response

### 1. Monitoring Alerts

Configure alerts for:
- API error rate > 5%
- Response time > 5 seconds
- Database connection failures
- Card issuer API failures
- High fraud detection rate
- Memory usage > 80%

### 2. Emergency Procedures

```bash
# Emergency card freeze (all cards)
# Only use in extreme circumstances
mongo $MONGODB_URI --eval "
  db.virtualcards.updateMany(
    { status: 'active' },
    { \$set: { status: 'frozen', statusReason: 'Emergency freeze' } }
  )
"

# Disable real card creation
# Set USE_REAL_CARDS=false in environment and restart
pm2 restart freeway-cards-api --update-env
```

## ✅ Go-Live Checklist

- [ ] All environment variables configured
- [ ] Database indexes created
- [ ] SSL certificates installed and valid
- [ ] Card issuer webhooks configured
- [ ] Monitoring and alerting active
- [ ] Backup procedures tested
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Admin access verified
- [ ] Emergency procedures documented
- [ ] Team trained on production procedures

## 📞 Support Contacts

- **Card Issuer Support**: [Marqeta/Stripe support contacts]
- **Database Support**: MongoDB Atlas support
- **Infrastructure**: Your hosting provider support
- **Application**: Your development team

---

**⚠️ IMPORTANT**: Never deploy to production without thorough testing in a staging environment that mirrors production exactly.
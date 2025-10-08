# Freeway Cards Store

A digital gift card platform built with Node.js backend and vanilla JavaScript frontend.

## 🚀 Quick Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Atlanticfreeways/freeway-cards.store)

## 📁 Project Structure

```
├── frontend/          # Static frontend files
│   ├── index.html     # Main landing/login page
│   ├── dashboard.html # User dashboard
│   └── styles.css     # Styling
├── backend/           # Node.js API server
│   ├── server.js      # Main server file
│   ├── routes/        # API routes
│   └── models/        # Database models
└── netlify.toml       # Netlify configuration
```

## 🌐 Netlify Deployment

This project is configured for easy Netlify deployment:

1. **Connect Repository**: Link your GitHub repo to Netlify
2. **Build Settings**: 
   - Build command: `echo 'Static site deployment'`
   - Publish directory: `frontend`
3. **Deploy**: Netlify will automatically deploy from the `main` branch

## 🔧 Local Development

### Frontend
The frontend is a static site that can be served directly:
```bash
cd frontend
python -m http.server 8000
# or
npx serve .
```

### Backend
For local API development:
```bash
cd backend
npm install
npm start
```

## 🔒 Security Features

- HTTPS redirect middleware
- CSRF protection
- Input validation and sanitization
- Security headers configuration
- Rate limiting

## 📝 Environment Variables

Copy `.env.example` to `.env` and configure:
- Database connection
- JWT secrets
- API keys
- Email configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
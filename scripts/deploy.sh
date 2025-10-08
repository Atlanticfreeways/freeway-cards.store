#!/bin/bash

echo "🚀 Starting deployment..."

# Simple deployment without Docker
echo "📦 Installing dependencies..."
cd backend
npm install

echo "🚀 Starting application..."
npm start &

echo "⏳ Waiting for service to start..."
sleep 5

echo "🎉 Deployment completed successfully!"
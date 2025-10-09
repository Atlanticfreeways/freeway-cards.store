#!/usr/bin/env node

// Simple deployment test script
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Freeway Cards deployment...\n');

// Test 1: Check if frontend directory exists
const frontendPath = path.join(__dirname, 'frontend');
if (!fs.existsSync(frontendPath)) {
  console.error('❌ Frontend directory not found');
  process.exit(1);
}
console.log('✅ Frontend directory exists');

// Test 2: Check if index.html exists
const indexPath = path.join(frontendPath, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found');
  process.exit(1);
}
console.log('✅ index.html exists');

// Test 3: Check if CSS files exist
const cssPath = path.join(frontendPath, 'css', 'main.css');
if (!fs.existsSync(cssPath)) {
  console.error('❌ main.css not found');
  process.exit(1);
}
console.log('✅ CSS files exist');

// Test 4: Check if JS files exist
const jsPath = path.join(frontendPath, 'js');
if (!fs.existsSync(jsPath)) {
  console.error('❌ JS directory not found');
  process.exit(1);
}
console.log('✅ JavaScript files exist');

// Test 5: Check netlify.toml
const netlifyPath = path.join(__dirname, 'netlify.toml');
if (!fs.existsSync(netlifyPath)) {
  console.error('❌ netlify.toml not found');
  process.exit(1);
}
console.log('✅ netlify.toml exists');

// Test 6: Validate netlify.toml content
const netlifyContent = fs.readFileSync(netlifyPath, 'utf8');
if (!netlifyContent.includes('publish = "frontend"')) {
  console.error('❌ netlify.toml missing publish directory');
  process.exit(1);
}
console.log('✅ netlify.toml properly configured');

// Test 7: Check manifest.json
const manifestPath = path.join(frontendPath, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ manifest.json not found');
  process.exit(1);
}
console.log('✅ PWA manifest exists');

console.log('\n🎉 All deployment tests passed!');
console.log('📦 Ready for Netlify deployment');
console.log('\nNext steps:');
console.log('1. Connect your GitHub repo to Netlify');
console.log('2. Set build command: echo "Static site deployment"');
console.log('3. Set publish directory: frontend');
console.log('4. Deploy!');
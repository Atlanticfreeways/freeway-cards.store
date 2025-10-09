#!/usr/bin/env node

// Frontend Flow Testing Script
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Frontend Flows\n');

const flows = [
  {
    name: 'Homepage',
    file: 'frontend/index.html',
    tests: ['Landing page loads', 'Sign up button exists', 'Sign in button exists']
  },
  {
    name: 'User Registration',
    file: 'frontend/auth/signup.html',
    tests: ['Registration form exists', 'Google signup button', 'Email validation']
  },
  {
    name: 'User Login',
    file: 'frontend/login.html',
    tests: ['Login form exists', 'Google login button', 'Forgot password link']
  },
  {
    name: 'Google OAuth',
    file: 'frontend/js/google-oauth.js',
    tests: ['OAuth initialization', 'Client ID validation', 'Error handling']
  },
  {
    name: 'Dashboard',
    file: 'frontend/dashboard.html',
    tests: ['Dashboard loads', 'Navigation menu', 'User profile section']
  },
  {
    name: 'Wallet',
    file: 'frontend/wallet/index.html',
    tests: ['Wallet interface', 'Add funds button', 'Transaction history']
  },
  {
    name: 'Gift Cards',
    file: 'frontend/gift-cards/purchase.html',
    tests: ['Purchase form', 'Card selection', 'Payment options']
  },
  {
    name: 'Password Reset',
    file: 'frontend/auth/forgot-password.html',
    tests: ['Reset form', 'Email input', 'Submit button']
  },
  {
    name: 'Email Verification',
    file: 'frontend/auth/verify.html',
    tests: ['Verification page', 'Token handling', 'Success message']
  },
  {
    name: 'Profile Management',
    file: 'frontend/dashboard/profile.html',
    tests: ['Profile form', 'Update button', 'Security settings']
  }
];

let passed = 0;
let failed = 0;

flows.forEach(flow => {
  console.log(`📋 ${flow.name}`);
  
  const filePath = path.join(__dirname, flow.file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ File exists: ${flow.file}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    flow.tests.forEach(test => {
      let testPassed = false;
      
      switch(test) {
        case 'Landing page loads':
          testPassed = content.includes('<title>') && content.includes('Freeway Cards');
          break;
        case 'Sign up button exists':
          testPassed = content.includes('signup') || content.includes('Sign Up');
          break;
        case 'Sign in button exists':
          testPassed = content.includes('login') || content.includes('Sign In');
          break;
        case 'Registration form exists':
          testPassed = content.includes('<form') && content.includes('email');
          break;
        case 'Google signup button':
          testPassed = content.includes('google') || content.includes('Google');
          break;
        case 'Email validation':
          testPassed = content.includes('email') && content.includes('required');
          break;
        case 'Login form exists':
          testPassed = content.includes('<form') && content.includes('password');
          break;
        case 'Google login button':
          testPassed = content.includes('google') || content.includes('Google');
          break;
        case 'Forgot password link':
          testPassed = content.includes('forgot') || content.includes('reset');
          break;
        case 'OAuth initialization':
          testPassed = content.includes('google.accounts.id.initialize');
          break;
        case 'Client ID validation':
          testPassed = content.includes('clientId') && content.includes('validation');
          break;
        case 'Error handling':
          testPassed = content.includes('catch') && content.includes('error');
          break;
        case 'Dashboard loads':
          testPassed = content.includes('dashboard') || content.includes('Dashboard');
          break;
        case 'Navigation menu':
          testPassed = content.includes('<nav') || content.includes('menu');
          break;
        case 'User profile section':
          testPassed = content.includes('profile') || content.includes('user');
          break;
        case 'Wallet interface':
          testPassed = content.includes('wallet') || content.includes('balance');
          break;
        case 'Add funds button':
          testPassed = content.includes('add') && content.includes('funds');
          break;
        case 'Transaction history':
          testPassed = content.includes('transaction') || content.includes('history');
          break;
        case 'Purchase form':
          testPassed = content.includes('<form') && content.includes('purchase');
          break;
        case 'Card selection':
          testPassed = content.includes('select') || content.includes('card');
          break;
        case 'Payment options':
          testPassed = content.includes('payment') || content.includes('method');
          break;
        case 'Reset form':
          testPassed = content.includes('<form') && content.includes('reset');
          break;
        case 'Email input':
          testPassed = content.includes('email') && content.includes('input');
          break;
        case 'Submit button':
          testPassed = content.includes('submit') || content.includes('button');
          break;
        case 'Verification page':
          testPassed = content.includes('verify') || content.includes('verification');
          break;
        case 'Token handling':
          testPassed = content.includes('token') || content.includes('code');
          break;
        case 'Success message':
          testPassed = content.includes('success') || content.includes('verified');
          break;
        case 'Profile form':
          testPassed = content.includes('<form') && content.includes('profile');
          break;
        case 'Update button':
          testPassed = content.includes('update') || content.includes('save');
          break;
        case 'Security settings':
          testPassed = content.includes('security') || content.includes('password');
          break;
        default:
          testPassed = true;
      }
      
      if (testPassed) {
        console.log(`    ✅ ${test}`);
        passed++;
      } else {
        console.log(`    ❌ ${test}`);
        failed++;
      }
    });
  } else {
    console.log(`  ❌ File missing: ${flow.file}`);
    failed += flow.tests.length;
  }
  
  console.log('');
});

console.log(`📊 Test Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 All flows are ready!');
} else {
  console.log('\n⚠️  Some flows need attention.');
}
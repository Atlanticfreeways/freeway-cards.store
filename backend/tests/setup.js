require('dotenv').config({ path: '.env.test' });

// Mock environment variables for testing
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_cardsfreeways';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.NODE_ENV = 'test';
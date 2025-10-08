const axios = require('axios');

const BITNOB_BASE_URL = 'https://api.bitnob.com/api/v1';

const bitnobAPI = axios.create({
  baseURL: BITNOB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.BITNOB_SECRET_KEY}`,
    'Content-Type': 'application/json'
  }
});

// Create virtual card
const createBitnobCard = async (cardData) => {
  try {
    const response = await bitnobAPI.post('/cards/create', {
      currency: cardData.currency,
      amount: cardData.amount,
      callbackUrl: `${process.env.BASE_URL}/api/webhooks/bitnob`,
      customerDetails: cardData.customerDetails
    });
    
    return response.data.data;
  } catch (error) {
    throw new Error(`Bitnob card creation failed: ${error.response?.data?.message || error.message}`);
  }
};

// Get card details
const getBitnobCard = async (cardId) => {
  try {
    const response = await bitnobAPI.get(`/cards/${cardId}`);
    return response.data.data;
  } catch (error) {
    throw new Error(`Failed to get card details: ${error.response?.data?.message || error.message}`);
  }
};

// Freeze/Unfreeze card
const freezeBitnobCard = async (cardId, freeze = true) => {
  try {
    const endpoint = freeze ? `/cards/${cardId}/freeze` : `/cards/${cardId}/unfreeze`;
    const response = await bitnobAPI.post(endpoint);
    return response.data.data;
  } catch (error) {
    throw new Error(`Failed to ${freeze ? 'freeze' : 'unfreeze'} card: ${error.response?.data?.message || error.message}`);
  }
};

// Fund card
const fundBitnobCard = async (cardId, amount, currency) => {
  try {
    const response = await bitnobAPI.post(`/cards/${cardId}/fund`, {
      amount,
      currency
    });
    return response.data.data;
  } catch (error) {
    throw new Error(`Card funding failed: ${error.response?.data?.message || error.message}`);
  }
};

// Get card transactions
const getBitnobCardTransactions = async (cardId) => {
  try {
    const response = await bitnobAPI.get(`/cards/${cardId}/transactions`);
    return response.data.data;
  } catch (error) {
    throw new Error(`Failed to get transactions: ${error.response?.data?.message || error.message}`);
  }
};

// Generate crypto payment address
const generatePaymentAddress = async (currency, amount) => {
  try {
    const response = await bitnobAPI.post('/addresses/generate', {
      currency,
      amount,
      callbackUrl: `${process.env.BASE_URL}/api/webhooks/payment`
    });
    return response.data.data;
  } catch (error) {
    throw new Error(`Payment address generation failed: ${error.response?.data?.message || error.message}`);
  }
};

module.exports = {
  createBitnobCard,
  getBitnobCard,
  freezeBitnobCard,
  fundBitnobCard,
  getBitnobCardTransactions,
  generatePaymentAddress
};
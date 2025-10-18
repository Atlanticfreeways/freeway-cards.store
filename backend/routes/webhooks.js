const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const webhookProcessor = require('../services/webhookProcessor');
const cardIssuerConfig = require('../config/cardIssuer');

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handlePaymentSuccess(paymentIntent) {
  const { metadata } = paymentIntent;
  
  if (metadata.type === 'wallet_funding') {
    // Update transaction status
    await Transaction.findOneAndUpdate(
      { transactionId: paymentIntent.id },
      { status: 'completed' }
    );
  }
}

async function handlePaymentFailure(paymentIntent) {
  // Update transaction status to failed
  await Transaction.findOneAndUpdate(
    { transactionId: paymentIntent.id },
    { status: 'failed' }
  );
}

// Marqeta webhook endpoint
router.post('/marqeta', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-marqeta-signature'] || req.headers['signature'];
    const event = JSON.parse(req.body.toString());

    console.log('Marqeta webhook received:', {
      type: event.type,
      token: event.token,
      timestamp: new Date().toISOString()
    });

    // Check if webhooks are enabled
    if (!cardIssuerConfig.featureFlags.enableWebhooks) {
      console.log('Webhooks disabled, ignoring Marqeta event');
      return res.status(200).json({ 
        received: true, 
        processed: false,
        reason: 'Webhooks disabled' 
      });
    }

    // Process the webhook event
    const result = await webhookProcessor.processWebhookEvent('marqeta', event, signature);

    res.status(200).json({
      received: true,
      processed: result.success,
      eventType: result.eventType,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Marqeta webhook processing failed:', error);
    res.status(500).json({ 
      received: true, 
      processed: false,
      error: error.message 
    });
  }
});

// Stripe Issuing webhook endpoint
router.post('/stripe-issuing', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    let event;

    // Verify webhook signature
    try {
      event = stripe.webhooks.constructEvent(
        req.body, 
        signature, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Stripe Issuing webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log('Stripe Issuing webhook received:', {
      type: event.type,
      id: event.id,
      timestamp: new Date().toISOString()
    });

    // Check if webhooks are enabled
    if (!cardIssuerConfig.featureFlags.enableWebhooks) {
      console.log('Webhooks disabled, ignoring Stripe Issuing event');
      return res.status(200).json({ 
        received: true, 
        processed: false,
        reason: 'Webhooks disabled' 
      });
    }

    // Only process issuing-related events
    const issuingEvents = [
      'issuing_authorization.created',
      'issuing_authorization.updated',
      'issuing_transaction.created',
      'issuing_transaction.updated',
      'issuing_card.created',
      'issuing_card.updated'
    ];

    if (!issuingEvents.includes(event.type)) {
      console.log('Non-issuing event ignored:', event.type);
      return res.status(200).json({ 
        received: true, 
        processed: false,
        reason: 'Non-issuing event' 
      });
    }

    // Process the webhook event
    const result = await webhookProcessor.processWebhookEvent('stripe', event, signature);

    res.status(200).json({
      received: true,
      processed: result.success,
      eventType: result.eventType,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Stripe Issuing webhook processing failed:', error);
    res.status(500).json({ 
      received: true, 
      processed: false,
      error: error.message 
    });
  }
});

// Webhook health check endpoint
router.get('/health', async (req, res) => {
  try {
    const stats = webhookProcessor.getStats();
    const config = cardIssuerConfig.getStatus();

    res.json({
      status: 'healthy',
      webhooks: {
        enabled: config.featureFlags.enableWebhooks,
        providers: config.providers.filter(p => p.available).map(p => p.key),
        stats: stats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook statistics endpoint (for monitoring)
router.get('/stats', async (req, res) => {
  try {
    const stats = webhookProcessor.getStats();
    
    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test webhook endpoint (for development)
router.post('/test', express.json(), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Test endpoint not available in production' 
      });
    }

    const { provider, event } = req.body;
    
    if (!provider || !event) {
      return res.status(400).json({ 
        error: 'Provider and event are required' 
      });
    }

    // Process test event without signature validation
    const result = await webhookProcessor.processWebhookEvent(provider, event, 'test-signature');

    res.json({
      success: true,
      message: 'Test webhook processed',
      result: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
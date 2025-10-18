// Stripe Integration for Freeway Cards
class StripePayments {
  constructor() {
    this.stripe = null;
    this.elements = null;
    this.card = null;
    this.init();
  }

  async init() {
    // Initialize Stripe (replace with your publishable key)
    this.stripe = Stripe(window.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');
    this.elements = this.stripe.elements();
    this.setupCardElement();
  }

  setupCardElement() {
    const style = {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
    };

    this.card = this.elements.create('card', { style });
  }

  mountCard(elementId) {
    this.card.mount(elementId);
  }

  async purchaseGiftCard(amount, giftCardData) {
    try {
      // Create payment intent
      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount })
      });

      const { clientSecret, paymentIntentId } = await response.json();

      // Confirm payment
      const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.card,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Confirm with backend
      const confirmResponse = await fetch('/api/payments/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          paymentIntentId,
          giftCardData
        })
      });

      return await confirmResponse.json();
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }

  async addFundsToWallet(amount) {
    try {
      // Create payment intent for wallet funding
      const response = await fetch('/api/payments/add-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount })
      });

      const { clientSecret, paymentIntentId } = await response.json();

      // Confirm payment
      const { error } = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.card,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Confirm with backend
      const confirmResponse = await fetch('/api/payments/confirm-wallet-funding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ paymentIntentId })
      });

      return await confirmResponse.json();
    } catch (error) {
      console.error('Wallet funding failed:', error);
      throw error;
    }
  }
}

// Initialize Stripe payments
window.stripePayments = new StripePayments();
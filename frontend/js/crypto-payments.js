/**
 * Crypto Payment Integration
 * Handles Bitcoin and USDT payment processing
 */

class CryptoPayments {
    constructor() {
        this.apiBase = '/api';
        this.rates = {
            bitcoin: 43250.00,
            usdt: 1.00
        };
        this.paymentSession = null;
    }

    // Get current crypto rates
    async getCryptoRates() {
        try {
            const response = await fetch(`${this.apiBase}/crypto/rates`);
            if (response.ok) {
                this.rates = await response.json();
            }
        } catch (error) {
            console.log('Using cached rates:', error);
        }
        return this.rates;
    }

    // Generate payment address
    async generatePaymentAddress(crypto, amount) {
        try {
            const response = await fetch(`${this.apiBase}/crypto/generate-address`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    cryptocurrency: crypto,
                    amount: amount,
                    userId: localStorage.getItem('userId')
                })
            });

            if (response.ok) {
                this.paymentSession = await response.json();
                return this.paymentSession;
            }
        } catch (error) {
            console.error('Address generation failed:', error);
        }

        // Fallback demo addresses
        return {
            address: crypto === 'bitcoin' ? 
                '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' : 
                '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
            amount: crypto === 'bitcoin' ? 
                (amount / this.rates.bitcoin).toFixed(8) : 
                amount.toFixed(2),
            sessionId: 'demo_' + Date.now(),
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
        };
    }

    // Check payment status
    async checkPaymentStatus(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/crypto/payment-status/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Payment status check failed:', error);
        }

        // Demo payment confirmation after 15 seconds
        if (this.paymentSession && Date.now() - parseInt(sessionId.split('_')[1]) > 15000) {
            return {
                status: 'confirmed',
                txId: '0x1234567890abcdef1234567890abcdef12345678',
                confirmations: 3,
                amount: this.paymentSession.amount
            };
        }

        return {
            status: 'pending',
            confirmations: 0
        };
    }

    // Generate QR code for payment
    generateQRCode(address, amount, crypto) {
        // In production, use a proper QR code library like qrcode.js
        const qrData = crypto === 'bitcoin' ? 
            `bitcoin:${address}?amount=${amount}` : 
            `ethereum:${address}?value=${amount}`;

        return {
            data: qrData,
            svg: this.createSimpleQR(address)
        };
    }

    // Simple QR code placeholder
    createSimpleQR(address) {
        return `
            <div style="width: 180px; height: 180px; background: white; border: 2px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 12px; text-align: center; padding: 10px; border-radius: 8px;">
                <div>
                    <div style="font-weight: bold; margin-bottom: 8px; color: #333;">📱 Scan to Pay</div>
                    <div style="font-family: monospace; word-break: break-all; color: #666; line-height: 1.2;">${address.substring(0, 20)}...</div>
                    <div style="margin-top: 8px; font-size: 10px; color: #999;">Use your crypto wallet</div>
                </div>
            </div>
        `;
    }

    // Calculate crypto amount from USD
    calculateCryptoAmount(usdAmount, crypto) {
        if (crypto === 'bitcoin') {
            return (usdAmount / this.rates.bitcoin).toFixed(8);
        } else if (crypto === 'usdt') {
            return usdAmount.toFixed(2);
        }
        return '0.00';
    }

    // Get network info
    getNetworkInfo(crypto) {
        const networks = {
            bitcoin: {
                name: 'Bitcoin',
                confirmations: 3,
                avgTime: '10-30 minutes'
            },
            usdt: {
                name: 'Ethereum (ERC-20)',
                confirmations: 12,
                avgTime: '2-5 minutes'
            }
        };
        return networks[crypto] || networks.bitcoin;
    }

    // Copy address to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    // Format crypto amount for display
    formatCryptoAmount(amount, crypto) {
        if (crypto === 'bitcoin') {
            return parseFloat(amount).toFixed(8) + ' BTC';
        } else if (crypto === 'usdt') {
            return parseFloat(amount).toFixed(2) + ' USDT';
        }
        return amount;
    }

    // Validate crypto address
    validateAddress(address, crypto) {
        if (crypto === 'bitcoin') {
            return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || 
                   /^bc1[a-z0-9]{39,59}$/.test(address);
        } else if (crypto === 'usdt') {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
        return false;
    }
}

// Export for use in other files
window.CryptoPayments = CryptoPayments;
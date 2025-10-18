const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@freeway.cards',
      to: user.email,
      subject: 'Welcome to Freeway Cards!',
      html: `
        <h2>Welcome ${user.name}!</h2>
        <p>Your virtual card platform is ready.</p>
        <p>Start creating cards and funding your wallet.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard">Go to Dashboard</a>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendCardCreatedEmail(user, card) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@freeway.cards',
      to: user.email,
      subject: 'New Virtual Card Created',
      html: `
        <h2>Card Created Successfully</h2>
        <p>Your ${card.cardType.toUpperCase()} card "${card.cardName}" is ready.</p>
        <p>Card ending in: ****${card.cardNumber.slice(-4)}</p>
        <p>Spending limit: $${card.spendingLimit}</p>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendTransactionAlert(user, transaction) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@freeway.cards',
      to: user.email,
      subject: 'Transaction Alert',
      html: `
        <h2>Transaction Notification</h2>
        <p>Amount: $${Math.abs(transaction.amount)}</p>
        <p>Description: ${transaction.description}</p>
        <p>Status: ${transaction.status}</p>
        <p>Date: ${new Date(transaction.createdAt).toLocaleString()}</p>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
const nodemailer = require('nodemailer');
const logger = require('./logger');

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @returns {Promise} Email send result
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('Email credentials not configured - skipping email send');
      return { success: false, message: 'Email not configured' };
    }

    const mailOptions = {
      from: `"PaVa-Vak" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send welcome email
 * @param {string} email - User email
 * @param {string} username - Username
 */
async function sendWelcomeEmail(email, username) {
  const subject = 'Welcome to PaVa-Vak!';
  const text = `
Hello ${username},

Welcome to PaVa-Vak - your private chat system!

You can now:
- Generate invite codes to connect with friends
- Send encrypted messages
- Set message timers for auto-deletion
- Enable two-factor authentication for extra security

Get started by generating your first invite code and sharing it with a friend.

Best regards,
The PaVa-Vak Team
  `;

  const html = `
    <h1>Welcome to PaVa-Vak!</h1>
    <p>Hello <strong>${username}</strong>,</p>
    <p>Welcome to PaVa-Vak - your private chat system!</p>
    <h2>You can now:</h2>
    <ul>
      <li>Generate invite codes to connect with friends</li>
      <li>Send encrypted messages</li>
      <li>Set message timers for auto-deletion</li>
      <li>Enable two-factor authentication for extra security</li>
    </ul>
    <p>Get started by generating your first invite code and sharing it with a friend.</p>
    <p>Best regards,<br>The PaVa-Vak Team</p>
  `;

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} resetToken - Password reset token
 */
async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  
  const subject = 'Password Reset Request';
  const text = `
You requested a password reset for your PaVa-Vak account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The PaVa-Vak Team
  `;

  const html = `
    <h1>Password Reset Request</h1>
    <p>You requested a password reset for your PaVa-Vak account.</p>
    <p>Click the button below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>Or copy this link: ${resetUrl}</p>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Best regards,<br>The PaVa-Vak Team</p>
  `;

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Send connection request notification
 * @param {string} email - User email
 * @param {string} requesterName - Name of person requesting connection
 */
async function sendConnectionRequestEmail(email, requesterName) {
  const subject = 'New Connection Request';
  const text = `
${requesterName} wants to connect with you on PaVa-Vak!

Log in to your account to approve or reject this connection request.

Best regards,
The PaVa-Vak Team
  `;

  const html = `
    <h1>New Connection Request</h1>
    <p><strong>${requesterName}</strong> wants to connect with you on PaVa-Vak!</p>
    <p>Log in to your account to approve or reject this connection request.</p>
    <p>Best regards,<br>The PaVa-Vak Team</p>
  `;

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Send 2FA setup email
 * @param {string} email - User email
 */
async function send2FASetupEmail(email) {
  const subject = 'Two-Factor Authentication Enabled';
  const text = `
Two-factor authentication has been enabled on your PaVa-Vak account.

Your account is now more secure. You'll need to enter a code from your authenticator app each time you log in.

If you didn't enable this, please contact support immediately.

Best regards,
The PaVa-Vak Team
  `;

  const html = `
    <h1>Two-Factor Authentication Enabled</h1>
    <p>Two-factor authentication has been enabled on your PaVa-Vak account.</p>
    <p>Your account is now more secure. You'll need to enter a code from your authenticator app each time you log in.</p>
    <p><strong>If you didn't enable this, please contact support immediately.</strong></p>
    <p>Best regards,<br>The PaVa-Vak Team</p>
  `;

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Verify email configuration
 * @returns {Promise<boolean>} True if email is configured and working
 */
async function verifyEmailConfig() {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return false;
    }
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error('Email configuration error:', error);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendConnectionRequestEmail,
  send2FASetupEmail,
  verifyEmailConfig
};

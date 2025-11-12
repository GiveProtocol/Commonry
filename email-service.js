import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Email Service for sending transactional emails
 * Supports both real SMTP (Gmail, SendGrid, etc.) and Ethereal for testing
 */

// Create reusable transporter
let transporter = null;

async function createTransporter() {
  if (transporter) return transporter;

  // In development, use Ethereal if email credentials not configured
  const isDevMode = process.env.NODE_ENV === 'development';
  const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

  if (isDevMode && !hasEmailConfig) {
    // Create test account with Ethereal
    console.log('⚠️  Email credentials not configured. Creating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // Use STARTTLS instead of implicit TLS
      requireTLS: true, // Require encrypted connection via STARTTLS
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('✅ Using Ethereal test email service');
    console.log(`📧 Test email credentials:`);
    console.log(`   User: ${testAccount.user}`);
    console.log(`   Preview emails at: https://ethereal.email`);
  } else {
    // Use configured SMTP
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465', // Use implicit TLS for port 465
      requireTLS: process.env.EMAIL_PORT !== '465', // Require STARTTLS for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    console.log('✅ Email service configured with SMTP');
  }

  return transporter;
}

/**
 * Get frontend URL with security validation
 */
function getFrontendUrl() {
  const url = process.env.FRONTEND_URL;

  if (!url) {
    console.warn('⚠️  FRONTEND_URL not configured. Using localhost for development only.');
    console.warn('⚠️  This is insecure for production. Set FRONTEND_URL environment variable.');
    return 'http://localhost:5173'; // Development fallback only
  }

  if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
    console.error('❌ SECURITY WARNING: Using http:// in production is insecure!');
    console.error('❌ Please use https:// for FRONTEND_URL in production.');
  }

  return url;
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(email, username, verificationToken) {
  const transporter = await createTransporter();

  const verificationUrl = `${getFrontendUrl()}/verify-email/${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Commonry <noreply@commonry.com>',
    to: email,
    subject: 'Verify Your Email - Commonry',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo h1 {
              color: #2563eb;
              font-size: 28px;
              margin: 0;
            }
            h2 {
              color: #1f2937;
              font-size: 24px;
              margin-bottom: 20px;
            }
            p {
              color: #4b5563;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              padding: 14px 28px;
              background-color: #2563eb;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #1d4ed8;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>COMMONRY</h1>
            </div>

            <h2>Welcome, ${username}! 👋</h2>

            <p>Thanks for signing up for Commonry - your commons for lifelong learning.</p>

            <p>To get started, please verify your email address by clicking the button below:</p>

            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #1f2937; background-color: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 14px;">${verificationUrl}</p>

            <div class="warning">
              <strong>⏰ This link will expire in 24 hours.</strong>
            </div>

            <p>If you didn't create an account with Commonry, you can safely ignore this email.</p>

            <div class="footer">
              <p>Best regards,<br>The Commonry Team</p>
              <p style="font-size: 12px; color: #9ca3af;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to Commonry, ${username}!

Thanks for signing up. Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with Commonry, you can safely ignore this email.

Best regards,
The Commonry Team
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  console.log('✅ Verification email sent:', info.messageId);

  // If using Ethereal, log preview URL
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, username, resetToken) {
  const transporter = await createTransporter();

  const resetUrl = `${getFrontendUrl()}/reset-password/${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Commonry <noreply@commonry.com>',
    to: email,
    subject: 'Password Reset Request - Commonry',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .button {
              display: inline-block;
              padding: 14px 28px;
              background-color: #dc2626;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>COMMONRY</h1>
            <h2>Password Reset Request</h2>
            <p>Hi ${username},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `Password Reset Request\n\nHi ${username},\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Password reset email sent:', info.messageId);

  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
}

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
};

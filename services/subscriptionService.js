
import nodemailer from 'nodemailer';

/**
 * SubscriptionService handles communication with either Mailchimp (via Mandrill SMTP) 
 * or a generic SMTP server for email broadcasts.
 */
class SubscriptionService {
  constructor() {
    const { 
      MAILCHIMP_API_KEY, 
      SMTP_HOST, 
      SMTP_PORT, 
      SMTP_USER, 
      SMTP_PASS, 
      SMTP_SECURE 
    } = process.env;

    this.active = false;

    // 1. If Mailchimp API Key is provided, use Mandrill's SMTP Relay
    if (MAILCHIMP_API_KEY && MAILCHIMP_API_KEY !== 'your_mailchimp_api_key_here') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.mandrillapp.com',
        port: 587,
        secure: false, // Mandrill uses STARTTLS on 587
        auth: {
          user: 'mandrill-user', // Mandrill accepts any string here
          pass: MAILCHIMP_API_KEY,
        },
      });
      this.active = true;
      console.log('[SUBSCRIPTION SERVICE] Initialized using Mailchimp (Mandrill) SMTP Relay.');
    } 
    // 2. Fallback to Custom SMTP if provided
    else if (SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: SMTP_SECURE === 'true',
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      this.active = true;
      console.log('[SUBSCRIPTION SERVICE] Initialized using Custom SMTP.');
    } else {
      console.warn('[SUBSCRIPTION SERVICE] No email provider configured. Emails will be skipped.');
    }
  }

  async sendBroadcast({ fromEmail, fromName, subject, html, recipients }) {
    if (!this.active) {
      console.warn('[SUBSCRIPTION SERVICE] Service inactive. Skipping broadcast.');
      return null;
    }

    const defaultFrom = process.env.SMTP_FROM || fromEmail || 'status@voximplant.com';
    const senderName = fromName || 'Voximplant Status';

    try {
      // SMTP logic using BCC for bulk recipients to protect privacy
      const info = await this.transporter.sendMail({
        from: `"${senderName}" <${defaultFrom}>`,
        to: defaultFrom, // Send to self
        bcc: recipients, // Recipients in BCC
        subject: subject,
        html: html,
      });

      console.log('[SUBSCRIPTION SERVICE] SMTP Broadcast Sent Successfully:', info.messageId);
      return info;
    } catch (error) {
      console.error(`[SUBSCRIPTION SERVICE] SMTP Error:`, error.message);
      throw error;
    }
  }
}

export default SubscriptionService;

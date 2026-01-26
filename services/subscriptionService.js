
import nodemailer from 'nodemailer';

/**
 * SubscriptionService handles communication with the SMTP server for email broadcasts.
 * This ensures broad compatibility and bypasses specific API provider issues.
 */
class SubscriptionService {
  constructor() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

    // Only initialize if we have a host
    if (SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  async sendBroadcast({ fromEmail, fromName, subject, html, recipients }) {
    if (!this.transporter) {
      console.warn('[SUBSCRIPTION SERVICE] SMTP transporter not configured. Skipping broadcast.');
      return null;
    }

    const defaultFrom = process.env.SMTP_FROM || fromEmail;

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName || 'Voximplant Status'}" <${defaultFrom}>`,
        bcc: recipients.join(','), // Use BCC for bulk notifications to hide emails from recipients
        subject: subject,
        html: html,
      });

      console.log('[SUBSCRIPTION SERVICE] SMTP Broadcast Sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('[SUBSCRIPTION SERVICE] SMTP Transport Error:', error);
      throw error;
    }
  }
}

export default SubscriptionService;

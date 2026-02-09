
import nodemailer from 'nodemailer';
import mailchimpFactory from '@mailchimp/mailchimp_transactional';

/**
 * SubscriptionService handles communication with either Mailchimp (Transactional/Mandrill) 
 * or an SMTP server for email broadcasts.
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

    this.mode = 'IDLE';

    // 1. Prefer Mailchimp if API key is provided
    if (MAILCHIMP_API_KEY && MAILCHIMP_API_KEY !== 'your_mailchimp_api_key_here') {
      this.mailchimp = mailchimpFactory(MAILCHIMP_API_KEY);
      this.mode = 'MAILCHIMP';
      console.log('[SUBSCRIPTION SERVICE] Initialized with Mailchimp Transactional.');
    } 
    // 2. Fallback to SMTP if Host is provided
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
      this.mode = 'SMTP';
      console.log('[SUBSCRIPTION SERVICE] Initialized with SMTP.');
    } else {
      console.warn('[SUBSCRIPTION SERVICE] No email provider configured (Mailchimp or SMTP).');
    }
  }

  async sendBroadcast({ fromEmail, fromName, subject, html, recipients }) {
    if (this.mode === 'IDLE') {
      console.warn('[SUBSCRIPTION SERVICE] No email provider active. Skipping broadcast.');
      return null;
    }

    const defaultFrom = process.env.SMTP_FROM || fromEmail || 'status@voximplant.com';
    const senderName = fromName || 'Voximplant Status';

    try {
      if (this.mode === 'MAILCHIMP') {
        const message = {
          from_email: defaultFrom,
          from_name: senderName,
          subject: subject,
          html: html,
          to: recipients.map(email => ({ email, type: 'bcc' })),
        };
        const response = await this.mailchimp.messages.send({ message });
        console.log('[SUBSCRIPTION SERVICE] Mailchimp Broadcast Sent:', response);
        return response;
      } 
      
      if (this.mode === 'SMTP') {
        const info = await this.transporter.sendMail({
          from: `"${senderName}" <${defaultFrom}>`,
          bcc: recipients.join(','),
          subject: subject,
          html: html,
        });
        console.log('[SUBSCRIPTION SERVICE] SMTP Broadcast Sent:', info.messageId);
        return info;
      }
    } catch (error) {
      console.error(`[SUBSCRIPTION SERVICE] ${this.mode} Error:`, error);
      throw error;
    }
  }
}

export default SubscriptionService;

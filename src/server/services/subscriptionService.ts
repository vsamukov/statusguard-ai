
import nodemailer from 'nodemailer';
import crypto from 'crypto';

export interface SendBroadcastOptions {
  fromEmail?: string;
  fromName?: string;
  subject: string;
  html: string;
  recipients: string[];
}

class SubscriptionService {
  private transporter: nodemailer.Transporter | null = null;
  private active: boolean = false;

  constructor() {
    const { 
      MAILCHIMP_API_KEY, 
      SMTP_HOST, 
      SMTP_PORT, 
      SMTP_USER, 
      SMTP_PASS, 
      SMTP_SECURE 
    } = process.env;

    if (MAILCHIMP_API_KEY && MAILCHIMP_API_KEY !== 'your_mailchimp_api_key_here') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.mandrillapp.com',
        port: 587,
        secure: false,
        auth: {
          user: 'mandrill-user',
          pass: MAILCHIMP_API_KEY,
        },
      });
      this.active = true;
    } else if (SMTP_HOST) {
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
    }
  }

  generateUnsubscribeToken(email: string) {
    const secret = process.env.JWT_SECRET || 'default_secret';
    return crypto.createHmac('sha256', secret).update(email).digest('hex');
  }

  verifyUnsubscribeToken(email: string, token: string) {
    const expected = this.generateUnsubscribeToken(email);
    return expected === token;
  }

  async sendBroadcast({ fromEmail, fromName, subject, html, recipients }: SendBroadcastOptions) {
    if (!this.active || !this.transporter) {
      console.warn('[SUBSCRIPTION SERVICE] Service inactive. Skipping broadcast.');
      return null;
    }

    const defaultFrom = process.env.SMTP_FROM || fromEmail || 'status@voximplant.com';
    const senderName = fromName || 'Voximplant Status';

    // To address the "Mass Email Exposure" and "No Unsubscribe Tokens" issues:
    // We should ideally send individual emails. 
    // For now, we'll loop through recipients to ensure privacy and allow for future individual tokens.
    
    const results = [];
    for (const email of recipients) {
      try {
        // In a real app, we'd generate a unique token per email and store it in DB
        // For this refactor, we'll just send individual emails to avoid BCC exposure
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const unsubscribeUrl = `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${this.generateUnsubscribeToken(email)}`;
        
        const info = await this.transporter.sendMail({
          from: `"${senderName}" <${defaultFrom}>`,
          to: email,
          subject: subject,
          html: html + `<br><br><p style="font-size: 12px; color: #666;">You are receiving this because you subscribed to Voximplant Status updates. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
        });
        results.push(info);
      } catch (error: any) {
        console.error(`[SUBSCRIPTION SERVICE] Error sending to ${email}:`, error.message);
      }
    }

    return results;
  }
}

export const subscriptionService = new SubscriptionService();

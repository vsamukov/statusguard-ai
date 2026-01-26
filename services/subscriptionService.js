
import mailchimpTransactional from '@mailchimp/mailchimp_transactional';

/**
 * SubscriptionService handles communication with the Mailchimp Transactional API.
 * This encapsulates the SDK usage to ensure correct headers and payload formatting.
 */
class SubscriptionService {
  constructor(apiKey) {
    this.client = apiKey ? mailchimpTransactional(apiKey) : null;
  }

  async sendBroadcast({ fromEmail, fromName, subject, html, recipients }) {
    if (!this.client) {
      console.warn('[SUBSCRIPTION SERVICE] Mailchimp client not initialized. Skipping broadcast.');
      return null;
    }

    try {
      const message = {
        from_email: fromEmail,
        from_name: fromName || 'Voximplant Status',
        subject: subject,
        html: html,
        to: recipients.map(email => ({ email, type: 'to' })),
      };

      const response = await this.client.messages.send({ message });
      
      // The SDK returns an array of status objects for each recipient
      if (response && Array.isArray(response)) {
        const rejected = response.filter(r => r.status === 'rejected' || r.status === 'invalid');
        if (rejected.length > 0) {
          console.warn(`[SUBSCRIPTION SERVICE] Some emails failed: ${rejected.length}/${response.length}`);
        }
      }
      
      return response;
    } catch (error) {
      console.error('[SUBSCRIPTION SERVICE] Mandrill SDK Error:', error);
      throw error;
    }
  }
}

export default SubscriptionService;

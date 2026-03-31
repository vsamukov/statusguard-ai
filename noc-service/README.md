# Voximplant NOC Service

Standalone service for monitoring open incidents and notifying NOC by email.

## Configuration

1. Copy `.env.example` to `.env` in this folder.
2. Fill in the required variables:
   - `DATABASE_URL`: Connection string for the main application database.
   - `NOC_EMAIL`: Email address to receive alerts.
   - `NOTIFY_THRESHOLD`: Number of hours an incident must be open before alerting.
   - `MAILCHIMP_API_KEY`: Mandrill/Mailchimp API key for email transport.
   - `SMTP_FROM`: Sender email address.

## Usage

### One-time check (for Cron)

To run a single check and exit:
```bash
npm start
```

Example Cron job (every hour):
```
0 * * * * cd /path/to/noc-service && /usr/bin/npm start >> /var/log/noc-service.log 2>&1
```

### Daemon mode

To run as a persistent daemon with internal timer:
```bash
npm start -- --daemon
```

In daemon mode, it will check for incidents every `NOTIFY_THRESHOLD` hours (minimum 10 minutes).

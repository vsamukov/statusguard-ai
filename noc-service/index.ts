
import 'dotenv/config';
import pg from 'pg';
import nodemailer from 'nodemailer';

const { 
  DATABASE_URL, 
  NOC_EMAIL, 
  NOTIFY_THRESHOLD,
  MAILCHIMP_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  SMTP_FROM
} = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function createTransporter() {
  if (MAILCHIMP_API_KEY && MAILCHIMP_API_KEY !== 'your_mailchimp_api_key_here') {
    return nodemailer.createTransport({
      host: 'smtp.mandrillapp.com',
      port: 587,
      secure: false,
      auth: {
        user: 'mandrill-user',
        pass: MAILCHIMP_API_KEY,
      },
    });
  } else if (SMTP_HOST) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return null;
}

async function checkOpenIncidentsAndNotifyNOC() {
  if (!NOC_EMAIL || !NOTIFY_THRESHOLD) {
    console.log('NOC_EMAIL or NOTIFY_THRESHOLD not configured. Skipping.');
    return;
  }

  const thresholdHours = parseFloat(NOTIFY_THRESHOLD);
  if (isNaN(thresholdHours) || thresholdHours <= 0) {
    console.log('Invalid NOTIFY_THRESHOLD. Skipping.');
    return;
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('No mail transport configured. Skipping.');
    return;
  }

  try {
    console.log(`[NOC SERVICE] Checking for open incidents older than ${thresholdHours}h...`);
    
    const query = `
      SELECT i.*, 
             (SELECT json_agg(json_build_object('name', c.name, 'region', r.name))
              FROM incident_affected_components iac
              JOIN components c ON iac.component_id = c.id
              JOIN regions r ON c.region_id = r.id
              WHERE iac.incident_id = i.id) as affected_components
      FROM incidents i
      WHERE i.end_time IS NULL
        AND i.start_time <= NOW() - (INTERVAL '1 hour' * $1)
        AND (i.last_noc_notified_at IS NULL OR i.last_noc_notified_at <= NOW() - (INTERVAL '1 hour' * $1))
    `;
    
    const { rows: openIncidents } = await pool.query(query, [thresholdHours]);

    if (openIncidents.length === 0) {
      console.log('[NOC SERVICE] No incidents requiring notification.');
      return;
    }

    const fromEmail = SMTP_FROM || 'status@voximplant.com';

    for (const incident of openIncidents) {
      const affectedInfo = (incident.affected_components || [])
        .map((c: any) => `${c.name} (${c.region})`)
        .join(', ');

      const subject = `[NOC ALERT] Incident open for >${thresholdHours}h: ${incident.title}`;
      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ef4444; border-radius: 8px;">
          <h2 style="color: #ef4444;">NOC Alert: Long-standing Incident</h2>
          <p><strong>Title:</strong> ${incident.title}</p>
          <p><strong>Severity:</strong> ${incident.severity}</p>
          <p><strong>Started:</strong> ${new Date(incident.start_time).toLocaleString()}</p>
          <p><strong>Affected:</strong> ${affectedInfo}</p>
          <p><strong>Description:</strong> ${incident.description}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">This is a repeated alert for an open incident that has exceeded the notification threshold of ${thresholdHours} hours.</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"Voximplant Status" <${fromEmail}>`,
        to: NOC_EMAIL,
        subject,
        html,
      });

      await pool.query('UPDATE incidents SET last_noc_notified_at = NOW() WHERE id = $1', [incident.id]);
      console.log(`[NOC SERVICE] Alert sent for incident ${incident.id}`);
    }
  } catch (err) {
    console.error('[NOC SERVICE ERROR]', err);
  }
}

async function run() {
  const isDaemon = process.argv.includes('--daemon');
  
  if (isDaemon) {
    console.log('[NOC SERVICE] Running in daemon mode.');
    const thresholdHours = parseFloat(NOTIFY_THRESHOLD || '2');
    const intervalMs = Math.max(10 * 60 * 1000, thresholdHours * 60 * 60 * 1000);
    
    setInterval(checkOpenIncidentsAndNotifyNOC, intervalMs);
    checkOpenIncidentsAndNotifyNOC();
  } else {
    console.log('[NOC SERVICE] Running one-time check.');
    await checkOpenIncidentsAndNotifyNOC();
    await pool.end();
    process.exit(0);
  }
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

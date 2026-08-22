import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.SMTP_USER_NAME,
        pass: env.SMTP_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendMail({ to, fromName, subject, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;

  if (!env.SMTP_USER_NAME || !env.SMTP_APP_PASSWORD) {
    console.error(`Email "${subject}" not sent — SMTP credentials are not configured.`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${env.SMTP_USER_NAME}>`,
      to: recipients.join(', '),
      cc: env.CC_EMAILS.length > 0 ? env.CC_EMAILS.join(', ') : undefined,
      subject,
      html,
    });
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${recipients.join(', ')}:`, err.message);
  }
}

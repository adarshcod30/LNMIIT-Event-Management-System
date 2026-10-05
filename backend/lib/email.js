// ================================================================
// lib/email.js: Email Notification Service
// ================================================================
// Sends emails using Nodemailer with LNMIIT branding.
// Falls back gracefully if email credentials are not configured.
// ================================================================

const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS &&
      !process.env.EMAIL_USER.includes('your_email')) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    return transporter;
  }

  return null;
}

/**
 * Send an email with LNMIIT branding.
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional, auto-generated if not provided)
 */
async function sendEmail({ to, subject, text, html }) {
  const emailTransporter = getTransporter();

  if (!emailTransporter) {
    console.log(` Email would be sent to ${to}: ${subject}`);
    console.log(`   (Email not configured, skipping actual send)`);
    return { success: true, simulated: true };
  }

  const htmlBody = html || generateEmailTemplate(subject, text);

  try {
    await emailTransporter.sendMail({
      from: `"LNMIIT Event Hub" <${process.env.EMAIL_USER}>`,
      to,
      subject: `[LNMIIT Event Hub] ${subject}`,
      text,
      html: htmlBody,
    });
    return { success: true };
  } catch (error) {
    console.error(` Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a branded HTML email template.
 */
function generateEmailTemplate(title, content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr>
          <td style="background: linear-gradient(135deg, #1a237e 0%, #283593 100%); padding: 24px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">
               LNMIIT Event Hub
            </h1>
            <p style="color: #bbdefb; margin: 4px 0 0; font-size: 13px;">
              The LNM Institute of Information Technology, Jaipur
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <h2 style="color: #1a237e; margin: 0 0 16px; font-size: 20px;">${title}</h2>
            <div style="color: #424242; font-size: 15px; line-height: 1.6;">
              ${content.replace(/\n/g, '<br>')}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background: #f5f5f5; padding: 16px 32px; text-align: center; font-size: 12px; color: #757575;">
            <p style="margin: 0;">This is an automated email from LNMIIT Event Hub.</p>
            <p style="margin: 4px 0 0;">The LNM Institute of Information Technology, Jaipur, Rajasthan</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

module.exports = { sendEmail };

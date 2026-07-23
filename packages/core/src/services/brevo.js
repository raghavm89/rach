'use strict';

/**
 * Brevo Transactional Email service
 * Uses Brevo's v3 REST API (no extra package required — uses global fetch / node 18+).
 *
 * Required env vars:
 *   BREVO_API_KEY       — Brevo API key (Settings → API Keys)
 *   BREVO_FROM_EMAIL    — verified sender address in Brevo (e.g. noreply@rach.dev)
 *   BREVO_FROM_NAME     — sender display name (e.g. Rach Dev LLP)
 *   APP_URL             — public frontend URL (e.g. https://app.rach.dev)
 */

const API_URL    = 'https://api.brevo.com/v3/smtp/email';
const API_KEY    = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'noreply@rach.dev';
const FROM_NAME  = process.env.BREVO_FROM_NAME  || 'Rach Dev LLP';
const APP_URL    = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');

// ── Core send ─────────────────────────────────────────────────────────────────

/**
 * Low-level send.
 * @param {object}   opts
 * @param {{email:string,name?:string}[]} opts.to
 * @param {string}   opts.subject
 * @param {string}   opts.htmlContent
 * @param {string}   [opts.textContent]
 * @param {{name:string, content:Buffer|string}[]} [opts.attachments]
 *        Binary attachments; Buffers are base64-encoded for Brevo's API.
 */
async function sendEmail({ to, subject, htmlContent, textContent, attachments }) {
  if (!API_KEY) {
    console.warn('[brevo] BREVO_API_KEY not set — email skipped (logged below)');
    console.warn(`  To: ${to.map(r => r.email).join(', ')}  |  Subject: ${subject}`);
    return false;
  }

  const body = {
    sender      : { name: FROM_NAME, email: FROM_EMAIL },
    to,
    subject,
    htmlContent,
    textContent,
    // Disable tracking pixels — they trigger spam filters and have no alt attribute
    trackOpens  : false,
    trackClicks : false,
  };

  if (Array.isArray(attachments) && attachments.length) {
    body.attachment = attachments.map((a) => ({
      name   : a.name,
      content: Buffer.isBuffer(a.content)
        ? a.content.toString('base64')
        : Buffer.from(a.content).toString('base64'),
    }));
  }

  try {
    const res = await fetch(API_URL, {
      method : 'POST',
      headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[brevo] send failed:', res.status, err);
      return false;
    }

    console.log(`[brevo] sent "${subject}" → ${to}`);
    return true;
  } catch (err) {
    console.error('[brevo] network error:', err.message);
    return false;
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

/**
 * Sends a 6-digit OTP to a newly registered user for email verification.
 * @param {{ toEmail: string, toName: string, otp: string }} opts
 */
async function sendVerificationOtp({ toEmail, toName, otp }) {
  const digits = otp.split('');

  const digitCells = digits.map(d => `
    <td style="padding:0 4px;">
      <div style="width:44px;height:56px;border-radius:10px;
                  background:linear-gradient(135deg,#eff6ff,#f5f3ff);
                  border:2px solid #e0e7ff;
                  font-size:28px;font-weight:800;color:#1e40af;
                  text-align:center;line-height:56px;
                  font-family:ui-monospace,SFMono-Regular,monospace;">
        ${d}
      </div>
    </td>`).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-.5px;">
              Rach Dev LLP
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;">
              Verify your email address
            </h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">
              Hi ${toName},
            </p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">
              Thanks for signing up! Enter the code below to activate your account.
            </p>

            <!-- OTP digit boxes -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding-bottom:24px;">
                <table cellpadding="0" cellspacing="0"><tr>${digitCells}</tr></table>
              </td></tr>
            </table>

            <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Rach Dev LLP · All rights reserved
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent =
    `Hi ${toName},\n\n` +
    `Thanks for signing up with Rach Dev LLP!\n\n` +
    `Your email verification code is:\n\n  ${otp}\n\n` +
    `This code expires in 10 minutes.\n\n` +
    `If you didn't create an account, ignore this email.\n\n` +
    `— Rach Dev LLP Team`;

  return sendEmail({
    to: [{ email: toEmail, name: toName }],
    subject: `${otp} is your Rach Dev LLP verification code`,
    htmlContent,
    textContent,
  });
}

// ── Alert email ───────────────────────────────────────────────────────────────

/**
 * Sends a VM resource alert email to one or more recipients.
 * @param {{ recipients: string[], subject: string, htmlContent: string }} opts
 * recipients — plain email address strings (names are omitted for alert emails)
 */
async function sendAlertEmail({ recipients, subject, htmlContent }) {
  if (!recipients.length) return false;
  return sendEmail({
    to: recipients.map(email => ({ email })),
    subject,
    htmlContent,
  });
}

/**
 * Sends a password reset link to the user.
 * @param {{ toEmail: string, toName: string, resetUrl: string }} opts
 */
async function sendPasswordResetEmail({ toEmail, toName, resetUrl }) {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-.5px;">
              Rach Dev LLP
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;">
              Reset your password
            </h2>
            <p style="margin:0 0 8px;color:#4b5563;font-size:15px;line-height:1.6;">Hi ${toName},</p>
            <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.6;">
              We received a request to reset your password. Click the button below to choose a new one.
              This link expires in <strong>30 minutes</strong>.
            </p>

            <!-- CTA button -->
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="padding-bottom:28px;">
                <a href="${resetUrl}"
                   style="display:inline-block;padding:14px 32px;border-radius:10px;
                          background:linear-gradient(135deg,#2563eb,#7c3aed);
                          color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;
                          letter-spacing:-.2px;">
                  Reset Password
                </a>
              </td></tr>
            </table>

            <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
              Or copy this link into your browser:
            </p>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;text-align:center;word-break:break-all;">
              ${resetUrl}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Rach Dev LLP · All rights reserved
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent =
    `Hi ${toName},\n\n` +
    `We received a request to reset your Rach Dev LLP password.\n\n` +
    `Reset your password here:\n${resetUrl}\n\n` +
    `This link expires in 30 minutes.\n\n` +
    `If you didn't request this, you can safely ignore this email.\n\n` +
    `— Rach Dev LLP Team`;

  return sendEmail({
    to: [{ email: toEmail, name: toName }],
    subject: 'Reset your Rach Dev LLP password',
    htmlContent,
    textContent,
  });
}


/**
 * Sends a contact form submission to sales@rachdev.com.
 * @param {{ firstName: string, lastName: string, email: string, company?: string, subject: string, message: string }} opts
 */
async function sendContactEmail({ firstName, lastName, email, company, subject, message }) {
  const subjectLabels = {
    general: 'General Inquiry',
    pricing: 'Pricing Question',
    migration: 'Migration Help',
    'custom-development': 'Custom Development',
    partnership: 'Partnership',
  };
  const subjectLabel = subjectLabels[subject] || subject;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">New Contact Form Submission</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['Name',    `${firstName} ${lastName}`],
                ['Email',   `<a href="mailto:${email}" style="color:#2563eb;">${email}</a>`],
                ['Company', company || '—'],
                ['Subject', subjectLabel],
              ].map(([label, value]) => `
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;width:100px;">
                  <span style="font-size:13px;font-weight:600;color:#6b7280;">${label}</span>
                </td>
                <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;">
                  <span style="font-size:14px;color:#111827;">${value}</span>
                </td>
              </tr>`).join('')}
            </table>

            <div style="margin-top:24px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;">MESSAGE</p>
              <div style="background:#f9fafb;border-radius:10px;padding:16px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${message}</div>
            </div>

            <div style="margin-top:24px;">
              <a href="mailto:${email}?subject=Re: ${subjectLabel}"
                 style="display:inline-block;padding:12px 28px;border-radius:10px;
                        background:linear-gradient(135deg,#2563eb,#7c3aed);
                        color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                Reply to ${firstName}
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Rach Dev LLP · Sent from rachdev.com contact form
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent =
    `New contact form submission\n\n` +
    `Name: ${firstName} ${lastName}\n` +
    `Email: ${email}\n` +
    `Company: ${company || '—'}\n` +
    `Subject: ${subjectLabel}\n\n` +
    `Message:\n${message}`;

  return sendEmail({
    to: [{ email: 'sales@rachdev.com', name: 'Rach Dev Sales' }],
    subject: `[Contact] ${subjectLabel} — ${firstName} ${lastName}`,
    htmlContent,
    textContent,
  });
}

/**
 * Sends a subscription invoice email to the customer and to raghav@rachdev.com.
 * @param {{ orderId, customerName, customerEmail, description, items, amountPaid, currency, subscriptionId, requestedAt }} opts
 */
async function sendInvoiceEmail({ orderId, customerName, customerEmail, description, items, amountPaid, currency, subscriptionId, requestedAt }) {
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', minimumFractionDigits: 2 });
  const amountDisplay = fmt.format((amountPaid || 0) / 100);
  const dateDisplay   = new Date(requestedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const itemRows = Array.isArray(items) && items.length
    ? items.map(item => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
            ${item.name || item.id}${item.qty > 1 ? ` × ${item.qty}` : ''}
          </td>
          <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;font-family:monospace;">
            ${amountDisplay}
          </td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px 16px;font-size:14px;color:#374151;">${description}</td></tr>`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;">
            <table width="100%"><tr>
              <td>
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px;">Rach Dev LLP</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">Tax Invoice / Receipt</p>
              </td>
              <td style="text-align:right;">
                <p style="margin:0;color:rgba(255,255,255,.85);font-size:13px;">Invoice #${orderId}</p>
                <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:12px;">${dateDisplay}</p>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Bill to -->
        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;">Billed To</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${customerName}</p>
            <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${customerEmail}</p>
          </td>
        </tr>

        <!-- Items table -->
        <tr>
          <td style="padding:24px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:.5px;">Description</th>
                  <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
              <tfoot>
                <tr style="background:#f9fafb;border-top:2px solid #e5e7eb;">
                  <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#111827;">Total (Monthly)</td>
                  <td style="padding:12px 16px;font-size:16px;font-weight:800;color:#2563eb;text-align:right;font-family:monospace;">${amountDisplay}/mo</td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>

        <!-- Subscription info -->
        <tr>
          <td style="padding:20px 40px 0;">
            <div style="background:#eff6ff;border-radius:10px;padding:14px 16px;border:1px solid #dbeafe;">
              <p style="margin:0;font-size:13px;color:#1e40af;">
                <strong>Subscription active</strong> — auto-renews monthly. Cancel anytime from your Orders page.
              </p>
              ${subscriptionId ? `<p style="margin:6px 0 0;font-size:11px;color:#6b7280;font-family:monospace;">Subscription ID: ${subscriptionId}</p>` : ''}
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;margin-top:28px;text-align:center;">
            <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">
              Questions? Reply to this email or contact <a href="mailto:support@rachdev.com" style="color:#2563eb;">support@rachdev.com</a>
            </p>
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} Rach Dev LLP · All rights reserved
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent =
    `Invoice #${orderId} — Rach Dev LLP\n` +
    `Date: ${dateDisplay}\n\n` +
    `Billed to: ${customerName} (${customerEmail})\n\n` +
    `${description}\n` +
    `Total: ${amountDisplay}/mo\n\n` +
    (subscriptionId ? `Subscription ID: ${subscriptionId}\n\n` : '') +
    `Your subscription is active and will auto-renew monthly.\n` +
    `Questions? Contact support@rachdev.com\n\n` +
    `— Rach Dev LLP Team`;

  return sendEmail({
    to: [
      { email: customerEmail, name: customerName },
      { email: 'raghav@rachdev.com', name: 'Raghav — Rach Dev' },
    ],
    subject: `Invoice #${orderId} — ${description} · ${amountDisplay}/mo`,
    htmlContent,
    textContent,
  });
}

/**
 * Internal order notification → raghav@rachdev.com.
 * Sent once an order is completed. Lists the ordered items + quantities, who
 * placed it (name + email), and when.
 *
 * @param {object} opts
 * @param {number|string} opts.orderId
 * @param {{ name: string, qty: number }[]} opts.items
 * @param {string} opts.customerName
 * @param {string} opts.customerEmail
 * @param {string|Date} opts.placedAt
 * @param {number} [opts.amount]     total in minor units (cents/paise)
 * @param {string} [opts.currency]
 */
async function sendOrderNotificationEmail({ orderId, items, customerName, customerEmail, placedAt, amount, currency }) {
  const when = new Date(placedAt || Date.now()).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const amountDisplay = (amount != null && Number.isFinite(Number(amount)))
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', minimumFractionDigits: 2 }).format(Number(amount) / 100)
    : null;

  const list = (Array.isArray(items) && items.length ? items : [{ name: '—', qty: 1 }]);
  const itemRows = list.map((it) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">${escapeHtml(it.name)}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;text-align:right;font-family:monospace;width:80px;">× ${Number(it.qty) || 1}</td>
    </tr>`).join('');

  const htmlContent = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">New Order Completed</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px;">Order #${orderId}</p>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;width:110px;">Placed by</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(customerName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Email</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(customerEmail)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#6b7280;">Placed at</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(when)}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 32px 0;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;">Order Items</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <thead><tr style="background:#f9fafb;">
              <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Item</th>
              <th style="padding:8px 16px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Qty</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            ${amountDisplay ? `<tfoot><tr style="background:#f9fafb;border-top:2px solid #e5e7eb;">
              <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#111827;">Total</td>
              <td style="padding:10px 16px;font-size:14px;font-weight:800;color:#2563eb;text-align:right;font-family:monospace;">${amountDisplay}</td>
            </tr></tfoot>` : ''}
          </table>
        </td></tr>

        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from RachBase billing.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const textContent =
    `New order #${orderId} completed\n\n` +
    `Placed by: ${customerName} (${customerEmail})\n` +
    `Placed at: ${when}\n\n` +
    `Items:\n` + list.map((i) => `  - ${Number(i.qty) || 1}× ${i.name}`).join('\n') +
    (amountDisplay ? `\n\nTotal: ${amountDisplay}` : '');

  return sendEmail({
    to: [{ email: 'raghav@rachdev.com', name: 'Raghav — Rach Dev' }],
    subject: `New order #${orderId} — ${customerName}`,
    htmlContent,
    textContent,
  });
}

// ── Tax invoice ───────────────────────────────────────────────────────────────

/**
 * Sends the issued invoice with its PDF attached.
 *
 * Distinct from `sendInvoiceEmail` above, which is an order-confirmation
 * receipt and not a tax document. (Note: that older template has a display bug —
 * it renders the order total against every line item instead of the line's own
 * price. This function renders from the invoice's real line rows.)
 *
 * @param {object} opts
 * @param {object} opts.invoice   invoices row
 * @param {Array}  opts.lines     invoice_line_items rows
 * @param {Buffer} opts.pdfBuffer rendered PDF
 * @param {string} opts.filename
 */
async function sendTaxInvoiceEmail({ invoice, lines, pdfBuffer, filename }) {
  const buyer  = typeof invoice.buyer_json === 'string' ? JSON.parse(invoice.buyer_json) : invoice.buyer_json;
  const seller = typeof invoice.seller_json === 'string' ? JSON.parse(invoice.seller_json) : invoice.seller_json;

  const cur    = invoice.currency;
  const locale = cur === 'INR' ? 'en-IN' : 'en-US';
  const fmt = (minor) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: cur, minimumFractionDigits: 2,
  }).format(Number(minor) / 100);

  const isTaxInvoice = Number(invoice.tax_total_minor) > 0;
  const heading = isTaxInvoice ? 'Tax Invoice' : 'Invoice';

  const rows = (lines || []).map((l) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;">
        ${escapeHtml(l.description)}${l.quantity > 1 ? ` × ${l.quantity}` : ''}
      </td>
      <td style="padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151;text-align:right;font-family:monospace;">
        ${fmt(l.total_minor)}
      </td>
    </tr>`).join('');

  // Aggregate tax components across lines (CGST/SGST/IGST/state tax).
  const components = new Map();
  for (const l of lines || []) {
    const bd = typeof l.tax_breakdown === 'string' ? JSON.parse(l.tax_breakdown) : (l.tax_breakdown || []);
    for (const b of bd) {
      components.set(b.name, (components.get(b.name) ?? 0) + Number(b.amount_minor));
    }
  }

  const taxRows = [...components.entries()].map(([name, amount]) => `
    <tr>
      <td style="padding:4px 16px;font-size:13px;color:#6b7280;text-align:right;">${escapeHtml(name)}</td>
      <td style="padding:4px 16px;font-size:13px;color:#374151;text-align:right;font-family:monospace;width:120px;">${fmt(amount)}</td>
    </tr>`).join('');

  const htmlContent = `
<!doctype html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${escapeHtml(seller?.legal_name || 'Rach Dev LLP')}</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">${heading}</p>
        </td></tr>

        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0;font-size:15px;color:#111827;">Hi ${escapeHtml(buyer?.name || 'there')},</p>
          <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
            Your ${heading.toLowerCase()} <strong style="color:#111827;">${escapeHtml(invoice.invoice_number)}</strong>
            is attached as a PDF and is also available in your billing dashboard.
          </p>
        </td></tr>

        <tr><td style="padding:16px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>

        <tr><td style="padding:8px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 16px;font-size:13px;color:#6b7280;text-align:right;">Subtotal</td>
              <td style="padding:4px 16px;font-size:13px;color:#374151;text-align:right;font-family:monospace;width:120px;">${fmt(invoice.subtotal_minor)}</td>
            </tr>
            ${taxRows}
            <tr>
              <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#111827;text-align:right;border-top:1px solid #e5e7eb;">Total</td>
              <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#111827;text-align:right;font-family:monospace;border-top:1px solid #e5e7eb;">${fmt(invoice.total_minor)}</td>
            </tr>
          </table>
        </td></tr>

        ${invoice.place_of_supply ? `
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Place of supply: ${escapeHtml(invoice.place_of_supply)}</p>
        </td></tr>` : ''}

        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            This is a computer-generated invoice and does not require a signature.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendEmail({
    to: [{ email: buyer?.email, name: buyer?.name || undefined }],
    subject: `${heading} ${invoice.invoice_number} — ${fmt(invoice.total_minor)}`,
    htmlContent,
    textContent:
      `${heading} ${invoice.invoice_number}\n` +
      `Total: ${fmt(invoice.total_minor)}\n` +
      `The PDF is attached.`,
    attachments: pdfBuffer ? [{ name: filename || 'invoice.pdf', content: pdfBuffer }] : undefined,
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = {
  sendVerificationOtp,
  sendAlertEmail,
  sendPasswordResetEmail,
  sendContactEmail,
  sendInvoiceEmail,
  sendOrderNotificationEmail,
  sendTaxInvoiceEmail,
};

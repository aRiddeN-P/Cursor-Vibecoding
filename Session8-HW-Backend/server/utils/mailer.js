/**
 * mailer.js
 * Sends transactional emails (OTP codes) using Nodemailer with SMTP from .env.
 *
 * Dev-friendly behavior:
 *  - The OTP code is ALWAYS printed to the server console in a clear banner,
 *    so during local development you can copy the code from the terminal even
 *    if SMTP is not configured yet.
 *  - If SMTP is not configured (placeholder values from .env.example), the
 *    mailer silently skips sending and returns { sent:false, reason:'smtp-not-configured' }.
 *  - If SMTP is configured but the send fails, the error is logged and the
 *    mailer returns { sent:false, reason:'smtp-error', error }.
 *  - The controller treats both cases as success for the API response, since
 *    the developer can still read the code from the console.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
} = process.env;

function isSmtpConfigured() {
  return Boolean(
    SMTP_HOST &&
      SMTP_USER &&
      SMTP_PASS &&
      SMTP_USER !== 'your@gmail.com' &&
      SMTP_PASS !== 'your_app_password'
  );
}

let transporter = null;
if (isSmtpConfigured()) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildOtpHtml(code, type) {
  const title =
    type === 'signup'
      ? 'کد تایید ثبت‌نام در دخلیار'
      : 'کد بازیابی رمز عبور دخلیار';

  const intro =
    type === 'signup'
      ? 'برای تکمیل فرآیند ثبت‌نام در دخلیار، کد زیر را وارد کنید:'
      : 'برای بازیابی رمز عبور حساب کاربری خود در دخلیار، کد زیر را وارد کنید:';

  return `
  <!doctype html>
  <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#F3F7F4;font-family:Tahoma,Arial,sans-serif;direction:rtl;">
      <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(13,46,30,0.08);">
        <div style="background:linear-gradient(135deg,#1A5C3A,#0D2E1E);padding:24px;color:#ffffff;text-align:center;">
          <h1 style="margin:0;font-size:22px;">دخلیار <span style="color:#F0B429;">•</span></h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">${title}</p>
        </div>
        <div style="padding:28px;color:#0D2E1E;line-height:1.9;">
          <p style="font-size:15px;">${intro}</p>
          <div style="margin:24px 0;text-align:center;">
            <span style="display:inline-block;font-size:34px;letter-spacing:14px;font-weight:bold;color:#1A5C3A;background:#ECFDF5;padding:14px 22px;border-radius:10px;direction:ltr;border:1px solid #d6e2db;">${code}</span>
          </div>
          <p style="font-size:13px;color:#5b6b62;">این کد به مدت <strong>۳ دقیقه</strong> معتبر است. در صورتی که این درخواست از سمت شما نبوده است، این ایمیل را نادیده بگیرید.</p>
        </div>
        <div style="background:#fafafa;padding:14px;text-align:center;color:#888;font-size:12px;">
          © دخلیار — مدیریت مالی شخصی
        </div>
      </div>
    </body>
  </html>
  `;
}

function logCodeToConsole(to, code, type, note) {
  const line = '━'.repeat(60);
  const label = type === 'signup' ? 'SIGNUP' : 'RESET PASSWORD';
  console.log('\n' + line);
  console.log(`📧  OTP CODE (${label})`);
  console.log(`    to:   ${to}`);
  console.log(`    code: ${code}`);
  if (note) console.log(`    note: ${note}`);
  console.log(line + '\n');
}

async function sendOtpEmail(to, code, type) {
  const subject =
    type === 'signup'
      ? 'کد تایید ثبت‌نام در دخلیار'
      : 'کد بازیابی رمز عبور دخلیار';

  if (!isSmtpConfigured()) {
    logCodeToConsole(
      to,
      code,
      type,
      'SMTP در .env تنظیم نشده — این کد را از همین ترمینال در صفحه وارد کنید.'
    );
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL || `Dakhlyar <${SMTP_USER}>`,
      to,
      subject,
      text: `کد تایید شما: ${code}\nاین کد به مدت ۳ دقیقه معتبر است.`,
      html: buildOtpHtml(code, type),
    });
    logCodeToConsole(to, code, type, `ایمیل ارسال شد (messageId=${info.messageId})`);
    return { sent: true, info };
  } catch (err) {
    logCodeToConsole(
      to,
      code,
      type,
      `ارسال ایمیل ناموفق بود: ${err.message} — کد را از همین ترمینال در فرم وارد کنید.`
    );
    console.error('[mailer] SMTP error:', err);
    return { sent: false, reason: 'smtp-error', error: err };
  }
}

module.exports = {
  transporter,
  sendOtpEmail,
  isSmtpConfigured,
};

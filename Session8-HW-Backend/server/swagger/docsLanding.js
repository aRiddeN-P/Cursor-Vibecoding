'use strict';

/**
 * Serves the Swagger docs landing page at GET /api/docs
 */
function docsLanding(_req, res) {
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>دخلیار — مستندات API</title>
  <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Vazirmatn', system-ui, sans-serif;
      margin: 0; min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #e2e8f0; padding: 32px 20px;
    }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin: 0 0 8px; color: #fff; }
    .sub { color: #94a3b8; margin-bottom: 32px; line-height: 1.7; }
    h2 { font-size: 1.1rem; color: #cbd5e1; margin: 28px 0 12px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    a.card {
      display: block; padding: 18px 20px; border-radius: 12px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: #f8fafc; text-decoration: none; transition: all .15s;
    }
    a.card:hover { background: rgba(255,255,255,0.12); border-color: #38bdf8; transform: translateY(-1px); }
    .card-title { font-weight: 700; font-size: 1rem; margin-bottom: 6px; }
    .card-desc { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
    .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; margin-left: 6px; vertical-align: middle; }
    .fa { background: #065f46; color: #6ee7b7; }
    .en { background: #1e3a8a; color: #93c5fd; }
    footer { margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>دخلیار — مستندات API</h1>
    <p class="sub">
      مستندات OpenAPI به دو بخش <strong>اپ کاربر</strong> و <strong>پنل ادمین</strong> تقسیم شده و به زبان فارسی و انگلیسی در دسترس است.
      <br/>Dakhlyar API docs are split into <strong>App</strong> and <strong>Admin Panel</strong>, available in Persian and English.
    </p>

    <h2>اپ کاربر / User App</h2>
    <div class="grid">
      <a class="card" href="/api/docs/fa/app">
        <div class="card-title"><span class="badge fa">FA</span> مستندات API اپ</div>
        <div class="card-desc">احراز هویت، تراکنش‌ها، گزارشات، دارایی‌ها، دنگ و دونگ و …</div>
      </a>
      <a class="card" href="/api/docs/en/app">
        <div class="card-title"><span class="badge en">EN</span> App API Docs</div>
        <div class="card-desc">Auth, transactions, reports, assets, split bills, and more.</div>
      </a>
    </div>

    <h2>پنل ادمین / Admin Panel</h2>
    <div class="grid">
      <a class="card" href="/api/docs/fa/admin">
        <div class="card-title"><span class="badge fa">FA</span> مستندات API ادمین</div>
        <div class="card-desc">مدیریت کاربران، محتوا، پیام‌رسانی، آمار و …</div>
      </a>
      <a class="card" href="/api/docs/en/admin">
        <div class="card-title"><span class="badge en">EN</span> Admin API Docs</div>
        <div class="card-desc">User management, content, messaging, analytics, and more.</div>
      </a>
    </div>

    <footer>Dakhlyar · OpenAPI 3.0 · localhost:3000</footer>
  </div>
</body>
</html>`;
  res.type('html').send(html);
}

module.exports = { docsLanding };

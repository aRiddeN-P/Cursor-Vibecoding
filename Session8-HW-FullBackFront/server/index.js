/**
 * server/index.js
 * Entry point for the Dakhlyar (دخلیار) backend.
 * Serves the user-facing API, static frontend, and Swagger docs.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');

require('./db/appDb');
require('./db/adminDb');

const swaggerSpec = require('./swagger/specBuilder');
const { docsLanding } = require('./swagger/docsLanding');
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const profileRoutes = require('./routes/profile');
const verificationRoutes = require('./routes/verification');
const subscriptionRoutes = require('./routes/subscription');
const messagesRoutes = require('./routes/messages');
const adminReviewRoutes = require('./routes/adminReview');
const avatarRoutes = require('./routes/avatar');
const referralRoutes = require('./routes/referral');
const pushRoutes = require('./routes/push');
const categoriesRoutes = require('./routes/categories');
const categoriesCtrl = require('./controllers/categoriesController');
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes = require('./routes/budgets');
const reportsRoutes = require('./routes/reports');
const goalsRoutes = require('./routes/goals');
const marketRoutes = require('./routes/market');
const assetsRoutes = require('./routes/assets');
const expertRoutes = require('./routes/expert');
const splitRoutes = require('./routes/split');
const sessionRoutes = require('./routes/session');
const bannersRoutes = require('./routes/banners');
const adminAuthRoutes = require('./routes/admin/adminAuth');
const adminAdminsRoutes = require('./routes/admin/adminAdmins');
const adminUsersRoutes = require('./routes/admin/adminUsers');
const adminVerificationRoutes = require('./routes/admin/adminVerification');
const adminSubscriptionRoutes = require('./routes/admin/adminSubscription');
const adminStatsRoutes = require('./routes/admin/adminStats');
const adminStoriesRoutes = require('./routes/admin/adminStories');
const adminBannersRoutes = require('./routes/admin/adminBanners');
const adminRecommendationsRoutes = require('./routes/admin/adminRecommendations');
const adminCategoriesRoutes = require('./routes/admin/adminCategories');
const adminMessagingRoutes = require('./routes/admin/adminMessaging');
const adminStatsCtrl = require('./controllers/admin/adminStatsController');
const { requireAdmin: requirePanelAdmin } = require('./middlewares/adminAuth');
const configRoutes = require('./routes/config');
const { checkRecurringTransactions } = require('./utils/recurringHelper');
const referralCtrl = require('./controllers/referralController');
const messagesCtrl = require('./controllers/messagesController');
const { requireAdmin } = require('./middlewares/auth');
const { isSmtpConfigured } = require('./utils/mailer');
const {
  checkAndRevertExpiredSubscriptions,
  sendUpcomingExpiryWarnings,
} = require('./controllers/subscriptionController');
const { checkReferralDiscountExpiry } = require('./utils/discountHelper');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const adminSession = session({
  name: 'dakhlyar_admin_sid',
  secret:
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    'dakhlyar-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  },
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dakhlyar-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 2,
    },
  })
);

app.use('/api/admin', adminSession);
app.use('/admin', adminSession);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    fallthrough: true,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/admins', adminAdminsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/verification', adminVerificationRoutes);
app.use('/api/admin/subscription', adminSubscriptionRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.get('/api/admin/activity-log', requirePanelAdmin, adminStatsCtrl.activityLog);
app.use('/api/stories', storiesRoutes.userRouter);
app.use('/api/admin/stories', adminStoriesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/expert', expertRoutes);
app.use('/api/admin/expert', adminRecommendationsRoutes);
app.use('/api/split', splitRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/banners', bannersRoutes.userRouter);
app.use('/api/admin/banners', adminBannersRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/messages', adminMessagingRoutes.messagesRouter);
app.use('/api/admin/expert', adminMessagingRoutes.expertRouter);
app.use('/api/admin', adminReviewRoutes);
app.use('/api/config', configRoutes);

// Phase 5 — serve the static CSV template directory (also reachable via
// GET /api/transactions/sample-csv with the Persian filename header).
app.use('/sample', express.static(path.join(__dirname, '..', 'sample'), { maxAge: '7d' }));

// Phase 3-C — admin endpoints for the referral system live under /api/admin
// alongside the verification/subscription review endpoints. They share the
// same dev `requireAdmin` guard.
app.get('/api/admin/referrals',       requireAdmin, referralCtrl.adminListReferrals);
app.get('/api/admin/referrals/stats', requireAdmin, referralCtrl.adminReferralsStats);


const SWAGGER_UI_OPTS = {
  customCss: '.topbar { display: none }',
};

function mountSwaggerDocs(app, locale, scope) {
  const spec = swaggerSpec.buildSpec(locale, scope);
  const title = spec.info.title;
  const base = `/api/docs/${locale}/${scope}`;
  app.use(base, swaggerUi.serve);
  app.get(base, swaggerUi.setup(spec, { ...SWAGGER_UI_OPTS, customSiteTitle: title }));
}

mountSwaggerDocs(app, 'fa', 'app');
mountSwaggerDocs(app, 'fa', 'admin');
mountSwaggerDocs(app, 'en', 'app');
mountSwaggerDocs(app, 'en', 'admin');

app.get('/api/docs', docsLanding);
// Legacy redirect — old single-doc URL
app.get('/api/docs/legacy', (_req, res) => res.redirect('/api/docs/fa/app'));

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'مسیر مورد نظر یافت نشد' });
  }
  next();
});

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ message: 'خطای سرور' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Dakhlyar server is running at http://localhost:${PORT}`);
  console.log(`📚 Swagger docs:           http://localhost:${PORT}/api/docs`);
  console.log(`   App (FA):               http://localhost:${PORT}/api/docs/fa/app`);
  console.log(`   App (EN):               http://localhost:${PORT}/api/docs/en/app`);
  console.log(`   Admin (FA):             http://localhost:${PORT}/api/docs/fa/admin`);
  console.log(`   Admin (EN):             http://localhost:${PORT}/api/docs/en/admin`);

  if (!isSmtpConfigured()) {
    const line = '─'.repeat(72);
    console.log('\n' + line);
    console.log('⚠️  SMTP در فایل .env تنظیم نشده — حالت توسعه فعال است.');
    console.log('    وقتی کاربر OTP درخواست می‌کند، کد در همین ترمینال چاپ می‌شود.');
    console.log('    برای فعال‌سازی ارسال واقعی ایمیل، مقادیر SMTP_USER و SMTP_PASS');
    console.log('    در فایل .env را با Gmail App Password خود پر کنید.');
    console.log(line + '\n');
  } else {
    console.log('✉️  SMTP فعال — ایمیل OTP به صورت واقعی ارسال خواهد شد.\n');
  }

  // ── Phase 3-B/3-D: hourly scheduler ───────────────────────────────────
  // Runs once at startup (catch up after downtime) and then every 60 minutes.
  // Includes:
  //   1. expire subscriptions + revert premium avatars (Phase 3-B)
  //   2. send 10/5/1-day expiry warnings (Phase 3-D)
  //   3. flip already-expired messages to read so the 7-day cleanup applies (Phase 3-D)
  //   4. send 3/1-day referral discount expiry warnings (Phase 3-D)
  // Per-request real-time checks live in /api/profile, /api/avatar/list, /api/messages.
  function runHourlySweep(label) {
    try { checkAndRevertExpiredSubscriptions(); } catch (e) {
      console.warn(`[${label}] expiry sweep failed:`, e.message);
    }
    try { sendUpcomingExpiryWarnings(); } catch (e) {
      console.warn(`[${label}] expiry warning sweep failed:`, e.message);
    }
    try { messagesCtrl.autoExpireMessages(); } catch (e) {
      console.warn(`[${label}] message auto-expire failed:`, e.message);
    }
    try { checkReferralDiscountExpiry(); } catch (e) {
      console.warn(`[${label}] referral discount expiry sweep failed:`, e.message);
    }
    // Phase 5 — recurring transaction reminders.
    // Dedup inside the helper (alert_sent_at check) makes this safe to run
    // every hour even though the spec calls for once a day.
    try { checkRecurringTransactions(); } catch (e) {
      console.warn(`[${label}] recurring transactions sweep failed:`, e.message);
    }
  }
  runHourlySweep('startup');
  setInterval(() => runHourlySweep('periodic'), 60 * 60 * 1000).unref();
});

// ── Friendly startup error handler ──────────────────────────────────────
// The default Node behavior for EADDRINUSE / EACCES is a noisy stack trace.
// Catch it ourselves and print a clear, actionable Persian message instead.
server.on('error', (err) => {
  const line = '─'.repeat(72);
  if (err && err.code === 'EADDRINUSE') {
    console.error('\n' + line);
    console.error(`❌  پورت ${PORT} از قبل توسط برنامه‌ی دیگری در حال استفاده است.`);
    console.error('    این معمولاً به این معنی است که یک نسخه‌ی قبلی سرور دخلیار');
    console.error('    هنوز در حال اجراست (مثلاً در ترمینالی دیگر).');
    console.error('');
    console.error('    راه‌حل سریع — بستن پروسه‌ی موجود روی این پورت:');
    console.error(`        lsof -ti tcp:${PORT} | xargs kill -9`);
    console.error('');
    console.error('    یا اجرای سرور روی پورت دیگر:');
    console.error(`        PORT=3001 npm start`);
    console.error(line + '\n');
  } else if (err && err.code === 'EACCES') {
    console.error('\n' + line);
    console.error(`❌  دسترسی به پورت ${PORT} مجاز نیست.`);
    console.error('    پورت‌های زیر ۱۰۲۴ نیازمند sudo هستند — لطفاً پورت بالاتری انتخاب کنید:');
    console.error('        PORT=3000 npm start');
    console.error(line + '\n');
  } else {
    console.error('\n❌  خطا در راه‌اندازی سرور:', err && (err.message || err));
  }
  process.exit(1);
});

/**
 * server/index.js
 * Entry point for the Dakhlyar (دخلیار) backend API.
 * API-only — no frontend static files are served from this package.
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { createCorsOptions, getAllowedOrigins } = require('./utils/corsConfig');
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

const corsOptions = createCorsOptions();
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
    sameSite: 'lax',
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

app.use('/sample', express.static(path.join(__dirname, '..', 'sample'), { maxAge: '7d' }));

app.get('/api/admin/referrals', requireAdmin, referralCtrl.adminListReferrals);
app.get('/api/admin/referrals/stats', requireAdmin, referralCtrl.adminReferralsStats);

const SWAGGER_UI_OPTS = {
  customCss: '.topbar { display: none }',
};

function mountSwaggerDocs(appInstance, locale, scope) {
  const spec = swaggerSpec.buildSpec(locale, scope);
  const title = spec.info.title;
  const base = `/api/docs/${locale}/${scope}`;
  appInstance.use(base, swaggerUi.serve);
  appInstance.get(base, swaggerUi.setup(spec, { ...SWAGGER_UI_OPTS, customSiteTitle: title }));
}

mountSwaggerDocs(app, 'fa', 'app');
mountSwaggerDocs(app, 'fa', 'admin');
mountSwaggerDocs(app, 'en', 'app');
mountSwaggerDocs(app, 'en', 'admin');

app.get('/api/docs', docsLanding);
app.get('/api/docs/legacy', (_req, res) => res.redirect('/api/docs/fa/app'));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'مسیر مورد نظر یافت نشد' });
  }
  return res.status(404).json({ message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ message: 'خطای سرور' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Dakhlyar API server is running at http://localhost:${PORT}`);
  console.log(`🏥 Health check:          http://localhost:${PORT}/health`);
  console.log(`📚 Swagger docs:           http://localhost:${PORT}/api/docs`);
  console.log(`   App (FA):               http://localhost:${PORT}/api/docs/fa/app`);
  console.log(`   App (EN):               http://localhost:${PORT}/api/docs/en/app`);
  console.log(`   Admin (FA):             http://localhost:${PORT}/api/docs/fa/admin`);
  console.log(`   Admin (EN):             http://localhost:${PORT}/api/docs/en/admin`);
  console.log(`🌐 CORS origins:           ${getAllowedOrigins().join(', ') || '(none — set CORS_ORIGINS)'}`);

  if (!isSmtpConfigured()) {
    const line = '─'.repeat(72);
    console.log('\n' + line);
    console.log('⚠️  SMTP is not configured in .env — development mode is active.');
    console.log('    When a user requests OTP, the code is printed in this terminal.');
    console.log('    Set SMTP_USER and SMTP_PASS in .env for real email delivery.');
    console.log(line + '\n');
  } else {
    console.log('✉️  SMTP enabled — OTP emails will be sent.\n');
  }

  function runHourlySweep(label) {
    try {
      checkAndRevertExpiredSubscriptions();
    } catch (e) {
      console.warn(`[${label}] expiry sweep failed:`, e.message);
    }
    try {
      sendUpcomingExpiryWarnings();
    } catch (e) {
      console.warn(`[${label}] expiry warning sweep failed:`, e.message);
    }
    try {
      messagesCtrl.autoExpireMessages();
    } catch (e) {
      console.warn(`[${label}] message auto-expire failed:`, e.message);
    }
    try {
      checkReferralDiscountExpiry();
    } catch (e) {
      console.warn(`[${label}] referral discount expiry sweep failed:`, e.message);
    }
    try {
      checkRecurringTransactions();
    } catch (e) {
      console.warn(`[${label}] recurring transactions sweep failed:`, e.message);
    }
  }
  runHourlySweep('startup');
  setInterval(() => runHourlySweep('periodic'), 60 * 60 * 1000).unref();
});

server.on('error', (err) => {
  const line = '─'.repeat(72);
  if (err && err.code === 'EADDRINUSE') {
    console.error('\n' + line);
    console.error(`❌  Port ${PORT} is already in use.`);
    console.error(`    lsof -ti tcp:${PORT} | xargs kill -9`);
    console.error(`    PORT=3001 npm start`);
    console.error(line + '\n');
  } else if (err && err.code === 'EACCES') {
    console.error('\n' + line);
    console.error(`❌  Permission denied for port ${PORT}.`);
    console.error('    Use a port above 1024, e.g. PORT=3000 npm start');
    console.error(line + '\n');
  } else {
    console.error('\n❌  Server startup error:', err && (err.message || err));
  }
  process.exit(1);
});

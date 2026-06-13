/**
 * appDb.js
 * Connects to the user-facing SQLite database (dakhlyar_app.db).
 * This database is completely independent from the admin database.
 * Never import adminDb here.
 */

const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const APP_DB_PATH = process.env.APP_DB_PATH || './dakhlyar_app.db';
const absolutePath = path.resolve(process.cwd(), APP_DB_PATH);

const db = new Database(absolutePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      national_id TEXT UNIQUE NOT NULL,
      birth_date TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      success INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_otp_email_type ON otp_codes(email, type);
    CREATE INDEX IF NOT EXISTS idx_login_mobile_time ON login_attempts(mobile, attempted_at);
    CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_national_id ON users(national_id);
  `);
}

/**
 * Idempotent migrations applied to existing databases.
 * SQLite ALTER TABLE has no "IF NOT EXISTS" for columns, so we inspect the schema first.
 */
function runMigrations() {
  const userCols = db.pragma('table_info(users)').map((c) => c.name);

  // Phase 2 — onboarding stories
  if (!userCols.includes('has_seen_stories')) {
    db.exec('ALTER TABLE users ADD COLUMN has_seen_stories INTEGER DEFAULT 0');
  }

  // Phase 3 — profile fields, verification, subscription
  const phase3Cols = [
    ['first_name',              'TEXT DEFAULT NULL'],
    ['last_name',               'TEXT DEFAULT NULL'],
    ['address',                 'TEXT DEFAULT NULL'],
    ['postal_code',             'TEXT DEFAULT NULL'],
    ['verification_level',      'INTEGER DEFAULT 0'],
    ['subscription_plan',       'TEXT DEFAULT NULL'],
    ['subscription_expires_at', 'TEXT DEFAULT NULL'],
  ];
  for (const [col, type] of phase3Cols) {
    if (!userCols.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }

  // Phase 3-B — user avatar (DiceBear seeds + optional uploaded photo)
  const phase3bCols = [
    ['avatar_type',         "TEXT DEFAULT 'dicebear'"],
    ['avatar_seed',         "TEXT DEFAULT 'aria'"],
    ['avatar_custom_path',  'TEXT DEFAULT NULL'],
    ['avatar_last_seed',    "TEXT DEFAULT 'aria'"],
  ];
  // Re-read in case any previous ALTER above added columns.
  const userColsAfterP3 = db.pragma('table_info(users)').map((c) => c.name);
  for (const [col, type] of phase3bCols) {
    if (!userColsAfterP3.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }

  // Phase 3-C — referral (invite) system: user columns
  const phase3cUserCols = [
    ['referred_by_code',        'TEXT DEFAULT NULL'],
    ['referral_discount_count', 'INTEGER DEFAULT 0'],
  ];
  const userColsAfterP3b = db.pragma('table_info(users)').map((c) => c.name);
  for (const [col, type] of phase3cUserCols) {
    if (!userColsAfterP3b.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }
  // NOTE: the `subscription_requests.final_price` migration lives AFTER the
  // CREATE TABLE IF NOT EXISTS block below — on a fresh DB the table doesn't
  // exist yet here, so the ALTER would silently no-op.

  // Phase 3-D — messages system: per-user welcome flag
  const phase3dUserCols = [
    ['first_login_message_sent', 'INTEGER DEFAULT 0'],
  ];
  const userColsAfterP3c = db.pragma('table_info(users)').map((c) => c.name);
  for (const [col, type] of phase3dUserCols) {
    if (!userColsAfterP3c.includes(col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    }
  }

  // Phase 3 — new tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_level INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_note TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL,
      duration_months INTEGER NOT NULL,
      price INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_note TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS connected_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      user_agent TEXT DEFAULT NULL,
      ip_address TEXT DEFAULT NULL,
      last_active TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_verif_user_status ON verification_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_subreq_user_status ON subscription_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_devices_user ON connected_devices(user_id, last_active);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 3-D — messages system FULLY REPLACES the legacy notifications
  // table. Per spec we DROP the old table on startup if it still exists
  // (Phase 3 installs created one). All new reads/writes target `messages`.
  // ────────────────────────────────────────────────────────────────────────
  db.exec('DROP TABLE IF EXISTS notifications');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      type        TEXT NOT NULL,
      related_id  INTEGER DEFAULT NULL,
      is_read     INTEGER DEFAULT 0,
      read_at     TEXT DEFAULT NULL,
      expires_at  TEXT DEFAULT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_id      ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_type_related ON messages(type, related_id);
    CREATE INDEX IF NOT EXISTS idx_messages_unread       ON messages(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_messages_expiry       ON messages(expires_at) WHERE expires_at IS NOT NULL;
  `);

  // Phase 3-C — subscription_requests.final_price (must run AFTER the CREATE
  // TABLE above, otherwise the column never gets added on a fresh database).
  const subReqCols = db.pragma('table_info(subscription_requests)').map((c) => c.name);
  if (subReqCols.length && !subReqCols.includes('final_price')) {
    db.exec('ALTER TABLE subscription_requests ADD COLUMN final_price INTEGER DEFAULT NULL');
  }

  // Phase 3-C — referral tables
  // referrals: one row per (inviter → invitee) relationship; invitee_user_id UNIQUE
  //   so a user can only ever be invited once.
  // referral_discounts: one row per discount entitlement (either earned by the
  //   inviter on each successful referral purchase, or held by the invitee for
  //   their first purchase within 10 days).
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inviter_user_id INTEGER NOT NULL,
      invitee_user_id INTEGER UNIQUE NOT NULL,
      invite_code TEXT NOT NULL,
      inviter_plan_at_signup TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS referral_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      discount_percent REAL NOT NULL,
      referral_id INTEGER NOT NULL,
      triggered_by_subscription_request_id INTEGER DEFAULT NULL,
      is_used INTEGER DEFAULT 0,
      used_at TEXT DEFAULT NULL,
      expires_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_referrals_inviter   ON referrals(inviter_user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_invitee   ON referrals(invitee_user_id);
    CREATE INDEX IF NOT EXISTS idx_refdisc_user_source ON referral_discounts(user_id, source, is_used);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 3-F — Web Push subscriptions.
  //
  // One row per (browser, user) pair. `endpoint` is UNIQUE so re-subscribing
  // the same browser does an INSERT-OR-REPLACE (rebound to whichever user is
  // logged in now). When web-push returns 410/404 the row is deleted.
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      user_agent  TEXT DEFAULT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used   TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 4 — Transaction categories (defaults shared by everyone, plus
  // user-requested custom ones approved by admin).
  //
  // `categories`           — the live catalog. user_id IS NULL → system default
  //                          (visible to everyone); otherwise user_id owns it.
  // `category_requests`    — pending/approved/rejected requests from users to
  //                          add new custom categories.
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      icon        TEXT    NOT NULL,
      color       TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK (type IN ('expense','income','both')),
      is_default  INTEGER DEFAULT 1,
      user_id     INTEGER DEFAULT NULL,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_categories_type    ON categories(type);
    CREATE INDEX IF NOT EXISTS idx_categories_user    ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_default ON categories(is_default, is_active);

    CREATE TABLE IF NOT EXISTS category_requests (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      name        TEXT    NOT NULL,
      icon        TEXT    NOT NULL,
      color       TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK (type IN ('expense','income','both')),
      status      TEXT    DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      admin_note  TEXT    DEFAULT NULL,
      created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT    DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_catreq_user_status ON category_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_catreq_status      ON category_requests(status);
  `);

  // Seed defaults — only when the categories table is empty (never re-seed).
  const defaultCount = db.prepare(
    'SELECT COUNT(*) AS c FROM categories WHERE is_default = 1'
  ).get().c;
  if (!defaultCount) {
    const insertDefault = db.prepare(`
      INSERT INTO categories (name, icon, color, type, is_default, user_id)
      VALUES (?, ?, ?, ?, 1, NULL)
    `);
    const DEFAULTS = [
      // expense
      ['خوراک و رستوران',     '🍽️', '#EF4444', 'expense'],
      ['حمل‌ونقل',            '🚗', '#F59E0B', 'expense'],
      ['خرید و پوشاک',         '🛍️', '#8B5CF6', 'expense'],
      ['قبوض و خدمات',         '📄', '#3B82F6', 'expense'],
      ['بهداشت و درمان',       '💊', '#10B981', 'expense'],
      ['سرگرمی و تفریح',       '🎮', '#F97316', 'expense'],
      ['آموزش',                '📚', '#06B6D4', 'expense'],
      ['اشتراک‌های دیجیتال',   '📱', '#6366F1', 'expense'],
      ['مسافرت',               '✈️', '#0EA5E9', 'expense'],
      ['هزینه خانه',           '🏠', '#84CC16', 'expense'],
      ['هدیه',                 '🎁', '#EC4899', 'expense'],
      ['متفرقه',               '📦', '#9CA3AF', 'expense'],
      ['سایر هزینه‌ها',        '💸', '#78716C', 'expense'],
      // income
      ['حقوق',                 '💰', '#1A5C3A', 'income'],
      ['فریلنسر',              '💻', '#0D9488', 'income'],
      ['هدیه دریافتی',         '🎀', '#EC4899', 'income'],
      ['سود سرمایه‌گذاری',     '📈', '#F0B429', 'income'],
      ['اجاره',                '🏢', '#8B5CF6', 'income'],
      ['سایر درآمد',           '💵', '#9CA3AF', 'income'],
      // both (loans, credit, BNPL — incoming loan = income, repayment = expense)
      ['وام و اعتبار',         '🏦', '#6366F1', 'both'],
    ];
    const seedTx = db.transaction((rows) => {
      for (const r of rows) insertDefault.run(...r);
    });
    seedTx(DEFAULTS);
    console.log(`[appDb] seeded ${DEFAULTS.length} default categories.`);
  } else {
    // Phase 5 — make sure the 'وام و اعتبار' default category exists even on
    // databases that were seeded BEFORE this default was added.
    const hasLoanCat = db.prepare(`
      SELECT 1 FROM categories
       WHERE is_default = 1 AND user_id IS NULL AND name = 'وام و اعتبار'
       LIMIT 1
    `).get();
    if (!hasLoanCat) {
      db.prepare(`
        INSERT INTO categories (name, icon, color, type, is_default, user_id)
        VALUES ('وام و اعتبار', '🏦', '#6366F1', 'both', 1, NULL)
      `).run();
      console.log('[appDb] added new default category: وام و اعتبار');
    }
    const hasOtherExpense = db.prepare(`
      SELECT 1 FROM categories
       WHERE is_default = 1 AND user_id IS NULL AND name = 'سایر هزینه‌ها'
       LIMIT 1
    `).get();
    if (!hasOtherExpense) {
      db.prepare(`
        INSERT INTO categories (name, icon, color, type, is_default, user_id)
        VALUES ('سایر هزینه‌ها', '💸', '#78716C', 'expense', 1, NULL)
      `).run();
      console.log('[appDb] added new default category: سایر هزینه‌ها');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Phase 5 — Transactions (income/expense) + per-user tags + recurring
  // alerts. `transactions.amount` is ALWAYS a positive integer in Toman;
  // the `type` field encodes direction. Soft-delete via `is_deleted`.
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id            INTEGER NOT NULL,
      type               TEXT    NOT NULL CHECK (type IN ('income','expense')),
      amount             INTEGER NOT NULL CHECK (amount > 0),
      currency           TEXT    DEFAULT 'IRR',
      amount_original    INTEGER DEFAULT NULL,
      currency_original  TEXT    DEFAULT NULL,
      exchange_rate      INTEGER DEFAULT NULL,
      category_id        INTEGER NOT NULL,
      title              TEXT    NOT NULL,
      note               TEXT    DEFAULT NULL,
      tags               TEXT    DEFAULT NULL,
      transaction_date   TEXT    NOT NULL,
      transaction_time   TEXT    DEFAULT NULL,
      is_recurring       INTEGER DEFAULT 0,
      recurring_interval TEXT    DEFAULT NULL CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly','monthly','yearly')),
      is_deleted         INTEGER DEFAULT 0,
      created_at         TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at         TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category  ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_alive     ON transactions(user_id, is_deleted, transaction_date DESC);

    CREATE TABLE IF NOT EXISTS transaction_tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      name        TEXT    NOT NULL,
      color       TEXT    DEFAULT '#6B7280',
      usage_count INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_user_usage ON transaction_tags(user_id, usage_count DESC);

    CREATE TABLE IF NOT EXISTS recurring_alerts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      transaction_id  INTEGER NOT NULL,
      alert_sent_at   TEXT    DEFAULT NULL,
      next_expected   TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_alerts(next_expected, alert_sent_at);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 6 — Budgets + financial scores
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      month       TEXT    NOT NULL,
      amount      INTEGER NOT NULL CHECK (amount > 0),
      created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category_id, month)
    );

    CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);

    CREATE TABLE IF NOT EXISTS financial_scores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      month         TEXT    NOT NULL,
      score         INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
      breakdown     TEXT    NOT NULL,
      calculated_at TEXT    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, month)
    );

    CREATE INDEX IF NOT EXISTS idx_financial_scores_user ON financial_scores(user_id, month);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 7 — Savings goals
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      title         TEXT    NOT NULL,
      target_amount INTEGER NOT NULL CHECK (target_amount > 0),
      saved_amount  INTEGER DEFAULT 0 CHECK (saved_amount >= 0),
      icon          TEXT    DEFAULT '🎯',
      color         TEXT    DEFAULT '#1A5C3A',
      deadline      TEXT    DEFAULT NULL,
      is_completed  INTEGER DEFAULT 0,
      created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id, is_completed);

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id         INTEGER NOT NULL,
      user_id         INTEGER NOT NULL,
      amount          INTEGER NOT NULL,
      note            TEXT    DEFAULT NULL,
      contributed_at  TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id, contributed_at DESC);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 8 — Market view cache + favorites
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_cache (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category    TEXT    NOT NULL UNIQUE,
      data        TEXT    NOT NULL,
      fetched_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_favorites (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      symbol      TEXT    NOT NULL,
      category    TEXT    NOT NULL,
      is_pinned   INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol, category)
    );

    CREATE INDEX IF NOT EXISTS idx_market_favorites_user ON market_favorites(user_id, is_pinned DESC);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 9 — User assets + net-worth snapshots
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      asset_key     TEXT    NOT NULL,
      custom_name   TEXT    DEFAULT NULL,
      quantity      REAL    NOT NULL,
      manual_price  INTEGER DEFAULT NULL,
      note          TEXT    DEFAULT NULL,
      risk_level    TEXT    DEFAULT 'medium',
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_assets_user_active ON assets(user_id, is_active);

    CREATE TABLE IF NOT EXISTS asset_snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL,
      total_value   INTEGER NOT NULL,
      snapshot_data TEXT    NOT NULL,
      created_at    TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_asset_snapshots_user ON asset_snapshots(user_id, created_at DESC);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 10 — Expert recommendations
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS expert_recommendations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      title           TEXT    NOT NULL,
      body            TEXT    NOT NULL,
      type            TEXT    NOT NULL,
      asset_key       TEXT    DEFAULT NULL,
      asset_name      TEXT    DEFAULT NULL,
      target_percent  REAL    DEFAULT NULL,
      priority        TEXT    DEFAULT 'medium',
      is_active       INTEGER DEFAULT 1,
      expires_at      TEXT    DEFAULT NULL,
      created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_expert_recs_active ON expert_recommendations(is_active, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_recommendation_status (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER NOT NULL,
      recommendation_id   INTEGER NOT NULL,
      status              TEXT    DEFAULT 'pending',
      updated_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, recommendation_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_rec_status_user ON user_recommendation_status(user_id, status);
  `);

  // ────────────────────────────────────────────────────────────────────────
  // Phase 12 — دنگ و دونگ (split expense mini-app)
  // ────────────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS split_groups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      description   TEXT    DEFAULT NULL,
      created_by    INTEGER NOT NULL,
      invite_token  TEXT    UNIQUE NOT NULL,
      is_active     INTEGER DEFAULT 1,
      created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_split_groups_creator ON split_groups(created_by, is_active);

    CREATE TABLE IF NOT EXISTS split_members (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id      INTEGER NOT NULL,
      user_id       INTEGER DEFAULT NULL,
      mobile        TEXT    DEFAULT NULL,
      display_name  TEXT    NOT NULL,
      is_registered INTEGER DEFAULT 0,
      joined_at     TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_split_members_group ON split_members(group_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_split_members_group_user
      ON split_members(group_id, user_id) WHERE user_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_split_members_group_mobile
      ON split_members(group_id, mobile) WHERE mobile IS NOT NULL;

    CREATE TABLE IF NOT EXISTS split_expenses (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id          INTEGER NOT NULL,
      paid_by_member_id INTEGER NOT NULL,
      title             TEXT    NOT NULL,
      amount            INTEGER NOT NULL,
      category_id       INTEGER DEFAULT NULL,
      expense_date      TEXT    NOT NULL,
      note              TEXT    DEFAULT NULL,
      is_deleted        INTEGER DEFAULT 0,
      created_at        TEXT    DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_split_expenses_group ON split_expenses(group_id, is_deleted, expense_date DESC);

    CREATE TABLE IF NOT EXISTS split_expense_shares (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id    INTEGER NOT NULL,
      member_id     INTEGER NOT NULL,
      share_amount  INTEGER NOT NULL,
      is_settled    INTEGER DEFAULT 0,
      settled_at    TEXT    DEFAULT NULL,
      transaction_id INTEGER DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_split_shares_expense ON split_expense_shares(expense_id);
    CREATE INDEX IF NOT EXISTS idx_split_shares_member ON split_expense_shares(member_id, is_settled);

    CREATE TABLE IF NOT EXISTS split_settlements (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id        INTEGER NOT NULL,
      from_member_id  INTEGER NOT NULL,
      to_member_id    INTEGER NOT NULL,
      amount          INTEGER NOT NULL,
      transaction_id  INTEGER DEFAULT NULL,
      settled_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
      note            TEXT    DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_split_settlements_group ON split_settlements(group_id, settled_at DESC);

    CREATE TABLE IF NOT EXISTS user_app_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      started_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_ping_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at     TEXT    DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_app_sessions_user
      ON user_app_sessions(user_id, ended_at);
    CREATE INDEX IF NOT EXISTS idx_user_app_sessions_ping
      ON user_app_sessions(last_ping_at);
  `);
}

initialize();
runMigrations();

module.exports = db;
module.exports.path = absolutePath;

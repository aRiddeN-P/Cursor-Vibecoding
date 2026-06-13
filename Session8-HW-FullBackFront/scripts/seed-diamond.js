#!/usr/bin/env node
/**
 * scripts/seed-diamond.js
 *
 * One-shot dev seed: wipes the app DB (kept on disk by `require('./db/appDb')`)
 * is assumed to ALREADY be deleted by the wrapping shell script — this script
 * only INSERTs a fresh diamond-tier test user and prints their invite code.
 *
 * Run via:  node scripts/seed-diamond.js
 *
 * The script is intentionally idempotent: if a user with the seeded email or
 * mobile already exists it is removed first, so re-running gives a clean state.
 */
'use strict';

const bcrypt = require('bcrypt');
const db = require('../server/db/appDb');
const { PLANS } = require('../server/utils/plans');

const SEED = Object.freeze({
  mobile:      '09120000000',
  email:       'test@dakhlyar.app',
  national_id: '0010000019',     // checksum-friendly placeholder
  birth_date:  '1995-06-15',
  password:    'Test@1234',
  first_name:  'کاربر',
  last_name:   'تست',
  postal_code: '1234567890',
  address:     'تهران، خیابان آزادی، پلاک ۱',
});

(async () => {
  try {
    // Remove any existing rows for this seed identity so re-runs are clean.
    db.prepare('DELETE FROM users WHERE mobile = ? OR email = ? OR national_id = ?').run(
      SEED.mobile, SEED.email, SEED.national_id
    );

    const passwordHash = await bcrypt.hash(SEED.password, 12);

    // Diamond plan, expires 12 months from today.
    const plan = PLANS.diamond;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + plan.duration_months);
    const expiresIso = expires.toISOString().slice(0, 10);

    const info = db.prepare(`
      INSERT INTO users (
        mobile, email, national_id, birth_date, password_hash, is_verified,
        first_name, last_name, postal_code, address,
        verification_level,
        subscription_plan, subscription_expires_at,
        avatar_type, avatar_seed, avatar_last_seed,
        referral_discount_count
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 3, ?, ?, 'dicebear', 'aria', 'aria', 0)
    `).run(
      SEED.mobile, SEED.email, SEED.national_id, SEED.birth_date, passwordHash,
      SEED.first_name, SEED.last_name, SEED.postal_code, SEED.address,
      plan.key, expiresIso
    );

    const id = Number(info.lastInsertRowid);
    const inviteCode = `DKHL-${id}`;

    const line = '─'.repeat(60);
    console.log('\n' + line);
    console.log('✅ کاربر تستی با اشتراک الماس ساخته شد');
    console.log(line);
    console.log(`   شناسه‌ی کاربر:   ${id}`);
    console.log(`   نام:            ${SEED.first_name} ${SEED.last_name}`);
    console.log(`   موبایل:         ${SEED.mobile}`);
    console.log(`   ایمیل:          ${SEED.email}`);
    console.log(`   رمز عبور:       ${SEED.password}`);
    console.log(`   پلن:            ${plan.name} (${plan.label})`);
    console.log(`   انقضا:          ${expiresIso}`);
    console.log(`   کد ملی:         ${SEED.national_id}`);
    console.log(`   سطح احراز:      ۳ (تمام فیلدها قفل — آماده‌ی تست)`);
    console.log(line);
    console.log(`   🎁 کد دعوت:     ${inviteCode}`);
    console.log(line + '\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ خطا در ساخت کاربر تستی:', err);
    process.exit(1);
  }
})();

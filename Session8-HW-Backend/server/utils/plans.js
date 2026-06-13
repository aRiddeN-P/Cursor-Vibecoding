/**
 * plans.js
 * Hardcoded subscription plans for Dakhlyar.
 * Prices are stored on the server — the client may never override them.
 */

const PLANS = Object.freeze({
  silver: Object.freeze({
    key: 'silver',
    name: 'نقره‌ای',
    duration_months: 3,
    price: 2000000,
    label: '۳ ماهه',
  }),
  gold: Object.freeze({
    key: 'gold',
    name: 'طلایی',
    duration_months: 6,
    price: 3500000,
    label: '۶ ماهه',
  }),
  diamond: Object.freeze({
    key: 'diamond',
    name: 'الماسی',
    duration_months: 12,
    price: 6000000,
    label: '۱ ساله',
  }),
});

const PLAN_RANK = { silver: 1, gold: 2, diamond: 3 };

function getPlan(key) {
  return PLANS[key] || null;
}

function listPlans() {
  return Object.values(PLANS);
}

module.exports = { PLANS, PLAN_RANK, getPlan, listPlans };

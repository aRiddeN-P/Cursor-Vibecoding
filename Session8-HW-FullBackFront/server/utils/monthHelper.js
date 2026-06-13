'use strict';

const ISO_MONTH = /^\d{4}-\d{2}$/;

function currentMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(raw, fallback) {
  const m = String(raw || fallback || currentMonth()).trim();
  if (!ISO_MONTH.test(m)) return null;
  const [y, mo] = m.split('-').map(Number);
  if (mo < 1 || mo > 12) return null;
  return m;
}

function prevMonth(monthYYYYMM) {
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(monthYYYYMM) {
  const [y, m] = monthYYYYMM.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${monthYYYYMM}-01`,
    to: `${monthYYYYMM}-${String(lastDay).padStart(2, '0')}`,
    days: lastDay,
  };
}

function lastNMonths(n, fromMonth) {
  const out = [];
  let cur = fromMonth || currentMonth();
  for (let i = 0; i < n; i++) {
    out.unshift(cur);
    cur = prevMonth(cur);
  }
  return out;
}

function parseMonthsList(raw, max = 6, defaultCount = 3) {
  if (!raw) return lastNMonths(defaultCount);
  const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  const valid = [];
  for (const p of parts) {
    if (ISO_MONTH.test(p) && !valid.includes(p)) valid.push(p);
    if (valid.length >= max) break;
  }
  return valid.length ? valid.sort() : lastNMonths(defaultCount);
}

function daysRemainingInMonth(monthYYYYMM) {
  const { to } = monthRange(monthYYYYMM);
  const end = new Date(to + 'T23:59:59Z');
  const now = new Date();
  const diff = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

function daysElapsedInMonth(monthYYYYMM) {
  const { from, days } = monthRange(monthYYYYMM);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (today < from) return 0;
  const { to } = monthRange(monthYYYYMM);
  if (today > to) return days;
  return Number(today.slice(8, 10));
}

module.exports = {
  ISO_MONTH,
  currentMonth,
  parseMonth,
  prevMonth,
  monthRange,
  lastNMonths,
  parseMonthsList,
  daysRemainingInMonth,
  daysElapsedInMonth,
};

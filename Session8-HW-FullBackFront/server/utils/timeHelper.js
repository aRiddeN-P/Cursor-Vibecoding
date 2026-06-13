/**
 * timeHelper.js — Phase 3-D
 *
 * Pure formatting helpers for Persian dates / relative timestamps.
 * All functions here are sync, side-effect free, and safe to import from
 * any controller or scheduler.
 */
'use strict';

const FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];

/** "12" → "۱۲", null/undefined → "" */
function toPersianDigits(n) {
  if (n == null) return '';
  return String(n).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/**
 * "5 minutes ago" in Persian. Accepts:
 *   - ISO strings ("2026-06-12T01:00:00.000Z")
 *   - SQLite default timestamps ("2026-06-12 01:00:00" — assumed UTC)
 *   - Date objects
 *   - epoch ms numbers
 * Falls back to "" for unparseable input.
 */
function persianTimeAgo(input) {
  if (input == null || input === '') return '';
  let t;
  if (input instanceof Date) {
    t = input.getTime();
  } else if (typeof input === 'number') {
    t = input;
  } else {
    const s = String(input);
    // SQLite "YYYY-MM-DD HH:MM:SS" → treat as UTC for parity with
    // datetime('now') which writes in UTC.
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
      ? s.replace(' ', 'T') + 'Z'
      : s;
    t = new Date(normalized).getTime();
  }
  if (Number.isNaN(t)) return '';

  const diff = Date.now() - t;
  if (diff < 0) return 'همین الان'; // clock skew safety
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toPersianDigits(days)} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${toPersianDigits(months)} ماه پیش`;
  const years = Math.floor(months / 12);
  return `${toPersianDigits(years)} سال پیش`;
}

/** YYYY-MM-DD (Jalali) — best-effort, falls back to input if invalid. */
function jalaliDate(input) {
  if (input == null || input === '') return '';
  let d;
  if (input instanceof Date) d = input;
  else if (typeof input === 'number') d = new Date(input);
  else {
    const s = String(input);
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
      ? s.replace(' ', 'T') + 'Z'
      : s;
    d = new Date(normalized);
  }
  if (Number.isNaN(d.getTime())) return String(input);
  try {
    // fa-IR with persian calendar via Intl
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (_) {
    return String(input);
  }
}

module.exports = { toPersianDigits, persianTimeAgo, jalaliDate };

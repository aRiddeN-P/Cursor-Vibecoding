/**
 * date-fa.js — Dakhlyar shared Persian (Jalali) date formatting.
 *
 * Goal: every date shown anywhere in the app or the admin panels goes
 * through this module, so the entire UI consistently displays Shamsi dates
 * with Persian digits (and gracefully degrades when input is malformed).
 *
 * Storage assumption (server-side):
 *   - `birth_date`, `subscription_expires_at`         → "YYYY-MM-DD" (Gregorian, no TZ)
 *   - `created_at`, `reviewed_at`, `last_active`, …  → "YYYY-MM-DD HH:MM:SS" (UTC, from
 *                                                       SQLite's CURRENT_TIMESTAMP)
 *   - ISO 8601 with "Z"/offset → used as-is
 *
 * Exposed (also bound to `window` for ergonomics):
 *   - DakDate.toFaDigits(s)
 *   - DakDate.parse(input)                → Date | null
 *   - DakDate.formatJalaliDate(input)     → "۱۴۰۳/۰۳/۲۱"
 *   - DakDate.formatJalaliDateTime(input) → "۱۴۰۳/۰۳/۲۱ ۲۲:۴۵"
 *   - DakDate.formatJalaliRelative(input) → "۳ دقیقه پیش" / falls back to absolute date
 *
 * Also re-exports `toFaDigits`, `formatJalaliDate`, `formatJalaliDateTime`,
 * `formatJalaliRelative` directly on `window`.
 */
(function () {
  'use strict';

  const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  function toFaDigits(s) {
    if (s == null) return '';
    return String(s).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);
  }

  /**
   * Parse a value into a Date with the right timezone semantics:
   *  - Date / number  → passthrough
   *  - "YYYY-MM-DD"   → local midnight (no shift)
   *  - "YYYY-MM-DD HH:MM:SS" → UTC (SQLite CURRENT_TIMESTAMP is UTC)
   *  - Any string with timezone marker (`Z` / `±hh:mm`) → as-is
   *  - Other strings  → handed to `new Date(...)` and validated
   *
   * Returns null on invalid input.
   */
  function parse(input) {
    if (input == null || input === '') return null;
    if (input instanceof Date)  return Number.isNaN(input.getTime()) ? null : input;
    if (typeof input === 'number') {
      const d = new Date(input);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof input !== 'string') return null;

    const s = input.trim();
    let d;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      // date-only → local midnight (so we never shift to the previous day)
      d = new Date(s + 'T00:00:00');
    } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      // SQLite CURRENT_TIMESTAMP → UTC
      d = new Date(s.replace(' ', 'T') + 'Z');
    } else {
      d = new Date(s);
    }
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Intl formatters — built once, cached for perf.
  const _fmtDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const _fmtDateTime = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  /**
   * "۱۴۰۳/۰۳/۲۱" — Jalali calendar, Persian digits, slash-separated.
   * Returns "—" for empty/invalid input.
   */
  function formatJalaliDate(input) {
    const d = parse(input);
    if (!d) return '—';
    const parts = _fmtDate.formatToParts(d);
    const y  = parts.find((p) => p.type === 'year')?.value  || '';
    const m  = parts.find((p) => p.type === 'month')?.value || '';
    const da = parts.find((p) => p.type === 'day')?.value   || '';
    // Always force Persian digits regardless of locale numbering choices.
    return toFaDigits(`${y}/${m}/${da}`);
  }

  /**
   * "۱۴۰۳/۰۳/۲۱ ۲۲:۴۵" — Jalali calendar + 24h clock, Persian digits.
   * Returns "—" for empty/invalid input.
   */
  function formatJalaliDateTime(input) {
    const d = parse(input);
    if (!d) return '—';
    const parts = _fmtDateTime.formatToParts(d);
    const y  = parts.find((p) => p.type === 'year')?.value  || '';
    const m  = parts.find((p) => p.type === 'month')?.value || '';
    const da = parts.find((p) => p.type === 'day')?.value   || '';
    const h  = parts.find((p) => p.type === 'hour')?.value   || '';
    const mi = parts.find((p) => p.type === 'minute')?.value || '';
    return toFaDigits(`${y}/${m}/${da} ${h}:${mi}`);
  }

  /**
   * Relative phrase in Persian (useful for notifications, activity feeds):
   *   < 45s        → "هم‌اکنون"
   *   < 60min      → "X دقیقه پیش"
   *   < 24h        → "X ساعت پیش"
   *   < 7 days     → "X روز پیش"
   *   else         → falls back to Jalali date "۱۴۰۳/۰۳/۲۱"
   *
   * Future timestamps are formatted as "تا X دقیقه/ساعت/روز دیگر".
   */
  function formatJalaliRelative(input) {
    const d = parse(input);
    if (!d) return '—';
    const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const future = diffSec > 0;
    const sign = (n) => (future ? `تا ${n} دیگر` : `${n} پیش`);

    if (abs < 45) return 'هم‌اکنون';
    if (abs < 60 * 60) {
      const m = Math.round(abs / 60);
      return sign(`${toFaDigits(m)} دقیقه`);
    }
    if (abs < 60 * 60 * 24) {
      const h = Math.round(abs / 3600);
      return sign(`${toFaDigits(h)} ساعت`);
    }
    if (abs < 60 * 60 * 24 * 7) {
      const dy = Math.round(abs / 86400);
      return sign(`${toFaDigits(dy)} روز`);
    }
    return formatJalaliDate(d);
  }

  // ----- expose ------
  const api = { toFaDigits, parse, formatJalaliDate, formatJalaliDateTime, formatJalaliRelative };
  window.DakDate = api;
  // Also publish bare helpers for terse call sites:
  window.toFaDigits           = window.toFaDigits           || toFaDigits;
  window.formatJalaliDate     = formatJalaliDate;
  window.formatJalaliDateTime = formatJalaliDateTime;
  window.formatJalaliRelative = formatJalaliRelative;
})();

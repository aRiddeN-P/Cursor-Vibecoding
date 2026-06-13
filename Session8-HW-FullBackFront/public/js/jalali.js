/**
 * jalali.js — Phase 5
 *
 * Self-contained Jalali ↔ Gregorian conversion + Persian formatting.
 * Algorithm: jalaali-js (MIT, Behnam Mohammadi) — port of Boozri/Babai.
 * Inlined here so the frontend never has to fetch a CDN.
 *
 * Exposes a global object `window.Jalali` with:
 *   - toJalali(gy, gm, gd)               → { jy, jm, jd }
 *   - toGregorian(jy, jm, jd)            → { gy, gm, gd }
 *   - todayJalali()                      → { jy, jm, jd }
 *   - jalaliToStr(jy, jm, jd)            → "۱۵ خرداد ۱۴۰۴"
 *   - persianMonthName(m)                → "خرداد"
 *   - persianDayName(dateLike)           → "چهارشنبه"
 *   - formatJalaliFromGregorian(gStr)    → "چهارشنبه ۱۵ خرداد ۱۴۰۴"
 *   - jStrFromGregorian(gStr)            → "1404-03-15"
 *   - gStrFromJalali(jStr)               → "2025-06-05"
 *   - isLeapJalaliYear(jy)               → boolean
 *   - jalaliMonthLength(jy, jm)          → number
 *   - formatJalaliShort(gStr)            → "۱۵ خرداد"
 *
 *   - toPersian(n)                       → '۰۱۲۳۴۵۶۷۸۹' mapping
 *   - withSeparators(n)                  → "1,234,567"
 */
(function () {
  'use strict';

  // ── jalaali-js algorithm — minimal, no allocations in hot path ──────────
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  function jalCal(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
      1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = breaks[0];
    if (jy < jp || jy >= breaks[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
    let jump = 0;
    let jm;
    for (let i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap, gy, march };
  }

  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
      + div(153 * mod(gm + 9, 12) + 2, 5)
      + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    let jm, jd;
    if (k >= 0) {
      if (k <= 185) {
        jm = 1 + div(k, 31);
        jd = mod(k, 31) + 1;
        return { jy, jm, jd };
      }
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }

  function toJalali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function isLeapJalaliYear(jy) { return jalCal(jy).leap === 0; }
  function jalaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    if (isLeapJalaliYear(jy)) return 30;
    return 29;
  }

  // ── Formatting / Persian helpers ────────────────────────────────────────
  const MONTH_NAMES_FA = [
    '', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];
  const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

  function toPersian(n) {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  function withSeparators(n) {
    return Number(n).toLocaleString('en');
  }

  function persianMonthName(m) { return MONTH_NAMES_FA[m] || ''; }

  function persianDayName(dateLike) {
    let dt;
    if (dateLike instanceof Date) dt = dateLike;
    else if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
      const [y, m, d] = dateLike.split('-').map(Number);
      dt = new Date(Date.UTC(y, m - 1, d));
    } else dt = new Date();
    // Date.getUTCDay(): Sun=0..Sat=6 — map so Sun→0 (یکشنبه)
    return DAY_NAMES_FA[dt.getUTCDay()];
  }

  function todayJalali() {
    const d = new Date();
    return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function jalaliToStr(jy, jm, jd) {
    return `${toPersian(jd)} ${persianMonthName(jm)} ${toPersian(jy)}`;
  }

  function formatJalaliFromGregorian(gStr) {
    if (!gStr || !/^\d{4}-\d{2}-\d{2}/.test(gStr)) return '';
    const [y, m, d] = gStr.slice(0, 10).split('-').map(Number);
    const j = toJalali(y, m, d);
    const day = persianDayName(gStr.slice(0, 10));
    return `${day} ${toPersian(j.jd)} ${persianMonthName(j.jm)} ${toPersian(j.jy)}`;
  }

  function formatJalaliShort(gStr) {
    if (!gStr || !/^\d{4}-\d{2}-\d{2}/.test(gStr)) return '';
    const [y, m, d] = gStr.slice(0, 10).split('-').map(Number);
    const j = toJalali(y, m, d);
    return `${toPersian(j.jd)} ${persianMonthName(j.jm)}`;
  }

  function jStrFromGregorian(gStr) {
    if (!gStr || !/^\d{4}-\d{2}-\d{2}/.test(gStr)) return '';
    const [y, m, d] = gStr.slice(0, 10).split('-').map(Number);
    const j = toJalali(y, m, d);
    return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
  }

  function gStrFromJalali(jStr) {
    if (!jStr || !/^\d{4}-\d{2}-\d{2}$/.test(jStr)) return '';
    const [jy, jm, jd] = jStr.split('-').map(Number);
    const g = toGregorian(jy, jm, jd);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }

  window.Jalali = {
    toJalali, toGregorian,
    todayJalali,
    jalaliToStr,
    persianMonthName, persianDayName,
    formatJalaliFromGregorian, formatJalaliShort,
    jStrFromGregorian, gStrFromJalali,
    isLeapJalaliYear, jalaliMonthLength,
    toPersian, withSeparators,
  };
})();

'use strict';

const XLSX = require('xlsx');
const appDb = require('../db/appDb');
const { normalizeDigits } = require('./digitHelper');

const MOBILE_HEADERS = new Set([
  'mobile', 'phone', 'tel', 'cell',
  'موبایل', 'شماره موبایل', 'شماره', 'تلفن', 'موبایل کاربر',
]);

const MOBILE_REGEX = /^09[0-9]{9}$/;

function normalizeMobile(raw) {
  let digits = normalizeDigits(String(raw ?? '')).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('98') && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  return MOBILE_REGEX.test(digits) ? digits : '';
}

function findMobileColumn(headers) {
  for (const h of headers) {
    const key = String(h || '').trim().toLowerCase();
    if (MOBILE_HEADERS.has(key) || MOBILE_HEADERS.has(String(h || '').trim())) {
      return h;
    }
  }
  return headers[0] || null;
}

function rowsFromFile(buffer, filename) {
  const lower = String(filename || '').toLowerCase();
  const isCsv = lower.endsWith('.csv');
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');
  if (!isCsv && !isExcel) {
    const err = new Error('فرمت فایل نامعتبر است — فقط CSV یا Excel پذیرفته می‌شود');
    err.status = 400;
    throw err;
  }
  if (!buffer || !buffer.length) {
    const err = new Error('فایل خالی است');
    err.status = 400;
    throw err;
  }

  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      const err = new Error('هیچ شیتی در فایل اکسل وجود ندارد');
      err.status = 400;
      throw err;
    }
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });
  }

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!text) {
    const err = new Error('فایل خالی است');
    err.status = 400;
    throw err;
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function extractMobilesFromRows(rows) {
  if (!rows.length) return { mobiles: [], invalid: [] };

  const headers = Object.keys(rows[0] || {});
  const col = findMobileColumn(headers);
  const seen = new Set();
  const mobiles = [];
  const invalid = [];

  for (const row of rows) {
    const raw = col != null ? row[col] : Object.values(row)[0];
    const mobile = normalizeMobile(raw);
    if (!mobile) {
      const trimmed = String(raw ?? '').trim();
      if (trimmed) invalid.push(trimmed);
      continue;
    }
    if (seen.has(mobile)) continue;
    seen.add(mobile);
    mobiles.push(mobile);
  }

  return { mobiles, invalid };
}

function resolveUsersByMobiles(mobiles) {
  if (!mobiles.length) {
    return { users: [], matched_mobiles: [], unmatched_mobiles: [] };
  }

  const placeholders = mobiles.map(() => '?').join(',');
  const rows = appDb.prepare(`
    SELECT id, mobile, first_name, last_name, subscription_plan, subscription_expires_at
    FROM users
    WHERE mobile IN (${placeholders})
  `).all(...mobiles);

  const byMobile = new Map(rows.map((u) => [u.mobile, u]));
  const users = [];
  const matched_mobiles = [];
  const unmatched_mobiles = [];

  for (const m of mobiles) {
    const u = byMobile.get(m);
    if (u) {
      users.push(u);
      matched_mobiles.push(m);
    } else {
      unmatched_mobiles.push(m);
    }
  }

  return { users, matched_mobiles, unmatched_mobiles };
}

function parseMobileImport(buffer, filename) {
  const rows = rowsFromFile(buffer, filename);
  if (!rows.length) {
    const err = new Error('هیچ ردیف معتبری در فایل یافت نشد');
    err.status = 400;
    throw err;
  }

  const { mobiles, invalid } = extractMobilesFromRows(rows);
  const resolved = resolveUsersByMobiles(mobiles);

  return {
    total_rows: rows.length,
    unique_mobiles: mobiles.length,
    invalid_rows: invalid.length,
    invalid_samples: invalid.slice(0, 5),
    matched_count: resolved.users.length,
    unmatched_count: resolved.unmatched_mobiles.length,
    unmatched_samples: resolved.unmatched_mobiles.slice(0, 10),
    user_ids: resolved.users.map((u) => u.id),
    users: resolved.users.map((u) => ({
      id: u.id,
      mobile: u.mobile,
      first_name: u.first_name,
      last_name: u.last_name,
    })),
  };
}

module.exports = {
  normalizeMobile,
  parseMobileImport,
  resolveUsersByMobiles,
};

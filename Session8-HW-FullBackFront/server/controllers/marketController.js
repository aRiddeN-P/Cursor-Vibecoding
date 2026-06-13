'use strict';

const db = require('../db/appDb');
const { toPersianDigits } = require('../utils/timeHelper');

const CACHE_TTL = 900;
const FORCE_MIN_AGE = 60;
const VALID_CATEGORIES = Object.freeze(['gold_currency', 'crypto', 'commodity']);

const BRS_URLS = {
  gold_currency: 'https://Api.BrsApi.ir/Market/Gold_Currency.php',
  crypto: 'https://Api.BrsApi.ir/Market/Cryptocurrency.php',
  commodity: 'https://Api.BrsApi.ir/Market/Commodity.php',
};

const forceRefreshByIp = new Map();

const stmts = {
  getCache: db.prepare('SELECT data, fetched_at FROM market_cache WHERE category = ?'),
  upsertCache: db.prepare(`
    INSERT INTO market_cache (category, data, fetched_at)
    VALUES (?, ?, ?)
    ON CONFLICT(category) DO UPDATE SET
      data = excluded.data,
      fetched_at = excluded.fetched_at
  `),
  listFavorites: db.prepare(`
    SELECT id, symbol, category, is_pinned, created_at
      FROM market_favorites
     WHERE user_id = ?
     ORDER BY is_pinned DESC, created_at DESC
  `),
  insertFavorite: db.prepare(`
    INSERT OR IGNORE INTO market_favorites (user_id, symbol, category, is_pinned)
    VALUES (?, ?, ?, 0)
  `),
  deleteFavorite: db.prepare(`
    DELETE FROM market_favorites
     WHERE user_id = ? AND symbol = ? AND category = ?
  `),
  findFavorite: db.prepare(`
    SELECT id FROM market_favorites
     WHERE user_id = ? AND symbol = ? AND category = ?
     LIMIT 1
  `),
  updatePin: db.prepare(`
    UPDATE market_favorites SET is_pinned = ?
     WHERE user_id = ? AND symbol = ? AND category = ?
  `),
};

function getApiKey() {
  return process.env.BRSAPI_KEY || '';
}

function faDigits(str) {
  return toPersianDigits(str);
}

function formatUpdatedAt(date, time) {
  const d = date ? faDigits(String(date)) : '';
  const t = time ? faDigits(String(time)) : '';
  if (d && t) return `${d} | ${t}`;
  return d || t || '';
}

function cacheAgeMinutes(fetchedAt) {
  if (!fetchedAt) return 0;
  return Math.max(0, Math.floor((Math.floor(Date.now() / 1000) - fetchedAt) / 60));
}

function normalizeApiArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && typeof data === 'object') {
    for (const val of Object.values(data)) {
      if (Array.isArray(val)) return val;
    }
  }
  return [];
}

function goldGroup(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (s.includes('COIN')) return 'coin';
  if (s.includes('GOLD')) return 'gold';
  return 'currency';
}

function commoditySection(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (/XAU|XAG|GOLD|SILVER|PLAT|PALL/.test(s)) return 'precious';
  if (/OIL|BRENT|GAS|WTI|ENERGY|NGAS|CRUDE/.test(s)) return 'energy';
  return 'base';
}

function cryptoSymbol(item) {
  if (item.symbol) return String(item.symbol);
  const name = String(item.name || '').trim();
  if (!name) return 'UNKNOWN';
  return name.split(/\s+/)[0].toUpperCase();
}

function mapGoldItem(item) {
  return {
    symbol: item.symbol,
    name: item.name,
    name_en: item.name_en || null,
    price: Number(item.price || 0),
    change_value: Number(item.change_value || 0),
    change_percent: Number(item.change_percent || 0),
    unit: item.unit || 'تومان',
    updated_at: formatUpdatedAt(item.date, item.time),
    group: goldGroup(item.symbol),
  };
}

function mapCryptoItem(item) {
  return {
    symbol: cryptoSymbol(item),
    name: item.name,
    price_usd: Number(item.price || 0),
    price_toman: Number(item.price_toman || 0),
    change_percent: Number(item.change_percent || 0),
    market_cap: Number(item.market_cap || 0),
    icon_url: item.link_icon || null,
    updated_at: formatUpdatedAt(item.date, item.time),
  };
}

function mapCommodityItem(item) {
  return {
    symbol: item.symbol,
    name: item.name,
    price: Number(item.price || 0),
    change_value: Number(item.change_value || 0),
    change_percent: Number(item.change_percent || 0),
    unit: item.unit || '',
    updated_at: formatUpdatedAt(item.date, item.time),
    section: commoditySection(item.symbol),
  };
}

function mappers(category) {
  if (category === 'gold_currency') return mapGoldItem;
  if (category === 'crypto') return mapCryptoItem;
  return mapCommodityItem;
}

function buildPayload(category, raw, meta) {
  const items = normalizeApiArray(raw).map(mappers(category));
  return {
    items,
    cached: meta.fromCache,
    cache_age_minutes: cacheAgeMinutes(meta.fetchedAt),
    stale: !!meta.stale,
  };
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function canForceRefresh(ip) {
  const now = Date.now();
  const last = forceRefreshByIp.get(ip) || 0;
  if (now - last < 60000) return false;
  forceRefreshByIp.set(ip, now);
  return true;
}

async function fetchFromBrs(category) {
  const key = getApiKey();
  if (!key) throw new Error('BRSAPI_KEY not configured');
  const base = BRS_URLS[category];
  const url = `${base}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BrsApi error: ${res.status}`);
  return res.json();
}

async function getCachedOrFetch(category, options = {}) {
  const { force = false, clientIp: ip = 'unknown' } = options;
  const now = Math.floor(Date.now() / 1000);
  const row = stmts.getCache.get(category);

  let shouldFetch = false;
  if (force) {
    const allowed = canForceRefresh(ip);
    if (allowed && (!row || (now - row.fetched_at) >= FORCE_MIN_AGE)) {
      shouldFetch = true;
    }
  } else if (!row || (now - row.fetched_at) >= CACHE_TTL) {
    shouldFetch = true;
  }

  if (shouldFetch) {
    try {
      const data = await fetchFromBrs(category);
      stmts.upsertCache.run(category, JSON.stringify(data), now);
      return { raw: data, fromCache: false, fetchedAt: now, stale: false };
    } catch (err) {
      if (row) {
        return {
          raw: JSON.parse(row.data),
          fromCache: true,
          fetchedAt: row.fetched_at,
          stale: true,
          error: err.message,
        };
      }
      throw err;
    }
  }

  if (!row) throw new Error('No cache available');
  return {
    raw: JSON.parse(row.data),
    fromCache: true,
    fetchedAt: row.fetched_at,
    stale: false,
  };
}

async function loadCategory(category, req) {
  const force = String(req.query.force || '').toLowerCase() === 'true';
  const meta = await getCachedOrFetch(category, { force, clientIp: clientIp(req) });
  return buildPayload(category, meta.raw, meta);
}

function serviceUnavailable(res) {
  return res.status(503).json({ message: 'سرویس قیمت در حال حاضر در دسترس نیست' });
}

async function goldCurrencyEndpoint(req, res) {
  try {
    if (!getApiKey()) return serviceUnavailable(res);
    const payload = await loadCategory('gold_currency', req);
    res.json(payload);
  } catch (err) {
    console.error('[market.gold]', err.message);
    serviceUnavailable(res);
  }
}

async function cryptoEndpoint(req, res) {
  try {
    if (!getApiKey()) return serviceUnavailable(res);
    const payload = await loadCategory('crypto', req);
    res.json(payload);
  } catch (err) {
    console.error('[market.crypto]', err.message);
    serviceUnavailable(res);
  }
}

async function commodityEndpoint(req, res) {
  try {
    if (!getApiKey()) return serviceUnavailable(res);
    const payload = await loadCategory('commodity', req);
    res.json(payload);
  } catch (err) {
    console.error('[market.commodity]', err.message);
    serviceUnavailable(res);
  }
}

async function allEndpoint(req, res) {
  try {
    if (!getApiKey()) return serviceUnavailable(res);
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const ip = clientIp(req);
    const cats = ['gold_currency', 'crypto', 'commodity'];
    const results = await Promise.allSettled(
      cats.map((c) => getCachedOrFetch(c, { force, clientIp: ip }))
    );
    const out = {};
    const errors = [];
    cats.forEach((cat, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') {
        out[cat] = buildPayload(cat, r.value.raw, r.value);
      } else {
        errors.push(cat);
        out[cat] = { items: [], cached: false, cache_age_minutes: 0, stale: true, error: true };
      }
    });
    res.json({ ...out, errors });
  } catch (err) {
    console.error('[market.all]', err.message);
    serviceUnavailable(res);
  }
}

function listFavoritesEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const favorites = stmts.listFavorites.all(userId).map((r) => ({
      id: r.id,
      symbol: r.symbol,
      category: r.category,
      is_pinned: !!r.is_pinned,
      created_at: r.created_at,
    }));
    res.json({ favorites });
  } catch (err) {
    console.error('[market.favorites.list]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function addFavoriteEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const symbol = String(req.body.symbol || '').trim();
    const category = String(req.body.category || '').trim();
    if (!symbol) return res.status(400).json({ message: 'نماد نامعتبر است' });
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'دسته‌بندی نامعتبر است' });
    }
    stmts.insertFavorite.run(userId, symbol, category);
    res.json({ success: true, message: 'به علاقه‌مندی‌ها اضافه شد' });
  } catch (err) {
    console.error('[market.favorites.add]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteFavoriteEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const symbol = decodeURIComponent(String(req.params.symbol || ''));
    const category = String(req.query.category || '').trim();
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'دسته‌بندی نامعتبر است' });
    }
    const row = stmts.findFavorite.get(userId, symbol, category);
    if (!row) return res.status(404).json({ message: 'آیتم در علاقه‌مندی‌ها یافت نشد' });
    stmts.deleteFavorite.run(userId, symbol, category);
    res.json({ success: true });
  } catch (err) {
    console.error('[market.favorites.delete]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

function pinFavoriteEndpoint(req, res) {
  try {
    const userId = req.session.user_id;
    const symbol = decodeURIComponent(String(req.params.symbol || ''));
    const category = String(req.query.category || req.body.category || '').trim();
    const pinned = req.body.pinned === true || req.body.pinned === 1 || req.body.pinned === 'true';
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'دسته‌بندی نامعتبر است' });
    }
    const row = stmts.findFavorite.get(userId, symbol, category);
    if (!row) return res.status(404).json({ message: 'آیتم در علاقه‌مندی‌ها یافت نشد' });
    stmts.updatePin.run(pinned ? 1 : 0, userId, symbol, category);
    res.json({ success: true });
  } catch (err) {
    console.error('[market.favorites.pin]', err);
    res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  goldCurrencyEndpoint,
  cryptoEndpoint,
  commodityEndpoint,
  allEndpoint,
  listFavoritesEndpoint,
  addFavoriteEndpoint,
  deleteFavoriteEndpoint,
  pinFavoriteEndpoint,
  getCachedOrFetch,
  VALID_CATEGORIES,
};

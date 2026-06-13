'use strict';

const db = require('../db/appDb');
const {
  ASSET_TYPES,
  getTypeByKey,
  getAssetTomanValue,
  getPriceMeta,
  getMarketCacheData,
  marketCacheAgeMinutes,
  publicTypeShape,
  groupByCategory,
  groupByRisk,
} = require('../utils/assetPriceHelper');

const VALID_RISK = Object.freeze(['safe', 'medium', 'risky']);

const stmts = {
  selectUserSub: db.prepare(`
    SELECT subscription_plan, subscription_expires_at
      FROM users WHERE id = ?
  `),
  listAssets: db.prepare(`
    SELECT id, asset_key, custom_name, quantity, manual_price, note, risk_level,
           is_active, created_at, updated_at
      FROM assets
     WHERE user_id = ? AND is_active = 1
     ORDER BY created_at DESC
  `),
  getAsset: db.prepare(`
    SELECT id, user_id, asset_key, custom_name, quantity, manual_price, note,
           risk_level, is_active, created_at, updated_at
      FROM assets
     WHERE id = ? AND user_id = ? AND is_active = 1
     LIMIT 1
  `),
  insertAsset: db.prepare(`
    INSERT INTO assets
      (user_id, asset_key, custom_name, quantity, manual_price, note, risk_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateAsset: db.prepare(`
    UPDATE assets
       SET custom_name = ?, quantity = ?, manual_price = ?, note = ?,
           risk_level = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ? AND is_active = 1
  `),
  softDelete: db.prepare(`
    UPDATE assets SET is_active = 0, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?
  `),
  lastSnapshot: db.prepare(`
    SELECT id, total_value, created_at
      FROM asset_snapshots
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1
  `),
  insertSnapshot: db.prepare(`
    INSERT INTO asset_snapshots (user_id, total_value, snapshot_data)
    VALUES (?, ?, ?)
  `),
  listSnapshots: db.prepare(`
    SELECT total_value, created_at
      FROM asset_snapshots
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?
  `),
};

function userId(req) {
  return req.session.user_id;
}

function hasActiveSubscription(user) {
  if (!user || !user.subscription_plan || !user.subscription_expires_at) return false;
  const t = new Date(String(user.subscription_expires_at).slice(0, 10) + 'T23:59:59').getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now();
}

function getUserSubscription(userIdVal) {
  return stmts.selectUserSub.get(userIdVal);
}

function requireSubscription(req, res) {
  const user = getUserSubscription(userId(req));
  if (!hasActiveSubscription(user)) {
    res.status(403).json({ message: 'این بخش مخصوص کاربران دارای اشتراک فعال است' });
    return false;
  }
  return true;
}

function parseQuantity(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseManualPrice(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseRisk(val, fallback = 'medium') {
  const v = String(val || fallback).toLowerCase();
  return VALID_RISK.includes(v) ? v : fallback;
}

function enrichAsset(row, marketCache) {
  const typeDef = getTypeByKey(row.asset_key);
  const type = typeDef ? publicTypeShape(typeDef) : null;
  const toman_value = getAssetTomanValue(row, marketCache);
  const { market_price_used, price_source } = getPriceMeta(row, marketCache, typeDef);
  return {
    id: row.id,
    asset_key: row.asset_key,
    custom_name: row.custom_name,
    quantity: Number(row.quantity),
    manual_price: row.manual_price != null ? Number(row.manual_price) : null,
    note: row.note,
    risk_level: row.risk_level || 'medium',
    type,
    toman_value,
    display_name: row.custom_name || (type ? type.name : row.asset_key),
    market_price_used,
    price_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function takeSnapshotIfNeeded(userIdVal, totalValue, enrichedAssets) {
  const last = stmts.lastSnapshot.get(userIdVal);
  if (last && last.created_at) {
    const lastTime = new Date(String(last.created_at).replace(' ', 'T') + 'Z').getTime();
    if (!Number.isNaN(lastTime) && (Date.now() - lastTime) < 24 * 60 * 60 * 1000) {
      return;
    }
  }
  const snapshotData = enrichedAssets.map((a) => ({
    id: a.id,
    asset_key: a.asset_key,
    display_name: a.display_name,
    toman_value: a.toman_value,
    price_source: a.price_source,
  }));
  stmts.insertSnapshot.run(userIdVal, totalValue, JSON.stringify(snapshotData));
}

function parseSnapshotDate(str) {
  return new Date(String(str).replace(' ', 'T') + 'Z').getTime();
}

function computePeriodChange(snapshots, days) {
  if (!snapshots.length) return { value: 0, percent: 0 };
  const current = Number(snapshots[0].total_value);
  const targetMs = Date.now() - days * 24 * 60 * 60 * 1000;
  let past = null;
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    const t = parseSnapshotDate(snapshots[i].created_at);
    if (t <= targetMs) {
      past = snapshots[i];
      break;
    }
  }
  if (!past && snapshots.length > 1) past = snapshots[snapshots.length - 1];
  if (!past) return { value: 0, percent: 0 };
  const prev = Number(past.total_value);
  const diff = current - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 1000) / 10 : 0;
  return { value: diff, percent: pct };
}

function listTypesEndpoint(_req, res) {
  return res.json({
    types: ASSET_TYPES.map(publicTypeShape),
  });
}

function listAssetsEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const uid = userId(req);
    const rows = stmts.listAssets.all(uid);
    const marketCache = getMarketCacheData(db);
    const assets = rows.map((row) => enrichAsset(row, marketCache));
    const total_value = assets.reduce((s, a) => s + a.toman_value, 0);
    takeSnapshotIfNeeded(uid, total_value, assets);
    return res.json({
      assets,
      total_value,
      by_risk: groupByRisk(assets, total_value),
      by_category: groupByCategory(assets, total_value),
      market_data_age_minutes: marketCacheAgeMinutes(marketCache.fetched_at),
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[assets.list]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function createAssetEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const body = req.body || {};
    const typeDef = getTypeByKey(body.asset_key);
    if (!typeDef) {
      return res.status(400).json({ message: 'نوع دارایی نامعتبر است' });
    }

    const quantity = parseQuantity(body.quantity);
    if (quantity == null) {
      return res.status(422).json({ message: 'مقدار دارایی باید بزرگ‌تر از صفر باشد' });
    }

    let manualPrice = parseManualPrice(body.manual_price);
    if (!typeDef.market_symbol && (manualPrice == null || manualPrice <= 0)) {
      return res.status(422).json({ message: 'برای این نوع دارایی وارد کردن قیمت الزامی است' });
    }

    const customName = body.custom_name
      ? String(body.custom_name).trim().slice(0, 40) || null
      : null;
    const note = body.note ? String(body.note).trim().slice(0, 200) || null : null;
    const riskLevel = parseRisk(body.risk_level);

    const info = stmts.insertAsset.run(
      userId(req),
      typeDef.key,
      customName,
      quantity,
      manualPrice,
      note,
      riskLevel
    );

    const row = stmts.getAsset.get(Number(info.lastInsertRowid), userId(req));
    const marketCache = getMarketCacheData(db);
    const asset = enrichAsset(row, marketCache);
    return res.status(201).json({ success: true, asset });
  } catch (err) {
    console.error('[assets.create]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function patchAssetEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ message: 'دارایی یافت نشد' });
    }

    const existing = stmts.getAsset.get(id, userId(req));
    if (!existing) return res.status(404).json({ message: 'دارایی یافت نشد' });

    const typeDef = getTypeByKey(existing.asset_key);
    const body = req.body || {};

    let quantity = Number(existing.quantity);
    if (body.quantity != null) {
      const q = parseQuantity(body.quantity);
      if (q == null) return res.status(422).json({ message: 'مقدار دارایی باید بزرگ‌تر از صفر باشد' });
      quantity = q;
    }

    let manualPrice = existing.manual_price;
    if (body.manual_price !== undefined) {
      manualPrice = parseManualPrice(body.manual_price);
    }

    if (typeDef && !typeDef.market_symbol && (manualPrice == null || manualPrice <= 0)) {
      return res.status(422).json({ message: 'برای این نوع دارایی وارد کردن قیمت الزامی است' });
    }

    const customName = body.custom_name !== undefined
      ? (String(body.custom_name).trim().slice(0, 40) || null)
      : existing.custom_name;
    const note = body.note !== undefined
      ? (String(body.note).trim().slice(0, 200) || null)
      : existing.note;
    const riskLevel = body.risk_level != null
      ? parseRisk(body.risk_level, existing.risk_level)
      : existing.risk_level;

    stmts.updateAsset.run(customName, quantity, manualPrice, note, riskLevel, id, userId(req));
    const row = stmts.getAsset.get(id, userId(req));
    const marketCache = getMarketCacheData(db);
    const asset = enrichAsset(row, marketCache);
    return res.json({ success: true, asset });
  } catch (err) {
    console.error('[assets.patch]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteAssetEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const id = Number(req.params.id);
    const existing = stmts.getAsset.get(id, userId(req));
    if (!existing) return res.status(404).json({ message: 'دارایی یافت نشد' });
    stmts.softDelete.run(id, userId(req));
    return res.json({ success: true });
  } catch (err) {
    console.error('[assets.delete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function historyEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    let days = Number(req.query.days);
    if (!Number.isFinite(days) || days <= 0) days = 30;
    days = Math.min(365, Math.max(1, Math.floor(days)));

    const snapshots = stmts.listSnapshots.all(userId(req), days);
    return res.json({
      snapshots,
      change_7d: computePeriodChange(snapshots, 7),
      change_30d: computePeriodChange(snapshots, 30),
    });
  } catch (err) {
    console.error('[assets.history]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function netWorthEndpoint(req, res) {
  try {
    if (!requireSubscription(req, res)) return;
    const uid = userId(req);
    const rows = stmts.listAssets.all(uid);
    const marketCache = getMarketCacheData(db);
    const assets = rows.map((row) => enrichAsset(row, marketCache));
    const total_assets = assets.reduce((s, a) => s + a.toman_value, 0);
    const total_liabilities = 0;
    const net_worth = total_assets - total_liabilities;

    const lastSnap = stmts.lastSnapshot.get(uid);
    const snapshots = stmts.listSnapshots.all(uid, 30);
    const change7 = computePeriodChange(snapshots, 7);
    let trend = 'stable';
    if (change7.value > 0) trend = 'up';
    else if (change7.value < 0) trend = 'down';

    return res.json({
      total_assets,
      total_liabilities,
      net_worth,
      last_snapshot: lastSnap ? String(lastSnap.created_at).slice(0, 10) : null,
      trend,
    });
  } catch (err) {
    console.error('[assets.netWorth]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listTypesEndpoint,
  listAssetsEndpoint,
  createAssetEndpoint,
  patchAssetEndpoint,
  deleteAssetEndpoint,
  historyEndpoint,
  netWorthEndpoint,
};

'use strict';

const ASSET_TYPES = Object.freeze([
  { key: 'gold_18k', name: 'طلای ۱۸ عیار', icon: '🥇', unit: 'گرم', category: 'gold', market_symbol: 'IR_GOLD_18K', market_category: 'gold_currency', price_per_unit: true },
  { key: 'gold_24k', name: 'طلای ۲۴ عیار', icon: '🏅', unit: 'گرم', category: 'gold', market_symbol: 'IR_GOLD_24K', market_category: 'gold_currency', price_per_unit: true },
  { key: 'gold_melted', name: 'طلای آب‌شده', icon: '🥇', unit: 'گرم', category: 'gold', market_symbol: 'IR_GOLD_MELTED', market_category: 'gold_currency', price_per_unit: true },
  { key: 'coin_emami', name: 'سکه امامی', icon: '🪙', unit: 'سکه', category: 'coin', market_symbol: 'IR_COIN_EMAMI', market_category: 'gold_currency', price_per_unit: true },
  { key: 'coin_bahar', name: 'سکه بهار آزادی', icon: '🪙', unit: 'سکه', category: 'coin', market_symbol: 'IR_COIN_BAHAR', market_category: 'gold_currency', price_per_unit: true },
  { key: 'coin_half', name: 'نیم سکه', icon: '🪙', unit: 'سکه', category: 'coin', market_symbol: 'IR_COIN_HALF', market_category: 'gold_currency', price_per_unit: true },
  { key: 'coin_quarter', name: 'ربع سکه', icon: '🪙', unit: 'سکه', category: 'coin', market_symbol: 'IR_COIN_QUARTER', market_category: 'gold_currency', price_per_unit: true },
  { key: 'coin_1gr', name: 'سکه یک گرمی', icon: '🪙', unit: 'سکه', category: 'coin', market_symbol: 'IR_COIN_1GR', market_category: 'gold_currency', price_per_unit: true },
  { key: 'usd', name: 'دلار آمریکا', icon: '💵', unit: 'دلار', category: 'currency', market_symbol: 'USD', market_category: 'gold_currency', price_per_unit: true },
  { key: 'eur', name: 'یورو', icon: '💶', unit: 'یورو', category: 'currency', market_symbol: 'EUR', market_category: 'gold_currency', price_per_unit: true },
  { key: 'bitcoin', name: 'بیتکوین', icon: '₿', unit: 'BTC', category: 'crypto', market_symbol: 'BTC', market_category: 'crypto', price_per_unit: true },
  { key: 'ethereum', name: 'اتریوم', icon: '⟠', unit: 'ETH', category: 'crypto', market_symbol: 'ETH', market_category: 'crypto', price_per_unit: true },
  { key: 'tether', name: 'تتر', icon: '₮', unit: 'USDT', category: 'crypto', market_symbol: 'USDT', market_category: 'crypto', price_per_unit: true },
  { key: 'gold_ounce', name: 'انس طلا', icon: '🏆', unit: 'انس', category: 'commodity', market_symbol: 'XAUUSD', market_category: 'commodity', price_per_unit: true },
  { key: 'property', name: 'ملک و مسکن', icon: '🏠', unit: null, category: 'real_estate', market_symbol: null, market_category: null, price_per_unit: false },
  { key: 'car', name: 'خودرو', icon: '🚗', unit: null, category: 'vehicle', market_symbol: null, market_category: null, price_per_unit: false },
  { key: 'cash_toman', name: 'پول نقد (تومان)', icon: '💰', unit: 'تومان', category: 'cash', market_symbol: null, market_category: null, price_per_unit: true },
  { key: 'bank_deposit', name: 'سپرده بانکی', icon: '🏦', unit: 'تومان', category: 'cash', market_symbol: null, market_category: null, price_per_unit: true },
  { key: 'stocks', name: 'سهام بورس', icon: '📈', unit: 'سهم', category: 'investment', market_symbol: null, market_category: null, price_per_unit: false },
  { key: 'fund', name: 'صندوق سرمایه‌گذاری', icon: '📊', unit: 'واحد', category: 'investment', market_symbol: null, market_category: null, price_per_unit: false },
  { key: 'other', name: 'سایر دارایی‌ها', icon: '📦', unit: null, category: 'other', market_symbol: null, market_category: null, price_per_unit: false },
]);

const CATEGORY_LABELS = Object.freeze({
  gold: 'طلا',
  coin: 'سکه',
  currency: 'ارز',
  crypto: 'کریپتو',
  commodity: 'کامودیتی',
  real_estate: 'ملک',
  vehicle: 'خودرو',
  cash: 'نقد',
  investment: 'سرمایه‌گذاری',
  other: 'سایر',
});

const TYPE_BY_KEY = new Map(ASSET_TYPES.map((t) => [t.key, t]));

function getTypeByKey(key) {
  return TYPE_BY_KEY.get(key) || null;
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

function getMarketCacheData(appDb) {
  const result = { gold_currency: [], crypto: [], commodity: [], fetched_at: null };
  for (const cat of ['gold_currency', 'crypto', 'commodity']) {
    const row = appDb.prepare('SELECT data, fetched_at FROM market_cache WHERE category = ?').get(cat);
    if (row) {
      try {
        result[cat] = normalizeApiArray(JSON.parse(row.data));
      } catch (_) {
        result[cat] = [];
      }
      if (row.fetched_at && (result.fetched_at == null || row.fetched_at > result.fetched_at)) {
        result.fetched_at = row.fetched_at;
      }
    }
  }
  return result;
}

function marketCacheAgeMinutes(fetchedAt) {
  if (!fetchedAt) return null;
  return Math.max(0, Math.floor((Math.floor(Date.now() / 1000) - fetchedAt) / 60));
}

function findCryptoItem(items, symbol) {
  const sym = String(symbol || '').toUpperCase();
  return items.find((item) => {
    const itemSym = String(item.symbol || '').toUpperCase();
    const name = String(item.name || '').toUpperCase();
    if (itemSym === sym) return true;
    if (name === sym) return true;
    const first = name.split(/\s+/)[0];
    return first === sym || name.includes(sym);
  });
}

function lookupMarketPrice(type, marketCache) {
  if (!type || !type.market_symbol || !type.market_category) return null;
  const items = marketCache[type.market_category] || [];
  if (type.market_category === 'crypto') {
    const item = findCryptoItem(items, type.market_symbol);
    return item ? Number(item.price_toman || 0) : null;
  }
  const item = items.find((i) => i.symbol === type.market_symbol);
  return item ? Number(item.price || 0) : null;
}

function getPriceMeta(asset, marketCache, type) {
  if (!type) return { market_price_used: null, price_source: 'unavailable' };

  if (!type.market_symbol) {
    if (asset.manual_price != null && asset.manual_price > 0) {
      return {
        market_price_used: type.price_per_unit ? Number(asset.manual_price) : null,
        price_source: 'manual',
      };
    }
    return { market_price_used: null, price_source: 'unavailable' };
  }

  if (asset.manual_price != null && asset.manual_price > 0) {
    return { market_price_used: Number(asset.manual_price), price_source: 'manual' };
  }

  const marketPrice = lookupMarketPrice(type, marketCache);
  if (marketPrice != null && marketPrice > 0) {
    return { market_price_used: marketPrice, price_source: 'market' };
  }

  if (asset.manual_price != null && asset.manual_price > 0) {
    return { market_price_used: Number(asset.manual_price), price_source: 'manual' };
  }

  return { market_price_used: null, price_source: 'unavailable' };
}

function getAssetTomanValue(asset, marketCache) {
  const type = getTypeByKey(asset.asset_key);
  if (!type) return 0;

  if (!type.market_symbol) {
    if (type.price_per_unit) {
      return Math.round((Number(asset.quantity) || 0) * (Number(asset.manual_price) || 0));
    }
    return Math.round(Number(asset.manual_price) || 0);
  }

  if (asset.manual_price != null && Number(asset.manual_price) > 0) {
    return Math.round((Number(asset.quantity) || 0) * Number(asset.manual_price));
  }

  const marketPrice = lookupMarketPrice(type, marketCache);
  if (marketPrice != null && marketPrice > 0) {
    return Math.round((Number(asset.quantity) || 0) * marketPrice);
  }

  if (asset.manual_price != null && Number(asset.manual_price) > 0) {
    return Math.round((Number(asset.quantity) || 0) * Number(asset.manual_price));
  }

  return 0;
}

function publicTypeShape(type) {
  return {
    key: type.key,
    name: type.name,
    icon: type.icon,
    unit: type.unit,
    category: type.category,
    has_market_price: Boolean(type.market_symbol),
    market_symbol: type.market_symbol,
    price_per_unit: type.price_per_unit,
  };
}

function groupByCategory(enrichedAssets, totalValue) {
  const map = new Map();
  for (const asset of enrichedAssets) {
    const cat = asset.type?.category || 'other';
    if (!map.has(cat)) map.set(cat, { category: cat, label: CATEGORY_LABELS[cat] || cat, total: 0, count: 0 });
    const row = map.get(cat);
    row.total += asset.toman_value;
    row.count += 1;
  }
  return Array.from(map.values())
    .map((row) => ({
      ...row,
      percentage: totalValue > 0 ? Math.round((row.total / totalValue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function groupByRisk(enrichedAssets, totalValue) {
  const levels = ['safe', 'medium', 'risky'];
  const out = {};
  for (const level of levels) {
    const items = enrichedAssets.filter((a) => a.risk_level === level);
    const total = items.reduce((s, a) => s + a.toman_value, 0);
    out[level] = {
      total,
      count: items.length,
      percentage: totalValue > 0 ? Math.round((total / totalValue) * 1000) / 10 : 0,
    };
  }
  return out;
}

module.exports = {
  ASSET_TYPES,
  CATEGORY_LABELS,
  getTypeByKey,
  getAssetTomanValue,
  getPriceMeta,
  getMarketCacheData,
  marketCacheAgeMinutes,
  publicTypeShape,
  groupByCategory,
  groupByRisk,
};

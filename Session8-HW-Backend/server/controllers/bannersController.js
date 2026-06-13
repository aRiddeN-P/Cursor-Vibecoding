'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db/adminDb');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads', 'banners');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const stmts = {
  listActive: db.prepare(`
    SELECT id, image_path, link_url, link_type
      FROM banners
     WHERE is_active = 1
       AND datetime(starts_at) <= datetime('now')
       AND datetime(ends_at) >= datetime('now')
     ORDER BY display_order ASC, id ASC
  `),
  getById: db.prepare('SELECT * FROM banners WHERE id = ? LIMIT 1'),
  getActiveById: db.prepare(`
    SELECT id FROM banners
     WHERE id = ?
       AND is_active = 1
       AND datetime(starts_at) <= datetime('now')
       AND datetime(ends_at) >= datetime('now')
     LIMIT 1
  `),
  incImpression: db.prepare(`
    UPDATE banners SET impression_count = impression_count + 1 WHERE id = ?
  `),
  incClick: db.prepare(`
    UPDATE banners SET click_count = click_count + 1 WHERE id = ?
  `),
  logEvent: db.prepare(`
    INSERT INTO banner_events (banner_id, event_type) VALUES (?, ?)
  `),
  todayStats: db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END), 0) AS impressions,
      COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks
    FROM banner_events
    WHERE date(created_at) = date('now')
  `),
  listAll: db.prepare(`
    SELECT * FROM banners ORDER BY display_order ASC, id DESC
  `),
  listActiveOnly: db.prepare(`
    SELECT * FROM banners WHERE is_active = 1 ORDER BY display_order ASC, id DESC
  `),
  insert: db.prepare(`
    INSERT INTO banners
      (title, image_path, link_url, link_type, starts_at, ends_at, display_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `),
  updateMeta: db.prepare(`
    UPDATE banners
       SET title = ?, link_url = ?, link_type = ?, starts_at = ?, ends_at = ?,
           display_order = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?
  `),
  updateImage: db.prepare(`
    UPDATE banners SET image_path = ?, updated_at = datetime('now') WHERE id = ?
  `),
  delete: db.prepare('DELETE FROM banners WHERE id = ?'),
  statsTotal: db.prepare(`
    SELECT
      COUNT(*) AS total_banners,
      SUM(CASE WHEN is_active = 1 AND datetime(starts_at) <= datetime('now') AND datetime(ends_at) >= datetime('now') THEN 1 ELSE 0 END) AS active_now,
      COALESCE(SUM(impression_count), 0) AS total_impressions,
      COALESCE(SUM(click_count), 0) AS total_clicks
    FROM banners
  `),
  topBanner: db.prepare(`
    SELECT id, title, click_count, impression_count
      FROM banners
     ORDER BY click_count DESC, id DESC
     LIMIT 1
  `),
};

function nowIso() {
  return new Date().toISOString();
}

function computeStatus(row) {
  if (!row.is_active) return 'disabled';
  const now = nowIso();
  if (row.ends_at < now) return 'expired';
  if (row.starts_at > now) return 'scheduled';
  return 'active';
}

function computeCtr(clicks, impressions) {
  const c = Number(clicks) || 0;
  const i = Number(impressions) || 0;
  if (i <= 0) return 0;
  return Math.round((c / i) * 10000) / 100;
}

function imageUrl(imagePath) {
  if (!imagePath) return null;
  if (String(imagePath).startsWith('/')) return imagePath;
  return `/uploads/banners/${imagePath}`;
}

function diskPath(imagePath) {
  if (!imagePath) return null;
  const rel = String(imagePath).replace(/^\/uploads\/banners\//, '');
  return path.join(uploadsRoot, rel);
}

function deleteImageFile(imagePath) {
  const full = diskPath(imagePath);
  if (!full || !fs.existsSync(full)) return;
  try { fs.unlinkSync(full); } catch (_) { /* ignore */ }
}

function publicShape(row) {
  return {
    id: row.id,
    image_url: imageUrl(row.image_path),
    link_url: row.link_url,
    link_type: row.link_type === 'internal' ? 'internal' : 'external',
    title: null,
  };
}

function adminShape(row) {
  return {
    id: row.id,
    title: row.title,
    image_url: imageUrl(row.image_path),
    link_url: row.link_url,
    link_type: row.link_type === 'internal' ? 'internal' : 'external',
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_active: Boolean(row.is_active),
    display_order: Number(row.display_order) || 0,
    click_count: Number(row.click_count) || 0,
    impression_count: Number(row.impression_count) || 0,
    ctr: computeCtr(row.click_count, row.impression_count),
    status: computeStatus(row),
  };
}

function parseIsoDatetime(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function validateDateRange(startsAt, endsAt) {
  if (!startsAt || !endsAt) return 'تاریخ شروع و پایان الزامی است';
  if (endsAt <= startsAt) return 'تاریخ پایان باید بعد از تاریخ شروع باشد';
  return null;
}

function parseLinkType(val) {
  if (val === 'internal') return 'internal';
  return 'external';
}

function recordImpression(id) {
  stmts.incImpression.run(id);
  stmts.logEvent.run(id, 'impression');
}

function recordClick(id) {
  stmts.incClick.run(id);
  stmts.logEvent.run(id, 'click');
}

function getTodayBannerStats() {
  const row = stmts.todayStats.get();
  return {
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
  };
}

function buildImagePath(filename) {
  return `/uploads/banners/${filename}`;
}

function activeEndpoint(req, res) {
  try {
    const rows = stmts.listActive.all();
    const banners = rows.map(publicShape);

    if (rows.length) {
      const ids = rows.map((r) => r.id);
      setImmediate(() => {
        try {
          const tx = db.transaction(() => {
            for (const id of ids) recordImpression(id);
          });
          tx();
        } catch (err) {
          console.error('[banners.impressions]', err);
        }
      });
    }

    return res.json({ banners });
  } catch (err) {
    console.error('[banners.active]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function clickEndpoint(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isFinite(id) && id > 0) {
      const row = stmts.getActiveById.get(id);
      if (row) recordClick(id);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[banners.click]', err);
    return res.json({ success: true });
  }
}

function adminListEndpoint(req, res) {
  try {
    const includeInactive = req.query.include_inactive !== 'false';
    const rows = includeInactive ? stmts.listAll.all() : stmts.listActiveOnly.all();
    return res.json({ banners: rows.map(adminShape) });
  } catch (err) {
    console.error('[banners.adminList]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminCreateEndpoint(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود' });
    }

    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ message: 'عنوان الزامی است' });
    if (title.length > 80) return res.status(400).json({ message: 'عنوان نمی‌تواند بیش از ۸۰ کاراکتر باشد' });

    const linkUrl = String(req.body.link_url || '').trim();
    if (!linkUrl) return res.status(400).json({ message: 'آدرس لینک الزامی است' });

    const startsAt = parseIsoDatetime(req.body.starts_at);
    const endsAt = parseIsoDatetime(req.body.ends_at);
    const rangeErr = validateDateRange(startsAt, endsAt);
    if (rangeErr) return res.status(400).json({ message: rangeErr });

    const linkType = parseLinkType(req.body.link_type);
    const displayOrder = Number(req.body.display_order);
    const order = Number.isFinite(displayOrder) ? Math.floor(displayOrder) : 0;

    const imagePath = buildImagePath(req.file.filename);
    const info = stmts.insert.run(
      title, imagePath, linkUrl, linkType, startsAt, endsAt, order
    );
    const row = stmts.getById.get(Number(info.lastInsertRowid));

    return res.status(201).json({
      success: true,
      banner: {
        id: row.id,
        title: row.title,
        image_url: imageUrl(row.image_path),
        starts_at: row.starts_at,
        ends_at: row.ends_at,
      },
    });
  } catch (err) {
    console.error('[banners.adminCreate]', err);
    return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
  }
}

function adminPatchEndpoint(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ message: 'بنر یافت نشد' });

    const existing = stmts.getById.get(id);
    if (!existing) return res.status(404).json({ message: 'بنر یافت نشد' });

    const title = req.body.title != null ? String(req.body.title).trim() : existing.title;
    const linkUrl = req.body.link_url != null ? String(req.body.link_url).trim() : existing.link_url;
    const linkType = req.body.link_type != null ? parseLinkType(req.body.link_type) : existing.link_type;
    const startsAt = req.body.starts_at != null ? parseIsoDatetime(req.body.starts_at) : existing.starts_at;
    const endsAt = req.body.ends_at != null ? parseIsoDatetime(req.body.ends_at) : existing.ends_at;
    const displayOrder = req.body.display_order != null
      ? Math.floor(Number(req.body.display_order))
      : existing.display_order;
    const isActive = req.body.is_active != null
      ? (req.body.is_active === true || req.body.is_active === 1 || req.body.is_active === '1' ? 1 : 0)
      : existing.is_active;

    if (!title) return res.status(400).json({ message: 'عنوان الزامی است' });
    const rangeErr = validateDateRange(startsAt, endsAt);
    if (rangeErr) return res.status(400).json({ message: rangeErr });

    if (req.file) {
      deleteImageFile(existing.image_path);
      stmts.updateImage.run(buildImagePath(req.file.filename), id);
    }

    stmts.updateMeta.run(
      title, linkUrl, linkType, startsAt, endsAt,
      Number.isFinite(displayOrder) ? displayOrder : 0,
      isActive, id
    );

    const row = stmts.getById.get(id);
    return res.json({ success: true, banner: adminShape(row) });
  } catch (err) {
    console.error('[banners.adminPatch]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminDeleteEndpoint(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(404).json({ message: 'بنر یافت نشد' });

    const existing = stmts.getById.get(id);
    if (!existing) return res.status(404).json({ message: 'بنر یافت نشد' });

    deleteImageFile(existing.image_path);
    stmts.delete.run(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[banners.adminDelete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function adminStatsEndpoint(req, res) {
  try {
    const totals = stmts.statsTotal.get();
    const top = stmts.topBanner.get();
    const today = getTodayBannerStats();
    const totalImpressions = Number(totals.total_impressions) || 0;
    const totalClicks = Number(totals.total_clicks) || 0;

    return res.json({
      total_banners: Number(totals.total_banners) || 0,
      active_now: Number(totals.active_now) || 0,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_impressions_today: today.impressions,
      total_clicks_today: today.clicks,
      overall_ctr: computeCtr(totalClicks, totalImpressions),
      top_banner: top ? {
        id: top.id,
        title: top.title,
        click_count: Number(top.click_count) || 0,
        ctr: computeCtr(top.click_count, top.impression_count),
      } : null,
    });
  } catch (err) {
    console.error('[banners.adminStats]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  activeEndpoint,
  clickEndpoint,
  adminListEndpoint,
  adminCreateEndpoint,
  adminPatchEndpoint,
  adminDeleteEndpoint,
  adminStatsEndpoint,
  getTodayBannerStats,
  uploadsRoot,
};

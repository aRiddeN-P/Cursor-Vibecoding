'use strict';

const fs = require('fs');
const path = require('path');
const appDb = require('../../db/appDb');
const adminDb = require('../../db/adminDb');
const { logActivity, getClientIp } = require('./adminAuthController');

const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads', 'stories');
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const adminStmts = {
  allStories: adminDb.prepare(
    'SELECT id, order_index, image_path, is_active, created_at FROM stories ORDER BY order_index ASC, id ASC'
  ),
  insertStory: adminDb.prepare(
    'INSERT INTO stories (order_index, image_path, is_active) VALUES (?, ?, 1)'
  ),
  storyById: adminDb.prepare('SELECT * FROM stories WHERE id = ?'),
  deleteStory: adminDb.prepare('DELETE FROM stories WHERE id = ?'),
  countSameImage: adminDb.prepare(
    'SELECT COUNT(*) AS cnt FROM stories WHERE image_path = ?'
  ),
};

const appStmts = {
  resetAllHasSeen: appDb.prepare('UPDATE users SET has_seen_stories = 0'),
  userCount: appDb.prepare('SELECT COUNT(*) AS cnt FROM users'),
};

function toImageUrl(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('/')) return imagePath;
  return '/uploads/stories/' + imagePath;
}

function listStories(_req, res) {
  try {
    const rows = adminStmts.allStories.all();
    return res.json({
      stories: rows.map((r) => ({
        id: r.id,
        order_index: r.order_index,
        image_path: r.image_path,
        image_url: toImageUrl(r.image_path),
        is_active: r.is_active ? 1 : 0,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[adminStories.list]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function uploadStory(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'فایل تصویر ارسال نشده است' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIMES.has(file.mimetype) || !ALLOWED_EXTS.has(ext)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        message: 'فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود',
      });
    }
    if (file.size > MAX_FILE_BYTES) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ message: 'حجم فایل بیش از ۵ مگابایت است' });
    }

    const orderIndex = Number.parseInt(req.body.order_index, 10);
    if (!Number.isInteger(orderIndex) || orderIndex < 1) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({
        message: 'ترتیب نمایش معتبر نیست — باید عدد صحیح و بزرگ‌تر از صفر باشد',
      });
    }

    const imagePath = '/uploads/stories/' + file.filename;
    const info = adminStmts.insertStory.run(orderIndex, imagePath);
    const story = adminStmts.storyById.get(info.lastInsertRowid);

    logActivity(req.session.adminId, 'upload_story', {
      target_type: 'story',
      target_id: story.id,
      ip: getClientIp(req),
      detail: { order_index: orderIndex },
    });

    return res.json({
      success: true,
      story: {
        id: story.id,
        order_index: story.order_index,
        image_url: toImageUrl(story.image_path),
      },
    });
  } catch (err) {
    console.error('[adminStories.upload]', err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ message: 'خطای سرور در آپلود فایل' });
  }
}

function patchStory(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه استوری معتبر نیست' });
    }
    const story = adminStmts.storyById.get(id);
    if (!story) return res.status(404).json({ message: 'استوری یافت نشد' });

    const updates = [];
    const params = [];

    if (req.body.is_active !== undefined) {
      const active =
        req.body.is_active === 1 ||
        req.body.is_active === true ||
        req.body.is_active === '1'
          ? 1
          : 0;
      updates.push('is_active = ?');
      params.push(active);
    }

    if (req.body.order_index !== undefined) {
      const oi = Number.parseInt(req.body.order_index, 10);
      if (!Number.isInteger(oi) || oi < 1) {
        return res.status(400).json({ message: 'ترتیب نمایش معتبر نیست' });
      }
      updates.push('order_index = ?');
      params.push(oi);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'فیلدی برای بروزرسانی ارسال نشده است' });
    }

    params.push(id);
    adminDb.prepare(`UPDATE stories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logActivity(req.session.adminId, 'update_story', {
      target_type: 'story',
      target_id: id,
      ip: getClientIp(req),
      detail: req.body,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[adminStories.patch]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function deleteStory(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: 'شناسه استوری معتبر نیست' });
    }
    const story = adminStmts.storyById.get(id);
    if (!story) return res.status(404).json({ message: 'استوری یافت نشد' });

    adminStmts.deleteStory.run(id);

    const filename = path.basename(story.image_path || '');
    const refCount = adminStmts.countSameImage.get(story.image_path).cnt;
    if (refCount === 0 && filename && filename.startsWith('story_')) {
      const onDisk = path.join(uploadsDir, filename);
      fs.unlink(onDisk, () => {});
    }

    logActivity(req.session.adminId, 'delete_story', {
      target_type: 'story',
      target_id: id,
      ip: getClientIp(req),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[adminStories.delete]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

function resetForUsers(req, res) {
  try {
    const { cnt: userCount } = appStmts.userCount.get();
    const info = appStmts.resetAllHasSeen.run();

    logActivity(req.session.adminId, 'reset_stories_all', {
      ip: getClientIp(req),
      detail: { affected_users: info.changes, total_users: userCount },
    });

    return res.json({
      success: true,
      message: 'استوری برای همه کاربران ریست شد',
      affected_users: info.changes,
      total_users: userCount,
    });
  } catch (err) {
    console.error('[adminStories.resetForUsers]', err);
    return res.status(500).json({ message: 'خطای سرور' });
  }
}

module.exports = {
  listStories,
  uploadStory,
  patchStory,
  deleteStory,
  resetForUsers,
  uploadsDir,
  MAX_FILE_BYTES,
  ALLOWED_MIMES,
};

'use strict';

const appDb = require('../db/appDb');

const SESSION_GAP_MINUTES = 30;
const MAX_SESSION_MINUTES = 480;

function endStaleSessions() {
  appDb.prepare(`
    UPDATE user_app_sessions
    SET ended_at = last_ping_at
    WHERE ended_at IS NULL
      AND datetime(last_ping_at) < datetime('now', '-' || ? || ' minutes')
  `).run(SESSION_GAP_MINUTES);
}

function pingSession(userId) {
  endStaleSessions();

  const open = appDb.prepare(`
    SELECT id, last_ping_at FROM user_app_sessions
    WHERE user_id = ? AND ended_at IS NULL
    ORDER BY id DESC LIMIT 1
  `).get(userId);

  if (open) {
    const lastMs = Date.parse(String(open.last_ping_at).replace(' ', 'T') + 'Z');
    const gapMs = Date.now() - (Number.isFinite(lastMs) ? lastMs : 0);
    if (gapMs > SESSION_GAP_MINUTES * 60 * 1000) {
      appDb.prepare('UPDATE user_app_sessions SET ended_at = last_ping_at WHERE id = ?').run(open.id);
      appDb.prepare(`
        INSERT INTO user_app_sessions (user_id, started_at, last_ping_at)
        VALUES (?, datetime('now'), datetime('now'))
      `).run(userId);
    } else {
      appDb.prepare(`
        UPDATE user_app_sessions SET last_ping_at = datetime('now') WHERE id = ?
      `).run(open.id);
    }
  } else {
    appDb.prepare(`
      INSERT INTO user_app_sessions (user_id, started_at, last_ping_at)
      VALUES (?, datetime('now'), datetime('now'))
    `).run(userId);
  }

  appDb.prepare(`
    UPDATE connected_devices SET last_active = datetime('now')
    WHERE user_id = ? AND id = (
      SELECT id FROM connected_devices WHERE user_id = ?
      ORDER BY datetime(last_active) DESC LIMIT 1
    )
  `).run(userId, userId);
}

function maxIsoDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a >= b ? a : b;
}

function getOverviewEngagement() {
  endStaleSessions();

  const row = appDb.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT user_id) FROM user_app_sessions
        WHERE date(last_ping_at) = date('now')) AS dau,
      (SELECT COUNT(DISTINCT user_id) FROM user_app_sessions
        WHERE datetime(last_ping_at) >= datetime('now', '-7 days')) AS wau,
      (SELECT COUNT(DISTINCT user_id) FROM user_app_sessions
        WHERE datetime(last_ping_at) >= datetime('now', '-30 days')) AS mau_sessions,
      (SELECT COUNT(*) FROM user_app_sessions
        WHERE datetime(started_at) >= datetime('now', '-30 days')) AS sessions_30d
  `).get();

  const { device_mau } = appDb.prepare(`
    SELECT COUNT(DISTINCT user_id) AS device_mau FROM connected_devices
    WHERE datetime(last_active) >= datetime('now', '-30 days')
  `).get();

  const { avg_session_minutes } = appDb.prepare(`
    SELECT ROUND(AVG(duration_min), 1) AS avg_session_minutes FROM (
      SELECT MIN(?, MAX(1,
        (strftime('%s', COALESCE(ended_at, last_ping_at)) - strftime('%s', started_at)) / 60.0
      )) AS duration_min
      FROM user_app_sessions
      WHERE datetime(started_at) >= datetime('now', '-30 days')
        AND datetime(COALESCE(ended_at, last_ping_at)) > datetime(started_at)
    )
  `).get(MAX_SESSION_MINUTES);

  return {
    dau: row.dau || 0,
    wau: row.wau || 0,
    mau: Math.max(row.mau_sessions || 0, device_mau || 0),
    sessions_30d: row.sessions_30d || 0,
    avg_session_minutes: avg_session_minutes || 0,
  };
}

function getUserEngagement(userId) {
  endStaleSessions();

  const sessionLast = appDb.prepare(`
    SELECT MAX(last_ping_at) AS last_seen FROM user_app_sessions WHERE user_id = ?
  `).get(userId)?.last_seen;

  const deviceLast = appDb.prepare(`
    SELECT MAX(last_active) AS last_active FROM connected_devices WHERE user_id = ?
  `).get(userId)?.last_active;

  const agg = appDb.prepare(`
    SELECT
      COUNT(*) AS session_count,
      ROUND(AVG(duration_min), 1) AS avg_session_minutes
    FROM (
      SELECT MIN(?, MAX(1,
        (strftime('%s', COALESCE(ended_at, last_ping_at)) - strftime('%s', started_at)) / 60.0
      )) AS duration_min
      FROM user_app_sessions
      WHERE user_id = ?
        AND datetime(COALESCE(ended_at, last_ping_at)) > datetime(started_at)
    )
  `).get(MAX_SESSION_MINUTES, userId);

  const { device_count } = appDb.prepare(
    'SELECT COUNT(*) AS device_count FROM connected_devices WHERE user_id = ?'
  ).get(userId);

  return {
    last_seen: maxIsoDate(sessionLast, deviceLast),
    session_count: agg.session_count || 0,
    avg_session_minutes: agg.avg_session_minutes || 0,
    device_count: device_count || 0,
  };
}

function getEngagementByMonth(monthKeys) {
  endStaleSessions();
  const countActive = appDb.prepare(`
    SELECT COUNT(DISTINCT user_id) AS cnt FROM user_app_sessions
    WHERE strftime('%Y-%m', last_ping_at) = ?
  `);
  const countSessions = appDb.prepare(`
    SELECT COUNT(*) AS cnt FROM user_app_sessions
    WHERE strftime('%Y-%m', started_at) = ?
  `);

  return monthKeys.map((month) => ({
    month,
    active_users: countActive.get(month).cnt,
    sessions: countSessions.get(month).cnt,
  }));
}

module.exports = {
  pingSession,
  getOverviewEngagement,
  getUserEngagement,
  getEngagementByMonth,
  SESSION_GAP_MINUTES,
};

/**
 * middlewares/auth.js
 * Reusable session guards.
 *   - requireUser : returns 401 unless req.session.user_id is set.
 *   - requireAdmin: returns 401 unless req.session.isAdmin === true.
 *                   (Phase 3 dev panel still uses the placeholder isAdmin flag
 *                    that is toggled via /api/admin/stories/dev-login.)
 */

function requireUser(req, res, next) {
  if (req.session && req.session.user_id) return next();
  return res.status(401).json({ message: 'لطفاً وارد حساب کاربری خود شوید' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ message: 'دسترسی غیرمجاز' });
}

module.exports = { requireUser, requireAdmin };

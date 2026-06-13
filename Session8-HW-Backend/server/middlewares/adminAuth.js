'use strict';

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    const isApi =
      req.originalUrl.startsWith('/api/') || req.path.startsWith('/api/');
    if (isApi) {
      return res.status(401).json({
        message: 'دسترسی غیرمجاز — لطفاً وارد پنل ادمین شوید',
      });
    }
    return res.redirect('/admin/login.html');
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.session || req.session.adminRole !== 'superadmin') {
    return res.status(403).json({
      message: 'این عملیات نیاز به دسترسی سوپر ادمین دارد',
    });
  }
  next();
}

module.exports = { requireAdmin, requireSuperAdmin };

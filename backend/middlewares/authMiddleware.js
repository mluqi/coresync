const jwt = require('jsonwebtoken');
const { sequelize } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeycoresync2026');
    
    // Attach decoded user info
    req.user = decoded;
    req.tenantId = decoded.tenantId;

    // Always sync latest DB user role for accuracy & verify active user_token for single-device session
    const dbUser = await sequelize.models.User.findByPk(decoded.id, { 
      attributes: ['id', 'role', 'tenantId', 'name', 'email', 'metadata', 'userToken'] 
    });

    if (!dbUser) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Pengguna tidak ditemukan atau telah dinonaktifkan.'
      });
    }

    // Single-device session verification
    if (dbUser.userToken && dbUser.userToken !== token) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_TERMINATED',
        message: 'Sesi Anda telah berakhir karena akun ini telah login di perangkat lain. Silakan login kembali.'
      });
    }

    req.user.role = dbUser.role;
    req.user.metadata = dbUser.metadata;
    if (dbUser.role === 'SUPERADMIN' && req.headers['x-tenant-id']) {
      const targetTenantId = parseInt(req.headers['x-tenant-id'], 10);
      if (!isNaN(targetTenantId) && targetTenantId > 0) {
        req.tenantId = targetTenantId;
      }
    }

    // Enforce user tax access scope (PKP or NON_PKP) in backend
    const userTaxAccess = dbUser.metadata?.taxAccess;
    if (userTaxAccess === 'PKP' || userTaxAccess === 'NON_PKP') {
      req.user.taxAccess = userTaxAccess;
      if (req.query) {
        req.query.taxStatus = userTaxAccess;
        req.query.taxType = userTaxAccess;
      }
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Normal expiration - return 401 without spamming server error logs
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Sesi Anda telah berakhir. Silakan login kembali.'
      });
    }

    // Only log actual unexpected or malformed token errors
    console.warn('JWT Verification Warning:', error.message);
    return res.status(401).json({
      success: false,
      code: 'TOKEN_INVALID',
      message: 'Token otentikasi tidak valid atau telah kadaluarsa.'
    });
  }
};

module.exports = authMiddleware;

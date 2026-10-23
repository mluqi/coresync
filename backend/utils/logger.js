const { ActivityLog, AccessLog } = require('../models');

/**
 * Utility to record User Activity Log (Audit Trail)
 * Supports both logActivity(req, options) and logActivity(options)
 */
exports.logActivity = async (reqOrPayload, maybePayload = {}) => {
  try {
    let req = null;
    let payload = maybePayload;

    if (reqOrPayload && (reqOrPayload.headers || reqOrPayload.socket || reqOrPayload.ip || reqOrPayload.method)) {
      req = reqOrPayload;
      payload = maybePayload || {};
    } else {
      payload = reqOrPayload || {};
      req = null;
    }

    const {
      action = 'UNKNOWN',
      module = 'GENERAL',
      description = '',
      metadata = null,
      tenantId = null,
      userId = null,
      userName = null,
      userRole = null
    } = payload;

    const activeTenantId = tenantId || req?.tenantId || req?.user?.tenantId || null;
    const activeUserId = userId || req?.user?.id || null;
    const activeUserName = userName || req?.user?.name || req?.user?.email || 'System';
    const activeUserRole = userRole || req?.user?.role || 'SYSTEM';

    const ipAddress = req ? (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '') : '';
    const userAgent = req ? (req.headers?.['user-agent'] || '') : '';

    await ActivityLog.create({
      tenantId: activeTenantId,
      userId: activeUserId,
      userName: activeUserName,
      userRole: activeUserRole,
      action,
      module,
      description,
      ipAddress: String(ipAddress).substring(0, 45),
      userAgent,
      metadata
    });
  } catch (err) {
    console.error('[Logger] Failed to write ActivityLog:', err.message);
  }
};

/**
 * Utility to record Authentication Access Log (Login, Failed Login, Logout)
 */
exports.logAccess = async (req, { email, action, status = 'SUCCESS', reason = null, userId = null, tenantId = null }) => {
  try {
    const activeTenantId = tenantId || req?.tenantId || req?.user?.tenantId || null;
    const activeUserId = userId || req?.user?.id || null;

    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    await AccessLog.create({
      tenantId: activeTenantId,
      userId: activeUserId,
      email: email || req?.user?.email || 'unknown',
      action,
      status,
      reason,
      ipAddress: String(ipAddress).substring(0, 45),
      userAgent
    });
  } catch (err) {
    console.error('[Logger] Failed to write AccessLog:', err.message);
  }
};

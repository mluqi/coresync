const { ActivityLog, AccessLog, User, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/logs/activity
 * Fetch paginated list of Activity Logs (Audit Trail)
 */
exports.getActivityLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = '',
      module: moduleFilter = '',
      action: actionFilter = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortDir = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

    // Scope to tenant unless SUPERADMIN viewing global
    if (req.user?.role !== 'SUPERADMIN' || req.tenantId) {
      whereClause.tenantId = req.tenantId;
    }

    if (moduleFilter) {
      whereClause.module = moduleFilter;
    }

    if (actionFilter) {
      whereClause.action = actionFilter;
    }

    if (search) {
      whereClause[Op.or] = [
        { userName: { [Op.like]: `%${search}%` } },
        { userRole: { [Op.like]: `%${search}%` } },
        { action: { [Op.like]: `%${search}%` } },
        { module: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { ipAddress: { [Op.like]: `%${search}%` } }
      ];
    }

    if (req.query.targetCode) {
      whereClause[Op.or] = [
        ...(whereClause[Op.or] || []),
        { description: { [Op.like]: `%${req.query.targetCode}%` } }
      ];
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const allowedSortCols = ['createdAt', 'userName', 'module', 'action'];
    const validSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'createdAt';
    const validSortDir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await ActivityLog.findAndCountAll({
      where: whereClause,
      order: [[validSortBy, validSortDir]],
      limit: limitNum,
      offset
    });

    const totalPages = Math.ceil(count / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/logs/access
 * Fetch paginated list of Access Logs (Login / Logout events)
 */
exports.getAccessLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = '',
      status: statusFilter = '',
      action: actionFilter = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortDir = 'DESC'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const offset = (pageNum - 1) * limitNum;

    const whereClause = {};

    // Scope to tenant unless SUPERADMIN
    if (req.user?.role !== 'SUPERADMIN' || req.tenantId) {
      whereClause.tenantId = req.tenantId;
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    if (actionFilter) {
      whereClause.action = actionFilter;
    }

    if (search) {
      whereClause[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { action: { [Op.like]: `%${search}%` } },
        { reason: { [Op.like]: `%${search}%` } },
        { ipAddress: { [Op.like]: `%${search}%` } }
      ];
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const allowedSortCols = ['createdAt', 'email', 'action', 'status'];
    const validSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'createdAt';
    const validSortDir = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await AccessLog.findAndCountAll({
      where: whereClause,
      order: [[validSortBy, validSortDir]],
      limit: limitNum,
      offset
    });

    const totalPages = Math.ceil(count / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

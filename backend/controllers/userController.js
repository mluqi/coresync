const bcrypt = require('bcryptjs');
const { User, Warehouse, Tenant } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');

exports.getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['name', 'email', 'role', 'createdAt'],
      defaultSortBy: 'name',
      defaultSortDir: 'ASC'
    });

    const whereClause = {};

    // If SUPERADMIN, allow viewing all users or filtering by tenantId
    if (req.user.role === 'SUPERADMIN') {
      if (req.query.tenantId) {
        whereClause.tenantId = req.query.tenantId;
      }
    } else {
      whereClause.tenantId = req.tenantId;
    }

    if (req.query.role) whereClause.role = req.query.role;

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'companyName', 'subdomain'] }
      ],
      order: [[sortBy, sortDir]],
      limit,
      offset
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: buildPaginationMeta(count, page, limit)
    });
  } catch (error) {
    next(error);
  }
};


exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, warehouseId, tenantId, metadata } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required.'
      });
    }

    // Check if email already exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Email '${email}' is already registered.`
      });
    }

    // Validate role
    if (!['OWNER', 'ADMIN', 'STAFF', 'SUPERADMIN'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be OWNER, ADMIN, STAFF, or SUPERADMIN.'
      });
    }

    // Determine target tenantId
    const targetTenantId = (req.user.role === 'SUPERADMIN' && tenantId) ? parseInt(tenantId, 10) : req.tenantId;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      tenantId: targetTenantId,
      warehouseId: warehouseId ? parseInt(warehouseId, 10) : null,
      name,
      email,
      passwordHash,
      role,
      metadata: metadata || null
    });

    const userResponse = await User.findByPk(user.id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'companyName'] }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'USERS',
      description: `Menambah pengguna baru: ${user.name} (${user.email} - ${user.role})`,
      metadata: { id: user.id, email: user.email, name: user.name, role: user.role }
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, warehouseId, tenantId, password, metadata } = req.body;

    // If SUPERADMIN, can update any user; otherwise restrict to tenant
    const whereClause = { id };
    if (req.user.role !== 'SUPERADMIN') {
      whereClause.tenantId = req.tenantId;
    }

    const user = await User.findOne({ where: whereClause });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email, id: { [Op.ne]: id } } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: `Email '${email}' sudah digunakan oleh pengguna lain.`
        });
      }
      user.email = email;
    }
    if (role) {
      if (!['OWNER', 'ADMIN', 'STAFF', 'SUPERADMIN'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be OWNER, ADMIN, STAFF, or SUPERADMIN.'
        });
      }
      user.role = role;
    }
    if (req.user.role === 'SUPERADMIN' && tenantId !== undefined) {
      user.tenantId = parseInt(tenantId, 10);
    }
    if (warehouseId !== undefined) {
      user.warehouseId = warehouseId ? parseInt(warehouseId, 10) : null;
    }
    if (metadata !== undefined) {
      user.metadata = metadata;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();

    const userResponse = await User.findByPk(user.id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'companyName'] }
      ]
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'USERS',
      description: `Mengubah data pengguna: ${user.name} (${user.email})`,
      metadata: { id: user.id, email: user.email, name: user.name, role: user.role }
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: userResponse
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own user account.'
      });
    }

    const whereClause = { id };
    if (req.user.role !== 'SUPERADMIN') {
      whereClause.tenantId = req.tenantId;
    }

    const user = await User.findOne({ where: whereClause });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const userData = { id: user.id, email: user.email, name: user.name, role: user.role };

    await user.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'USERS',
      description: `Menghapus pengguna: ${userData.name} (${userData.email})`,
      metadata: userData
    });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

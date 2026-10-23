const { Driver, Delivery, StockTransfer, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');
const { computeDiff } = require('../utils/auditHelper');

/**
 * GET /api/drivers
 * List drivers with pagination, search, and status filter
 */
exports.getAllDrivers = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['name', 'phone', 'vehicleNumber', 'vehicleType', 'isActive', 'createdAt'],
      defaultSortBy: 'name',
      defaultSortDir: 'ASC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.isActive !== undefined && req.query.isActive !== '') {
      whereClause.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { vehicleNumber: { [Op.like]: `%${search}%` } },
        { vehicleType: { [Op.like]: `%${search}%` } },
        { licenseNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Driver.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortDir]],
      limit,
      offset,
      distinct: true
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

/**
 * GET /api/drivers/:id
 * Get single driver details
 */
exports.getDriverById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver tidak ditemukan.'
      });
    }

    return res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/drivers
 * Create a new driver
 */
exports.createDriver = async (req, res, next) => {
  try {
    const { name, phone, licenseNumber, vehicleNumber, vehicleType, isActive, notes, metadata } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama driver wajib diisi.'
      });
    }

    const driver = await Driver.create({
      tenantId: req.tenantId,
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      licenseNumber: licenseNumber ? licenseNumber.trim() : null,
      vehicleNumber: vehicleNumber ? vehicleNumber.trim().toUpperCase() : null,
      vehicleType: vehicleType ? vehicleType.trim() : null,
      isActive: isActive !== undefined ? !!isActive : true,
      notes: notes ? notes.trim() : null,
      metadata: metadata || null
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'DRIVERS',
      description: `Menambahkan driver baru: ${driver.name} (No Pol: ${driver.vehicleNumber || '-'})`,
      metadata: {
        targetType: 'DRIVER',
        targetId: driver.id,
        targetName: driver.name,
        targetCode: driver.vehicleNumber
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Driver berhasil ditambahkan.',
      data: driver
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/drivers/:id
 * Update driver details
 */
exports.updateDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, licenseNumber, vehicleNumber, vehicleType, isActive, notes, metadata } = req.body;

    const driver = await Driver.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver tidak ditemukan.'
      });
    }

    const previousData = driver.toJSON();

    await driver.update({
      name: name !== undefined ? name.trim() : driver.name,
      phone: phone !== undefined ? (phone ? phone.trim() : null) : driver.phone,
      licenseNumber: licenseNumber !== undefined ? (licenseNumber ? licenseNumber.trim() : null) : driver.licenseNumber,
      vehicleNumber: vehicleNumber !== undefined ? (vehicleNumber ? vehicleNumber.trim().toUpperCase() : null) : driver.vehicleNumber,
      vehicleType: vehicleType !== undefined ? (vehicleType ? vehicleType.trim() : null) : driver.vehicleType,
      isActive: isActive !== undefined ? !!isActive : driver.isActive,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : driver.notes,
      metadata: metadata !== undefined ? metadata : driver.metadata
    });

    const driverDiffFields = [
      { field: 'name', label: 'Nama Driver', type: 'TEXT' },
      { field: 'phone', label: 'No. Telepon', type: 'TEXT' },
      { field: 'licenseNumber', label: 'No. SIM', type: 'TEXT' },
      { field: 'vehicleNumber', label: 'No. Polisi', type: 'TEXT' },
      { field: 'vehicleType', label: 'Tipe Kendaraan', type: 'TEXT' },
      { field: 'isActive', label: 'Status Aktif', type: 'TEXT' }
    ];

    const changes = computeDiff(previousData, driver.toJSON(), driverDiffFields);
    const changeDesc = changes.length > 0
      ? `Mengubah data driver ${driver.name}: ` + changes.map(c => `${c.label} dari ${c.beforeFormatted} ➔ ${c.afterFormatted}`).join(', ')
      : `Mengubah data driver: ${driver.name}`;

    await logActivity(req, {
      action: 'UPDATE',
      module: 'DRIVERS',
      description: changeDesc,
      metadata: {
        targetType: 'DRIVER',
        targetId: driver.id,
        targetName: driver.name,
        targetCode: driver.vehicleNumber,
        changes,
        previous: previousData
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Data driver berhasil diperbarui.',
      data: driver
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/drivers/:id
 * Delete driver
 */
exports.deleteDriver = async (req, res, next) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver tidak ditemukan.'
      });
    }

    const deletedSnapshot = driver.toJSON();

    await driver.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'DRIVERS',
      description: `Menghapus driver: ${deletedSnapshot.name} (No Pol: ${deletedSnapshot.vehicleNumber || '-'})`,
      metadata: {
        targetType: 'DRIVER',
        targetId: deletedSnapshot.id,
        targetName: deletedSnapshot.name,
        targetCode: deletedSnapshot.vehicleNumber,
        deletedSnapshot
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Driver berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

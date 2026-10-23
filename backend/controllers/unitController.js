const { Unit } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');

exports.getAllUnits = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['name', 'isActive', 'createdAt'],
      defaultSortBy: 'name',
      defaultSortDir: 'ASC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.isActive !== undefined) {
      whereClause.isActive = req.query.isActive === 'true';
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Unit.findAndCountAll({
      where: whereClause,
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

exports.createUnit = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nama satuan wajib diisi.'
      });
    }

    // Check unique unit name per tenant
    const existing = await Unit.findOne({
      where: { tenantId: req.tenantId, name }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Satuan '${name}' sudah terdaftar.`
      });
    }

    const unit = await Unit.create({
      tenantId: req.tenantId,
      name,
      description: description || null,
      isActive: true
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'UNITS',
      description: `Menambah satuan unit: ${unit.name}`,
      metadata: { id: unit.id, name: unit.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Satuan berhasil ditambahkan.',
      data: unit
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const unit = await Unit.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Satuan tidak ditemukan.'
      });
    }

    // If changing name, make sure it's unique
    if (name && name !== unit.name) {
      const existing = await Unit.findOne({
        where: { tenantId: req.tenantId, name }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Satuan '${name}' sudah digunakan.`
        });
      }
    }

    await unit.update({
      name: name !== undefined ? name : unit.name,
      description: description !== undefined ? description : unit.description,
      isActive: isActive !== undefined ? isActive : unit.isActive
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'UNITS',
      description: `Mengubah satuan unit: ${unit.name}`,
      metadata: { id: unit.id, name: unit.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Satuan berhasil diperbarui.',
      data: unit
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const unit = await Unit.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        message: 'Satuan tidak ditemukan.'
      });
    }

    const unitData = { id: unit.id, name: unit.name };

    // Soft delete / nonaktifkan saja untuk keamanan relasi barang
    await unit.update({ isActive: false });

    await logActivity(req, {
      action: 'DELETE',
      module: 'UNITS',
      description: `Menonaktifkan satuan unit: ${unitData.name}`,
      metadata: unitData
    });

    return res.status(200).json({
      success: true,
      message: 'Satuan dinonaktifkan.'
    });
  } catch (error) {
    next(error);
  }
};

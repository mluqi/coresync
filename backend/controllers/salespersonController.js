const { Salesperson } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');

exports.getAllSalespersons = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['code', 'name', 'phone', 'email', 'commissionRate', 'isActive', 'createdAt'],
      defaultSortBy: 'code',
      defaultSortDir: 'ASC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.isActive !== undefined) {
      whereClause.isActive = req.query.isActive === 'true';
    }

    if (search) {
      whereClause[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Salesperson.findAndCountAll({
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


exports.createSalesperson = async (req, res, next) => {
  try {
    const { code, name, phone, email, commissionRate, metadata } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nama salesperson wajib diisi.'
      });
    }

    let finalCode = code;
    if (!finalCode) {
      // Auto-generate code SLS-XXXX
      const lastSp = await Salesperson.findOne({
        where: { tenantId: req.tenantId, code: { [Op.like]: 'SLS-%' } },
        order: [['id', 'DESC']]
      });

      let nextSeq = 1;
      if (lastSp && lastSp.code) {
        const match = lastSp.code.match(/SLS-(\d+)/);
        if (match) nextSeq = parseInt(match[1]) + 1;
      }
      finalCode = `SLS-${String(nextSeq).padStart(4, '0')}`;
    }

    const salesperson = await Salesperson.create({
      tenantId: req.tenantId,
      code: finalCode,
      name,
      phone: phone || null,
      email: email || null,
      commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : 0,
      isActive: true,
      metadata: metadata || null
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'SALESPERSONS',
      description: `Menambah salesperson: ${salesperson.name} (${salesperson.code})`,
      metadata: { id: salesperson.id, code: salesperson.code, name: salesperson.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Salesperson berhasil ditambahkan.',
      data: salesperson
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSalesperson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, phone, email, commissionRate, isActive, metadata } = req.body;

    const salesperson = await Salesperson.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!salesperson) {
      return res.status(404).json({
        success: false,
        message: 'Salesperson tidak ditemukan.'
      });
    }

    await salesperson.update({
      code: code !== undefined ? code : salesperson.code,
      name: name ?? salesperson.name,
      phone: phone !== undefined ? phone : salesperson.phone,
      email: email !== undefined ? email : salesperson.email,
      commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : salesperson.commissionRate,
      isActive: isActive !== undefined ? isActive : salesperson.isActive,
      metadata: metadata !== undefined ? metadata : salesperson.metadata
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'SALESPERSONS',
      description: `Mengubah data salesperson: ${salesperson.name} (${salesperson.code})`,
      metadata: { id: salesperson.id, code: salesperson.code, name: salesperson.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Salesperson berhasil diperbarui.',
      data: salesperson
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteSalesperson = async (req, res, next) => {
  try {
    const { id } = req.params;

    const salesperson = await Salesperson.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!salesperson) {
      return res.status(404).json({
        success: false,
        message: 'Salesperson tidak ditemukan.'
      });
    }

    const spData = { id: salesperson.id, code: salesperson.code, name: salesperson.name };

    await salesperson.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'SALESPERSONS',
      description: `Menghapus salesperson: ${spData.name} (${spData.code})`,
      metadata: spData
    });

    return res.status(200).json({
      success: true,
      message: 'Salesperson berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

const { StockLedger, Product, Warehouse, ProductUnit } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');

exports.getAllStockLedgers = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['quantity', 'createdAt', 'referenceNumber', 'qty'],
      defaultSortBy: 'createdAt',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.productId) {
      whereClause.productId = parseInt(req.query.productId);
    }
    if (req.query.warehouseId) {
      whereClause.warehouseId = parseInt(req.query.warehouseId);
    }

    if (search) {
      whereClause[Op.or] = [
        { referenceType: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await StockLedger.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'sku', 'name', 'unit', 'metadata'],
          include: [{ model: ProductUnit, as: 'units' }]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] }
      ],
      order: [
        [sortBy === 'quantity' ? 'qty' : sortBy, sortDir],
        ...(sortBy !== 'id' ? [['id', sortDir]] : [])
      ],
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


const { Warehouse } = require('../models');
const { logActivity } = require('../utils/logger');

exports.getAllWarehouses = async (req, res, next) => {
  try {
    const whereClause = {};
    if (req.user.role === 'SUPERADMIN' && req.query.tenantId) {
      whereClause.tenantId = req.query.tenantId;
    } else {
      whereClause.tenantId = req.tenantId;
    }

    const warehouses = await Warehouse.findAll({
      where: whereClause
    });

    return res.status(200).json({
      success: true,
      data: warehouses
    });
  } catch (error) {
    next(error);
  }
};

exports.createWarehouse = async (req, res, next) => {
  try {
    const { name, address, isActive, type, metadata } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse name is required.'
      });
    }

    const warehouse = await Warehouse.create({
      tenantId: req.tenantId,
      name,
      address,
      isActive: isActive !== undefined ? isActive : true,
      type: type || 'REGULAR',
      metadata
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'WAREHOUSES',
      description: `Menambah gudang baru: ${warehouse.name} (${warehouse.type})`,
      metadata: { id: warehouse.id, name: warehouse.name, type: warehouse.type }
    });

    return res.status(201).json({
      success: true,
      message: 'Warehouse created successfully.',
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

exports.updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, address, isActive, type, metadata } = req.body;

    const warehouse = await Warehouse.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found or access denied.'
      });
    }

    await warehouse.update({
      name: name !== undefined ? name : warehouse.name,
      address: address !== undefined ? address : warehouse.address,
      isActive: isActive !== undefined ? isActive : warehouse.isActive,
      type: type !== undefined ? type : warehouse.type,
      metadata: metadata !== undefined ? metadata : warehouse.metadata
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'WAREHOUSES',
      description: `Mengubah data gudang: ${warehouse.name}`,
      metadata: { id: warehouse.id, name: warehouse.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Warehouse updated successfully.',
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const warehouse = await Warehouse.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found or access denied.'
      });
    }

    const { User, ProductWarehouse, PurchaseOrder, Delivery, StockOpname, StockLedger, IncomingBatch } = require('../models');
    const { Op } = require('sequelize');

    const hasUsers = await User.findOne({ where: { warehouseId: id } });
    const hasActiveStock = await ProductWarehouse.findOne({ where: { warehouseId: id, stock: { [Op.gt]: 0 } } });
    const hasPO = await PurchaseOrder.findOne({ where: { warehouseId: id } });
    const hasDelivery = await Delivery.findOne({ where: { warehouseId: id } });
    const hasOpname = await StockOpname.findOne({ where: { warehouseId: id } });
    const hasLedger = await StockLedger.findOne({ where: { warehouseId: id } });
    const hasBatch = await IncomingBatch.findOne({ where: { warehouseId: id } });

    if (hasUsers || hasActiveStock || hasPO || hasDelivery || hasOpname || hasLedger || hasBatch) {
      return res.status(400).json({
        success: false,
        message: 'Gudang ini tidak dapat dihapus karena masih terhubung dengan pengguna, stok produk, atau riwayat transaksi. Anda dapat me-nonaktifkan status gudang.'
      });
    }

    const warehouseData = { id: warehouse.id, name: warehouse.name };

    await ProductWarehouse.destroy({ where: { warehouseId: id } });
    await warehouse.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'WAREHOUSES',
      description: `Menghapus gudang: ${warehouseData.name}`,
      metadata: warehouseData
    });

    return res.status(200).json({
      success: true,
      message: 'Gudang berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

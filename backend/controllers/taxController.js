const { Tax } = require('../models');
const { logActivity } = require('../utils/logger');

exports.getAllTaxes = async (req, res, next) => {
  try {
    const taxes = await Tax.findAll({
      where: { tenantId: req.tenantId }
    });

    return res.status(200).json({
      success: true,
      data: taxes
    });
  } catch (error) {
    next(error);
  }
};

exports.createTax = async (req, res, next) => {
  try {
    const { name, rate, isActive } = req.body;

    if (!name || rate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and rate are required.'
      });
    }

    const tax = await Tax.create({
      tenantId: req.tenantId,
      name,
      rate,
      isActive: isActive !== undefined ? isActive : true
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'TAXES',
      description: `Menambah tarif pajak: ${tax.name} (${tax.rate}%)`,
      metadata: { id: tax.id, name: tax.name, rate: tax.rate }
    });

    return res.status(201).json({
      success: true,
      message: 'Tax created successfully.',
      data: tax
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTax = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, rate, isActive } = req.body;

    const tax = await Tax.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!tax) {
      return res.status(404).json({
        success: false,
        message: 'Tax not found or access denied.'
      });
    }

    await tax.update({
      name: name !== undefined ? name : tax.name,
      rate: rate !== undefined ? rate : tax.rate,
      isActive: isActive !== undefined ? isActive : tax.isActive
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'TAXES',
      description: `Mengubah tarif pajak: ${tax.name} (${tax.rate}%)`,
      metadata: { id: tax.id, name: tax.name, rate: tax.rate }
    });

    return res.status(200).json({
      success: true,
      message: 'Tax updated successfully.',
      data: tax
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteTax = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!tax) {
      return res.status(404).json({
        success: false,
        message: 'Tax not found or access denied.'
      });
    }

    const { Product } = require('../models');
    const hasProducts = await Product.findOne({ where: { taxId: id } });

    if (hasProducts) {
      return res.status(400).json({
        success: false,
        message: 'Tarif pajak ini tidak dapat dihapus karena sedang digunakan oleh beberapa produk.'
      });
    }

    const taxData = { id: tax.id, name: tax.name, rate: tax.rate };

    await tax.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'TAXES',
      description: `Menghapus tarif pajak: ${taxData.name} (${taxData.rate}%)`,
      metadata: taxData
    });

    return res.status(200).json({
      success: true,
      message: 'Tarif pajak berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

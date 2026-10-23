const { Supplier, PurchaseOrder } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../utils/logger');

exports.getAllSuppliers = async (req, res, next) => {
  try {
    const {
      search = '',
      status,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortDir = 'ASC'
    } = req.query;

    const isAll = req.query.limit === 'all';
    const pageNum = Math.max(1, parseInt(page));
    const requestedLimit = parseInt(limit);
    const limitNum = isAll ? undefined : Math.min(100, Math.max(1, requestedLimit || 20));
    const offset = isAll ? undefined : (pageNum - 1) * limitNum;

    const allowedSortCols = ['code', 'name', 'email', 'phone', 'contactPerson', 'topDays', 'creditLimit', 'createdAt'];
    const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'name';
    const safeSortDir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = { tenantId: req.tenantId };

    if (status === 'ACTIVE' || status === 'true') {
      whereClause.isActive = true;
    } else if (status === 'INACTIVE' || status === 'false') {
      whereClause.isActive = false;
    }

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: q } },
        { code: { [Op.like]: q } },
        { legacyCode: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
        { phone2: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { npwp: { [Op.like]: q } },
        { nik: { [Op.like]: q } },
        { contactPerson: { [Op.like]: q } },
        { contactPersonPhone: { [Op.like]: q } }
      ];
    }

    const queryOptions = {
      where: whereClause,
      order: [[safeSortBy, safeSortDir]],
      distinct: true
    };

    if (!isAll && limitNum) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
    }

    const { count, rows } = await Supplier.findAndCountAll(queryOptions);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: isAll ? {
        total: count,
        page: 1,
        limit: count,
        totalPages: 1
      } : {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Pemasok tidak ditemukan.' });
    }

    return res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const {
      code,
      legacyCode,
      name,
      address,
      address2,
      phone,
      phone2,
      email,
      shippingAddress,
      districtName,
      topDays,
      creditLimit,
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxCity,
      taxProvince,
      priceTier,
      metadata
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama Pemasok / Perusahaan wajib diisi.'
      });
    }

    // Auto-generate supplier code if not provided
    let finalCode = code;
    if (!finalCode) {
      const count = await Supplier.count({ where: { tenantId: req.tenantId } });
      finalCode = `SUPP-${String(count + 1).padStart(5, '0')}`;
    }

    const supplier = await Supplier.create({
      tenantId: req.tenantId,
      code: finalCode,
      legacyCode,
      name,
      address,
      address2,
      phone,
      phone2,
      email,
      shippingAddress,
      districtName,
      topDays: parseInt(topDays || 0),
      creditLimit: parseFloat(creditLimit || 0),
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxCity,
      taxProvince,
      priceTier: priceTier || 'STANDAR',
      metadata
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'SUPPLIERS',
      description: `Menambah supplier baru: ${supplier.name} (${supplier.code})`,
      metadata: { id: supplier.id, code: supplier.code, name: supplier.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Data pemasok berhasil disimpan.',
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Pemasok tidak ditemukan atau akses ditolak.'
      });
    }

    const {
      code,
      legacyCode,
      name,
      address,
      address2,
      phone,
      phone2,
      email,
      shippingAddress,
      districtName,
      topDays,
      creditLimit,
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxCity,
      taxProvince,
      priceTier,
      metadata
    } = req.body;

    await supplier.update({
      code: code !== undefined ? code : supplier.code,
      legacyCode: legacyCode !== undefined ? legacyCode : supplier.legacyCode,
      name: name !== undefined ? name : supplier.name,
      address: address !== undefined ? address : supplier.address,
      address2: address2 !== undefined ? address2 : supplier.address2,
      phone: phone !== undefined ? phone : supplier.phone,
      phone2: phone2 !== undefined ? phone2 : supplier.phone2,
      email: email !== undefined ? email : supplier.email,
      shippingAddress: shippingAddress !== undefined ? shippingAddress : supplier.shippingAddress,
      districtName: districtName !== undefined ? districtName : supplier.districtName,
      topDays: topDays !== undefined ? parseInt(topDays || 0) : supplier.topDays,
      creditLimit: creditLimit !== undefined ? parseFloat(creditLimit || 0) : supplier.creditLimit,
      contactPerson: contactPerson !== undefined ? contactPerson : supplier.contactPerson,
      contactPersonPhone: contactPersonPhone !== undefined ? contactPersonPhone : supplier.contactPersonPhone,
      nik: nik !== undefined ? nik : supplier.nik,
      npwp: npwp !== undefined ? npwp : supplier.npwp,
      taxName: taxName !== undefined ? taxName : supplier.taxName,
      taxAddress1: taxAddress1 !== undefined ? taxAddress1 : supplier.taxAddress1,
      taxAddress2: taxAddress2 !== undefined ? taxAddress2 : supplier.taxAddress2,
      taxCity: taxCity !== undefined ? taxCity : supplier.taxCity,
      taxProvince: taxProvince !== undefined ? taxProvince : supplier.taxProvince,
      priceTier: priceTier !== undefined ? priceTier : supplier.priceTier,
      metadata: metadata !== undefined ? metadata : supplier.metadata
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'SUPPLIERS',
      description: `Mengubah data supplier: ${supplier.name} (${supplier.code})`,
      metadata: { id: supplier.id, code: supplier.code, name: supplier.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Data pemasok berhasil diperbarui.',
      data: supplier
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Pemasok tidak ditemukan atau akses ditolak.'
      });
    }

    // Check transaction history in PurchaseOrder
    const hasPO = await PurchaseOrder.findOne({ where: { contactId: id } });

    if (hasPO) {
      return res.status(400).json({
        success: false,
        message: 'Pemasok tidak dapat dihapus karena sudah memiliki riwayat transaksi Purchase Order (PO).'
      });
    }

    const deletedSupplierData = { id: supplier.id, code: supplier.code, name: supplier.name };

    await supplier.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'SUPPLIERS',
      description: `Menghapus supplier: ${deletedSupplierData.name} (${deletedSupplierData.code})`,
      metadata: deletedSupplierData
    });

    return res.status(200).json({
      success: true,
      message: 'Data pemasok berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

const { Customer, SalesOrder, Salesperson, sequelize } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const { logActivity } = require('../utils/logger');

exports.getAllCustomers = async (req, res, next) => {
  try {
    const {
      search = '',
      regionCode,
      areaCode,
      salespersonId,
      status,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortDir = 'ASC'
    } = req.query;

    const isAll = req.query.limit === 'all';
    const pageNum = Math.max(1, parseInt(page));
    const requestedLimit = parseInt(limit);
    const limitNum = isAll ? undefined : Math.min(10000, Math.max(1, requestedLimit || 20));
    const offset = isAll ? undefined : (pageNum - 1) * limitNum;

    const allowedSortCols = ['code', 'name', 'phone', 'contactPerson', 'topDays', 'creditLimit', 'createdAt'];
    const safeSortBy = allowedSortCols.includes(sortBy) ? sortBy : 'name';
    const safeSortDir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = { tenantId: req.tenantId };

    if (regionCode) whereClause.regionCode = regionCode;
    if (areaCode) whereClause.areaCode = areaCode;
    if (salespersonId) {
      const spIdNum = parseInt(salespersonId);
      if (!isNaN(spIdNum)) {
        const sp = await Salesperson.findOne({ where: { id: spIdNum, tenantId: req.tenantId } });
        if (sp) {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push({
            [Op.or]: [
              { salespersonId: sp.id },
              ...(sp.code ? [{ salespersonCode: sp.code }] : []),
              ...(sp.name ? [{ salespersonName: sp.name }] : [])
            ]
          });
        } else {
          whereClause.salespersonId = spIdNum;
        }
      } else {
        whereClause.salespersonId = salespersonId;
      }
    }
    if (status === 'ACTIVE' || status === 'true') {
      whereClause.isActive = true;
    } else if (status === 'INACTIVE' || status === 'false') {
      whereClause.isActive = false;
    }

    let relevanceOrder = null;

    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      const tokens = trimmedSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const cleanTokens = tokens.map(t => t.replace(/'/g, "''"));
      const fullClean = trimmedSearch.toLowerCase().replace(/'/g, "''");

      // Match each token across customer fields (AND of ORs if multiple words)
      const tokenConditions = cleanTokens.map(token => {
        const q = `%${token}%`;
        return {
          [Op.or]: [
            { name: { [Op.like]: q } },
            { code: { [Op.like]: q } },
            { legacyCode: { [Op.like]: q } },
            { phone: { [Op.like]: q } },
            { phone2: { [Op.like]: q } },
            { npwp: { [Op.like]: q } },
            { nik: { [Op.like]: q } },
            { contactPerson: { [Op.like]: q } },
            { contactPersonPhone: { [Op.like]: q } },
            { salespersonName: { [Op.like]: q } },
            { areaName: { [Op.like]: q } },
            { regionName: { [Op.like]: q } },
            { districtName: { [Op.like]: q } },
            { address: { [Op.like]: q } }
          ]
        };
      });

      if (tokenConditions.length === 1) {
        whereClause[Op.or] = tokenConditions[0][Op.or];
      } else if (tokenConditions.length > 1) {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(...tokenConditions);
      }

      // Relevance ranking: Prioritize exact matches, prefix matches, and name matches before address matches
      const firstToken = cleanTokens[0] || fullClean;
      const secondToken = cleanTokens[1] || '';

      const multiTokenBranch = secondToken
        ? `WHEN LOWER(Customer.name) LIKE '%${firstToken}%' AND LOWER(Customer.name) LIKE '%${secondToken}%' THEN 5`
        : `WHEN LOWER(Customer.name) LIKE '%${firstToken}%' THEN 5`;

      relevanceOrder = sequelize.literal(`
        CASE
          WHEN LOWER(Customer.name) = '${fullClean}' THEN 1
          WHEN LOWER(Customer.name) LIKE '${fullClean}%' THEN 2
          WHEN LOWER(Customer.name) LIKE '% ${fullClean}%' THEN 3
          WHEN LOWER(Customer.name) LIKE '%${fullClean}%' THEN 4
          ${multiTokenBranch}
          WHEN LOWER(Customer.code) = '${fullClean}' THEN 6
          WHEN LOWER(Customer.code) LIKE '${fullClean}%' THEN 7
          WHEN LOWER(Customer.code) LIKE '%${fullClean}%' THEN 8
          WHEN LOWER(Customer.contact_person) LIKE '%${fullClean}%' THEN 9
          ELSE 10
        END
      `);
    }

    const orderClauses = [];
    if (relevanceOrder) {
      orderClauses.push([relevanceOrder, 'ASC']);
    }
    orderClauses.push([safeSortBy, safeSortDir]);

    const queryOptions = {
      where: whereClause,
      include: [
        ...(Salesperson ? [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code', 'phone'] }] : [])
      ],
      order: orderClauses,
      distinct: true
    };

    if (!isAll && limitNum) {
      queryOptions.limit = limitNum;
      queryOptions.offset = offset;
    }

    const { count, rows } = await Customer.findAndCountAll(queryOptions);

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

exports.getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        ...(Salesperson ? [{ model: Salesperson, as: 'salesperson' }] : [])
      ]
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    }

    return res.status(200).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const {
      code,
      legacyCode,
      name,
      address,
      address2,
      phone,
      phone2,
      regionCode,
      regionName,
      typeCode,
      typeName,
      areaCode,
      areaName,
      districtName,
      salespersonCode,
      salespersonName,
      salespersonId,
      topDays,
      creditLimit,
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxBlock,
      taxHouseNumber,
      taxRt,
      taxRw,
      taxKelurahan,
      taxKecamatan,
      taxCity,
      taxProvince,
      priceTier,
      visitDays,
      visitWeeks,
      visitTime,
      openOutletDate,
      metadata
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama Langganan / Toko wajib diisi.'
      });
    }

    // Auto-generate customer code if not provided
    let finalCode = code;
    if (!finalCode) {
      const count = await Customer.count({ where: { tenantId: req.tenantId } });
      finalCode = `C-TGL-${String(count + 1).padStart(6, '0')}`;
    }

    // If salespersonId provided, auto fill code/name if missing
    let finalSalespersonCode = salespersonCode;
    let finalSalespersonName = salespersonName;
    let finalSalespersonId = salespersonId;
    if (!finalSalespersonId && salespersonCode) {
      const cleanCode = String(salespersonCode).replace(/[^0-9]/g, '');
      if (cleanCode) finalSalespersonId = parseInt(cleanCode);
    }
    if (finalSalespersonId && (!finalSalespersonName || !finalSalespersonCode)) {
      const sp = await Salesperson.findByPk(finalSalespersonId);
      if (sp) {
        finalSalespersonName = finalSalespersonName || sp.name;
        finalSalespersonCode = finalSalespersonCode || `SP-${sp.id}`;
      }
    }

    const customer = await Customer.create({
      tenantId: req.tenantId,
      code: finalCode,
      legacyCode,
      name,
      address,
      address2,
      phone,
      phone2,
      regionCode,
      regionName,
      typeCode,
      typeName,
      areaCode,
      areaName,
      districtName,
      salespersonCode: finalSalespersonCode,
      salespersonName: finalSalespersonName,
      salespersonId: finalSalespersonId || null,
      topDays: parseInt(topDays || 0),
      creditLimit: parseFloat(creditLimit || 0),
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxBlock,
      taxHouseNumber,
      taxRt,
      taxRw,
      taxKelurahan,
      taxKecamatan,
      taxCity,
      taxProvince,
      priceTier: priceTier || 'REGULER',
      visitDays: visitDays || [],
      visitWeeks: visitWeeks || [],
      visitTime: visitTime || null,
      openOutletDate: openOutletDate || null,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      metadata
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'CUSTOMERS',
      description: `Menambah pelanggan baru: ${customer.name} (${customer.code})`,
      metadata: { id: customer.id, code: customer.code, name: customer.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Data pelanggan berhasil disimpan.',
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan atau akses ditolak.'
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
      regionCode,
      regionName,
      typeCode,
      typeName,
      areaCode,
      areaName,
      districtName,
      salespersonCode,
      salespersonName,
      salespersonId,
      topDays,
      creditLimit,
      contactPerson,
      contactPersonPhone,
      nik,
      npwp,
      taxName,
      taxAddress1,
      taxAddress2,
      taxBlock,
      taxHouseNumber,
      taxRt,
      taxRw,
      taxKelurahan,
      taxKecamatan,
      taxCity,
      taxProvince,
      priceTier,
      visitDays,
      visitWeeks,
      visitTime,
      openOutletDate,
      isActive,
      metadata
    } = req.body;

    let finalSalespersonId = salespersonId;
    if (finalSalespersonId === undefined && salespersonCode) {
      const cleanCode = String(salespersonCode).replace(/[^0-9]/g, '');
      if (cleanCode) finalSalespersonId = parseInt(cleanCode);
    }

    await customer.update({
      code: code !== undefined ? code : customer.code,
      legacyCode: legacyCode !== undefined ? legacyCode : customer.legacyCode,
      name: name !== undefined ? name : customer.name,
      address: address !== undefined ? address : customer.address,
      address2: address2 !== undefined ? address2 : customer.address2,
      phone: phone !== undefined ? phone : customer.phone,
      phone2: phone2 !== undefined ? phone2 : customer.phone2,
      regionCode: regionCode !== undefined ? regionCode : customer.regionCode,
      regionName: regionName !== undefined ? regionName : customer.regionName,
      typeCode: typeCode !== undefined ? typeCode : customer.typeCode,
      typeName: typeName !== undefined ? typeName : customer.typeName,
      areaCode: areaCode !== undefined ? areaCode : customer.areaCode,
      areaName: areaName !== undefined ? areaName : customer.areaName,
      districtName: districtName !== undefined ? districtName : customer.districtName,
      salespersonCode: salespersonCode !== undefined ? salespersonCode : customer.salespersonCode,
      salespersonName: salespersonName !== undefined ? salespersonName : customer.salespersonName,
      salespersonId: finalSalespersonId !== undefined ? finalSalespersonId : customer.salespersonId,
      topDays: topDays !== undefined ? parseInt(topDays || 0) : customer.topDays,
      creditLimit: creditLimit !== undefined ? parseFloat(creditLimit || 0) : customer.creditLimit,
      contactPerson: contactPerson !== undefined ? contactPerson : customer.contactPerson,
      contactPersonPhone: contactPersonPhone !== undefined ? contactPersonPhone : customer.contactPersonPhone,
      nik: nik !== undefined ? nik : customer.nik,
      npwp: npwp !== undefined ? npwp : customer.npwp,
      taxName: taxName !== undefined ? taxName : customer.taxName,
      taxAddress1: taxAddress1 !== undefined ? taxAddress1 : customer.taxAddress1,
      taxAddress2: taxAddress2 !== undefined ? taxAddress2 : customer.taxAddress2,
      taxBlock: taxBlock !== undefined ? taxBlock : customer.taxBlock,
      taxHouseNumber: taxHouseNumber !== undefined ? taxHouseNumber : customer.taxHouseNumber,
      taxRt: taxRt !== undefined ? taxRt : customer.taxRt,
      taxRw: taxRw !== undefined ? taxRw : customer.taxRw,
      taxKelurahan: taxKelurahan !== undefined ? taxKelurahan : customer.taxKelurahan,
      taxKecamatan: taxKecamatan !== undefined ? taxKecamatan : customer.taxKecamatan,
      taxCity: taxCity !== undefined ? taxCity : customer.taxCity,
      taxProvince: taxProvince !== undefined ? taxProvince : customer.taxProvince,
      priceTier: priceTier !== undefined ? priceTier : customer.priceTier,
      visitDays: visitDays !== undefined ? visitDays : customer.visitDays,
      visitWeeks: visitWeeks !== undefined ? visitWeeks : customer.visitWeeks,
      visitTime: visitTime !== undefined ? visitTime : customer.visitTime,
      openOutletDate: openOutletDate !== undefined ? openOutletDate : customer.openOutletDate,
      isActive: isActive !== undefined ? Boolean(isActive) : customer.isActive,
      metadata: metadata !== undefined ? metadata : customer.metadata
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'CUSTOMERS',
      description: `Mengubah data pelanggan: ${customer.name} (${customer.code})`,
      metadata: { id: customer.id, code: customer.code, name: customer.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui.',
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan.'
      });
    }

    const nextStatus = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !customer.isActive;
    await customer.update({ isActive: nextStatus });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'CUSTOMERS',
      description: `Mengubah status pelanggan: ${customer.name} (${customer.code}) menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`,
      metadata: { id: customer.id, code: customer.code, name: customer.name, isActive: nextStatus }
    });

    return res.status(200).json({
      success: true,
      message: `Status pelanggan "${customer.name}" berhasil diubah menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}.`,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan atau akses ditolak.'
      });
    }

    // Check if customer has related sales orders
    const soCount = await SalesOrder.count({
      where: { contactId: id, tenantId: req.tenantId }
    });

    if (soCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Pelanggan tidak dapat dihapus karena memiliki ${soCount} transaksi Sales Order terkait.`
      });
    }

    const deletedCustomerData = { id: customer.id, code: customer.code, name: customer.name };

    await customer.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'CUSTOMERS',
      description: `Menghapus pelanggan: ${deletedCustomerData.name} (${deletedCustomerData.code})`,
      metadata: deletedCustomerData
    });

    return res.status(200).json({
      success: true,
      message: 'Pelanggan berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

const { parseCustomerExcel } = require('../utils/customerExcelParser');

exports.importCustomers = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'File Excel wajib diunggah.'
      });
    }

    const rawCustomers = parseCustomerExcel(req.file.buffer);

    if (!rawCustomers || rawCustomers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada data pelanggan yang valid ditemukan di dalam file Excel.'
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // Pre-fetch salespersons for automatic ID resolution
    const salespersons = await Salesperson.findAll({ where: { tenantId: req.tenantId } });
    const spMapByName = new Map();
    salespersons.forEach(sp => {
      spMapByName.set(sp.name.trim().toLowerCase(), sp);
    });

    for (let i = 0; i < rawCustomers.length; i++) {
      const row = rawCustomers[i];
      try {
        if (!row.name || !row.name.trim()) continue;

        // Map salespersonCode directly into salespersonId if numeric, or match existing
        let matchedSpId = row.salespersonId || null;
        if (row.salespersonCode) {
          const cleanCode = String(row.salespersonCode).replace(/[^0-9]/g, '');
          if (cleanCode) {
            matchedSpId = parseInt(cleanCode);
          }
        }
        if (!matchedSpId && row.salespersonName) {
          const sp = spMapByName.get(row.salespersonName.trim().toLowerCase());
          if (sp) matchedSpId = sp.id;
        }

        // Check if customer exists strictly by code or legacyCode
        let existingCustomer = null;
        if (row.code && String(row.code).trim()) {
          existingCustomer = await Customer.findOne({
            where: { tenantId: req.tenantId, code: String(row.code).trim() }
          });
        }
        if (!existingCustomer && row.legacyCode && String(row.legacyCode).trim()) {
          existingCustomer = await Customer.findOne({
            where: { tenantId: req.tenantId, legacyCode: String(row.legacyCode).trim() }
          });
        }

        if (existingCustomer) {
          await existingCustomer.update({
            code: (row.code && String(row.code).trim()) || existingCustomer.code,
            legacyCode: (row.legacyCode && String(row.legacyCode).trim()) || existingCustomer.legacyCode,
            name: (row.name && String(row.name).trim()) || existingCustomer.name,
            address: row.address ? row.address : existingCustomer.address,
            address2: row.address2 ? row.address2 : existingCustomer.address2,
            phone: row.phone ? row.phone : existingCustomer.phone,
            phone2: row.phone2 ? row.phone2 : existingCustomer.phone2,
            regionCode: row.regionCode ? row.regionCode : existingCustomer.regionCode,
            regionName: row.regionName ? row.regionName : existingCustomer.regionName,
            typeCode: row.typeCode ? row.typeCode : existingCustomer.typeCode,
            typeName: row.typeName ? row.typeName : existingCustomer.typeName,
            areaCode: row.areaCode ? row.areaCode : existingCustomer.areaCode,
            areaName: row.areaName ? row.areaName : existingCustomer.areaName,
            districtName: row.districtName ? row.districtName : existingCustomer.districtName,
            salespersonCode: row.salespersonCode ? row.salespersonCode : existingCustomer.salespersonCode,
            salespersonName: row.salespersonName ? row.salespersonName : existingCustomer.salespersonName,
            salespersonId: matchedSpId || existingCustomer.salespersonId,
            topDays: row.topDays !== undefined && row.topDays !== null ? parseInt(row.topDays || 0) : existingCustomer.topDays,
            creditLimit: row.creditLimit !== undefined && row.creditLimit !== null ? parseFloat(row.creditLimit || 0) : existingCustomer.creditLimit,
            contactPerson: row.contactPerson ? row.contactPerson : existingCustomer.contactPerson,
            contactPersonPhone: row.contactPersonPhone ? row.contactPersonPhone : existingCustomer.contactPersonPhone,
            nik: row.nik ? row.nik : existingCustomer.nik,
            npwp: row.npwp ? row.npwp : existingCustomer.npwp,
            taxName: row.taxName ? row.taxName : existingCustomer.taxName,
            taxAddress1: row.taxAddress1 ? row.taxAddress1 : existingCustomer.taxAddress1,
            taxAddress2: row.taxAddress2 ? row.taxAddress2 : existingCustomer.taxAddress2,
            taxBlock: row.taxBlock ? row.taxBlock : existingCustomer.taxBlock,
            taxHouseNumber: row.taxHouseNumber ? row.taxHouseNumber : existingCustomer.taxHouseNumber,
            taxRt: row.taxRt ? row.taxRt : existingCustomer.taxRt,
            taxRw: row.taxRw ? row.taxRw : existingCustomer.taxRw,
            taxKelurahan: row.taxKelurahan ? row.taxKelurahan : existingCustomer.taxKelurahan,
            taxKecamatan: row.taxKecamatan ? row.taxKecamatan : existingCustomer.taxKecamatan,
            taxCity: row.taxCity ? row.taxCity : existingCustomer.taxCity,
            taxProvince: row.taxProvince ? row.taxProvince : existingCustomer.taxProvince,
            priceTier: row.priceTier || existingCustomer.priceTier,
            visitDays: row.visitDays && row.visitDays.length > 0 ? row.visitDays : existingCustomer.visitDays,
            visitWeeks: row.visitWeeks && row.visitWeeks.length > 0 ? row.visitWeeks : existingCustomer.visitWeeks,
            visitTime: row.visitTime || existingCustomer.visitTime,
            openOutletDate: row.openOutletDate || existingCustomer.openOutletDate
          });
          updatedCount++;
        } else {
          // Generate code if missing
          let custCode = row.code;
          if (!custCode) {
            const count = await Customer.count({ where: { tenantId: req.tenantId } });
            custCode = `C-TGL-${String(count + 1).padStart(6, '0')}`;
          }

          await Customer.create({
            tenantId: req.tenantId,
            code: custCode,
            legacyCode: row.legacyCode || null,
            name: row.name.trim(),
            address: row.address || null,
            address2: row.address2 || null,
            phone: row.phone || null,
            phone2: row.phone2 || null,
            regionCode: row.regionCode || null,
            regionName: row.regionName || null,
            typeCode: row.typeCode || null,
            typeName: row.typeName || null,
            areaCode: row.areaCode || null,
            areaName: row.areaName || null,
            districtName: row.districtName || null,
            salespersonCode: row.salespersonCode || null,
            salespersonName: row.salespersonName || null,
            salespersonId: matchedSpId || null,
            topDays: parseInt(row.topDays || 0),
            creditLimit: parseFloat(row.creditLimit || 0),
            contactPerson: row.contactPerson || null,
            contactPersonPhone: row.contactPersonPhone || null,
            nik: row.nik || null,
            npwp: row.npwp || null,
            taxName: row.taxName || null,
            taxAddress1: row.taxAddress1 || null,
            taxAddress2: row.taxAddress2 || null,
            taxBlock: row.taxBlock || null,
            taxHouseNumber: row.taxHouseNumber || null,
            taxRt: row.taxRt || null,
            taxRw: row.taxRw || null,
            taxKelurahan: row.taxKelurahan || null,
            taxKecamatan: row.taxKecamatan || null,
            taxCity: row.taxCity || null,
            taxProvince: row.taxProvince || null,
            priceTier: row.priceTier || 'REGULER',
            visitDays: row.visitDays || [],
            visitWeeks: row.visitWeeks || [],
            visitTime: row.visitTime || null,
            openOutletDate: row.openOutletDate || null,
            metadata: row.metadata || {}
          });
          createdCount++;
        }
      } catch (rowErr) {
        errors.push({ row: i + 1, name: row.name, error: rowErr.message });
      }
    }

    await logActivity(req, {
      action: 'IMPORT',
      module: 'CUSTOMERS',
      description: `Import massal pelanggan: ${createdCount} baru, ${updatedCount} diperbarui dari total ${rawCustomers.length} baris`,
      metadata: { total: rawCustomers.length, created: createdCount, updated: updatedCount }
    });

    return res.status(200).json({
      success: true,
      message: `Migrasi selesai! ${createdCount} pelanggan baru ditambahkan, ${updatedCount} diperbarui.`,
      stats: {
        totalProcessed: rawCustomers.length,
        created: createdCount,
        updated: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.exportCustomersExcel = async (req, res, next) => {
  try {
    const customers = await Customer.findAll({
      where: { tenantId: req.tenantId },
      include: [
        ...(Salesperson ? [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code'] }] : [])
      ],
      order: [['code', 'ASC']]
    });

    const singleRowHeaders = [
      'No', 'Kode', 'Nama Langganan', 'Alamat-1', 'Alamat-2', 'Telpon-1', 'Telpon-2',
      'Kode Wilayah', 'Nama Wilayah', 'Kode Tipe', 'Nama Tipe', 'Kode Area', 'Nama Area',
      'Nama Kecamatan', 'Kode Salesman', 'Nama Salesman', 'TOP (dlm hari)', 'Plafon Kredit',
      'Contact Person', 'Nomor HP', 'Nomor NIK', 'Nomor NPWP', 'Nama Wajib Pajak',
      'Alamat-1 Wajib Pajak', 'Alamat-2 Wajib Pajak', 'No Blok Wajib Pajak',
      'Nomor Rumah Wajib Pajak', 'Nomor RT Wajib Pajak', 'Nomor RW Wajib Pajak', 'Kelurahan Wajib Pajak',
      'Kecamatan Wajib Pajak', 'Kabupaten/Kota Wajib Pajak', 'Propinsi Wajib Pajak',
      'Kode Lama', 'Jenis Harga',
      'S', 'S', 'R', 'K', 'J', 'S',
      'MG-1', 'MG-2', 'MG-3', 'MG-4',
      'Jam Kunjungan', 'Tgl Open New Outlet'
    ];

    const rows = customers.map((c, idx) => {
      const visitDays = Array.isArray(c.visitDays) ? c.visitDays : [];
      const visitWeeks = Array.isArray(c.visitWeeks) ? c.visitWeeks : [];

      const hasDay = (dayKey) => visitDays.includes(dayKey) ? 'V' : '';
      const hasWeek = (weekKey) => visitWeeks.includes(weekKey) ? 'V' : '';

      let formattedOpenDate = '';
      if (c.openOutletDate) {
        try {
          const d = new Date(c.openOutletDate);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear()).slice(-2);
            formattedOpenDate = `${day}/${month}/${year}`;
          }
        } catch (e) {
          formattedOpenDate = c.openOutletDate;
        }
      }

      return [
        String(idx + 1),
        c.code || '',
        c.name || '',
        c.address || '',
        c.address2 || '',
        c.phone || '',
        c.phone2 || '',
        c.regionCode || '',
        c.regionName || '',
        c.typeCode || '',
        c.typeName || '',
        c.areaCode || '',
        c.areaName || '',
        c.districtName || '',
        c.salespersonCode || (c.salesperson ? c.salesperson.code : ''),
        c.salespersonName || (c.salesperson ? c.salesperson.name : ''),
        String(c.topDays || 0),
        String(c.creditLimit || 0),
        c.contactPerson || '',
        c.contactPersonPhone || '',
        c.nik || '',
        c.npwp || '',
        c.taxName || '',
        c.taxAddress1 || '',
        c.taxAddress2 || '',
        c.taxBlock || '',
        c.taxHouseNumber || '',
        c.taxRt || '',
        c.taxRw || '',
        c.taxKelurahan || '',
        c.taxKecamatan || '',
        c.taxCity || '',
        c.taxProvince || '',
        c.legacyCode || '',
        c.priceTier || '1',
        hasDay('S_SENIN'),
        hasDay('S_SELASA'),
        hasDay('R_RABU'),
        hasDay('K_KAMIS'),
        hasDay('J_JUMAT'),
        hasDay('S_SABTU'),
        hasWeek('MG-1'),
        hasWeek('MG-2'),
        hasWeek('MG-3'),
        hasWeek('MG-4'),
        c.visitTime || '',
        formattedOpenDate
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([singleRowHeaders, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Pelanggan');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Data_Pelanggan_CoreSync_${dateStr}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const { StockOpname, StockOpnameItem, Warehouse, Product, ProductWarehouse, ProductUnit, IncomingBatch, StockLedger, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { recordStockIn, recordStockOut } = require('../utils/inventoryEngine');
const { logActivity } = require('../utils/logger');

exports.getAllStockOpnames = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['opnameDate', 'status', 'createdAt'],
      defaultSortBy: 'opnameDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };
    if (req.query.warehouseId) whereClause.warehouseId = req.query.warehouseId;
    if (req.query.status) whereClause.status = req.query.status;

    if (search) {
      whereClause[Op.or] = [
        { notes: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await StockOpname.findAndCountAll({
      where: whereClause,
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        {
          model: StockOpnameItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ],
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


exports.createStockOpname = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { warehouseId, opnameDate, notes, items } = req.body;
    const opnameDateVal = opnameDate || new Date().toISOString().split('T')[0];

    if (!warehouseId || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Gudang opname dan daftar barang wajib diisi.'
      });
    }

    // Verify warehouse belongs to tenant
    const warehouse = await Warehouse.findOne({
      where: { id: warehouseId, tenantId: req.tenantId },
      transaction
    });

    if (!warehouse) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid warehouse selected.'
      });
    }

    // 1. Create Stock Opname Document
    const opname = await StockOpname.create({
      tenantId: req.tenantId,
      warehouseId,
      opnameDate: opnameDateVal,
      status: 'DRAFT',
      notes
    }, { transaction });

    // 2. Add items and compute system stock
    const opnameItems = [];
    for (const item of items) {
      const { productId, actualQty, unitName, conversionRatio, inputQty } = item;

      if (!productId || actualQty === undefined || actualQty < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Each item must have a product ID and valid actual quantity.'
        });
      }

      // Check current system stock in ProductWarehouse
      const prodWh = await ProductWarehouse.findOne({
        where: { productId, warehouseId },
        transaction
      });

      const systemQty = prodWh ? prodWh.stock : 0;
      const ratio = parseFloat(conversionRatio) || 1.0;
      
      const actualBaseQty = inputQty !== undefined ? parseFloat((parseFloat(inputQty) * ratio).toFixed(4)) : parseFloat(actualQty);
      const adjustmentQty = parseFloat((actualBaseQty - systemQty).toFixed(4));

      opnameItems.push({
        stockOpnameId: opname.id,
        productId,
        systemQty,
        actualQty: actualBaseQty,
        adjustmentQty,
        unitName: unitName || null,
        conversionRatio: ratio,
        metadata: {
          inputQty: inputQty !== undefined ? inputQty : actualQty,
          inputUnit: unitName || null,
          conversionRatio: ratio
        }
      });
    }

    await StockOpnameItem.bulkCreate(opnameItems, { transaction });

    await transaction.commit();

    // Fetch complete created draft document
    const createdOpname = await StockOpname.findByPk(opname.id, {
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        {
          model: StockOpnameItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE_STOCK_OPNAME',
      module: 'STOCK_OPNAME',
      description: `Membuat draft Stock Opname #${createdOpname.id} (${createdOpname.items?.length || 0} barang)`,
      metadata: { id: createdOpname.id, warehouseId: createdOpname.warehouseId }
    });

    return res.status(201).json({
      success: true,
      message: 'Stock Opname draft created successfully.',
      data: createdOpname
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.finalizeStockOpname = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const opname = await StockOpname.findOne({
      where: { id, tenantId: req.tenantId, status: 'DRAFT' },
      include: [
        {
          model: StockOpnameItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ],
      transaction
    });

    if (!opname) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Draft Stock Opname not found or already finalized.'
      });
    }

    // 1. Process adjustment for each item using the FIFO Engine
    for (const item of opname.items) {
      const adjustmentQty = item.adjustmentQty;
      const unit = item.product?.unit || item.unitName || 'KRT';

      if (adjustmentQty > 0) {
        // Find latest purchase cost price to value the added stock
        const lastBatch = await IncomingBatch.findOne({
          where: { tenantId: req.tenantId, productId: item.productId },
          order: [['receiveDate', 'DESC'], ['id', 'DESC']],
          transaction
        });
        
        const costPrice = lastBatch ? parseFloat(lastBatch.costPrice) : 0.00;

        // Add stock
        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: opname.warehouseId,
          productId: item.productId,
          batchNumber: opname.opnameNumber || `OPN-${opname.id}`,
          receiveDate: opname.opnameDate,
          qty: adjustmentQty,
          costPrice,
          referenceType: 'STOCK_OPNAME',
          referenceId: opname.id,
          transaction
        });

      } else if (adjustmentQty < 0) {
        // Deduct stock via FIFO
        const customNotes = `Penyesuaian Fisik Stock Opname #${opname.id}: Selisih -${Math.abs(adjustmentQty)} ${unit}`;
        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: opname.warehouseId,
          productId: item.productId,
          qty: Math.abs(adjustmentQty),
          referenceType: 'STOCK_OPNAME',
          referenceId: opname.id,
          customNotes,
          transaction
        });
      }
      // If adjustmentQty === 0, no stock movement is needed
    }

    // 2. Finalize status
    await opname.update({ status: 'COMPLETED' }, { transaction });

    await transaction.commit();

    await logActivity(req, {
      action: 'FINALIZE_STOCK_OPNAME',
      module: 'STOCK_OPNAME',
      description: `Memfinalisasi Stock Opname #${opname.id} dan memperbarui kartu stok persediaan`,
      metadata: { id: opname.id, warehouseId: opname.warehouseId }
    });

    return res.status(200).json({
      success: true,
      message: 'Stock Opname finalized successfully. Inventory levels updated.'
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getStockOpnameById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const opname = await StockOpname.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        {
          model: StockOpnameItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'metadata'] }]
        }
      ]
    });

    if (!opname) {
      return res.status(404).json({ success: false, message: 'Stock Opname tidak ditemukan.' });
    }

    return res.status(200).json({ success: true, data: opname });
  } catch (error) {
    next(error);
  }
};

exports.updateStockOpname = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { warehouseId, opnameDate, notes, items } = req.body;

    const opname = await StockOpname.findOne({
      where: { id, tenantId: req.tenantId },
      transaction
    });

    if (!opname) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Stock Opname tidak ditemukan.' });
    }

    if (opname.status === 'COMPLETED') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Stock Opname yang sudah Finalized tidak dapat diubah lagi.' });
    }

    // Update main fields
    await opname.update({
      warehouseId: warehouseId || opname.warehouseId,
      opnameDate: opnameDate || opname.opnameDate,
      notes: notes !== undefined ? notes : opname.notes
    }, { transaction });

    // Update items if provided
    if (items && Array.isArray(items)) {
      await StockOpnameItem.destroy({ where: { stockOpnameId: opname.id }, transaction });

      const opnameItems = [];
      for (const item of items) {
        const { productId, actualQty, unitName, conversionRatio, inputQty } = item;

        const prodWh = await ProductWarehouse.findOne({
          where: { productId, warehouseId: opname.warehouseId },
          transaction
        });

        const systemQty = prodWh ? prodWh.stock : 0;
        const ratio = parseFloat(conversionRatio) || 1.0;
        const actualBaseQty = inputQty !== undefined ? parseFloat((parseFloat(inputQty) * ratio).toFixed(4)) : parseFloat(actualQty);
        const adjustmentQty = parseFloat((actualBaseQty - systemQty).toFixed(4));

        opnameItems.push({
          stockOpnameId: opname.id,
          productId,
          systemQty,
          actualQty: actualBaseQty,
          adjustmentQty,
          unitName: unitName || null,
          conversionRatio: ratio,
          metadata: {
            inputQty: inputQty !== undefined ? inputQty : actualQty,
            inputUnit: unitName || null,
            conversionRatio: ratio
          }
        });
      }

      await StockOpnameItem.bulkCreate(opnameItems, { transaction });
    }

    await transaction.commit();

    const updated = await StockOpname.findByPk(opname.id, {
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        {
          model: StockOpnameItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'UPDATE_STOCK_OPNAME',
      module: 'STOCK_OPNAME',
      description: `Memperbarui draft Stock Opname #${opname.id}`,
      metadata: { id: opname.id, warehouseId: opname.warehouseId }
    });

    return res.status(200).json({ success: true, message: 'Draft Stock Opname berhasil diperbarui.', data: updated });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deleteStockOpname = async (req, res, next) => {
  try {
    const { id } = req.params;
    const opname = await StockOpname.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!opname) {
      return res.status(404).json({ success: false, message: 'Stock Opname tidak ditemukan.' });
    }

    if (opname.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Stock Opname yang sudah Finalized tidak dapat dihapus.' });
    }

    const opnameData = { id: opname.id, warehouseId: opname.warehouseId };

    await StockOpnameItem.destroy({ where: { stockOpnameId: opname.id } });
    await opname.destroy();

    await logActivity(req, {
      action: 'DELETE_STOCK_OPNAME',
      module: 'STOCK_OPNAME',
      description: `Menghapus draft Stock Opname #${opnameData.id}`,
      metadata: opnameData
    });

    return res.status(200).json({ success: true, message: 'Draft Stock Opname berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
};

exports.getWorksheetData = async (req, res, next) => {
  try {
    const { warehouseId, opnameId } = req.query;

    if (!warehouseId && !opnameId) {
      return res.status(400).json({
        success: false,
        message: 'warehouseId atau opnameId wajib disertakan.'
      });
    }

    let targetWarehouseId = warehouseId;
    let targetOpname = null;

    if (opnameId) {
      targetOpname = await StockOpname.findOne({
        where: { id: opnameId, tenantId: req.tenantId },
        include: [
          { model: Warehouse, as: 'warehouse' },
          {
            model: StockOpnameItem,
            as: 'items',
            include: [{ model: Product, as: 'product' }]
          }
        ]
      });
      if (targetOpname) {
        targetWarehouseId = targetOpname.warehouseId;
      }
    }

    const warehouse = await Warehouse.findOne({
      where: { id: targetWarehouseId, tenantId: req.tenantId }
    });

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Gudang tidak ditemukan.'
      });
    }

    const warehouseCode = warehouse.metadata?.code || `WH-00${warehouse.id}`;
    const warehouseName = warehouse.name;

    // Helper to format stock breakdown into big unit (satuan besar) and remainder (lebih berapa)
    const formatStockBreakdown = (stockQty, p) => {
      const currentStock = parseFloat(stockQty) || 0;
      const baseUnit = (p.unit || 'PCS').toUpperCase();
      const units = p.units || [];

      if (currentStock <= 0) {
        return {
          bigQty: 0,
          bigUnitName: baseUnit,
          capacity: 1,
          remainder: 0,
          smallUnitName: baseUnit,
          formatted: `0 ${baseUnit}`
        };
      }

      // 1. Alternate unit with conversionRatio > 1 (e.g. base=PCS, alt=KRT with conversionRatio=24)
      const bigUnitCandidate = units
        .filter(u => !u.isBaseUnit && parseFloat(u.conversionRatio) > 1)
        .sort((a, b) => parseFloat(b.conversionRatio) - parseFloat(a.conversionRatio))[0];

      if (bigUnitCandidate) {
        const ratio = Math.round(parseFloat(bigUnitCandidate.conversionRatio));
        const bigUnitName = (bigUnitCandidate.unitName || 'KRT').toUpperCase();
        const bigQty = Math.floor(currentStock / ratio);
        const remainder = Math.round(currentStock % ratio);
        
        return {
          bigQty,
          bigUnitName,
          capacity: ratio,
          remainder,
          smallUnitName: baseUnit,
          formatted: remainder > 0 
            ? `${bigQty} ${bigUnitName} (isi ${ratio}) lebih ${remainder} ${baseUnit}`
            : `${bigQty} ${bigUnitName} (isi ${ratio}) lebih 0`
        };
      }

      // 2. Alternate unit with conversionRatio < 1 (e.g. base=KRT, alt=PCS with conversionRatio=0.005 -> 200 pcs per KRT)
      const smallUnitCandidate = units
        .filter(u => !u.isBaseUnit && parseFloat(u.conversionRatio) < 1 && parseFloat(u.conversionRatio) > 0)
        .sort((a, b) => parseFloat(a.conversionRatio) - parseFloat(b.conversionRatio))[0];

      if (smallUnitCandidate) {
        const smallRatio = parseFloat(smallUnitCandidate.conversionRatio);
        const capacity = Math.round(1 / smallRatio);
        const smallUnitName = (smallUnitCandidate.unitName || 'PCS').toUpperCase();
        const bigQty = Math.floor(currentStock);
        const remainder = Math.round((currentStock - bigQty) * capacity);

        return {
          bigQty,
          bigUnitName: baseUnit,
          capacity,
          remainder,
          smallUnitName,
          formatted: remainder > 0 
            ? `${bigQty} ${baseUnit} (isi ${capacity}) lebih ${remainder} ${smallUnitName}`
            : `${bigQty} ${baseUnit} (isi ${capacity}) lebih 0`
        };
      }

      // 3. Fallback: single base unit
      return {
        bigQty: currentStock,
        bigUnitName: baseUnit,
        capacity: 1,
        remainder: 0,
        smallUnitName: baseUnit,
        formatted: `${currentStock} ${baseUnit}`
      };
    };

    // Fetch all products for the tenant
    const products = await Product.findAll({
      where: { tenantId: req.tenantId },
      include: [
        {
          model: ProductWarehouse,
          as: 'warehouseStocks',
          where: { warehouseId: targetWarehouseId },
          required: false
        },
        {
          model: ProductUnit,
          as: 'units',
          required: false
        }
      ],
      order: [['name', 'ASC']]
    });

    const productIds = products.map(p => p.id);

    // Latest incoming batch per product
    const latestBatches = await IncomingBatch.findAll({
      where: {
        tenantId: req.tenantId,
        warehouseId: targetWarehouseId,
        productId: { [Op.in]: productIds }
      },
      order: [['receiveDate', 'DESC'], ['id', 'DESC']]
    });

    const batchMap = {};
    latestBatches.forEach(b => {
      if (!batchMap[b.productId]) {
        batchMap[b.productId] = b;
      }
    });

    // Outgoing stock movement over last 30 days (Rata-rata penjualan 1 bulan)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const outgoingLedgers = await StockLedger.findAll({
      where: {
        tenantId: req.tenantId,
        warehouseId: targetWarehouseId,
        productId: { [Op.in]: productIds },
        type: { [Op.in]: ['OUT', 'ADJUSTMENT_OUT', 'RETURN_OUT'] },
        createdAt: { [Op.gte]: thirtyDaysAgo }
      },
      attributes: ['productId', [sequelize.fn('SUM', sequelize.col('qty')), 'totalOut']],
      group: ['productId'],
      raw: true
    });

    const outMap = {};
    outgoingLedgers.forEach(l => {
      outMap[l.productId] = parseFloat(l.totalOut) || 0;
    });

    const opnameItemMap = {};
    if (targetOpname && targetOpname.items) {
      targetOpname.items.forEach(it => {
        opnameItemMap[it.productId] = it;
      });
    }

    const rows = products.map((p, idx) => {
      const stockRow = (p.warehouseStocks || []).find(ws => ws.warehouseId === parseInt(targetWarehouseId));
      const currentStock = stockRow ? (parseFloat(stockRow.stock) || 0) : 0;
      const batch = batchMap[p.id];
      const monthlySales = outMap[p.id] || 0; // Penjualan produk selama 1 bulan (30 hari)

      // Umur dari penerimaan terakhir (dalam hari)
      let receiptAgeDays = null;
      let receiptAgeFormatted = '-';
      if (batch && batch.receiveDate) {
        const receiveDateObj = new Date(batch.receiveDate);
        const now = new Date();
        const diffTime = now.getTime() - receiveDateObj.getTime();
        receiptAgeDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        receiptAgeFormatted = `${receiptAgeDays} Hari`;
      }

      const opnameItem = opnameItemMap[p.id];
      const actualQty = opnameItem ? opnameItem.actualQty : currentStock;
      const adjustmentQty = opnameItem ? opnameItem.adjustmentQty : 0;

      // Perincian stok: sisa brp satuan besar (brp jumlah per satuan besar) lebih berapa
      const stockBreakdownObj = formatStockBreakdown(currentStock, p);
      const actualBreakdownObj = formatStockBreakdown(actualQty, p);

      // 3-tier unit structure (Satuan Terbesar -> Menengah -> Terkecil)
      const rawUnits = (p.units || []).map(u => ({
        unitName: (u.unitName || '').trim().toUpperCase(),
        conversionRatio: parseFloat(u.conversionRatio) || 1.0,
        isBaseUnit: !!u.isBaseUnit
      })).filter(u => u.unitName);

      const baseUnitName = (p.unit || 'PCS').trim().toUpperCase();
      if (!rawUnits.some(u => u.unitName === baseUnitName)) {
        rawUnits.push({
          unitName: baseUnitName,
          conversionRatio: 1.0,
          isBaseUnit: true
        });
      }

      const unitMap = new Map();
      rawUnits.forEach(u => {
        if (!unitMap.has(u.unitName)) {
          unitMap.set(u.unitName, u);
        }
      });
      const uniqueUnits = Array.from(unitMap.values());
      uniqueUnits.sort((a, b) => b.conversionRatio - a.conversionRatio);

      let unit1 = null;
      let unit2 = null;
      let unit3 = null;

      if (uniqueUnits.length >= 3) {
        unit1 = uniqueUnits[0];
        unit2 = uniqueUnits[1];
        unit3 = uniqueUnits[uniqueUnits.length - 1];
      } else if (uniqueUnits.length === 2) {
        unit1 = uniqueUnits[0];
        unit2 = null;
        unit3 = uniqueUnits[1];
      } else if (uniqueUnits.length === 1) {
        unit1 = uniqueUnits[0];
        unit2 = null;
        unit3 = null;
      }

      return {
        no: idx + 1,
        productId: p.id,
        sku: p.sku,
        name: p.name,
        warehouseCode,
        warehouseName,
        receiptDate: batch ? batch.receiveDate : '-',
        receiptQty: batch ? (parseFloat(batch.initialQty) || 0) : 0,
        receiptAge: receiptAgeDays,
        receiptAgeFormatted: receiptAgeFormatted,
        receiptFormatted: batch ? `${receiptAgeFormatted} (${batch.receiveDate})` : '-',
        stock: currentStock,
        stockBreakdown: stockBreakdownObj.formatted,
        stockBreakdownObj,
        actualQty,
        actualBreakdown: actualBreakdownObj.formatted,
        actualBreakdownObj,
        adjustmentQty,
        unit: p.unit,
        units: p.units || [],
        unitTiers: {
          unit1: unit1 ? { name: unit1.unitName, ratio: unit1.conversionRatio } : null,
          unit2: unit2 ? { name: unit2.unitName, ratio: unit2.conversionRatio } : null,
          unit3: unit3 ? { name: unit3.unitName, ratio: unit3.conversionRatio } : null
        },
        monthlySales,
        monthlySalesFormatted: `${monthlySales} ${p.unit}`,
        mur: monthlySales // for compatibility
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          code: warehouseCode,
          name: warehouseName
        },
        opname: targetOpname ? {
          id: targetOpname.id,
          opnameNumber: targetOpname.opnameNumber,
          opnameDate: targetOpname.opnameDate,
          status: targetOpname.status,
          notes: targetOpname.notes
        } : null,
        items: rows
      }
    });

  } catch (error) {
    next(error);
  }
};

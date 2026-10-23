const { Delivery, DeliveryItem, DeliveryManifest, SalesOrder, SalesOrderItem, Product, ProductUnit, Warehouse, Customer, Supplier, Invoice, Salesperson, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { recordStockOut } = require('../utils/inventoryEngine');
const { postDeliveryJournal, postInvoiceJournal } = require('../utils/journalEngine');
const { checkAndUpdateSoStatus } = require('../utils/orderStatusEngine');
const { logActivity } = require('../utils/logger');

exports.getAllDeliveries = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['deliveryNumber', 'deliveryDate', 'createdAt'],
      defaultSortBy: 'deliveryDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };
    if (req.query.warehouseId) whereClause.warehouseId = req.query.warehouseId;

    if (search) {
      whereClause[Op.or] = [
        { deliveryNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Delivery.findAndCountAll({
      where: whereClause,
      include: [
        { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'soNumber', 'soDate', 'metadata'],
          include: [
            { model: Customer, as: 'customer', attributes: ['name', 'address', 'phone'] },
            { model: SalesOrderItem, as: 'items' }
          ]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['name'] },
        {
          model: DeliveryItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'sellingPrice'] }]
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


exports.createDelivery = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let { salesOrderId, warehouseId, deliveryNumber, deliveryDate, driverName, vehiclePlate, notes, items, metadata } = req.body;

    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    let parsedMeta = {};
    if (metadata) {
      if (typeof metadata === 'string') {
        try { parsedMeta = JSON.parse(metadata); } catch (e) { parsedMeta = {}; }
      } else {
        parsedMeta = metadata;
      }
    }

    if (req.uploadedImageUrl) {
      parsedMeta.evidence = req.uploadedImageUrl;
      parsedMeta.dispatchEvidence = req.uploadedImageUrl;
    }

    if (!salesOrderId || !warehouseId || !deliveryNumber || !deliveryDate || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sales Order ID, Warehouse ID, Delivery Number, Delivery Date, and items are required.'
      });
    }

    // Verify Sales Order belongs to tenant
    const salesOrder = await SalesOrder.findOne({
      where: { id: parseInt(salesOrderId, 10), tenantId: req.tenantId },
      include: [{ model: SalesOrderItem, as: 'items' }],
      transaction
    });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales Order not found or access denied.'
      });
    }

    if (salesOrder.status === 'CANCELLED' || salesOrder.status === 'SHIPPED') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot ship items for Sales Order in status: ${salesOrder.status}`
      });
    }

    // Check unique Delivery Number per tenant
    const existingDelivery = await Delivery.findOne({
      where: { tenantId: req.tenantId, deliveryNumber },
      transaction
    });

    if (existingDelivery) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Delivery Number '${deliveryNumber}' is already in use.`
      });
    }

    // 1. Create Delivery Record
    const delivery = await Delivery.create({
      tenantId: req.tenantId,
      salesOrderId: parseInt(salesOrderId, 10),
      warehouseId: parseInt(warehouseId, 10),
      deliveryNumber,
      deliveryDate,
      status: 'SHIPPED',
      driverName,
      vehiclePlate,
      notes,
      metadata: parsedMeta
    }, { transaction });

    // 2. Loop through items to ship, deduct stock from FIFO, and record delivery items
    let totalComputedHpp = 0;
    const deliveryItems = [];

    for (const item of items) {
      const { productId, qtyShipped } = item;

      if (!productId || qtyShipped === undefined || qtyShipped <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Each item must have a product ID and quantity shipped > 0.'
        });
      }

      // Check if item is in the Sales Order
      const soItem = salesOrder.items.find(si => si.productId === parseInt(productId, 10));
      if (!soItem) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Product ID ${productId} is not part of this Sales Order.`
        });
      }

      const detail = (salesOrder.metadata?.itemsDetail || []).find(d => parseInt(d.productId) === parseInt(productId, 10)) || {};
      const ratio = parseFloat(detail.conversionRatio || soItem.conversionRatio || 1);
      const regularDeductQty = parseFloat((parseFloat(qtyShipped) * ratio).toFixed(4));

      // Record Stock Out via FIFO Engine (deducts stock and returns calculated HPP)
      try {
        const hpp = await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: parseInt(warehouseId, 10),
          productId: parseInt(productId, 10),
          qty: regularDeductQty,
          referenceType: 'DELIVERY_NOTE',
          referenceId: delivery.id,
          transaction
        });
        totalComputedHpp += parseFloat(hpp || 0);
      } catch (err) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Failed to deduct stock for product '${productId}': ${err.message}`
        });
      }

      deliveryItems.push({
        deliveryId: delivery.id,
        productId: parseInt(productId, 10),
        qtyShipped: parseFloat(qtyShipped)
      });
    }

    // Save Delivery Items
    await DeliveryItem.bulkCreate(deliveryItems, { transaction });

    // Update Sales Order Status to SHIPPED
    await salesOrder.update({ status: 'SHIPPED' }, { transaction });

    // Store total HPP in delivery metadata for accounting integration later
    const updatedMetadata = {
      ...(parsedMeta || {}),
      calculatedHpp: totalComputedHpp
    };
    await delivery.update({ metadata: updatedMetadata }, { transaction });

    // Post Auto-Journal Entry for HPP & Stock reduction
    await postDeliveryJournal(delivery, totalComputedHpp, transaction);

    // Pastikan Faktur Penjualan (Invoice) & Jurnal Pendapatan Penjualan terbit jika belum ada
    const existingInv = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: salesOrder.id, tenantId: req.tenantId },
      transaction
    });
    if (!existingInv) {
      let invNumber = salesOrder.soNumber.startsWith('SO.') ? salesOrder.soNumber.replace(/^SO\./, 'INV.') : `INV-${salesOrder.soNumber.replace(/^SO-/, '')}`;
      const invConflict = await sequelize.models.Invoice.findOne({ where: { tenantId: req.tenantId, invoiceNumber: invNumber }, transaction });
      if (invConflict) {
        invNumber = `${invNumber}-${Date.now().toString().slice(-4)}`;
      }

      const soMeta = salesOrder.metadata || {};
      const initialPaid = parseFloat(soMeta.paidAmount || 0);
      const totalAmount = parseFloat(salesOrder.totalAmount || 0);
      const invAmountDue = Math.max(0, totalAmount - initialPaid);
      let invStatus = 'UNPAID';
      if (initialPaid >= totalAmount - 0.01) invStatus = 'PAID';
      else if (initialPaid > 0) invStatus = 'PARTIALLY_PAID';

      const newInv = await sequelize.models.Invoice.create({
        tenantId: req.tenantId,
        type: 'SALES',
        salesOrderId: salesOrder.id,
        invoiceNumber: invNumber,
        invoiceDate: salesOrder.soDate || deliveryDate,
        dueDate: soMeta.dueDate || salesOrder.soDate || deliveryDate,
        status: invStatus,
        taxId: salesOrder.taxId || null,
        subtotal: salesOrder.subtotal || totalAmount,
        taxAmount: salesOrder.taxAmount || 0,
        totalAmount,
        amountDue: invAmountDue,
        metadata: {
          ...soMeta,
          autoGenerated: true,
          soNumber: salesOrder.soNumber,
          paidAmount: initialPaid
        }
      }, { transaction });

      await postInvoiceJournal(newInv, transaction);
    }

    await transaction.commit();

    const createdDelivery = await Delivery.findByPk(delivery.id, {
      include: [
        { model: SalesOrder, as: 'salesOrder', attributes: ['soNumber', 'soDate', 'metadata'],
          include: [{ model: Customer, as: 'customer', attributes: ['name', 'address', 'phone'] }]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['name'] },
        {
          model: DeliveryItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'DELIVERIES',
      description: `Menerbitkan Surat Jalan #${delivery.deliveryNumber} (SO #${salesOrder.soNumber})`,
      metadata: { id: delivery.id, deliveryNumber: delivery.deliveryNumber, salesOrderId: salesOrder.id, soNumber: salesOrder.soNumber }
    });

    return res.status(201).json({
      success: true,
      message: 'Surat Jalan (Delivery Note) berhasil diterbitkan. Stok dikurangi.',
      data: createdDelivery
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, receivedBy, notes } = req.body;

    if (!['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid. Harus SHIPPED, DELIVERED, atau CANCELLED.'
      });
    }

    const delivery = await Delivery.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: SalesOrder, as: 'salesOrder' }
      ]
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Surat Jalan tidak ditemukan.'
      });
    }

    const updatedMetadata = {
      ...(delivery.metadata || {}),
      receivedBy: receivedBy || delivery.metadata?.receivedBy || null,
      receivedAt: status === 'DELIVERED' ? new Date().toISOString() : delivery.metadata?.receivedAt || null
    };

    if (req.uploadedImageUrl) {
      updatedMetadata.deliveredEvidence = req.uploadedImageUrl;
      updatedMetadata.evidence = req.uploadedImageUrl;
    }

    await delivery.update({
      status,
      notes: notes !== undefined ? notes : delivery.notes,
      metadata: updatedMetadata
    });

    // Auto-check if Sales Order is now fully completed (Delivered + Paid)
    await checkAndUpdateSoStatus(delivery.salesOrderId, req.tenantId);

    const updatedDelivery = await Delivery.findByPk(delivery.id, {
      include: [
        { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'soNumber', 'soDate', 'metadata'],
          include: [
            { model: Customer, as: 'customer', attributes: ['name', 'address', 'phone'] },
            { model: SalesOrderItem, as: 'items' }
          ]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['name'] },
        {
          model: DeliveryItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'sellingPrice'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'DELIVERIES',
      description: `Mengubah status Surat Jalan #${delivery.deliveryNumber} menjadi ${status}`,
      metadata: { id: delivery.id, deliveryNumber: delivery.deliveryNumber, status }
    });

    return res.status(200).json({
      success: true,
      message: `Status Surat Jalan #${delivery.deliveryNumber} berhasil diperbarui menjadi ${status}.`,
      data: updatedDelivery
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build consolidated manifest data (groups, supplier items, summary, totals)
 */
async function buildManifestDataFromDeliveries({
  tenantId,
  deliveryIds = [],
  deliveryDate,
  driverName,
  vehiclePlate,
  warehouseName,
  manifestNumber,
  transaction = null
}) {
  const whereClause = {
    tenantId,
    status: { [Op.ne]: 'CANCELLED' }
  };

  const parsedIds = Array.isArray(deliveryIds)
    ? deliveryIds.map(id => parseInt(id, 10)).filter(Boolean)
    : (typeof deliveryIds === 'string' ? deliveryIds.split(',').map(id => parseInt(id.trim(), 10)).filter(Boolean) : []);

  if (parsedIds.length > 0) {
    whereClause.id = { [Op.in]: parsedIds };
  } else {
    if (deliveryDate) whereClause.deliveryDate = deliveryDate;
    if (driverName && driverName !== '—') {
      whereClause[Op.or] = [
        { driverName: { [Op.like]: `%${driverName}%` } },
        { driverName: null },
        { driverName: '' },
        { driverName: '—' },
        { driverName: 'Kirim Otomatis' }
      ];
    }
    if (vehiclePlate && vehiclePlate !== '—') {
      whereClause.vehiclePlate = { [Op.like]: `%${vehiclePlate}%` };
    }
  }

  const deliveries = await Delivery.findAll({
    where: whereClause,
    include: [
      {
        model: DeliveryItem,
        as: 'items',
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'sku', 'name', 'unit', 'sellingPrice'],
            include: [
              { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'code'] },
              { model: ProductUnit, as: 'units', attributes: ['id', 'unitName', 'conversionRatio', 'isBaseUnit'] }
            ]
          }
        ]
      },
      {
        model: Warehouse,
        as: 'warehouse',
        attributes: ['id', 'name', 'address']
      },
      {
        model: SalesOrder,
        as: 'salesOrder',
        attributes: ['id', 'soNumber', 'soDate', 'totalAmount', 'status', 'metadata'],
        where: {
          status: { [Op.ne]: 'CANCELLED' }
        },
        required: true,
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'code', 'phone', 'address', 'districtName', 'salespersonId', 'salespersonCode', 'salespersonName'],
            include: [
              { model: Salesperson, as: 'salesperson', attributes: ['id', 'code', 'name'] }
            ]
          },
          { model: Invoice, as: 'invoices', attributes: ['id', 'invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status'] },
          { model: SalesOrderItem, as: 'items' }
        ]
      }
    ],
    order: [['deliveryDate', 'DESC'], ['id', 'ASC']],
    transaction
  });

  const effectiveDate = deliveryDate || deliveries[0]?.deliveryDate || new Date().toISOString().split('T')[0];
  const primaryDriver = driverName || deliveries.find(d => d.driverName)?.driverName || '—';
  const primaryPlate = vehiclePlate || deliveries.find(d => d.vehiclePlate)?.vehiclePlate || '—';
  const primaryWarehouse = warehouseName || deliveries[0]?.warehouse?.name || 'Gudang Utama';
  const finalNumber = manifestNumber || `MNF-${effectiveDate.replace(/-/g, '')}-${(deliveries[0]?.id || 1).toString().padStart(4, '0')}`;

  if (!deliveries || deliveries.length === 0) {
    return {
      manifestNumber: finalNumber,
      deliveryDate: effectiveDate,
      driverName: primaryDriver,
      vehiclePlate: primaryPlate,
      warehouseName: primaryWarehouse,
      groups: [],
      table_data: [],
      summary: {
        totalInvoices: 0,
        totalQty: 0,
        totalBonus: 0,
        grandTotalAmount: 0,
        totalCashAmount: 0,
        totalCreditAmount: 0,
        cashInvoiceCount: 0,
        creditInvoiceCount: 0,
        invoiceNumbersList: []
      }
    };
  }

  let grandTotalQty = 0;
  let grandTotalBonus = 0;
  let grandTotalAmount = 0;
  let totalCashAmount = 0;
  let totalCreditAmount = 0;
  let cashInvoiceCount = 0;
  let creditInvoiceCount = 0;
  const invoiceNumbersSet = new Set();

  const allSalespersons = await Salesperson.findAll({ where: { tenantId }, transaction });
  const spMapById = new Map();
  const spMapByName = new Map();
  allSalespersons.forEach(sp => {
    spMapById.set(Number(sp.id), sp);
    if (sp.name) spMapByName.set(sp.name.trim().toUpperCase(), sp);
  });

  const groups = deliveries.map((d, grpIdx) => {
    const cust = d.salesOrder?.customer;
    const inv = d.salesOrder?.invoices?.[0];
    const soMeta = d.salesOrder?.metadata || {};
    const dMeta = d.metadata || {};

    const invoiceNumber = inv?.invoiceNumber || d.salesOrder?.soNumber || d.deliveryNumber;
    const invoiceAmount = parseFloat(inv?.totalAmount || d.salesOrder?.totalAmount || 0);
    const term = (soMeta.paymentTerm || d.salesOrder?.paymentTerm || 'CASH').toUpperCase();

    // Prioritize Sales Order data for salesperson
    const spIdFromSo = soMeta.salespersonId || null;
    const spFromSoId = spIdFromSo ? spMapById.get(Number(spIdFromSo)) : null;

    let salesmanCode = soMeta.salespersonCode || spFromSoId?.code || '';
    let salesmanName = soMeta.salespersonName || soMeta.salesperson || spFromSoId?.name || '';

    // If SO has name but no code, try finding matching salesperson
    if (!salesmanCode && salesmanName) {
      const matched = spMapByName.get(String(salesmanName).trim().toUpperCase());
      if (matched) {
        salesmanCode = matched.code;
        salesmanName = matched.name;
      }
    }

    // Fallback to customer salesperson only if SO does not have salesperson specified
    if (!salesmanName && !salesmanCode) {
      const custSp = cust?.salesperson || (cust?.salespersonId ? spMapById.get(Number(cust.salespersonId)) : null);
      salesmanCode = custSp?.code || cust?.salespersonCode || '';
      salesmanName = custSp?.name || cust?.salespersonName || '';
    }

    let salesmanLabel = '';
    if (salesmanCode && salesmanName && !salesmanName.toUpperCase().includes(salesmanCode.toUpperCase())) {
      salesmanLabel = `${salesmanCode} ${salesmanName}`.trim();
    } else if (salesmanName) {
      salesmanLabel = salesmanName.trim();
    } else if (salesmanCode) {
      salesmanLabel = salesmanCode.trim();
    } else {
      salesmanLabel = '-';
    }

    if (invoiceNumber && invoiceNumber !== '—') {
      invoiceNumbersSet.add(invoiceNumber);
    }
    grandTotalAmount += invoiceAmount;

    if (term.includes('CASH') || term.includes('COD') || term.includes('TUNAI') || term === 'LUNAS') {
      totalCashAmount += invoiceAmount;
      cashInvoiceCount++;
    } else {
      totalCreditAmount += invoiceAmount;
      creditInvoiceCount++;
    }

    const soDetails = d.salesOrder?.metadata?.itemsDetail || [];
    let groupQty = 0;
    let groupBonus = 0;

    const items = (d.items || []).map((it, itIdx) => {
      const itProdId = String(it.productId || it.product?.id || '');
      const soDetail = soDetails.find(sd => String(sd.productId || '') === itProdId);

      const qty = soDetail?.qty !== undefined 
        ? Number(soDetail.qty || 0) 
        : Number(it.qtyShipped || it.qty || 0);
      const unit = (soDetail?.unit || it.product?.unit || 'PCS').toUpperCase();

      const bonus = soDetail?.bonusQty !== undefined 
        ? Number(soDetail.bonusQty || 0) 
        : Number(it.metadata?.bonusQty || 0);
      const bonusUnit = (soDetail?.bonusUnit || soDetail?.unit || it.product?.unit || 'PCS').toUpperCase();

      const supplierName = it.product?.supplier?.name || 'LAIN-LAIN / UMUM';

      groupQty += qty;
      groupBonus += bonus;
      grandTotalQty += qty;
      grandTotalBonus += bonus;

      return {
        no: itIdx + 1,
        sku: it.product?.sku || '-',
        name: it.product?.name || '-',
        unit,
        qty,
        bonusQty: bonus,
        bonusUnit,
        bonusFormatted: bonus > 0 ? `${bonus} ${bonusUnit}` : '-',
        qtyFormatted: `${qty} ${unit}`,
        supplierName,
        price: parseFloat(it.product?.sellingPrice || 0)
      };
    });

    return {
      groupIndex: grpIdx + 1,
      deliveryId: d.id,
      deliveryNumber: d.deliveryNumber,
      deliveryDate: d.deliveryDate,
      customerName: cust?.name || 'Pelanggan Tunai',
      customerCode: cust?.code || '',
      customerAddress: cust?.address || '-',
      customerPhone: cust?.phone || '-',
      customerDistrict: cust?.districtName || '',
      salesman: salesmanLabel,
      salespersonCode: salesmanCode,
      salespersonName: salesmanName,
      paymentTerm: term,
      invoiceNumber,
      invoiceStatus: inv?.status || 'UNPAID',
      invoiceAmount,
      groupQty,
      groupBonus,
      items
    };
  });

  // Group items by Supplier
  const isLargeUnit = (u) => {
    const upper = (u || '').toUpperCase();
    return ['KRT', 'KARTON', 'BAL', 'DUS', 'BOX', 'CTN', 'CRT', 'LUSIN', 'PACK', 'DOZ', 'KRG', 'SAK', 'PAIL', 'DRUM', 'KALENG', 'SLOP'].some(k => upper.includes(k));
  };

  const supplierMap = {};
  deliveries.forEach(d => {
    const soDetails = d.salesOrder?.metadata?.itemsDetail || [];

    (d.items || []).forEach(it => {
      const prod = it.product;
      const suppName = prod?.supplier?.name || 'LAIN-LAIN / UMUM';
      if (!supplierMap[suppName]) {
        supplierMap[suppName] = {};
      }

      const prodKey = prod?.id ? String(prod.id) : (it.productId ? String(it.productId) : (it.sku || '-'));
      if (!supplierMap[suppName][prodKey]) {
        supplierMap[suppName][prodKey] = {
          productId: prod?.id,
          kode: prod?.sku || it.sku || '-',
          nama_barang: prod?.name || it.name || '-',
          baseUnit: (prod?.unit || 'KRT').toUpperCase(),
          units: prod?.units || [],
          orderedUnitsMap: {}, // unit -> qty
          bonusUnitsMap: {},   // unit -> qty
          price: parseFloat(prod?.sellingPrice || 0)
        };
      }

      const pEntry = supplierMap[suppName][prodKey];
      const itProdId = String(it.productId || it.product?.id || '');
      const soDetail = soDetails.find(sd => String(sd.productId || '') === itProdId);

      const buyQty = soDetail?.qty !== undefined ? Number(soDetail.qty || 0) : Number(it.qtyShipped || it.qty || 0);
      const buyUnit = (soDetail?.unit || prod?.unit || 'KRT').toUpperCase();
      const bnsQty = soDetail?.bonusQty !== undefined ? Number(soDetail.bonusQty || 0) : Number(it.metadata?.bonusQty || 0);
      const bnsUnit = (soDetail?.bonusUnit || soDetail?.unit || prod?.unit || 'PCS').toUpperCase();

      if (buyQty > 0) {
        pEntry.orderedUnitsMap[buyUnit] = (pEntry.orderedUnitsMap[buyUnit] || 0) + buyQty;
      }
      if (bnsQty > 0) {
        pEntry.bonusUnitsMap[bnsUnit] = (pEntry.bonusUnitsMap[bnsUnit] || 0) + bnsQty;
      }
    });
  });

  const supplierTableData = Object.keys(supplierMap).sort().map(suppName => {
    const prodList = Object.values(supplierMap[suppName]);
    const items = prodList.map((p, idx) => {
      // Build conversion ratio lookup for this product's units
      const ratioMap = {};
      (p.units || []).forEach(u => {
        const uName = (u.unitName || '').toUpperCase();
        ratioMap[uName] = parseFloat(u.conversionRatio || 1);
      });
      if (!ratioMap[p.baseUnit]) ratioMap[p.baseUnit] = 1.0;

      // Sort ordered units by conversion ratio descending (largest unit first)
      const orderedUnits = Object.keys(p.orderedUnitsMap).sort((a, b) => {
        const ratioA = ratioMap[a] !== undefined ? ratioMap[a] : (isLargeUnit(a) ? 1.0 : 0.01);
        const ratioB = ratioMap[b] !== undefined ? ratioMap[b] : (isLargeUnit(b) ? 1.0 : 0.01);
        return ratioB - ratioA;
      });

      let besarStr = '';
      let kecilStr = '';

      if (orderedUnits.length === 1) {
        const u = orderedUnits[0];
        const q = p.orderedUnitsMap[u];
        const ratio = ratioMap[u] !== undefined ? ratioMap[u] : (isLargeUnit(u) ? 1.0 : 0.01);
        // If it's a large unit or base unit (ratio >= 0.1 or isLargeUnit)
        if (ratio >= 0.1 || isLargeUnit(u) || u === p.baseUnit) {
          besarStr = `${q} ${u}`;
        } else {
          kecilStr = `${q} ${u}`;
        }
      } else if (orderedUnits.length === 2) {
        // Largest goes to besar, smallest goes to kecil
        const uBesar = orderedUnits[0];
        const uKecil = orderedUnits[1];
        besarStr = `${p.orderedUnitsMap[uBesar]} ${uBesar}`;
        kecilStr = `${p.orderedUnitsMap[uKecil]} ${uKecil}`;
      } else if (orderedUnits.length > 2) {
        // Largest goes to besar, rest to kecil
        const uBesar = orderedUnits[0];
        besarStr = `${p.orderedUnitsMap[uBesar]} ${uBesar}`;
        const rest = orderedUnits.slice(1).map(u => `${p.orderedUnitsMap[u]} ${u}`);
        kecilStr = rest.join(', ');
      }

      // Bonus string
      const bonusParts = Object.entries(p.bonusUnitsMap).map(([u, q]) => `${q} ${u}`);
      const bonusStr = bonusParts.join(', ');

      const totalRawQty = Object.values(p.orderedUnitsMap).reduce((a, b) => a + b, 0);
      const totalRawBonus = Object.values(p.bonusUnitsMap).reduce((a, b) => a + b, 0);

      return {
        no: (idx + 1).toString(),
        kode: p.kode,
        nama_barang: p.nama_barang,
        jumlah_barang_satuan_besar: besarStr,
        jumlah_barang_satuan_kecil: kecilStr,
        bonus: bonusStr,
        rawQty: totalRawQty,
        rawBonus: totalRawBonus
      };
    });

    return {
      supplier_name: suppName,
      items
    };
  });

  const totalBesarSum = supplierTableData.reduce((sum, s) => sum + (s.items || []).reduce((iSum, it) => iSum + (parseFloat(it.jumlah_barang_satuan_besar) || 0), 0), 0);
  const totalKecilSum = supplierTableData.reduce((sum, s) => sum + (s.items || []).reduce((iSum, it) => iSum + (parseFloat(it.jumlah_barang_satuan_kecil) || 0), 0), 0);
  const totalBonusSum = supplierTableData.reduce((sum, s) => sum + (s.items || []).reduce((iSum, it) => iSum + (parseFloat(it.bonus) || 0), 0), 0);

  const qtyParts = [];
  if (totalBesarSum > 0) qtyParts.push(`${totalBesarSum} Karton/Bal`);
  if (totalKecilSum > 0) qtyParts.push(`${totalKecilSum} Satuan Kecil`);
  if (totalBonusSum > 0) qtyParts.push(`+${totalBonusSum} Bonus`);
  const grandQtyFormatted = qtyParts.length > 0 ? qtyParts.join(' • ') : `${grandTotalQty} Kemasan`;

  return {
    manifestNumber: finalNumber,
    deliveryDate: effectiveDate,
    driverName: primaryDriver,
    vehiclePlate: primaryPlate,
    warehouseName: primaryWarehouse,
    groups,
    table_data: supplierTableData,
    summary: {
      totalInvoices: invoiceNumbersSet.size || deliveries.length,
      totalQty: grandTotalQty,
      totalBesar: totalBesarSum,
      totalKecil: totalKecilSum,
      totalBonus: grandTotalBonus,
      qtyFormatted: grandQtyFormatted,
      grandTotalAmount,
      totalCashAmount,
      totalCreditAmount,
      cashInvoiceCount,
      creditInvoiceCount,
      invoiceNumbersList: Array.from(invoiceNumbersSet)
    }
  };
}

/**
 * GET /api/deliveries/manifest
 * Generate Consolidated Delivery Note / Manifest 1 Mobil
 */
exports.getDeliveryManifest = async (req, res, next) => {
  try {
    const { deliveryDate, driverName, vehiclePlate, deliveryIds, warehouseName, manifestNumber } = req.query;
    const tenantId = req.tenantId;

    const data = await buildManifestDataFromDeliveries({
      tenantId,
      deliveryIds,
      deliveryDate,
      driverName,
      vehiclePlate,
      warehouseName,
      manifestNumber
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available deliveries for manifest selection
 * Excludes deliveries already in active manifests (unless part of currentManifestId)
 */
exports.getAvailableDeliveries = async (req, res, next) => {
  try {
    const { soDate, driverName, search, currentManifestId } = req.query;
    const tenantId = req.tenantId;

    // Find all non-cancelled manifests (SCHEDULED, ACTIVE, IN_DELIVERY, DELIVERED) except currentManifestId
    const activeManifestWhere = {
      tenantId,
      status: { [Op.ne]: 'CANCELLED' }
    };
    if (currentManifestId) {
      activeManifestWhere.id = { [Op.ne]: parseInt(currentManifestId, 10) };
    }
    const otherManifests = await DeliveryManifest.findAll({
      where: activeManifestWhere,
      attributes: ['id', 'deliveryIds']
    });

    const alreadyAssignedDeliveryIds = new Set();
    otherManifests.forEach(m => {
      const ids = m.deliveryIds || [];
      ids.forEach(id => {
        if (id) alreadyAssignedDeliveryIds.add(Number(id));
      });
    });

    const whereClause = { tenantId, status: { [Op.ne]: 'CANCELLED' } };

    if (alreadyAssignedDeliveryIds.size > 0) {
      whereClause.id = { [Op.notIn]: Array.from(alreadyAssignedDeliveryIds) };
    }
    if (driverName) {
      whereClause[Op.or] = [
        { driverName: { [Op.like]: `%${driverName}%` } },
        { driverName: null },
        { driverName: '' },
        { driverName: '—' },
        { driverName: 'Kirim Otomatis' }
      ];
    }
    if (search) {
      const searchCondition = [
        { deliveryNumber: { [Op.like]: `%${search}%` } },
        { driverName: { [Op.like]: `%${search}%` } },
        { vehiclePlate: { [Op.like]: `%${search}%` } }
      ];
      if (whereClause[Op.or]) {
        whereClause[Op.and] = [
          { [Op.or]: whereClause[Op.or] },
          { [Op.or]: searchCondition }
        ];
        delete whereClause[Op.or];
      } else {
        whereClause[Op.or] = searchCondition;
      }
    }

    const deliveries = await Delivery.findAll({
      where: whereClause,
      include: [
        {
          model: DeliveryItem,
          as: 'items',
          attributes: ['id', 'qtyShipped']
        },
        {
          model: SalesOrder,
          as: 'salesOrder',
          attributes: ['id', 'soNumber', 'soDate', 'totalAmount', 'status', 'metadata'],
          where: { status: { [Op.ne]: 'CANCELLED' } },
          required: true,
          include: [
            {
              model: Customer,
              as: 'customer',
              attributes: ['id', 'name', 'code', 'districtName', 'address', 'salespersonId', 'salespersonCode', 'salespersonName'],
              include: [
                { model: Salesperson, as: 'salesperson', attributes: ['id', 'code', 'name'] }
              ]
            },
            { model: Invoice, as: 'invoices', attributes: ['id', 'invoiceNumber', 'totalAmount', 'status'] }
          ]
        },
        {
          model: Warehouse,
          as: 'warehouse',
          attributes: ['id', 'name']
        }
      ],
      order: [['deliveryDate', 'DESC'], ['id', 'ASC']]
    });

    // Filter out PICKUP deliveries so they don't enter manifest queue
    const eligibleDeliveries = deliveries.filter(d => {
      const isPickup = d.metadata?.fulfillmentType === 'PICKUP' || 
                       d.metadata?.isPickup === true || 
                       d.salesOrder?.metadata?.fulfillmentType === 'PICKUP' || 
                       d.salesOrder?.metadata?.isPickup === true || 
                       d.driverName === 'Ambil Sendiri';
      return !isPickup;
    });

    const activeDeliveredSoIds = new Set(deliveries.map(d => d.salesOrderId).filter(Boolean));

    // Also collect all SO IDs that already have a non-cancelled Delivery in the database
    const allExistingDeliveries = await Delivery.findAll({
      where: { tenantId, status: { [Op.ne]: 'CANCELLED' } },
      attributes: ['salesOrderId']
    });
    allExistingDeliveries.forEach(d => {
      if (d.salesOrderId) activeDeliveredSoIds.add(Number(d.salesOrderId));
    });

    // 2. Fetch active Sales Orders that do NOT have a Delivery record yet
    const soWhereClause = {
      tenantId,
      status: { [Op.in]: ['CONFIRMED', 'APPROVED', 'PROCESSING'] }
    };
    if (activeDeliveredSoIds.size > 0) {
      soWhereClause.id = { [Op.notIn]: Array.from(activeDeliveredSoIds) };
    }
    if (soDate) {
      soWhereClause.soDate = soDate;
    }

    const availableSalesOrders = await SalesOrder.findAll({
      where: soWhereClause,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'code', 'districtName', 'address', 'salespersonId', 'salespersonCode', 'salespersonName'],
          include: [
            { model: Salesperson, as: 'salesperson', attributes: ['id', 'code', 'name'] }
          ]
        },
        { model: Invoice, as: 'invoices', attributes: ['id', 'invoiceNumber', 'totalAmount', 'status'] },
        { model: SalesOrderItem, as: 'items' }
      ],
      order: [['soDate', 'DESC'], ['id', 'ASC']]
    });

    // Filter out PICKUP sales orders so they don't enter manifest queue
    const eligibleSalesOrders = availableSalesOrders.filter(so => {
      const isPickup = so.metadata?.fulfillmentType === 'PICKUP' || so.metadata?.isPickup === true;
      return !isPickup;
    });

    const allSalespersons = await Salesperson.findAll({ where: { tenantId } });
    const spMapById = new Map();
    const spMapByName = new Map();
    allSalespersons.forEach(sp => {
      spMapById.set(Number(sp.id), sp);
      if (sp.name) spMapByName.set(sp.name.trim().toUpperCase(), sp);
    });

    const formatted = eligibleDeliveries.map(d => {
      const inv = d.salesOrder?.invoices?.[0];
      const soMeta = d.salesOrder?.metadata || {};
      const dMeta = d.metadata || {};
      const cust = d.salesOrder?.customer;

      const spIdFromSo = soMeta.salespersonId || null;
      const spFromSoId = spIdFromSo ? spMapById.get(Number(spIdFromSo)) : null;

      let spCode = soMeta.salespersonCode || spFromSoId?.code || '';
      let spName = soMeta.salespersonName || soMeta.salesperson || spFromSoId?.name || '';

      if (!spCode && spName) {
        const matched = spMapByName.get(String(spName).trim().toUpperCase());
        if (matched) {
          spCode = matched.code;
          spName = matched.name;
        }
      }

      if (!spName && !spCode) {
        const custSp = cust?.salesperson || (cust?.salespersonId ? spMapById.get(Number(cust.salespersonId)) : null);
        spCode = custSp?.code || cust?.salespersonCode || '';
        spName = custSp?.name || cust?.salespersonName || '';
      }

      const salesman = spCode && spName && !spName.toUpperCase().includes(spCode.toUpperCase()) ? `${spCode} ${spName}` : (spName || spCode || '-');

      const soDetails = d.salesOrder?.metadata?.itemsDetail || [];
      const unitMap = {};
      let totalQty = 0;
      (d.items || []).forEach(it => {
        const soDetail = soDetails.find(sd => sd.productId === it.productId || sd.productId === it.product?.id);
        const qty = Number(soDetail?.qty !== undefined ? soDetail.qty : (it.qtyShipped || it.qty || 0));
        const unit = (soDetail?.unit || it.product?.unit || 'KRT').toUpperCase();
        if (qty > 0) {
          unitMap[unit] = (unitMap[unit] || 0) + qty;
          totalQty += qty;
        }
      });
      const qtyFormatted = Object.entries(unitMap).map(([u, q]) => `${q} ${u}`).join(' + ') || `${totalQty} KRT`;

      return {
        id: d.id,
        deliveryNumber: d.deliveryNumber,
        deliveryDate: d.deliveryDate,
        soDate: d.salesOrder?.soDate || null,
        status: d.status,
        driverName: d.driverName || '—',
        vehiclePlate: d.vehiclePlate || '—',
        warehouseName: d.warehouse?.name || 'Gudang Utama',
        warehouseId: d.warehouseId,
        customerName: cust?.name || 'Pelanggan Umum',
        customerDistrict: cust?.districtName || '',
        customerAddress: cust?.address || '',
        salesman,
        totalQty,
        qtyFormatted,
        totalAmount: parseFloat(d.salesOrder?.totalAmount || 0),
        invoiceNumber: inv?.invoiceNumber || '-',
        invoiceStatus: inv?.status || 'UNPAID',
        paymentTerm: soMeta.paymentTerm || 'CASH',
        paymentStatus: soMeta.paymentStatus || 'UNPAID',
        paidAmount: parseFloat(soMeta.paidAmount || 0),
        salesOrderId: d.salesOrderId,
        soNumber: d.salesOrder?.soNumber
      };
    });

    const formattedSos = eligibleSalesOrders.map(so => {
      const inv = so.invoices?.[0];
      const soMeta = so.metadata || {};
      const cust = so.customer;

      const spIdFromSo = soMeta.salespersonId || null;
      const spFromSoId = spIdFromSo ? spMapById.get(Number(spIdFromSo)) : null;

      let spCode = soMeta.salespersonCode || spFromSoId?.code || '';
      let spName = soMeta.salespersonName || soMeta.salesperson || spFromSoId?.name || '';

      if (!spCode && spName) {
        const matched = spMapByName.get(String(spName).trim().toUpperCase());
        if (matched) {
          spCode = matched.code;
          spName = matched.name;
        }
      }

      if (!spName && !spCode) {
        const custSp = cust?.salesperson || (cust?.salespersonId ? spMapById.get(Number(cust.salespersonId)) : null);
        spCode = custSp?.code || cust?.salespersonCode || '';
        spName = custSp?.name || cust?.salespersonName || '';
      }

      const salesman = spCode && spName && !spName.toUpperCase().includes(spCode.toUpperCase()) ? `${spCode} ${spName}` : (spName || spCode || '-');

      const itemsDetail = soMeta.itemsDetail || [];
      const unitMap = {};
      let totalQty = 0;
      (so.items || []).forEach(it => {
        const detail = itemsDetail.find(d => d.productId === it.productId);
        const qty = Number(detail?.qty !== undefined ? detail.qty : (it.qty || 0));
        const unit = (detail?.unit || it.unit || 'KRT').toUpperCase();
        if (qty > 0) {
          unitMap[unit] = (unitMap[unit] || 0) + qty;
          totalQty += qty;
        }
      });
      const qtyFormatted = Object.entries(unitMap).map(([u, q]) => `${q} ${u}`).join(' + ') || `${totalQty} KRT`;

      const plannedSjNumber = so.soNumber.startsWith('SO.') ? so.soNumber.replace(/^SO\./, 'SJ.') : `SJ-${so.soNumber.replace(/^SO-/, '')}`;

      return {
        id: `SO_${so.id}`,
        isSalesOrder: true,
        salesOrderId: so.id,
        deliveryNumber: plannedSjNumber,
        deliveryDate: null,
        soDate: so.soDate,
        status: 'READY_TO_SHIP',
        driverName: '—',
        vehiclePlate: '—',
        warehouseName: so.warehouse?.name || 'Gudang Utama',
        warehouseId: so.warehouseId || 1,
        customerName: cust?.name || 'Pelanggan Umum',
        customerDistrict: cust?.districtName || '',
        customerAddress: cust?.address || '',
        salesman,
        totalQty,
        qtyFormatted,
        totalAmount: parseFloat(so.totalAmount || 0),
        invoiceNumber: inv?.invoiceNumber || '-',
        invoiceStatus: inv?.status || 'UNPAID',
        paymentTerm: soMeta.paymentTerm || 'CASH',
        paymentStatus: soMeta.paymentStatus || 'UNPAID',
        paidAmount: parseFloat(soMeta.paidAmount || 0),
        soNumber: so.soNumber
      };
    });

    let combined = [...formatted, ...formattedSos];

    if (search) {
      const s = search.toLowerCase();
      combined = combined.filter(c => 
        (c.deliveryNumber || '').toLowerCase().includes(s) ||
        (c.soNumber || '').toLowerCase().includes(s) ||
        (c.invoiceNumber || '').toLowerCase().includes(s) ||
        (c.customerName || '').toLowerCase().includes(s) ||
        (c.customerDistrict || '').toLowerCase().includes(s) ||
        (c.customerAddress || '').toLowerCase().includes(s)
      );
    }

    return res.status(200).json({
      success: true,
      data: combined,
      total: combined.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to resolve raw IDs (including SO_xx keys) into concrete Delivery records.
 * Generates Delivery, deducts stock via FIFO, posts Delivery Journal, and marks SO as SHIPPED.
 */
async function resolveAndEnsureDeliveries({
  tenantId,
  rawIds = [],
  manifestNumber,
  manifestDate,
  driverName,
  vehiclePlate,
  warehouseId,
  notes,
  manifestStatus = 'SCHEDULED',
  transaction
}) {
  const finalDeliveryIds = [];
  const isManifestInDelivery = manifestStatus === 'IN_DELIVERY' || manifestStatus === 'DELIVERED';
  const initialSoStatus = isManifestInDelivery ? 'SHIPPED' : 'WAITING_SHIPMENT';

  for (const rawId of rawIds) {
    if (typeof rawId === 'string' && rawId.startsWith('SO_')) {
      const soId = parseInt(rawId.replace('SO_', ''), 10);
      const so = await SalesOrder.findOne({
        where: { id: soId, tenantId },
        include: [{ model: SalesOrderItem, as: 'items' }],
        transaction
      });

      if (so) {
        let delivery = await Delivery.findOne({
          where: { salesOrderId: so.id, tenantId, status: { [Op.ne]: 'CANCELLED' } },
          transaction
        });

        if (!delivery) {
          let deliveryNumber = so.soNumber.startsWith('SO.') ? so.soNumber.replace(/^SO\./, 'SJ.') : `SJ-${so.soNumber.replace(/^SO-/, '')}`;
          const existingDeliv = await Delivery.findOne({ where: { tenantId, deliveryNumber }, transaction });
          if (existingDeliv) {
            deliveryNumber = `${deliveryNumber}-${Date.now().toString().slice(-4)}`;
          }

          delivery = await Delivery.create({
            tenantId,
            salesOrderId: so.id,
            warehouseId: warehouseId || so.warehouseId || 1,
            deliveryNumber,
            deliveryDate: manifestDate,
            driverName: driverName || '—',
            vehiclePlate: vehiclePlate || '—',
            status: 'SHIPPED',
            notes: notes || `Dibuat dari Manifest Pengiriman #${manifestNumber}`
          }, { transaction });

          const soItems = so.items || [];
          const itemsDetail = so.metadata?.itemsDetail || [];
          let totalComputedHpp = 0;

          for (let i = 0; i < soItems.length; i++) {
            const item = soItems[i];
            const detail = itemsDetail[i] || itemsDetail.find(d => d.productId === item.productId) || {};
            const buyRatio = parseFloat(detail.conversionRatio || item.conversionRatio || 1);
            const bonusRatio = parseFloat(detail.bonusConversionRatio || 1);
            const buyQty = parseFloat(item.qty) || 0;
            const bonusQty = parseFloat(detail.bonusQty) || 0;
            const regularDeductQty = parseFloat((buyQty * buyRatio).toFixed(4));
            const bonusDeductQty = parseFloat((bonusQty * bonusRatio).toFixed(4));

            await DeliveryItem.create({
              tenantId,
              deliveryId: delivery.id,
              productId: item.productId,
              qtyShipped: buyQty
            }, { transaction });

            if (regularDeductQty > 0) {
              const regularNote = `Pengiriman Manifest #${manifestNumber} (SO #${so.soNumber})`;
              try {
                const hpp = await recordStockOut({
                  tenantId,
                  warehouseId: delivery.warehouseId,
                  productId: item.productId,
                  qty: regularDeductQty,
                  isBonus: false,
                  referenceType: 'DELIVERY_ORDER',
                  referenceId: delivery.id,
                  customNotes: regularNote,
                  transaction
                });
                totalComputedHpp += parseFloat(hpp || 0);
              } catch (err) {
                const errOut = new Error(`SO #${so.soNumber}: ${err.message}`);
                errOut.name = 'InsufficientStockError';
                throw errOut;
              }
            }

            if (bonusDeductQty > 0) {
              const bonusNote = `Pengiriman Bonus Manifest #${manifestNumber} (SO #${so.soNumber})`;
              try {
                await recordStockOut({
                  tenantId,
                  warehouseId: delivery.warehouseId,
                  productId: item.productId,
                  qty: bonusDeductQty,
                  isBonus: true,
                  referenceType: 'DELIVERY_ORDER',
                  referenceId: delivery.id,
                  customNotes: bonusNote,
                  transaction
                });
              } catch (err) {
                const errOut = new Error(`SO #${so.soNumber} (Bonus): ${err.message}`);
                errOut.name = 'InsufficientStockError';
                throw errOut;
              }
            }
          }

          await postDeliveryJournal(delivery, totalComputedHpp, transaction);

          // Pastikan Faktur Penjualan (Invoice) & Jurnal Pendapatan Penjualan terbit jika belum ada
          const existingManifestInv = await sequelize.models.Invoice.findOne({
            where: { salesOrderId: so.id, tenantId },
            transaction
          });
          if (!existingManifestInv) {
            let invNumber = so.soNumber.startsWith('SO.') ? so.soNumber.replace(/^SO\./, 'INV.') : `INV-${so.soNumber.replace(/^SO-/, '')}`;
            const invConflict = await sequelize.models.Invoice.findOne({ where: { tenantId, invoiceNumber: invNumber }, transaction });
            if (invConflict) {
              invNumber = `${invNumber}-${Date.now().toString().slice(-4)}`;
            }

            const soMeta = so.metadata || {};
            const initialPaid = parseFloat(soMeta.paidAmount || 0);
            const totalAmount = parseFloat(so.totalAmount || 0);
            const invAmountDue = Math.max(0, totalAmount - initialPaid);
            let invStatus = 'UNPAID';
            if (initialPaid >= totalAmount - 0.01) invStatus = 'PAID';
            else if (initialPaid > 0) invStatus = 'PARTIALLY_PAID';

            const newInv = await sequelize.models.Invoice.create({
              tenantId,
              type: 'SALES',
              salesOrderId: so.id,
              invoiceNumber: invNumber,
              invoiceDate: so.soDate || manifestDate,
              dueDate: soMeta.dueDate || so.soDate || manifestDate,
              status: invStatus,
              taxId: so.taxId || null,
              subtotal: so.subtotal || totalAmount,
              taxAmount: so.taxAmount || 0,
              totalAmount,
              amountDue: invAmountDue,
              metadata: {
                ...soMeta,
                autoGenerated: true,
                soNumber: so.soNumber,
                paidAmount: initialPaid
              }
            }, { transaction });

            await postInvoiceJournal(newInv, transaction);
          }

          await so.update({
            status: initialSoStatus,
            metadata: {
              ...(so.metadata || {}),
              driverName: driverName || '—',
              vehiclePlate: vehiclePlate || '—',
              manifestNumber,
              manifestStatus,
              shippedAt: isManifestInDelivery ? new Date() : null
            }
          }, { transaction });
        } else {
          await delivery.update({
            deliveryDate: manifestDate,
            driverName: driverName || '—',
            vehiclePlate: vehiclePlate || '—'
          }, { transaction });
          await so.update({
            status: initialSoStatus,
            metadata: {
              ...(so.metadata || {}),
              driverName: driverName || '—',
              vehiclePlate: vehiclePlate || '—',
              manifestNumber,
              manifestStatus,
              shippedAt: isManifestInDelivery ? (so.metadata?.shippedAt || new Date()) : null
            }
          }, { transaction });
        }

        finalDeliveryIds.push(delivery.id);
      }
    } else {
      const dId = parseInt(rawId, 10);
      if (dId) {
        const delivery = await Delivery.findOne({ where: { id: dId, tenantId }, transaction });
        if (delivery) {
          await delivery.update({
            deliveryDate: manifestDate,
            driverName: driverName || delivery.driverName || '—',
            vehiclePlate: vehiclePlate || delivery.vehiclePlate || '—'
          }, { transaction });
          finalDeliveryIds.push(delivery.id);
          if (delivery.salesOrderId) {
            const so = await SalesOrder.findOne({ where: { id: delivery.salesOrderId, tenantId }, transaction });
            if (so) {
              await so.update({
                status: initialSoStatus,
                metadata: {
                  ...(so.metadata || {}),
                  manifestNumber,
                  manifestStatus,
                  driverName: driverName || '—',
                  vehiclePlate: vehiclePlate || '—',
                  shippedAt: isManifestInDelivery ? (so.metadata?.shippedAt || new Date()) : null
                }
              }, { transaction });
            }
          }
        }
      }
    }
  }

  return Array.from(new Set(finalDeliveryIds));
}

/**
 * Save & record a generated delivery manifest to history
 */
exports.createDeliveryManifest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { 
      manifestNumber: customNumber, 
      manifestDate, 
      driverName, 
      vehiclePlate, 
      warehouseId, 
      warehouseName, 
      deliveryIds, 
      notes,
      status = 'SCHEDULED'
    } = req.body;
    const tenantId = req.tenantId;

    const dateStr = manifestDate || new Date().toISOString().split('T')[0];
    const cleanDateStr = dateStr.replace(/-/g, '');

    let finalNumber = customNumber;
    if (!finalNumber) {
      const latest = await DeliveryManifest.findOne({
        where: {
          tenantId,
          manifestDate: dateStr
        },
        order: [['id', 'DESC']],
        transaction
      });

      let nextSeq = 1;
      if (latest && latest.manifestNumber) {
        const parts = latest.manifestNumber.split('-');
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart)) {
          nextSeq = lastPart + 1;
        }
      }
      finalNumber = `MNF-${cleanDateStr}-${String(nextSeq).padStart(4, '0')}`;
    }

    const createdByName = req.user?.name || req.user?.email || 'Admin Gudang';
    const rawDeliveryIds = Array.isArray(deliveryIds) ? deliveryIds : [];

    if (rawDeliveryIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Pilih minimal 1 Surat Jalan / Faktur untuk dimuat dalam manifest.'
      });
    }

    // Resolve any SO_xxx keys into actual Delivery records & deduct stock
    const parsedDeliveryIds = await resolveAndEnsureDeliveries({
      tenantId,
      rawIds: rawDeliveryIds,
      manifestNumber: finalNumber,
      manifestDate: dateStr,
      driverName,
      vehiclePlate,
      warehouseId,
      notes,
      manifestStatus: status || 'SCHEDULED',
      transaction
    });

    if (parsedDeliveryIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tidak ada Surat Jalan / Pesanan valid yang dapat diproses.'
      });
    }

    // Strict conflict check: Ensure none of the deliveries are already in another active/delivered manifest
    const conflictingManifests = await DeliveryManifest.findAll({
      where: {
        tenantId,
        status: { [Op.ne]: 'CANCELLED' }
      },
      attributes: ['id', 'manifestNumber', 'deliveryIds'],
      transaction
    });

    const alreadyUsedMap = new Map();
    conflictingManifests.forEach(m => {
      (m.deliveryIds || []).forEach(dId => {
        if (dId) alreadyUsedMap.set(Number(dId), m.manifestNumber);
      });
    });

    const conflictIds = parsedDeliveryIds.filter(id => alreadyUsedMap.has(Number(id)));
    if (conflictIds.length > 0) {
      await transaction.rollback();
      const conflictManifests = [...new Set(conflictIds.map(id => alreadyUsedMap.get(Number(id))))];
      return res.status(400).json({
        success: false,
        message: `Surat Jalan/Invoice berikut sudah berada di Manifest ${conflictManifests.join(', ')}. Keluarkan (remove) terlebih dahulu dari manifest tersebut sebelum memindahkannya ke pengiriman ini.`
      });
    }

    // Build snapshot and summary data
    const manifestDetails = await buildManifestDataFromDeliveries({
      tenantId,
      deliveryIds: parsedDeliveryIds,
      deliveryDate: dateStr,
      driverName: driverName || '—',
      vehiclePlate: vehiclePlate || '—',
      warehouseName: warehouseName || 'Gudang Utama',
      manifestNumber: finalNumber,
      transaction
    });

    const manifest = await DeliveryManifest.create({
      tenantId,
      manifestNumber: finalNumber,
      manifestDate: dateStr,
      driverName: driverName || '—',
      vehiclePlate: vehiclePlate || '—',
      warehouseId: warehouseId || null,
      warehouseName: warehouseName || 'Gudang Utama',
      deliveryIds: parsedDeliveryIds,
      summary: manifestDetails.summary || null,
      snapshot: manifestDetails,
      printCount: 1,
      lastPrintedAt: new Date(),
      createdById: req.user?.id || null,
      createdByName,
      status: status || 'SCHEDULED',
      notes: notes || null
    }, { transaction });

    // Automatically assign deliveryDate, driver & vehicle plate to all selected Deliveries
    if (parsedDeliveryIds.length > 0) {
      const updateData = { deliveryDate: dateStr };
      if (driverName && driverName !== '—') {
        updateData.driverName = driverName;
        updateData.vehiclePlate = vehiclePlate || '—';
      }
      await Delivery.update(updateData, {
        where: {
          id: { [Op.in]: parsedDeliveryIds },
          tenantId
        },
        transaction
      });
    }

    await transaction.commit();

    await logActivity(req, {
      tenantId,
      userId: req.user?.id,
      module: 'DELIVERIES',
      action: 'CREATE',
      description: `Menerbitkan Surat Manifesting Pengiriman #${finalNumber} (${parsedDeliveryIds.length} DO)`,
      metadata: { manifestId: manifest.id, manifestNumber: finalNumber, driverName }
    });

    return res.status(201).json({
      success: true,
      message: `Manifest #${finalNumber} berhasil disimpan ke riwayat!`,
      data: manifest
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    if (error.name === 'InsufficientStockError' || error.message?.includes('tidak mencukupi') || error.message?.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Edit / Update an existing delivery manifest (Only allowed when status is SCHEDULED / ACTIVE)
 */
exports.updateDeliveryManifest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { 
      manifestDate, 
      driverName, 
      vehiclePlate, 
      warehouseId, 
      warehouseName, 
      deliveryIds, 
      notes 
    } = req.body;
    const tenantId = req.tenantId;

    const manifest = await DeliveryManifest.findOne({
      where: { id: parseInt(id, 10), tenantId },
      transaction
    });

    if (!manifest) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Dokumen manifest tidak ditemukan.'
      });
    }

    if (manifest.status === 'IN_DELIVERY' || manifest.status === 'DELIVERED') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Manifest tidak dapat diedit karena status sudah '${manifest.status === 'IN_DELIVERY' ? 'SEDANG DIKIRIM' : 'SELESAI'}'.`
      });
    }

    const previousDeliveryIds = (manifest.deliveryIds || []).map(dId => parseInt(dId, 10));
    const rawNewIds = Array.isArray(deliveryIds) ? deliveryIds : previousDeliveryIds;

    const targetDate = manifestDate || manifest.manifestDate;
    const targetDriver = driverName !== undefined ? driverName : manifest.driverName;
    const targetPlate = vehiclePlate !== undefined ? vehiclePlate : manifest.vehiclePlate;
    const targetWarehouseName = warehouseName || manifest.warehouseName;

    // Resolve and ensure all deliveries
    const newDeliveryIds = await resolveAndEnsureDeliveries({
      tenantId,
      rawIds: rawNewIds,
      manifestNumber: manifest.manifestNumber,
      manifestDate: targetDate,
      driverName: targetDriver,
      vehiclePlate: targetPlate,
      warehouseId: warehouseId !== undefined ? warehouseId : manifest.warehouseId,
      notes,
      manifestStatus: manifest.status,
      transaction
    });

    // Strict conflict check: Ensure newly added deliveries are not in another active/delivered manifest
    const newlyAddedIds = newDeliveryIds.filter(dId => !previousDeliveryIds.includes(dId));
    if (newlyAddedIds.length > 0) {
      const conflictingManifests = await DeliveryManifest.findAll({
        where: {
          tenantId,
          status: { [Op.ne]: 'CANCELLED' },
          id: { [Op.ne]: manifest.id }
        },
        attributes: ['id', 'manifestNumber', 'deliveryIds'],
        transaction
      });

      const alreadyUsedMap = new Map();
      conflictingManifests.forEach(m => {
        (m.deliveryIds || []).forEach(dId => {
          if (dId) alreadyUsedMap.set(Number(dId), m.manifestNumber);
        });
      });

      const conflictIds = newlyAddedIds.filter(id => alreadyUsedMap.has(Number(id)));
      if (conflictIds.length > 0) {
        await transaction.rollback();
        const conflictManifests = [...new Set(conflictIds.map(id => alreadyUsedMap.get(Number(id))))];
        return res.status(400).json({
          success: false,
          message: `Surat Jalan/Invoice berikut sudah berada di Manifest ${conflictManifests.join(', ')}. Keluarkan (remove) terlebih dahulu dari manifest tersebut sebelum memindahkannya ke pengiriman ini.`
        });
      }
    }

    // Find removed deliveries (in previous, but not in new)
    const removedDeliveryIds = previousDeliveryIds.filter(dId => !newDeliveryIds.includes(dId));

    // Reset removed deliveries
    if (removedDeliveryIds.length > 0) {
      await Delivery.update({
        driverName: null,
        vehiclePlate: null
      }, {
        where: { id: { [Op.in]: removedDeliveryIds }, tenantId },
        transaction
      });

      // Clear manifest metadata on detached Sales Orders
      const detachedDeliveries = await Delivery.findAll({
        where: { id: { [Op.in]: removedDeliveryIds }, tenantId },
        attributes: ['id', 'salesOrderId'],
        transaction
      });
      const detachedSoIds = detachedDeliveries.map(d => d.salesOrderId).filter(Boolean);
      if (detachedSoIds.length > 0) {
        const detachedSos = await SalesOrder.findAll({
          where: { id: { [Op.in]: detachedSoIds }, tenantId },
          transaction
        });
        for (const so of detachedSos) {
          const updatedMeta = { ...(so.metadata || {}) };
          delete updatedMeta.manifestNumber;
          delete updatedMeta.manifestId;
          delete updatedMeta.manifestStatus;
          delete updatedMeta.driverName;
          delete updatedMeta.vehiclePlate;
          const revertStatus = so.status === 'WAITING_SHIPMENT' ? 'APPROVED' : so.status;
          await so.update({ status: revertStatus, metadata: updatedMeta }, { transaction });
        }
      }
    }

    // Rebuild snapshot and summary
    const manifestDetails = await buildManifestDataFromDeliveries({
      tenantId,
      deliveryIds: newDeliveryIds,
      deliveryDate: targetDate,
      driverName: targetDriver || '—',
      vehiclePlate: targetPlate || '—',
      warehouseName: targetWarehouseName || 'Gudang Utama',
      manifestNumber: manifest.manifestNumber,
      transaction
    });

    manifest.manifestDate = targetDate;
    manifest.driverName = targetDriver;
    manifest.vehiclePlate = targetPlate;
    if (warehouseId !== undefined) manifest.warehouseId = warehouseId;
    manifest.warehouseName = targetWarehouseName;
    manifest.deliveryIds = newDeliveryIds;
    manifest.summary = manifestDetails.summary;
    manifest.snapshot = manifestDetails;
    if (notes !== undefined) manifest.notes = notes;

    await manifest.save({ transaction });

    // Re-assign deliveryDate, driver & plate to current active deliveries
    if (newDeliveryIds.length > 0) {
      const updateData = { deliveryDate: targetDate };
      if (targetDriver && targetDriver !== '—') {
        updateData.driverName = targetDriver;
        updateData.vehiclePlate = targetPlate || '—';
      }
      await Delivery.update(updateData, {
        where: { id: { [Op.in]: newDeliveryIds }, tenantId },
        transaction
      });

      const deliveriesToUpdate = await Delivery.findAll({
        where: { id: { [Op.in]: newDeliveryIds }, tenantId },
        attributes: ['id', 'salesOrderId'],
        transaction
      });
      const soIds = deliveriesToUpdate.map(d => d.salesOrderId).filter(Boolean);
      if (soIds.length > 0) {
        const salesOrders = await SalesOrder.findAll({
          where: { id: { [Op.in]: soIds }, tenantId },
          transaction
        });
        for (const so of salesOrders) {
          const updatedMeta = {
            ...(so.metadata || {}),
            driverName: targetDriver,
            vehiclePlate: targetPlate || '—',
            manifestNumber: manifest.manifestNumber,
            manifestId: manifest.id
          };
          await so.update({ metadata: updatedMeta }, { transaction });
        }
      }
    }

    await transaction.commit();

    await logActivity(req, {
      tenantId,
      userId: req.user?.id,
      module: 'DELIVERIES',
      action: 'UPDATE',
      description: `Mengubah Dokumen Manifest Pengiriman #${manifest.manifestNumber} (${newDeliveryIds.length} DO)`,
      metadata: { manifestId: manifest.id, manifestNumber: manifest.manifestNumber }
    });

    return res.status(200).json({
      success: true,
      message: `Manifest #${manifest.manifestNumber} berhasil diperbarui!`,
      data: manifest
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    if (error.name === 'InsufficientStockError' || error.message?.includes('tidak mencukupi') || error.message?.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * Update Manifest Status (SCHEDULED -> IN_DELIVERY -> DELIVERED / CANCELLED)
 * Cascades status change to all linked Deliveries and Sales Orders
 */
exports.updateManifestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const tenantId = req.tenantId;

    if (!['SCHEDULED', 'ACTIVE', 'IN_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status tidak valid. Harus SCHEDULED, IN_DELIVERY, DELIVERED, atau CANCELLED.'
      });
    }

    const manifest = await DeliveryManifest.findOne({
      where: { id: parseInt(id, 10), tenantId }
    });

    if (!manifest) {
      return res.status(404).json({
        success: false,
        message: 'Dokumen manifest tidak ditemukan.'
      });
    }

    const deliveryIds = (manifest.deliveryIds || []).map(dId => parseInt(dId, 10)).filter(Boolean);
    manifest.status = status;
    if (notes) manifest.notes = notes;
    await manifest.save();

    if (deliveryIds.length > 0) {
      const deliveries = await Delivery.findAll({
        where: { id: { [Op.in]: deliveryIds }, tenantId },
        attributes: ['id', 'salesOrderId']
      });
      const soIds = deliveries.map(d => d.salesOrderId).filter(Boolean);

      if (status === 'IN_DELIVERY') {
        // Mark all deliveries as SHIPPED
        await Delivery.update({
          status: 'SHIPPED',
          driverName: manifest.driverName,
          vehiclePlate: manifest.vehiclePlate
        }, {
          where: { id: { [Op.in]: deliveryIds }, tenantId }
        });

        // Mark linked Sales Orders as SHIPPED
        if (soIds.length > 0) {
          const linkedSos = await SalesOrder.findAll({
            where: { id: { [Op.in]: soIds }, tenantId, status: { [Op.notIn]: ['CANCELLED', 'COMPLETED', 'SELESAI'] } }
          });
          for (const s of linkedSos) {
            await s.update({
              status: 'SHIPPED',
              metadata: {
                ...(s.metadata || {}),
                manifestStatus: 'IN_DELIVERY',
                shippedAt: s.metadata?.shippedAt || new Date().toISOString()
              }
            });
          }
        }
      } else if (status === 'SCHEDULED' || status === 'ACTIVE') {
        // Revert Sales Orders to WAITING_SHIPMENT
        if (soIds.length > 0) {
          const linkedSos = await SalesOrder.findAll({
            where: { id: { [Op.in]: soIds }, tenantId, status: { [Op.notIn]: ['CANCELLED', 'COMPLETED', 'SELESAI'] } }
          });
          for (const s of linkedSos) {
            await s.update({
              status: 'WAITING_SHIPMENT',
              metadata: {
                ...(s.metadata || {}),
                manifestStatus: 'SCHEDULED'
              }
            });
          }
        }
      } else if (status === 'DELIVERED') {
        // Mark all deliveries as DELIVERED
        await Delivery.update({
          status: 'DELIVERED'
        }, {
          where: { id: { [Op.in]: deliveryIds }, tenantId }
        });

        // Evaluate Sales Orders completion
        for (const sId of soIds) {
          const s = await SalesOrder.findOne({ where: { id: sId, tenantId } });
          if (s && !['CANCELLED'].includes(s.status)) {
            await s.update({
              metadata: {
                ...(s.metadata || {}),
                manifestStatus: 'DELIVERED',
                deliveredAt: new Date().toISOString()
              }
            });
            await checkAndUpdateSoStatus(sId, tenantId);
          }
        }
      } else if (status === 'CANCELLED') {
        // Release deliveries from manifest
        await Delivery.update({
          driverName: null,
          vehiclePlate: null
        }, {
          where: { id: { [Op.in]: deliveryIds }, tenantId, status: { [Op.ne]: 'DELIVERED' } }
        });

        // Detach Sales Orders from cancelled manifest
        for (const sId of soIds) {
          const s = await SalesOrder.findOne({ where: { id: sId, tenantId } });
          if (s) {
            const updatedMeta = { ...(s.metadata || {}) };
            delete updatedMeta.manifestNumber;
            delete updatedMeta.manifestId;
            delete updatedMeta.manifestStatus;
            delete updatedMeta.driverName;
            delete updatedMeta.vehiclePlate;
            const newStatus = s.status === 'WAITING_SHIPMENT' ? 'APPROVED' : s.status;
            await s.update({ status: newStatus, metadata: updatedMeta });
          }
        }
      }
    }

    await logActivity(req, {
      tenantId,
      userId: req.user?.id,
      module: 'DELIVERIES',
      action: 'UPDATE',
      description: `Mengubah status Manifest Pengiriman #${manifest.manifestNumber} menjadi ${status}`,
      metadata: { manifestId: manifest.id, manifestNumber: manifest.manifestNumber, status }
    });

    return res.status(200).json({
      success: true,
      message: `Status Manifest #${manifest.manifestNumber} berhasil diubah menjadi ${status}.`,
      data: manifest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of past delivery manifests (History & Management)
 */
exports.getManifestHistory = async (req, res, next) => {
  try {
    const { startDate, endDate, driverName, status } = req.query;
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['manifestDate', 'manifestNumber', 'createdAt', 'printCount', 'status'],
      defaultSortBy: 'createdAt',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (status && status !== 'ALL') {
      if (status === 'SCHEDULED') {
        whereClause.status = { [Op.in]: ['SCHEDULED', 'ACTIVE'] };
      } else {
        whereClause.status = status;
      }
    } else if (req.query.showCancelled !== 'true' && req.query.includeCancelled !== 'true') {
      whereClause.status = { [Op.ne]: 'CANCELLED' };
    } else {
      whereClause.status = { [Op.ne]: 'DELETED' };
    }

    if (startDate && endDate) {
      whereClause.manifestDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.manifestDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.manifestDate = { [Op.lte]: endDate };
    }

    if (driverName) {
      whereClause.driverName = { [Op.like]: `%${driverName}%` };
    }

    if (search) {
      whereClause[Op.or] = [
        { manifestNumber: { [Op.like]: `%${search}%` } },
        { driverName: { [Op.like]: `%${search}%` } },
        { vehiclePlate: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await DeliveryManifest.findAndCountAll({
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

/**
 * Get single manifest history by ID
 */
exports.getManifestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const manifest = await DeliveryManifest.findOne({
      where: { id: parseInt(id, 10), tenantId: req.tenantId }
    });

    if (manifest && manifest.deliveryIds && manifest.deliveryIds.length > 0) {
      const isSnapshotEmpty = !manifest.snapshot?.groups || 
        manifest.snapshot.groups.length === 0 || 
        !manifest.summary || 
        manifest.summary.totalQty === 0;

      const needsSalesmanEnrichment = manifest.snapshot?.groups?.some(g => !g.salesman || g.salesman === '-');
      const shouldRefresh = manifest.status === 'SCHEDULED' || 
                            manifest.status === 'ACTIVE' || 
                            manifest.status === 'IN_DELIVERY' || 
                            req.query.refresh === 'true' || 
                            isSnapshotEmpty || 
                            needsSalesmanEnrichment;

      if (shouldRefresh) {
        try {
          const enriched = await buildManifestDataFromDeliveries({
            tenantId: req.tenantId,
            deliveryIds: manifest.deliveryIds,
            deliveryDate: manifest.manifestDate,
            driverName: manifest.driverName,
            vehiclePlate: manifest.vehiclePlate,
            warehouseName: manifest.warehouseName,
            manifestNumber: manifest.manifestNumber
          });
          if (enriched && enriched.groups && enriched.groups.length > 0) {
            manifest.snapshot = enriched;
            manifest.summary = enriched.summary;
            await manifest.save();
          }
        } catch (enrichErr) {
          console.error('Enrich manifest snapshot error:', enrichErr);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: manifest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reprint manifest - increments print count and returns snapshot
 */
exports.reprintManifest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const manifest = await DeliveryManifest.findOne({
      where: { id: parseInt(id, 10), tenantId: req.tenantId }
    });

    if (!manifest) {
      return res.status(404).json({
        success: false,
        message: 'Dokumen manifest tidak ditemukan.'
      });
    }

    if (manifest.deliveryIds && manifest.deliveryIds.length > 0) {
      const isSnapshotEmpty = !manifest.snapshot?.groups || 
        manifest.snapshot.groups.length === 0 || 
        !manifest.summary || 
        manifest.summary.totalQty === 0;
      const shouldRefresh = manifest.status === 'SCHEDULED' || 
                            manifest.status === 'ACTIVE' || 
                            manifest.status === 'IN_DELIVERY' || 
                            isSnapshotEmpty;

      if (shouldRefresh) {
        try {
          const enriched = await buildManifestDataFromDeliveries({
            tenantId: req.tenantId,
            deliveryIds: manifest.deliveryIds,
            deliveryDate: manifest.manifestDate,
            driverName: manifest.driverName,
            vehiclePlate: manifest.vehiclePlate,
            warehouseName: manifest.warehouseName,
            manifestNumber: manifest.manifestNumber
          });
          if (enriched && enriched.groups && enriched.groups.length > 0) {
            manifest.snapshot = enriched;
            manifest.summary = enriched.summary;
          }
        } catch (enrichErr) {
          console.error('Enrich reprint manifest snapshot error:', enrichErr);
        }
      }
    }

    manifest.printCount = (manifest.printCount || 0) + 1;
    manifest.lastPrintedAt = new Date();
    await manifest.save();

    await logActivity(req, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      module: 'DELIVERIES',
      action: 'UPDATE',
      description: `Mencetak ulang Manifest #${manifest.manifestNumber} (Cetakan ke-${manifest.printCount})`,
      metadata: { manifestId: manifest.id, manifestNumber: manifest.manifestNumber, printCount: manifest.printCount }
    });

    return res.status(200).json({
      success: true,
      message: `Manifest #${manifest.manifestNumber} siap dicetak ulang (Cetakan ke-${manifest.printCount})`,
      data: manifest
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete / Cancel a manifest from history
 */
exports.deleteManifest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const manifest = await DeliveryManifest.findOne({
      where: { id: parseInt(id, 10), tenantId: req.tenantId }
    });

    if (!manifest) {
      return res.status(404).json({
        success: false,
        message: 'Dokumen manifest tidak ditemukan.'
      });
    }

    const deliveryIds = (manifest.deliveryIds || []).map(dId => parseInt(dId, 10)).filter(Boolean);
    if (deliveryIds.length > 0) {
      // Release deliveries
      await Delivery.update({
        driverName: null,
        vehiclePlate: null
      }, {
        where: { id: { [Op.in]: deliveryIds }, tenantId: req.tenantId, status: { [Op.ne]: 'DELIVERED' } }
      });

      // Clear manifest info from linked Sales Orders metadata
      const linkedDeliveries = await Delivery.findAll({
        where: { id: { [Op.in]: deliveryIds }, tenantId: req.tenantId },
        attributes: ['id', 'salesOrderId']
      });
      const soIds = linkedDeliveries.map(d => d.salesOrderId).filter(Boolean);
      if (soIds.length > 0) {
        const salesOrders = await SalesOrder.findAll({
          where: { id: { [Op.in]: soIds }, tenantId: req.tenantId }
        });
        for (const so of salesOrders) {
          const updatedMeta = { ...(so.metadata || {}) };
          delete updatedMeta.manifestNumber;
          delete updatedMeta.manifestId;
          delete updatedMeta.driverName;
          delete updatedMeta.vehiclePlate;
          await so.update({ metadata: updatedMeta });
        }
      }
    }

    manifest.status = 'CANCELLED';
    await manifest.save();

    await logActivity(req, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      module: 'DELIVERIES',
      action: 'DELETE',
      description: `Membatalkan / Menghapus riwayat Manifest #${manifest.manifestNumber}`,
      metadata: { manifestId: manifest.id, manifestNumber: manifest.manifestNumber }
    });

    return res.status(200).json({
      success: true,
      message: `Riwayat Manifest #${manifest.manifestNumber} berhasil dibatalkan.`
    });
  } catch (error) {
    next(error);
  }
};

exports.buildManifestDataFromDeliveries = buildManifestDataFromDeliveries;



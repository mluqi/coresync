const { SalesOrder, SalesOrderItem, Tax, Product, Customer, Delivery, DeliveryItem, DeliveryManifest, Supplier, ProductUnit, Salesperson, Invoice, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { recordStockOut, recordReturnIn } = require('../utils/inventoryEngine');
const { resolvePaymentAccountId, postDeliveryJournal, postPaymentJournal, postInvoiceJournal, syncOrPostInvoiceJournal } = require('../utils/journalEngine');
const { checkAndUpdateSoStatus } = require('../utils/orderStatusEngine');
const { logActivity } = require('../utils/logger');

exports.getAllSalesOrders = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['soNumber', 'soDate', 'totalAmount', 'status', 'createdAt'],
      defaultSortBy: 'createdAt',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    // Filter Date (Rentang Tanggal atau Tanggal Spesifik)
    const { startDate, endDate, date } = req.query;
    const filterStart = (startDate && String(startDate).trim()) || (date && String(date).trim()) || null;
    const filterEnd = (endDate && String(endDate).trim()) || (date && String(date).trim()) || null;

    if (filterStart && filterEnd) {
      if (filterStart === filterEnd) {
        whereClause.soDate = filterStart;
      } else {
        whereClause.soDate = { [Op.between]: [filterStart, filterEnd] };
      }
    } else if (filterStart) {
      whereClause.soDate = { [Op.gte]: filterStart };
    } else if (filterEnd) {
      whereClause.soDate = { [Op.lte]: filterEnd };
    }

    if (req.query.status) {
      if (req.query.status === 'SHIPPED') {
        whereClause.status = { [Op.in]: ['SHIPPED', 'WAITING_SHIPMENT'] };
      } else if (req.query.status === 'COMPLETED') {
        whereClause.status = { [Op.in]: ['COMPLETED', 'SELESAI'] };
      } else if (req.query.status === 'APPROVED') {
        whereClause.status = { [Op.in]: ['APPROVED', 'CONFIRMED'] };
      } else {
        whereClause.status = req.query.status;
      }
    } else if (req.query.showCancelled !== 'true' && req.query.includeCancelled !== 'true') {
      whereClause.status = { [Op.ne]: 'CANCELLED' };
    }

    // Filter Payment Status (Lunas vs Tempo / Belum Lunas)
    if (req.query.paymentStatus === 'PAID') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          SalesOrder.status IN ('COMPLETED', 'SELESAI') 
          OR JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.paymentStatus')) = 'PAID'
          OR (CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.paidAmount')), '0') AS DECIMAL(15,2)) >= SalesOrder.total_amount - 0.01)
        )`)
      ];
    } else if (req.query.paymentStatus === 'UNPAID') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          SalesOrder.status NOT IN ('COMPLETED', 'SELESAI') 
          AND (JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.paymentStatus')) != 'PAID' OR JSON_EXTRACT(SalesOrder.metadata, '$.paymentStatus') IS NULL)
          AND (CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.paidAmount')), '0') AS DECIMAL(15,2)) < SalesOrder.total_amount - 0.01)
        )`)
      ];
    }

    // Filter Salesperson (Prioritize Sales Order metadata salesperson, fallback to customer master data only if SO has none)
    if (req.query.salesperson) {
      const spVal = req.query.salesperson;
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          (
            JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonId')) IS NOT NULL 
            AND JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonId')) != ''
            AND (
              JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salesperson')) = ${sequelize.escape(spVal)}
              OR JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonId')) = ${sequelize.escape(spVal)}
              OR JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonName')) = ${sequelize.escape(spVal)}
              OR JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonCode')) = ${sequelize.escape(spVal)}
            )
          )
          OR (
            (JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonId')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(SalesOrder.metadata, '$.salespersonId')) = '')
            AND EXISTS (
              SELECT 1 FROM customers c 
              LEFT JOIN salespersons sp ON sp.id = c.salesperson_id
              WHERE c.id = SalesOrder.contact_id 
                AND (sp.name = ${sequelize.escape(spVal)} OR sp.code = ${sequelize.escape(spVal)} OR CAST(sp.id AS CHAR) = ${sequelize.escape(spVal)})
            )
          )
        )`)
      ];
    }

    // Filter PKP vs Non-PKP sales orders
    if (req.query.taxStatus === 'PKP' || req.query.taxType === 'PKP' || req.query.isPkp === 'true') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND taxes.rate > 0 
              AND taxes.name NOT LIKE '%Non%'
          )
        )`)
      ];
    } else if (req.query.taxStatus === 'NON_PKP' || req.query.taxType === 'NON_PKP' || req.query.isPkp === 'false') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          SalesOrder.tax_id IS NULL OR EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND (taxes.rate = 0 OR taxes.name LIKE '%Non%')
          )
        )`)
      ];
    } else if (req.query.taxId) {
      whereClause.taxId = req.query.taxId;
    }

    if (search) {
      whereClause[Op.or] = [
        { soNumber: { [Op.like]: `%${search}%` } },
        sequelize.literal(`EXISTS (
          SELECT 1 FROM customers c 
          WHERE c.id = SalesOrder.contact_id 
            AND (c.name LIKE ${sequelize.escape(`%${search}%`)} OR c.code LIKE ${sequelize.escape(`%${search}%`)})
        )`)
      ];
    }

    const { count, rows } = await SalesOrder.findAndCountAll({
      where: whereClause,
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { 
          model: Customer, 
          as: 'customer', 
          attributes: ['id', 'code', 'name', 'address', 'address2', 'districtName', 'phone', 'salespersonCode', 'salespersonName', 'salespersonId', 'topDays', 'npwp', 'taxName'],
          include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code'] }]
        },
        {
          model: SalesOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'purchasePrice', 'sellingPrice'] }]
        },
        {
          model: Invoice,
          as: 'invoices',
          attributes: ['id', 'invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status']
        }
      ],
      order: [
        [sortBy, sortDir],
        ...(sortBy !== 'createdAt' ? [['createdAt', 'DESC']] : [])
      ],
      limit,
      offset,
      distinct: true
    });

    const processedRows = rows.map(r => {
      const rowJson = r.toJSON();
      if (rowJson.metadata?.itemsDetail && Array.isArray(rowJson.metadata.itemsDetail)) {
        rowJson.items = (rowJson.items || []).map(it => {
          const detail = rowJson.metadata.itemsDetail.find(d => parseInt(d.productId) === parseInt(it.productId));
          return {
            ...it,
            bonusQty: detail?.bonusQty || 0,
            unit: detail?.unit || it.product?.unit || 'pcs',
            conversionRatio: detail?.conversionRatio || 1,
            bonusUnit: detail?.bonusUnit || detail?.unit || it.product?.unit || 'pcs',
            bonusConversionRatio: detail?.bonusConversionRatio || 1
          };
        });
      }
      return rowJson;
    });

    // Dynamic Manifest status resolution for active manifests
    const manifestNumbers = [...new Set(
      processedRows.map(r => r.metadata?.manifestNumber).filter(Boolean)
    )];

    if (manifestNumbers.length > 0) {
      const manifests = await DeliveryManifest.findAll({
        where: {
          tenantId: req.tenantId,
          manifestNumber: { [Op.in]: manifestNumbers }
        },
        attributes: ['manifestNumber', 'status']
      });
      const manifestStatusMap = new Map();
      manifests.forEach(m => manifestStatusMap.set(m.manifestNumber, m.status));

      processedRows.forEach(r => {
        if (r.metadata?.manifestNumber && manifestStatusMap.has(r.metadata.manifestNumber)) {
          const mStatus = manifestStatusMap.get(r.metadata.manifestNumber);
          if (!r.metadata) r.metadata = {};
          r.metadata.manifestStatus = mStatus;

          const isPaid = (parseFloat(r.metadata?.paidAmount || 0) >= parseFloat(r.totalAmount || 0) - 0.01) || r.metadata?.paymentStatus === 'PAID';

          if (mStatus === 'DELIVERED') {
            r.status = isPaid ? 'COMPLETED' : 'SHIPPED';
          } else if (mStatus === 'SCHEDULED' || mStatus === 'ACTIVE') {
            if (r.status === 'SHIPPED') {
              r.status = 'WAITING_SHIPMENT';
            }
          } else if (mStatus === 'IN_DELIVERY') {
            if (r.status === 'WAITING_SHIPMENT') {
              r.status = 'SHIPPED';
            }
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: processedRows,
      pagination: buildPaginationMeta(count, page, limit)
    });
  } catch (error) {
    next(error);
  }
};

exports.createSalesOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      soNumber,
      soDate,
      contactId,
      warehouseId,
      taxId,
      items,
      notes,
      autoSj,
      autoInvoice = true,
      paymentTerm,
      dpAmount,
      dueDate,
      metadata,
      driverName,
      vehiclePlate
    } = req.body;

    if (!soNumber || !soDate || !contactId || !warehouseId || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'SO Number, SO Date, Customer, Warehouse, and at least 1 item are required.'
      });
    }

    // Check duplicate products in item list
    const productIds = items.map(i => parseInt(i.productId));
    if (new Set(productIds).size !== productIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Terdapat barang duplikat dalam daftar item. Harap gabungkan jumlah (Qty) pada satu baris produk yang sama.'
      });
    }

    const existingSo = await SalesOrder.findOne({
      where: { tenantId: req.tenantId, soNumber },
      transaction
    });

    if (existingSo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `SO Number '${soNumber}' is already in use.`
      });
    }

    let applyTax = req.body.applyTax !== false;
    // Penjualan ke customer PKP: PPN sudah termasuk harga (inklusif), bukan di luar harga
    const taxInclusive = req.body.taxInclusive !== undefined ? Boolean(req.body.taxInclusive) : Boolean(applyTax);
    let effectiveTaxId = taxId;

    // Enforce taxAccess scope from backend
    if (req.user?.taxAccess === 'NON_PKP') {
      applyTax = false;
      effectiveTaxId = null;
    } else if (req.user?.taxAccess === 'PKP') {
      applyTax = true;
      if (!effectiveTaxId) {
        const pkpTax = await Tax.findOne({
          where: {
            tenantId: req.tenantId,
            isActive: true,
            rate: { [Op.gt]: 0 },
            name: { [Op.notLike]: '%Non%' }
          },
          transaction
        });
        if (pkpTax) effectiveTaxId = pkpTax.id;
      }
    }

    let taxRate = 0;
    if (applyTax && effectiveTaxId) {
      const tax = await Tax.findOne({ where: { id: effectiveTaxId, tenantId: req.tenantId }, transaction });
      if (tax) {
        taxRate = parseFloat(tax.rate);
      }
    }

    let itemsSum = 0;
    const soItems = [];

    for (const item of items) {
      const { productId, qty, price, discount = 0 } = item;
      if (!productId || qty === undefined || qty <= 0 || price === undefined || price < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Each item must have a product ID, quantity > 0, and price >= 0.'
        });
      }

      const product = await Product.findOne({ where: { id: productId, tenantId: req.tenantId }, transaction });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Product with ID ${productId} not found.`
        });
      }

      let calculatedPrice = parseFloat(price);
      let itemDiscount = parseFloat(discount || 0);
      let finalPrice = Math.max(0, calculatedPrice - itemDiscount);
      let itemSubtotal = qty * finalPrice;

      itemsSum += itemSubtotal;

      soItems.push({
        productId,
        qty,
        price: calculatedPrice,
        discount: itemDiscount,
        subtotal: itemSubtotal
      });
    }

    let globalDiscountMode = req.body.globalDiscountMode || req.body.metadata?.globalDiscountMode;
    let globalDiscountPercent = parseFloat(req.body.globalDiscountPercent !== undefined ? req.body.globalDiscountPercent : (req.body.metadata?.globalDiscountPercent || 0));
    let globalDiscountAmount = 0;
    const reqDiscountAmount = req.body.globalDiscountAmount !== undefined ? req.body.globalDiscountAmount : req.body.metadata?.globalDiscountAmount;

    if (globalDiscountMode === 'AMOUNT') {
      globalDiscountAmount = Math.min(itemsSum, Math.max(0, parseFloat(reqDiscountAmount || 0)));
      globalDiscountPercent = itemsSum > 0 ? (globalDiscountAmount / itemsSum) * 100 : 0;
    } else if (globalDiscountMode === 'PERCENT' || globalDiscountPercent > 0) {
      globalDiscountPercent = Math.min(100, Math.max(0, globalDiscountPercent));
      globalDiscountAmount = itemsSum * (globalDiscountPercent / 100);
    } else if (reqDiscountAmount !== undefined && parseFloat(reqDiscountAmount) > 0) {
      globalDiscountAmount = Math.min(itemsSum, Math.max(0, parseFloat(reqDiscountAmount)));
      globalDiscountPercent = itemsSum > 0 ? (globalDiscountAmount / itemsSum) * 100 : 0;
    } else {
      globalDiscountAmount = itemsSum * (globalDiscountPercent / 100);
    }

    let subtotal = Math.max(0, itemsSum - globalDiscountAmount);
    let taxAmount = 0;
    let totalAmount = subtotal;

    if (applyTax && effectiveTaxId && taxRate > 0) {
      if (taxInclusive) {
        totalAmount = subtotal;
        subtotal = totalAmount / (1 + (taxRate / 100));
        taxAmount = totalAmount - subtotal;
      } else {
        taxAmount = subtotal * (taxRate / 100);
        totalAmount = subtotal + taxAmount;
      }
    } else {
      taxAmount = 0;
      totalAmount = subtotal;
    }

    const fulfillmentType = req.body.fulfillmentType || metadata?.fulfillmentType || 'DELIVERY';
    const isPickup = fulfillmentType === 'PICKUP';
    const isDraft = req.body.isDraft === true || req.body.status === 'DRAFT';
    const initialPaymentStatus = isDraft ? 'UNPAID' : (paymentTerm === 'DP' && dpAmount > 0 ? 'PARTIAL' : 'UNPAID');
    const initialPaid = isDraft ? 0 : (paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0);
    const initialStatus = isDraft 
      ? 'DRAFT' 
      : (isPickup 
          ? 'COMPLETED'
          : (autoSj ? 'SHIPPED' : 'CONFIRMED'));

    // Validate bonus and regular stock sufficiency if not draft
    if (!isDraft) {
      for (const item of items) {
        const bonusQty = parseInt(item.bonusQty) || 0;
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const reqBonusBaseQty = bonusQty * bonusRatio;
        if (bonusQty > 0) {
          const pw = await sequelize.models.ProductWarehouse.findOne({
            where: { productId: item.productId, warehouseId },
            transaction
          });
          const availableBonusStock = pw ? parseFloat(pw.bonusStock || 0) : 0;
          if (availableBonusStock < reqBonusBaseQty) {
            const product = await Product.findOne({ where: { id: item.productId, tenantId: req.tenantId }, transaction });
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Stok bonus tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok bonus tersedia: ${availableBonusStock} ${product?.unit || 'pcs'}, Diminta: ${reqBonusBaseQty} ${product?.unit || 'pcs'}). Harap sesuaikan kuantitas bonus atau simpan sebagai Draft terlebih dahulu.`
            });
          }
        }

        if (autoSj || isPickup) {
          const buyRatio = parseFloat(item.conversionRatio || 1);
          const reqRegularBaseQty = (parseFloat(item.qty) || 0) * buyRatio;
          const pw = await sequelize.models.ProductWarehouse.findOne({
            where: { productId: item.productId, warehouseId },
            transaction
          });
          const availableRegularStock = pw ? parseFloat(pw.stock || 0) : 0;
          if (availableRegularStock < reqRegularBaseQty) {
            const product = await Product.findOne({ where: { id: item.productId, tenantId: req.tenantId }, transaction });
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Stok reguler tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok tersedia: ${availableRegularStock} ${product?.unit || 'pcs'}, Diminta: ${reqRegularBaseQty} ${product?.unit || 'pcs'}). Harap sesuaikan kuantitas atau simpan sebagai Draft terlebih dahulu.`
            });
          }
        }
      }
    }

    // Auto-resolve salesperson info if provided in metadata or request body
    let finalMetadata = { ...(metadata || {}) };
    const spId = finalMetadata.salespersonId || req.body.salespersonId || (req.body.salesperson && !isNaN(req.body.salesperson) ? parseInt(req.body.salesperson) : null);
    if (spId) {
      finalMetadata.salespersonId = spId;
      if (!finalMetadata.salespersonCode || !finalMetadata.salespersonName) {
        const spRecord = await Salesperson.findOne({ where: { id: spId, tenantId: req.tenantId }, transaction });
        if (spRecord) {
          finalMetadata.salespersonCode = finalMetadata.salespersonCode || spRecord.code;
          finalMetadata.salespersonName = finalMetadata.salespersonName || spRecord.name;
          finalMetadata.salesperson = finalMetadata.salesperson || spRecord.name;
        }
      }
    }

    // Create SO
    const so = await SalesOrder.create({
      tenantId: req.tenantId,
      contactId,
      soNumber,
      soDate,
      status: initialStatus,
      taxId: (applyTax && effectiveTaxId) ? effectiveTaxId : null,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      metadata: {
        ...finalMetadata,
        fulfillmentType,
        isPickup,
        isDraft,
        applyTax,
        taxInclusive,
        globalDiscountMode,
        globalDiscountPercent,
        globalDiscountAmount,
        itemsDetail: items.map(it => ({
          productId: it.productId,
          unit: it.unit || 'pcs',
          conversionRatio: parseFloat(it.conversionRatio || 1),
          qty: it.qty,
          bonusQty: parseInt(it.bonusQty) || 0,
          bonusUnit: it.bonusUnit || it.unit || 'pcs',
          bonusConversionRatio: parseFloat(it.bonusConversionRatio || 1),
          price: it.price,
          discount: it.discount || 0,
          discountPercent: it.discountPercent || 0
        })),
        paymentTerm: paymentTerm || 'LUNAS',
        dpAmount: dpAmount || 0,
        dueDate: dueDate || null,
        paidAmount: initialPaid,
        paymentStatus: initialPaymentStatus,
        payments: initialPaid > 0 ? [{
          id: `PAY-INIT-${Date.now()}`,
          amount: initialPaid,
          date: soDate,
          method: 'CASH',
          notes: paymentTerm === 'DP' ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran SO'
        }] : []
      }
    }, { transaction });

    // Create SO Items
    const itemsToSave = soItems.map(item => ({
      ...item,
      salesOrderId: so.id
    }));

    const createdSoItems = await SalesOrderItem.bulkCreate(itemsToSave, { transaction });

    // Auto Generate Invoice (Faktur Penjualan)
    if (!isDraft && autoInvoice !== false) {
      let invNumber = soNumber.startsWith('SO.') ? soNumber.replace(/^SO\./, 'INV.') : `INV-${soNumber.replace(/^SO-/, '')}`;
      const existingInv = await sequelize.models.Invoice.findOne({
        where: { tenantId: req.tenantId, type: 'SALES', invoiceNumber: invNumber },
        transaction
      });
      if (existingInv) {
        invNumber = `${invNumber}-${Date.now().toString().slice(-4)}`;
      }

      const invAmountDue = Math.max(0, totalAmount - initialPaid);
      let invStatus = 'UNPAID';
      if (initialPaid >= totalAmount - 0.01) {
        invStatus = 'PAID';
      } else if (initialPaid > 0) {
        invStatus = 'PARTIALLY_PAID';
      }

      const invoice = await sequelize.models.Invoice.create({
        tenantId: req.tenantId,
        type: 'SALES',
        salesOrderId: so.id,
        invoiceNumber: invNumber,
        invoiceDate: soDate,
        dueDate: dueDate || soDate,
        status: invStatus,
        taxId: (applyTax && effectiveTaxId) ? effectiveTaxId : null,
        subtotal,
        taxAmount,
        totalAmount,
        amountDue: invAmountDue,
        metadata: {
          ...metadata,
          autoGenerated: true,
          soNumber,
          paidAmount: initialPaid
        }
      }, { transaction });

      await postInvoiceJournal(invoice, transaction);

      // If initial payment was made (DP/Lunas), also post Payment journal
      if (initialPaid > 0) {
        const targetAccountId = await resolvePaymentAccountId(req.tenantId, 'CASH', null, transaction);
        if (targetAccountId) {
          const paymentNumber = `PAY-SO-${soNumber}-${Date.now().toString().slice(-4)}`;
          const paymentRecord = await sequelize.models.Payment.create({
            tenantId: req.tenantId,
            invoiceId: invoice.id,
            paymentNumber,
            paymentDate: soDate,
            paymentType: 'RECEIPT',
            paymentMethod: 'CASH',
            amount: initialPaid,
            accountId: targetAccountId,
            notes: paymentTerm === 'DP' ? `Pembayaran Uang Muka (DP) SO #${soNumber}` : `Pelunasan SO #${soNumber}`
          }, { transaction });

          await postPaymentJournal(paymentRecord, transaction);
        }
      }
    }

    if (!isDraft && (autoSj || isPickup)) {
      let deliveryNumber;
      if (isPickup) {
        deliveryNumber = soNumber.startsWith('SO.') ? soNumber.replace(/^SO\./, 'SJ-PKP.') : (soNumber.startsWith('SO-') ? `SJ-PKP-${soNumber.replace(/^SO-/, '')}` : `SJ-PKP-${soNumber}`);
      } else {
        deliveryNumber = soNumber.startsWith('SO.') ? soNumber.replace(/^SO\./, 'SJ.') : `SJ-${soNumber.replace(/^SO-/, '')}`;
      }
      // Verify unique delivery number
      const existingDeliv = await Delivery.findOne({
        where: { tenantId: req.tenantId, deliveryNumber },
        transaction
      });
      if (existingDeliv) {
        deliveryNumber = `${deliveryNumber}-${Date.now().toString().slice(-4)}`;
      }

      // Create Delivery (Surat Jalan / Penyerahan Barang)
      const delivery = await Delivery.create({
        tenantId: req.tenantId,
        salesOrderId: so.id,
        warehouseId,
        deliveryNumber,
        deliveryDate: soDate,
        status: isPickup ? 'DELIVERED' : 'SHIPPED',
        driverName: isPickup ? 'Ambil Sendiri' : (driverName || metadata?.driverName || null),
        vehiclePlate: isPickup ? '—' : (vehiclePlate || metadata?.vehiclePlate || null),
        notes: notes || (isPickup ? 'Pengambilan langsung oleh pelanggan (Pickup di Toko)' : 'Dibuat otomatis dari Sales Order'),
        metadata: {
          ...(metadata || {}),
          fulfillmentType,
          isPickup,
          pickedUpAt: isPickup ? new Date().toISOString() : null
        }
      }, { transaction });

      // Create Delivery Items (save main buy quantity)
      const deliveryItems = items.map(item => {
        const buyQty = parseInt(item.qty) || 0;
        return {
          tenantId: req.tenantId,
          deliveryId: delivery.id,
          productId: item.productId,
          qtyShipped: buyQty
        };
      });
      await DeliveryItem.bulkCreate(deliveryItems, { transaction });

      // Deduct Stock & Record Stock Out (separate regular and bonus stock)
      let totalComputedHpp = 0;
      for (const item of items) {
        const buyRatio = parseFloat(item.conversionRatio || 1);
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const buyQty = parseFloat(item.qty) || 0;
        const bonusQty = parseFloat(item.bonusQty) || 0;
        const regularDeductQty = parseFloat((buyQty * buyRatio).toFixed(4));
        const bonusDeductQty = parseFloat((bonusQty * bonusRatio).toFixed(4));

        if (regularDeductQty > 0) {
          const regularNote = isPickup ? `Ambil Sendiri SO #${so.soNumber}` : `Penjualan SO #${so.soNumber}`;
          const hpp = await recordStockOut({
            tenantId: req.tenantId,
            warehouseId,
            productId: item.productId,
            qty: regularDeductQty,
            isBonus: false,
            referenceType: 'DELIVERY_ORDER',
            referenceId: delivery.id,
            customNotes: regularNote,
            transaction
          });
          totalComputedHpp += parseFloat(hpp || 0);
        }

        if (bonusDeductQty > 0) {
          const bonusNote = isPickup ? `Ambil Sendiri Bonus SO #${so.soNumber}` : `Penjualan Bonus SO #${so.soNumber}`;
          await recordStockOut({
            tenantId: req.tenantId,
            warehouseId,
            productId: item.productId,
            qty: bonusDeductQty,
            isBonus: true,
            referenceType: 'DELIVERY_ORDER',
            referenceId: delivery.id,
            customNotes: bonusNote,
            transaction
          });
        }
      }

      // Post Delivery Journal
      await postDeliveryJournal(delivery, totalComputedHpp, transaction);

      // Update SO Status
      const finalStatus = isPickup ? 'COMPLETED' : 'SHIPPED';
      await so.update({
        status: finalStatus,
        metadata: {
          ...(so.metadata || {}),
          fulfillmentType,
          isPickup,
          pickedUpAt: isPickup ? new Date().toISOString() : null,
          ...(finalStatus === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {})
        }
      }, { transaction });
    }

    await transaction.commit();

    const createdSo = await SalesOrder.findByPk(so.id, {
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { 
          model: Customer, 
          as: 'customer',
          include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code', 'phone'] }]
        },
        {
          model: SalesOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'SALES_ORDERS',
      description: `Membuat Sales Order #${so.soNumber}`,
      metadata: { id: so.id, soNumber: so.soNumber, totalAmount: so.totalAmount, status: so.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Sales Order created as DRAFT.',
      data: createdSo
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deleteSalesOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const so = await SalesOrder.findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
      transaction
    });

    if (!so) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales Order not found or access denied.'
      });
    }

    if (so.status !== 'DRAFT') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Hanya Sales Order berstatus DRAFT yang dapat dihapus. Status saat ini: ${so.status}`
      });
    }

    const soData = { id: so.id, soNumber: so.soNumber, totalAmount: so.totalAmount };

    // 1. Delete linked Draft Invoice if exists
    const inv = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });
    if (inv) {
      await sequelize.models.InvoiceItem.destroy({
        where: { invoiceId: inv.id },
        transaction
      });
      await sequelize.models.JournalEntry.destroy({ where: { referenceType: 'INVOICE', referenceId: inv.id }, transaction });
      await inv.destroy({ transaction });
    }

    // 2. Delete SO Items
    await SalesOrderItem.destroy({
      where: { salesOrderId: so.id },
      transaction
    });

    // 3. Delete SO
    await so.destroy({ transaction });

    await transaction.commit();

    await logActivity(req, {
      action: 'DELETE',
      module: 'SALES_ORDERS',
      description: `Menghapus Sales Order #${soData.soNumber}`,
      metadata: soData
    });

    return res.status(200).json({
      success: true,
      message: 'Sales Order dan Invoice terkait berhasil dihapus.'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.updateSalesOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { soNumber, soDate, contactId, taxId, notes, items, metadata, autoSj, warehouseId, driverName, vehiclePlate, fulfillmentType: reqFulfillmentType } = req.body;
    
    const so = await SalesOrder.findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: [{ model: SalesOrderItem, as: 'items' }]
    });

    if (!so) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sales Order not found.'
      });
    }

    if (so.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sales Order yang sudah dibatalkan tidak dapat diubah.'
      });
    }

    if (!soNumber || !soDate || !contactId || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'SO Number, SO Date, Customer ID, and items are required.'
      });
    }

    // Check duplicate products in item list
    const productIds = items.map(i => parseInt(i.productId));
    if (new Set(productIds).size !== productIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Terdapat barang duplikat dalam daftar item. Harap gabungkan jumlah (Qty) pada satu baris produk yang sama.'
      });
    }

    const isAlreadyShipped = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'SELESAI'].includes(so.status);
    const targetWhId = warehouseId || so.warehouseId || 1;

    // Check tax rate
    let taxRate = 0;
    if (taxId) {
      const tax = await Tax.findOne({ where: { id: taxId, tenantId: req.tenantId } });
      if (tax) {
        taxRate = tax.rate / 100;
      }
    }

    // ─── If already shipped, handle stock reconciliation deltas ───────────
    if (isAlreadyShipped) {
      const oldItemsDetail = so.metadata?.itemsDetail || [];
      const oldItemsMap = {};
      for (const oldIt of (so.items || [])) {
        const pId = parseInt(oldIt.productId);
        const detail = oldItemsDetail.find(d => parseInt(d.productId) === pId);
        const ratio = parseFloat(detail?.conversionRatio || 1);
        const bonusRatio = parseFloat(detail?.bonusConversionRatio || 1);
        const buyQty = parseFloat(oldIt.qty || 0);
        const bonusQty = parseFloat(detail?.bonusQty || 0);
        oldItemsMap[pId] = {
          regularBaseQty: parseFloat((buyQty * ratio).toFixed(4)),
          bonusBaseQty: parseFloat((bonusQty * bonusRatio).toFixed(4))
        };
      }

      const newItemsMap = {};
      for (const item of items) {
        const pId = parseInt(item.productId);
        const ratio = parseFloat(item.conversionRatio || 1);
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const buyQty = parseFloat(item.qty || 0);
        const bonusQty = parseFloat(item.bonusQty || 0);
        newItemsMap[pId] = {
          regularBaseQty: parseFloat((buyQty * ratio).toFixed(4)),
          bonusBaseQty: parseFloat((bonusQty * bonusRatio).toFixed(4))
        };
      }

      const linkedDelivery = await Delivery.findOne({
        where: { salesOrderId: so.id, tenantId: req.tenantId },
        transaction
      });

      const allProductIds = Array.from(new Set([
        ...Object.keys(oldItemsMap).map(id => parseInt(id)),
        ...Object.keys(newItemsMap).map(id => parseInt(id))
      ]));

      // Check availability for any positive diffs
      for (const pId of allProductIds) {
        const oldReg = oldItemsMap[pId]?.regularBaseQty || 0;
        const newReg = newItemsMap[pId]?.regularBaseQty || 0;
        const diffReg = parseFloat((newReg - oldReg).toFixed(4));

        const oldBonus = oldItemsMap[pId]?.bonusBaseQty || 0;
        const newBonus = newItemsMap[pId]?.bonusBaseQty || 0;
        const diffBonus = parseFloat((newBonus - oldBonus).toFixed(4));

        if (diffReg > 0 || diffBonus > 0) {
          const pw = await sequelize.models.ProductWarehouse.findOne({
            where: { productId: pId, warehouseId: targetWhId },
            transaction
          });
          const product = await Product.findOne({ where: { id: pId, tenantId: req.tenantId }, transaction });

          if (diffReg > 0) {
            const availStock = pw ? parseFloat(pw.stock || 0) : 0;
            if (availStock < diffReg) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `Stok tidak mencukupi untuk penambahan barang '${product?.name || pId}' (Tersedia: ${availStock}, Diperlukan tambahan: ${diffReg}).`
              });
            }
          }

          if (diffBonus > 0) {
            const availBonus = pw ? parseFloat(pw.bonusStock || 0) : 0;
            if (availBonus < diffBonus) {
              await transaction.rollback();
              return res.status(400).json({
                success: false,
                message: `Stok bonus tidak mencukupi untuk penambahan barang '${product?.name || pId}' (Tersedia bonus: ${availBonus}, Diperlukan tambahan: ${diffBonus}).`
              });
            }
          }
        }
      }

      // Perform delta stock adjustments
      for (const pId of allProductIds) {
        const oldReg = oldItemsMap[pId]?.regularBaseQty || 0;
        const newReg = newItemsMap[pId]?.regularBaseQty || 0;
        const diffReg = parseFloat((newReg - oldReg).toFixed(4));

        const oldBonus = oldItemsMap[pId]?.bonusBaseQty || 0;
        const newBonus = newItemsMap[pId]?.bonusBaseQty || 0;
        const diffBonus = parseFloat((newBonus - oldBonus).toFixed(4));

        const product = await Product.findOne({ where: { id: pId, tenantId: req.tenantId }, transaction });
        const costPrice = parseFloat(product?.purchasePrice || 0);

        // Regular Stock diff
        if (diffReg < 0) {
          await recordReturnIn({
            tenantId: req.tenantId,
            warehouseId: targetWhId,
            productId: pId,
            qty: Math.abs(diffReg),
            costPrice,
            isBonus: false,
            referenceType: 'RETURN',
            referenceId: so.id,
            customNotes: `Revisi SO #${so.soNumber} (Pengurangan ${Math.abs(diffReg)} ${product?.unit || 'pcs'})`,
            transaction
          });
        } else if (diffReg > 0) {
          await recordStockOut({
            tenantId: req.tenantId,
            warehouseId: targetWhId,
            productId: pId,
            qty: diffReg,
            isBonus: false,
            referenceType: 'DELIVERY_ORDER',
            referenceId: linkedDelivery ? linkedDelivery.id : so.id,
            customNotes: `Revisi SO #${so.soNumber} (Penambahan ${diffReg} ${product?.unit || 'pcs'})`,
            transaction
          });
        }

        // Bonus Stock diff
        if (diffBonus < 0) {
          await recordReturnIn({
            tenantId: req.tenantId,
            warehouseId: targetWhId,
            productId: pId,
            qty: Math.abs(diffBonus),
            costPrice: 0,
            isBonus: true,
            referenceType: 'RETURN',
            referenceId: so.id,
            customNotes: `Revisi Bonus SO #${so.soNumber} (Pengurangan ${Math.abs(diffBonus)} ${product?.unit || 'pcs'})`,
            transaction
          });
        } else if (diffBonus > 0) {
          await recordStockOut({
            tenantId: req.tenantId,
            warehouseId: targetWhId,
            productId: pId,
            qty: diffBonus,
            isBonus: true,
            referenceType: 'DELIVERY_ORDER',
            referenceId: linkedDelivery ? linkedDelivery.id : so.id,
            customNotes: `Revisi Bonus SO #${so.soNumber} (Penambahan ${diffBonus} ${product?.unit || 'pcs'})`,
            transaction
          });
        }
      }

      // Update Delivery Items in linked delivery
      if (linkedDelivery) {
        await DeliveryItem.destroy({ where: { deliveryId: linkedDelivery.id }, transaction });
        const newDeliveryItems = items.map(item => {
          const bRatio = parseFloat(item.conversionRatio || 1);
          const bBonusRatio = parseFloat(item.bonusConversionRatio || 1);
          const bBuyQty = parseFloat(item.qty || 0);
          const bBonusQty = parseFloat(item.bonusQty || 0);
          return {
            deliveryId: linkedDelivery.id,
            productId: item.productId,
            qtyShipped: parseFloat(((bBuyQty * bRatio) + (bBonusQty * bBonusRatio)).toFixed(4))
          };
        });
        await DeliveryItem.bulkCreate(newDeliveryItems, { transaction });
      }
    }

    // Delete old items
    await SalesOrderItem.destroy({
      where: { salesOrderId: so.id },
      transaction
    });

    // Create new items and calculate totals
    let subtotal = 0;
    const itemsData = [];
    
    const applyTax = req.body.applyTax !== false;
    // Penjualan ke customer PKP: PPN sudah termasuk harga (inklusif), bukan di luar harga
    const taxInclusive = req.body.taxInclusive !== undefined ? Boolean(req.body.taxInclusive) : Boolean(applyTax);

    for (const item of items) {
      const product = await Product.findOne({ where: { id: item.productId, tenantId: req.tenantId } });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Product with ID ${item.productId} not found.`
        });
      }

      const qty = parseInt(item.qty || 1);
      const price = parseFloat(item.price || 0);
      const discount = parseFloat(item.discount || 0);
      const finalPrice = Math.max(0, price - discount);
      const itemSubtotal = qty * finalPrice;
      
      subtotal += itemSubtotal;

      itemsData.push({
        salesOrderId: so.id,
        productId: item.productId,
        qty,
        price,
        discount,
        subtotal: itemSubtotal
      });
    }

    // Apply global discount
    let globalDiscountMode = req.body.globalDiscountMode || req.body.metadata?.globalDiscountMode || metadata?.globalDiscountMode;
    let globalDiscountPercent = parseFloat(req.body.globalDiscountPercent !== undefined ? req.body.globalDiscountPercent : (metadata?.globalDiscountPercent || 0));
    let globalDiscountAmount = 0;
    const reqDiscountAmount = req.body.globalDiscountAmount !== undefined ? req.body.globalDiscountAmount : metadata?.globalDiscountAmount;

    if (globalDiscountMode === 'AMOUNT') {
      globalDiscountAmount = Math.min(subtotal, Math.max(0, parseFloat(reqDiscountAmount || 0)));
      globalDiscountPercent = subtotal > 0 ? (globalDiscountAmount / subtotal) * 100 : 0;
    } else if (globalDiscountMode === 'PERCENT' || globalDiscountPercent > 0) {
      globalDiscountPercent = Math.min(100, Math.max(0, globalDiscountPercent));
      globalDiscountAmount = subtotal * (globalDiscountPercent / 100);
    } else if (reqDiscountAmount !== undefined && parseFloat(reqDiscountAmount) > 0) {
      globalDiscountAmount = Math.min(subtotal, Math.max(0, parseFloat(reqDiscountAmount)));
      globalDiscountPercent = subtotal > 0 ? (globalDiscountAmount / subtotal) * 100 : 0;
    } else {
      globalDiscountAmount = subtotal * (globalDiscountPercent / 100);
    }
    const netSubtotal = Math.max(0, subtotal - globalDiscountAmount);

    // Calculate tax & grand total
    let taxAmount = 0;
    let grandTotal = netSubtotal;
    subtotal = netSubtotal;

    if (applyTax && taxId && taxRate > 0) {
      if (taxInclusive) {
        grandTotal = netSubtotal;
        subtotal = grandTotal / (1 + taxRate);
        taxAmount = grandTotal - subtotal;
      } else {
        subtotal = netSubtotal;
        taxAmount = subtotal * taxRate;
        grandTotal = subtotal + taxAmount;
      }
    } else {
      subtotal = netSubtotal;
      taxAmount = 0;
      grandTotal = netSubtotal;
    }

    const prevMetadata = so.metadata || {};
    const paymentTerm = req.body.paymentTerm || metadata?.paymentTerm || prevMetadata.paymentTerm || 'LUNAS';
    const dpAmount = paymentTerm === 'DP' ? parseFloat(req.body.dpAmount || metadata?.dpAmount || prevMetadata.dpAmount || 0) : 0;
    const dueDate = (paymentTerm === 'TEMPO' || paymentTerm === 'DP') ? (req.body.dueDate || metadata?.dueDate || prevMetadata.dueDate || null) : null;
    
    let currentPaid = 0;
    if (prevMetadata.paidAmount !== undefined && prevMetadata.paidAmount !== null) {
      currentPaid = parseFloat(prevMetadata.paidAmount);
    } else if (paymentTerm === 'DP') {
      currentPaid = dpAmount;
    } else {
      currentPaid = 0;
    }

    let currentPaymentStatus = 'UNPAID';
    if (currentPaid >= grandTotal - 0.01) {
      currentPaymentStatus = 'PAID';
    } else if (currentPaid > 0) {
      currentPaymentStatus = 'PARTIAL';
    } else {
      currentPaymentStatus = 'UNPAID';
    }

    const fulfillmentType = reqFulfillmentType || req.body.fulfillmentType || metadata?.fulfillmentType || prevMetadata.fulfillmentType || 'DELIVERY';
    const isPickup = fulfillmentType === 'PICKUP';
    const isDraft = req.body.isDraft === true || req.body.metadata?.isDraft === true || req.body.status === 'DRAFT';
    const newStatus = isAlreadyShipped 
      ? (isPickup ? 'COMPLETED' : so.status)
      : (isDraft 
          ? 'DRAFT' 
          : (isPickup 
              ? 'COMPLETED'
              : (autoSj ? 'SHIPPED' : 'APPROVED')));

    // Validate bonus and regular stock sufficiency if not draft and not already shipped
    if (!isDraft && !isAlreadyShipped) {
      for (const item of items) {
        const bonusQty = parseInt(item.bonusQty) || 0;
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const reqBonusBaseQty = bonusQty * bonusRatio;
        if (bonusQty > 0) {
          const pw = await sequelize.models.ProductWarehouse.findOne({
            where: { productId: item.productId, warehouseId: targetWhId },
            transaction
          });
          const availableBonusStock = pw ? parseFloat(pw.bonusStock || 0) : 0;
          if (availableBonusStock < reqBonusBaseQty) {
            const product = await Product.findOne({ where: { id: item.productId, tenantId: req.tenantId }, transaction });
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Stok bonus tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok bonus tersedia: ${availableBonusStock} ${product?.unit || 'pcs'}, Diminta: ${reqBonusBaseQty} ${product?.unit || 'pcs'}). Harap sesuaikan kuantitas bonus atau simpan sebagai Draft terlebih dahulu.`
            });
          }
        }

        if (autoSj || isPickup) {
          const buyRatio = parseFloat(item.conversionRatio || 1);
          const reqRegularBaseQty = (parseFloat(item.qty) || 0) * buyRatio;
          const pw = await sequelize.models.ProductWarehouse.findOne({
            where: { productId: item.productId, warehouseId: targetWhId },
            transaction
          });
          const availableRegularStock = pw ? parseFloat(pw.stock || 0) : 0;
          if (availableRegularStock < reqRegularBaseQty) {
            const product = await Product.findOne({ where: { id: item.productId, tenantId: req.tenantId }, transaction });
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              message: `Stok reguler tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok tersedia: ${availableRegularStock} ${product?.unit || 'pcs'}, Diminta: ${reqRegularBaseQty} ${product?.unit || 'pcs'}). Harap sesuaikan kuantitas atau simpan sebagai Draft terlebih dahulu.`
            });
          }
        }
      }
    }

    // Maintain revision history in metadata
    const prevRevisions = Array.isArray(prevMetadata.revisions) ? prevMetadata.revisions : [];
    const revisionEntry = {
      revisedAt: new Date().toISOString(),
      revisedBy: req.user?.name || 'User',
      reason: req.body.revisionReason || req.body.notes || (isAlreadyShipped ? 'Revisi pesanan setelah pengiriman' : 'Perubahan pesanan'),
      previousTotal: so.totalAmount,
      newTotal: grandTotal
    };

    // Auto-resolve salesperson info if provided in metadata or request body
    let finalMetadata = { ...prevMetadata, ...(metadata || {}) };
    const spId = finalMetadata.salespersonId || req.body.salespersonId || (req.body.salesperson && !isNaN(req.body.salesperson) ? parseInt(req.body.salesperson) : null);
    if (spId) {
      finalMetadata.salespersonId = spId;
      if (!finalMetadata.salespersonCode || !finalMetadata.salespersonName) {
        const spRecord = await Salesperson.findOne({ where: { id: spId, tenantId: req.tenantId }, transaction });
        if (spRecord) {
          finalMetadata.salespersonCode = spRecord.code;
          finalMetadata.salespersonName = spRecord.name;
          finalMetadata.salesperson = spRecord.name;
        }
      }
    }

    // Update Sales Order
    await so.update({
      soNumber,
      soDate,
      contactId,
      warehouseId: targetWhId,
      status: newStatus,
      taxId: applyTax ? taxId : null,
      notes,
      subtotal,
      taxAmount,
      totalAmount: grandTotal,
      metadata: {
        ...finalMetadata,
        fulfillmentType,
        isPickup,
        warehouseId: targetWhId,
        isDraft,
        taxInclusive,
        applyTax,
        globalDiscountMode,
        globalDiscountPercent,
        globalDiscountAmount,
        paymentTerm,
        dpAmount,
        dueDate,
        paidAmount: currentPaid,
        paymentStatus: currentPaymentStatus,
        revisions: [...prevRevisions, revisionEntry],
        itemsDetail: items.map(it => ({
          productId: it.productId,
          unit: it.unit || 'pcs',
          conversionRatio: parseFloat(it.conversionRatio || 1),
          qty: it.qty,
          bonusQty: parseInt(it.bonusQty) || 0,
          bonusUnit: it.bonusUnit || it.unit || 'pcs',
          bonusConversionRatio: parseFloat(it.bonusConversionRatio || 1),
          price: it.price,
          discount: it.discount || 0,
          discountPercent: it.discountPercent || 0
        }))
      }
    }, { transaction });

    // Bulk create new items
    const createdSoItems = await SalesOrderItem.bulkCreate(itemsData, { transaction });

    // Sync linked Delivery if exists
    const linkedDelivery = await Delivery.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });

    if (linkedDelivery) {
      await DeliveryItem.destroy({ where: { deliveryId: linkedDelivery.id }, transaction });
      const newDeliveryItems = items.map(item => {
        const bRatio = parseFloat(item.conversionRatio || 1);
        const bBonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const bBuyQty = parseFloat(item.qty || 0);
        const bBonusQty = parseFloat(item.bonusQty || 0);
        return {
          tenantId: req.tenantId,
          deliveryId: linkedDelivery.id,
          productId: item.productId,
          qtyShipped: parseFloat(((bBuyQty * bRatio) + (bBonusQty * bBonusRatio)).toFixed(4))
        };
      });
      await DeliveryItem.bulkCreate(newDeliveryItems, { transaction });

      // Automatically sync any active manifests containing this delivery
      try {
        const activeManifests = await DeliveryManifest.findAll({
          where: {
            tenantId: req.tenantId,
            status: { [Op.in]: ['SCHEDULED', 'ACTIVE', 'IN_DELIVERY'] }
          },
          transaction
        });

        for (const m of activeManifests) {
          const dIds = (m.deliveryIds || []).map(id => parseInt(id, 10));
          if (dIds.includes(linkedDelivery.id)) {
            const { buildManifestDataFromDeliveries } = require('./deliveryController');
            const refreshed = await buildManifestDataFromDeliveries({
              tenantId: req.tenantId,
              deliveryIds: m.deliveryIds,
              deliveryDate: m.manifestDate,
              driverName: m.driverName,
              vehiclePlate: m.vehiclePlate,
              warehouseName: m.warehouseName,
              manifestNumber: m.manifestNumber,
              transaction
            });
            if (refreshed && refreshed.groups) {
              m.snapshot = refreshed;
              m.summary = refreshed.summary;
              await m.save({ transaction });
            }
          }
        }
      } catch (mErr) {
        console.error('Failed to sync active manifest snapshot on SO update:', mErr);
      }
    }

    // Sync linked Invoice if exists, or auto-create if SO is now active/approved
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });

    if (linkedInvoice) {
      const invAmountDue = Math.max(0, grandTotal - currentPaid);
      let invStatus = 'UNPAID';
      if (currentPaid >= grandTotal - 0.01) {
        invStatus = 'PAID';
      } else if (currentPaid > 0) {
        invStatus = 'PARTIALLY_PAID';
      }

      await linkedInvoice.update({
        subtotal,
        taxAmount,
        totalAmount: grandTotal,
        amountDue: invAmountDue,
        status: invStatus,
        metadata: {
          ...(linkedInvoice.metadata || {}),
          paidAmount: currentPaid,
          revisedAt: new Date().toISOString()
        }
      }, { transaction });

      // Sinkronkan Jurnal Pendapatan Penjualan ke nominal revisi terbaru
      await syncOrPostInvoiceJournal(linkedInvoice, transaction);
    } else if (!isDraft) {
      // Jika sebelumnya draft lalu disetujui / aktif, otomatis terbitkan Invoice dan Jurnal Pendapatan
      let invNumber = so.soNumber.startsWith('SO.') ? so.soNumber.replace(/^SO\./, 'INV.') : `INV-${so.soNumber.replace(/^SO-/, '')}`;
      const existingInvConflict = await sequelize.models.Invoice.findOne({
        where: { tenantId: req.tenantId, type: 'SALES', invoiceNumber: invNumber },
        transaction
      });
      if (existingInvConflict) {
        invNumber = `${invNumber}-${Date.now().toString().slice(-4)}`;
      }

      const invAmountDue = Math.max(0, grandTotal - currentPaid);
      let invStatus = 'UNPAID';
      if (currentPaid >= grandTotal - 0.01) {
        invStatus = 'PAID';
      } else if (currentPaid > 0) {
        invStatus = 'PARTIALLY_PAID';
      }

      const newInvoice = await sequelize.models.Invoice.create({
        tenantId: req.tenantId,
        type: 'SALES',
        salesOrderId: so.id,
        invoiceNumber: invNumber,
        invoiceDate: soDate,
        dueDate: dueDate || soDate,
        status: invStatus,
        taxId: (applyTax && taxId) ? taxId : null,
        subtotal,
        taxAmount,
        totalAmount: grandTotal,
        amountDue: invAmountDue,
        metadata: {
          ...finalMetadata,
          autoGenerated: true,
          soNumber: so.soNumber,
          paidAmount: currentPaid
        }
      }, { transaction });

      await postInvoiceJournal(newInvoice, transaction);
    }

    // Auto SJ / Direct Pickup flow if requested (for initial pre-shipment creation)
    if ((autoSj || isPickup) && !isAlreadyShipped) {
      const targetWh = warehouseId || targetWhId;
      if (!targetWh) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Warehouse ID is required for fulfillment.'
        });
      }

      // Check stock sufficiency for regular and bonus stock
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction });
        const pw = await sequelize.models.ProductWarehouse.findOne({
          where: { productId: item.productId, warehouseId: targetWh },
          transaction
        });
        const currentRegularStock = pw ? parseFloat(pw.stock || 0) : 0;
        const currentBonusStock = pw ? parseFloat(pw.bonusStock || 0) : 0;
        const buyRatio = parseFloat(item.conversionRatio || 1);
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const reqRegular = (parseInt(item.qty) || 0) * buyRatio;
        const reqBonus = (parseInt(item.bonusQty) || 0) * bonusRatio;

        if (currentRegularStock < reqRegular) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Stok reguler tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok reguler: ${currentRegularStock}, Dibutuhkan: ${reqRegular}).`
          });
        }
        if (currentBonusStock < reqBonus) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Stok bonus tidak mencukupi untuk barang '${product?.name || item.productId}' di gudang terpilih (Stok bonus: ${currentBonusStock}, Dibutuhkan: ${reqBonus}).`
          });
        }
      }

      let deliveryNumber;
      if (isPickup) {
        deliveryNumber = soNumber.startsWith('SO.') ? soNumber.replace(/^SO\./, 'SJ-PKP.') : (soNumber.startsWith('SO-') ? `SJ-PKP-${soNumber.replace(/^SO-/, '')}` : `SJ-PKP-${soNumber}`);
      } else {
        deliveryNumber = soNumber.startsWith('SO.') ? soNumber.replace(/^SO\./, 'SJ.') : `SJ-${soNumber.replace(/^SO-/, '')}`;
      }
      const existingDeliv = await Delivery.findOne({
        where: { tenantId: req.tenantId, deliveryNumber },
        transaction
      });
      if (existingDeliv) {
        deliveryNumber = `${deliveryNumber}-${Date.now().toString().slice(-4)}`;
      }

      // Create Delivery
      const delivery = await Delivery.create({
        tenantId: req.tenantId,
        salesOrderId: so.id,
        deliveryNumber,
        deliveryDate: soDate,
        warehouseId: targetWh,
        driverName: isPickup ? 'Ambil Sendiri' : (driverName || metadata?.driverName || null),
        vehiclePlate: isPickup ? '—' : (vehiclePlate || metadata?.vehiclePlate || null),
        notes: notes || (isPickup ? 'Pengambilan langsung oleh pelanggan (Pickup di Toko)' : 'Dibuat otomatis dari Sales Order'),
        status: isPickup ? 'DELIVERED' : 'SHIPPED',
        metadata: {
          ...(metadata || {}),
          fulfillmentType,
          isPickup,
          pickedUpAt: isPickup ? new Date().toISOString() : null
        }
      }, { transaction });

      // Create Delivery Items
      const deliveryItems = items.map(item => {
        const buyRatio = parseFloat(item.conversionRatio || 1);
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const totalBaseShipped = ((parseInt(item.qty) || 0) * buyRatio) + ((parseInt(item.bonusQty) || 0) * bonusRatio);
        return {
          deliveryId: delivery.id,
          productId: item.productId,
          qtyShipped: totalBaseShipped
        };
      });
      await DeliveryItem.bulkCreate(deliveryItems, { transaction });

      // Deduct stock (separate regular and bonus stock)
      let totalComputedHpp = 0;
      for (const item of items) {
        const buyRatio = parseFloat(item.conversionRatio || 1);
        const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
        const buyQty = parseFloat(item.qty) || 0;
        const bonusQty = parseFloat(item.bonusQty) || 0;
        const regularDeductQty = parseFloat((buyQty * buyRatio).toFixed(4));
        const bonusDeductQty = parseFloat((bonusQty * bonusRatio).toFixed(4));

        if (regularDeductQty > 0) {
          const regularNote = isPickup ? `Ambil Sendiri SO #${so.soNumber}` : `Penjualan SO #${so.soNumber}`;
          const hpp = await recordStockOut({
            tenantId: req.tenantId,
            warehouseId: targetWh,
            productId: item.productId,
            qty: regularDeductQty,
            isBonus: false,
            referenceType: 'DELIVERY_ORDER',
            referenceId: delivery.id,
            customNotes: regularNote,
            transaction
          });
          totalComputedHpp += parseFloat(hpp || 0);
        }

        if (bonusDeductQty > 0) {
          const bonusNote = isPickup ? `Ambil Sendiri Bonus SO #${so.soNumber}` : `Penjualan Bonus SO #${so.soNumber}`;
          await recordStockOut({
            tenantId: req.tenantId,
            warehouseId: targetWh,
            productId: item.productId,
            qty: bonusDeductQty,
            isBonus: true,
            referenceType: 'DELIVERY_ORDER',
            referenceId: delivery.id,
            customNotes: bonusNote,
            transaction
          });
        }
      }

      // Post Delivery Journal
      await postDeliveryJournal(delivery, totalComputedHpp, transaction);

      // Update SO Status
      const finalStatus = isPickup ? 'COMPLETED' : 'SHIPPED';
      await so.update({
        status: finalStatus,
        metadata: {
          ...(so.metadata || {}),
          fulfillmentType,
          isPickup,
          pickedUpAt: isPickup ? new Date().toISOString() : null,
          ...(finalStatus === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {})
        }
      }, { transaction });
    }

    await transaction.commit();

    const updatedSo = await SalesOrder.findByPk(so.id, {
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { 
          model: Customer, 
          as: 'customer',
          include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code', 'phone'] }]
        },
        {
          model: SalesOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'SALES_ORDERS',
      description: `Mengubah Sales Order #${so.soNumber}`,
      metadata: { id: so.id, soNumber: so.soNumber, totalAmount: so.totalAmount, status: so.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Sales Order updated successfully.',
      data: updatedSo
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getSalesOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const so = await SalesOrder.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { 
          model: Customer, 
          as: 'customer',
          include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code', 'phone'] }]
        },
        {
          model: SalesOrderItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit', 'purchasePrice', 'sellingPrice'] }]
        },
        {
          model: Delivery,
          as: 'deliveries',
          include: [{ model: sequelize.models.DeliveryItem, as: 'items' }]
        },
        {
          model: sequelize.models.Invoice,
          as: 'invoices',
          include: [
            {
              model: sequelize.models.Payment,
              as: 'payments',
              include: [{ model: sequelize.models.ChartOfAccount, as: 'account', attributes: ['id', 'accountCode', 'accountName'] }]
            },
            {
              model: sequelize.models.Return,
              as: 'returns',
              include: [
                {
                  model: sequelize.models.ReturnItem,
                  as: 'items',
                  include: [{ model: sequelize.models.Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] }]
                },
                {
                  model: sequelize.models.Warehouse,
                  as: 'warehouse',
                  attributes: ['id', 'name', 'type']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!so) {
      return res.status(404).json({ success: false, message: 'Sales Order not found.' });
    }

    // Enforce tax scope access in backend
    if (req.user?.taxAccess === 'PKP') {
      const isPkp = so.tax && parseFloat(so.tax.rate) > 0 && !so.tax.name.toLowerCase().includes('non');
      if (!isPkp) {
        return res.status(403).json({ success: false, message: 'Forbidden. Akun Anda dibatasi hanya dapat mengakses transaksi PKP.' });
      }
    } else if (req.user?.taxAccess === 'NON_PKP') {
      const isPkp = so.tax && parseFloat(so.tax.rate) > 0 && !so.tax.name.toLowerCase().includes('non');
      if (isPkp) {
        return res.status(403).json({ success: false, message: 'Forbidden. Akun Anda dibatasi hanya dapat mengakses transaksi Non-PKP.' });
      }
    }

    const soJson = so.toJSON();
    if (soJson.metadata?.itemsDetail && Array.isArray(soJson.metadata.itemsDetail)) {
      soJson.items = (soJson.items || []).map(it => {
        const detail = soJson.metadata.itemsDetail.find(d => parseInt(d.productId) === parseInt(it.productId));
        return {
          ...it,
          bonusQty: detail?.bonusQty || 0,
          unit: detail?.unit || it.product?.unit || 'pcs',
          conversionRatio: detail?.conversionRatio || 1,
          bonusUnit: detail?.bonusUnit || detail?.unit || it.product?.unit || 'pcs',
          bonusConversionRatio: detail?.bonusConversionRatio || 1
        };
      });
    }

    if (soJson.metadata?.manifestNumber) {
      const manifest = await DeliveryManifest.findOne({
        where: { tenantId: req.tenantId, manifestNumber: soJson.metadata.manifestNumber },
        attributes: ['manifestNumber', 'status']
      });
      if (manifest) {
        if (!soJson.metadata) soJson.metadata = {};
        soJson.metadata.manifestStatus = manifest.status;
        const isPaid = (parseFloat(soJson.metadata?.paidAmount || 0) >= parseFloat(soJson.totalAmount || 0) - 0.01) || soJson.metadata?.paymentStatus === 'PAID';

        if (manifest.status === 'DELIVERED') {
          soJson.status = isPaid ? 'COMPLETED' : 'SHIPPED';
        } else if (manifest.status === 'SCHEDULED' || manifest.status === 'ACTIVE') {
          if (soJson.status === 'SHIPPED') {
            soJson.status = 'WAITING_SHIPMENT';
          }
        } else if (manifest.status === 'IN_DELIVERY') {
          if (soJson.status === 'WAITING_SHIPMENT') {
            soJson.status = 'SHIPPED';
          }
        }
      }
    }

    return res.status(200).json({ success: true, data: soJson });
  } catch (error) {
    next(error);
  }
};

exports.recordSalesOrderPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, paymentDate, paymentMethod, accountId, notes } = req.body;

    const paymentVal = parseFloat(amount || 0);
    if (paymentVal <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Jumlah pembayaran harus lebih dari 0.' });
    }

    const so = await SalesOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction
    });

    if (!so) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Sales Order tidak ditemukan.' });
    }

    const currentMeta = so.metadata || {};
    const totalAmount = parseFloat(so.totalAmount || 0);
    const existingPaid = parseFloat(currentMeta.paidAmount || 0);
    const newPaidAmount = existingPaid + paymentVal;

    let newStatus = 'PARTIAL';
    if (newPaidAmount >= totalAmount - 0.01) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'UNPAID';
    }

    // Otomatis tentukan akun Kas vs Bank berdasarkan metode bayar jika tidak disediakan
    const targetAccountId = await resolvePaymentAccountId(req.tenantId, paymentMethod, accountId, transaction);

    const existingPayments = currentMeta.payments || [];
    const newPaymentRecord = {
      id: `PAY-${Date.now()}`,
      amount: paymentVal,
      date: paymentDate || new Date().toISOString().split('T')[0],
      method: paymentMethod || 'CASH',
      accountId: targetAccountId,
      notes: notes || 'Pembayaran angsuran/pelunasan',
      evidence: req.uploadedImageUrl || null
    };

    const updatedMeta = {
      ...currentMeta,
      paidAmount: newPaidAmount,
      paymentStatus: newStatus,
      payments: [...existingPayments, newPaymentRecord]
    };

    await so.update({ metadata: updatedMeta }, { transaction });

    // Sync to linked Invoice if exists
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });

    if (linkedInvoice) {
      const invTotal = parseFloat(linkedInvoice.totalAmount || 0);
      const invPaid = newPaidAmount;
      const invDue = Math.max(0, invTotal - invPaid);

      let invStatus = 'UNPAID';
      if (invPaid >= invTotal - 0.01) {
        invStatus = 'PAID';
      } else if (invPaid > 0) {
        invStatus = 'PARTIALLY_PAID';
      }

      await linkedInvoice.update({
        amountDue: invDue,
        status: invStatus,
        metadata: {
          ...(linkedInvoice.metadata || {}),
          paidAmount: invPaid
        }
      }, { transaction });
    }

    // Create official Payment DB record & post auto-journal for cash flow & reports
    if (targetAccountId) {
      const paymentNumber = `PAY-SO-${so.soNumber}-${Date.now().toString().slice(6)}`;
      const paymentRecord = await sequelize.models.Payment.create({
        tenantId: req.tenantId,
        invoiceId: linkedInvoice ? linkedInvoice.id : null,
        paymentNumber,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        paymentType: 'RECEIPT',
        paymentMethod: paymentMethod || 'CASH',
        amount: paymentVal,
        accountId: targetAccountId,
        notes: notes || `Pelunasan/Angsuran SO #${so.soNumber}`,
        metadata: req.uploadedImageUrl ? { evidence: req.uploadedImageUrl } : null
      }, { transaction });

      await postPaymentJournal(paymentRecord, transaction);
    }

    // Auto-update SO status to COMPLETED if fully paid and delivered
    await checkAndUpdateSoStatus(so.id, req.tenantId, transaction);

    await transaction.commit();

    await logActivity(req, {
      action: 'PAYMENT',
      module: 'SALES_ORDERS',
      description: `Mencatat pembayaran SO #${so.soNumber} sebesar Rp ${paymentVal.toLocaleString('id-ID')}`,
      metadata: { id: so.id, soNumber: so.soNumber, amount: paymentVal, paymentMethod, newPaidAmount }
    });

    return res.status(200).json({
      success: true,
      message: `Pembayaran sebesar Rp ${paymentVal.toLocaleString('id-ID')} berhasil dicatat.`,
      data: {
        paidAmount: newPaidAmount,
        paymentStatus: newStatus,
        remainingAmount: Math.max(0, totalAmount - newPaidAmount)
      }
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.cancelSalesOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const so = await SalesOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction
    });

    if (!so) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Sales Order tidak ditemukan.' });
    }

    if (so.status === 'CANCELLED') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Sales Order ini sudah dibatalkan sebelumnya.' });
    }

    if (so.status === 'COMPLETED' || so.status === 'SELESAI') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Sales Order yang sudah SELESAI tidak dapat dibatalkan.' });
    }

    // 1. If stock was shipped/deducted, restore inventory (Return/Reversal IN)
    if (so.status === 'SHIPPED') {
      const delivery = await Delivery.findOne({
        where: { salesOrderId: so.id, tenantId: req.tenantId },
        include: [{ model: DeliveryItem, as: 'items' }],
        transaction
      });

      if (delivery && delivery.items) {
        for (const item of delivery.items) {
          const product = await Product.findByPk(item.productId, { transaction });
          const costPrice = parseFloat(product?.purchasePrice || product?.buyPrice || 0);

          await recordReturnIn({
            tenantId: req.tenantId,
            warehouseId: delivery.warehouseId,
            productId: item.productId,
            qty: item.qtyShipped,
            costPrice,
            referenceType: 'RETURN',
            referenceId: so.id,
            transaction
          });
        }
        await delivery.update({ status: 'CANCELLED' }, { transaction });
      }
    }

    // 2. Update linked Invoice if exists to CANCELLED
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });

    if (linkedInvoice) {
      await linkedInvoice.update({ status: 'CANCELLED' }, { transaction });
    }

    // 3. Update SO status to CANCELLED
    const currentMeta = so.metadata || {};
    await so.update({
      status: 'CANCELLED',
      metadata: {
        ...currentMeta,
        cancelReason: reason || 'Dibatalkan pengguna',
        cancelledAt: new Date().toISOString(),
        cancelledBy: req.user ? req.user.name : 'System'
      }
    }, { transaction });

    await transaction.commit();

    await logActivity(req, {
      action: 'CANCEL',
      module: 'SALES_ORDERS',
      description: `Membatalkan Sales Order #${so.soNumber}`,
      metadata: { id: so.id, soNumber: so.soNumber, reason: reason || 'Dibatalkan pengguna' }
    });

    return res.status(200).json({
      success: true,
      message: `Sales Order #${so.soNumber} berhasil dibatalkan.`,
      data: so
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getDistributionSalesExportData = async (req, res, next) => {
  try {
    const { startDate, endDate, salespersonId, taxStatus, status, search } = req.query;

    const whereClause = { tenantId: req.tenantId };

    if (startDate && endDate) {
      whereClause.soDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.soDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.soDate = { [Op.lte]: endDate };
    }

    if (status) {
      whereClause.status = status;
    } else {
      whereClause.status = { [Op.ne]: 'CANCELLED' };
    }

    if (taxStatus === 'PKP' || req.query.isPkp === 'true') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND taxes.rate > 0 
              AND taxes.name NOT LIKE '%Non%'
          )
        )`)
      ];
    } else if (taxStatus === 'NON_PKP' || req.query.isPkp === 'false') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          SalesOrder.tax_id IS NULL OR EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND (taxes.rate = 0 OR taxes.name LIKE '%Non%')
          )
        )`)
      ];
    }

    if (search) {
      whereClause[Op.or] = [
        { soNumber: { [Op.like]: `%${search}%` } },
        { '$customer.name$': { [Op.like]: `%${search}%` } },
        { '$customer.code$': { [Op.like]: `%${search}%` } }
      ];
    }

    const salesOrders = await SalesOrder.findAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Tax,
          as: 'tax'
        },
        {
          model: SalesOrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              include: [
                { model: Supplier, as: 'supplier' },
                { model: ProductUnit, as: 'units' }
              ]
            }
          ]
        }
      ],
      order: [['soDate', 'ASC'], ['id', 'ASC']]
    });

    const salespersons = await Salesperson.findAll({ where: { tenantId: req.tenantId } });
    const spMap = {};
    salespersons.forEach(sp => {
      spMap[sp.id] = sp;
      if (sp.code) spMap[sp.code.toUpperCase()] = sp;
      if (sp.name) spMap[sp.name.toUpperCase()] = sp;
    });

    const allTenantOrders = await SalesOrder.findAll({
      where: { tenantId: req.tenantId, status: { [Op.ne]: 'CANCELLED' } },
      attributes: ['contactId', [sequelize.fn('MIN', sequelize.col('so_date')), 'firstDate']],
      group: ['contactId'],
      raw: true
    });

    const firstOrderMap = {};
    allTenantOrders.forEach(o => {
      firstOrderMap[o.contactId] = o.firstDate;
    });

    const rows = [];

    for (const so of salesOrders) {
      const cust = so.customer || {};
      const taxObj = so.tax || {};
      const taxRate = parseFloat(taxObj.rate || 0);

      // Prioritize salesperson recorded on the Sales Order (so.metadata), then fallback to Customer master data
      const soSpId = so.metadata?.salespersonId 
        || (so.metadata?.salesperson && !isNaN(so.metadata.salesperson) ? parseInt(so.metadata.salesperson) : null);
      const soSpCode = so.metadata?.salespersonCode || null;
      const soSpName = so.metadata?.salespersonName 
        || (so.metadata?.salesperson && typeof so.metadata.salesperson === 'string' && isNaN(so.metadata.salesperson) ? so.metadata.salesperson : null);

      const sp = (soSpId ? spMap[soSpId] : null)
        || (soSpCode ? spMap[soSpCode.toUpperCase()] : null)
        || (soSpName ? spMap[soSpName.toUpperCase()] : null)
        || (cust.salespersonId ? spMap[cust.salespersonId] : null)
        || (cust.salespersonCode ? spMap[cust.salespersonCode.toUpperCase()] : null)
        || (cust.salespersonName ? spMap[cust.salespersonName.toUpperCase()] : null)
        || null;

      const finalSpId = sp?.id || soSpId || cust.salespersonId || null;
      const finalSpCode = sp?.code || soSpCode || cust.salespersonCode || 'E-TGL-00001';
      const finalSpName = sp?.name || soSpName || cust.salespersonName || '-';

      if (salespersonId) {
        if (!finalSpId || String(finalSpId) !== String(salespersonId)) {
          continue;
        }
      }

      const firstDate = firstOrderMap[so.contactId];
      const isNOO = firstDate && (new Date(so.soDate) <= new Date(firstDate));
      const roNooStatus = isNOO ? 'NOO' : 'RO';

      for (const item of (so.items || [])) {
        const prod = item.product || {};
        const supp = prod.supplier || {};

        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(item.price) || 0;
        const discount = parseFloat(item.discount) || 0;

        const baseUnit = prod.unit || 'KRT';
        const itemUnit = item.unit || baseUnit;
        const conversionRatio = parseFloat(item.conversionRatio || 1);

        let isiKarton = 1;
        if (conversionRatio < 1 && conversionRatio > 0) {
          isiKarton = Math.round(1 / conversionRatio);
        } else if (conversionRatio > 1) {
          isiKarton = conversionRatio;
        }

        const totalPcs = Math.round(qty * (isiKarton > 0 ? isiKarton : 1));

        const dppSatuan = (taxRate > 0 && so.taxInclusive) 
          ? (price / (1 + (taxRate / 100))) 
          : price;
        const totalDpp = (dppSatuan * qty) - discount;
        const valueFix = totalDpp * (1 + (taxRate / 100));
        const crtFix = isiKarton > 0 ? (totalPcs / isiKarton) : qty;

        const bonusPcs = item.metadata?.bonusQty ? parseInt(item.metadata.bonusQty) : 0;
        const joinDateStr = cust.openOutletDate 
          ? new Date(cust.openOutletDate).toLocaleDateString('id-ID')
          : (cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('id-ID') : '-');

        rows.push({
          pemasok: supp.name || prod.metadata?.supplier || 'PT Tiga Bintang Sejahtera Food',
          kode: prod.sku || prod.legacyCode || '-',
          namaBarang: prod.name || '-',
          idPelanggan: cust.code || cust.legacyCode || (`C-TGL-${String(cust.id).padStart(5, '0')}`),
          namaPelanggan: cust.name || '-',
          kecamatan: cust.districtName || cust.taxKecamatan || '-',
          kelurahan: cust.taxKelurahan || cust.metadata?.kelurahan || '-',
          kategoriPelanggan: cust.areaName || cust.regionName || cust.typeName || 'KAB. TEGAL',
          tanggal: `${so.soDate} 00.00.00`,
          nomor: so.metadata?.invoiceNumber || so.soNumber || '-',
          keterangan: so.notes || item.notes || so.metadata?.notes || '-',
          ktsUnit1: totalPcs,
          kuantitas: qty,
          satuan: `${itemUnit}(${isiKarton})`,
          rasioSatuan2: isiKarton,
          dppSatuan: Math.round(dppSatuan * 100) / 100,
          totalDpp: Math.round(totalDpp * 100) / 100,
          ppnRate: taxRate,
          tipeTransaksi: 'Faktur Penjualan',
          idSales: finalSpCode,
          namaSales: finalSpName,
          tglJoin: joinDateStr,
          tipeOutlet: cust.typeName || 'RETAIL',
          roNoo: roNooStatus,
          kategoriSales: sp?.metadata?.category || cust.metadata?.kategoriSales || 'GR MIX',
          crtFix: Math.round(crtFix * 100) / 100,
          valueFix: Math.round(valueFix * 100) / 100,
          ktsUnit1Dup: totalPcs,
          bonusPcs: bonusPcs,
          cek: 'BENAR',
          salesClosing: finalSpName
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: rows,
      totalRows: rows.length
    });

  } catch (error) {
    next(error);
  }
};

exports.updatePaymentTerms = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { paymentTerm, dueDate, dpAmount } = req.body;

    const so = await SalesOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction
    });

    if (!so) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Sales Order tidak ditemukan.' });
    }

    const currentMeta = so.metadata || {};
    const effectiveTerm = paymentTerm || currentMeta.paymentTerm || 'LUNAS';
    const effectiveDueDate = (effectiveTerm === 'TEMPO' || effectiveTerm === 'DP') ? (dueDate || currentMeta.dueDate || null) : null;
    const effectiveDp = effectiveTerm === 'DP' ? parseFloat(dpAmount !== undefined ? dpAmount : (currentMeta.dpAmount || 0)) : 0;

    const updatedMeta = {
      ...currentMeta,
      paymentTerm: effectiveTerm,
      dueDate: effectiveDueDate,
      dpAmount: effectiveDp
    };

    await so.update({ metadata: updatedMeta }, { transaction });

    // Sync to linked Invoice if exists
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { salesOrderId: so.id, tenantId: req.tenantId },
      transaction
    });
    if (linkedInvoice) {
      await linkedInvoice.update({
        dueDate: effectiveDueDate || linkedInvoice.dueDate,
        metadata: {
          ...(linkedInvoice.metadata || {}),
          paymentTerm: effectiveTerm,
          dueDate: effectiveDueDate
        }
      }, { transaction });
    }

    await transaction.commit();

    await logActivity(req, {
      action: 'UPDATE',
      module: 'SALES_ORDERS',
      description: `Mengubah syarat pembayaran SO #${so.soNumber} menjadi ${effectiveTerm}`,
      metadata: { id: so.id, soNumber: so.soNumber, paymentTerm: effectiveTerm, dueDate: effectiveDueDate }
    });

    return res.status(200).json({
      success: true,
      message: `Syarat pembayaran SO #${so.soNumber} berhasil diubah menjadi ${effectiveTerm}.`,
      data: so
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


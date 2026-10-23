const { Return, ReturnItem, Invoice, Product, Warehouse, IncomingBatch, SalesOrder, SalesOrderItem, Delivery, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { recordReturnIn, recordStockOut } = require('../utils/inventoryEngine');
const { postReturnJournal } = require('../utils/journalEngine');
const { logActivity } = require('../utils/logger');

exports.getAllReturns = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['returnNumber', 'returnDate', 'createdAt'],
      defaultSortBy: 'returnDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };
    if (req.query.warehouseId) whereClause.warehouseId = req.query.warehouseId;
    if (req.query.type) whereClause.type = req.query.type;

    if (search) {
      whereClause[Op.or] = [
        { returnNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Return.findAndCountAll({
      where: whereClause,
      include: [
        { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber', 'type', 'salesOrderId', 'purchaseOrderId'] },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'type'] },
        {
          model: ReturnItem,
          as: 'items',
          include: [
            { model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] },
            { model: Warehouse, as: 'targetWarehouse', attributes: ['id', 'name', 'type'] }
          ]
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


exports.createReturn = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    let { invoiceId, salesOrderId, warehouseId, quarantineWarehouseId, type, returnNumber, returnDate, notes, items, metadata } = req.body;

    if ((!invoiceId && !salesOrderId) || !warehouseId || !type || !returnNumber || !returnDate || !items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sales Order ID / Invoice ID, Warehouse ID, Type, Return Number, Return Date, and items are required.'
      });
    }

    if (type !== 'SALES_RETURN' && type !== 'PURCHASE_RETURN') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid return type. Must be SALES_RETURN or PURCHASE_RETURN.'
      });
    }

    // Resolve SalesOrder and Invoice
    let linkedSo = null;
    let invoice = null;

    if (salesOrderId) {
      linkedSo = await SalesOrder.findOne({
        where: { id: salesOrderId, tenantId: req.tenantId },
        include: [{ model: SalesOrderItem, as: 'items' }],
        transaction
      });

      if (!linkedSo) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Sales Order tidak ditemukan.'
        });
      }

      // Check delivery status: retur hanya bisa ketika barang sudah dikirim
      const isShipped = ['SHIPPED', 'DELIVERED', 'COMPLETED', 'SELESAI'].includes(linkedSo.status) ||
        ['SHIPPED', 'DELIVERED'].includes(linkedSo.deliveryStatus) ||
        ['SHIPPED', 'DELIVERED'].includes(linkedSo.metadata?.manifestStatus);

      if (!isShipped) {
        // Also check if any Delivery record exists that is SHIPPED or DELIVERED
        const activeDelivery = await Delivery.findOne({
          where: {
            salesOrderId: linkedSo.id,
            tenantId: req.tenantId,
            status: ['SHIPPED', 'DELIVERED']
          },
          transaction
        });

        if (!activeDelivery) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Retur penjualan hanya dapat diajukan jika barang sudah dikirim atau diterima oleh pelanggan (status SHIPPED / DELIVERED).'
          });
        }
      }

      // Find linked invoice for this SO
      invoice = await Invoice.findOne({
        where: { salesOrderId: linkedSo.id, tenantId: req.tenantId, type: 'SALES' },
        transaction
      });

      // If no invoice found, create one automatically to satisfy DB constraint
      if (!invoice) {
        invoice = await Invoice.create({
          tenantId: req.tenantId,
          type: 'SALES',
          salesOrderId: linkedSo.id,
          invoiceNumber: `INV-${linkedSo.soNumber}`,
          invoiceDate: returnDate,
          dueDate: linkedSo.metadata?.dueDate || returnDate,
          status: 'UNPAID',
          subtotal: linkedSo.subtotal,
          taxAmount: linkedSo.taxAmount || 0,
          totalAmount: linkedSo.totalAmount,
          amountDue: linkedSo.totalAmount,
          metadata: { autoCreatedForReturn: true }
        }, { transaction });
      }

      invoiceId = invoice.id;
    } else {
      // Find by invoiceId
      invoice = await Invoice.findOne({
        where: { id: invoiceId, tenantId: req.tenantId },
        transaction
      });

      if (!invoice) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Linked Invoice not found or access denied.'
        });
      }

      if (invoice.salesOrderId) {
        linkedSo = await SalesOrder.findOne({
          where: { id: invoice.salesOrderId, tenantId: req.tenantId },
          include: [{ model: SalesOrderItem, as: 'items' }],
          transaction
        });
      }
    }

    // Check unique Return Number per tenant
    const existing = await Return.findOne({
      where: { tenantId: req.tenantId, returnNumber },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Nomor Retur '${returnNumber}' sudah digunakan.`
      });
    }

    // 1. Calculate totals and validate items
    let totalAmount = 0;
    const returnItemsToSave = [];

    for (const item of items) {
      const { productId, qty, price, condition, warehouseId: itemWhId, reason } = item;
      const numQty = parseFloat(qty);
      const numPrice = parseFloat(price);

      if (!productId || isNaN(numQty) || numQty <= 0 || isNaN(numPrice) || numPrice < 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Setiap item retur wajib memiliki Product ID, kuantitas > 0, dan harga >= 0.'
        });
      }

      const subtotal = numQty * numPrice;
      totalAmount += subtotal;

      const itemCondition = condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
      // Determine destination warehouse for this item
      const designatedWarehouseId = itemWhId || (itemCondition === 'DAMAGED' ? (quarantineWarehouseId || warehouseId) : warehouseId);

      returnItemsToSave.push({
        productId,
        qty: numQty,
        price: numPrice,
        subtotal,
        condition: itemCondition,
        warehouseId: designatedWarehouseId,
        reason: reason || null
      });
    }

    // 2. Create Return Document
    const targetStatus = req.body.status || 'FORM_ISSUED';

    const returnDoc = await Return.create({
      tenantId: req.tenantId,
      invoiceId,
      warehouseId,
      type,
      returnNumber,
      returnDate,
      totalAmount,
      notes,
      status: targetStatus,
      metadata: {
        ...(metadata || {}),
        salesOrderId: linkedSo ? linkedSo.id : null,
        quarantineWarehouseId: quarantineWarehouseId || null,
        issuedAt: new Date().toISOString(),
        formNumber: returnNumber
      }
    }, { transaction });

    // Link returnId to items
    for (const item of returnItemsToSave) {
      item.returnId = returnDoc.id;
    }

    // Save Return Items
    await ReturnItem.bulkCreate(returnItemsToSave, { transaction });

    // 3. Deduct Sales Order quantities and recalculate subtotal & totals if SALES_RETURN
    if (type === 'SALES_RETURN' && linkedSo) {
      for (const retItem of returnItemsToSave) {
        const soItem = (linkedSo.items || []).find(it => it.productId === retItem.productId);
        if (soItem) {
          const currentQty = parseFloat(soItem.qty || 0);
          const newQty = Math.max(0, currentQty - retItem.qty);
          const itemPrice = parseFloat(soItem.price || 0);
          
          // Re-calculate proportional discount if item had discount
          const discountPerUnit = currentQty > 0 ? (parseFloat(soItem.discount || 0) / currentQty) : 0;
          const newDiscount = Math.round(discountPerUnit * newQty);
          const newSubtotal = Math.max(0, (newQty * itemPrice) - newDiscount);

          await soItem.update({
            qty: newQty,
            discount: newDiscount,
            subtotal: newSubtotal
          }, { transaction });
        }
      }

      // Fetch all updated items of this SO to compute new totals
      const updatedSoItems = await SalesOrderItem.findAll({
        where: { salesOrderId: linkedSo.id },
        transaction
      });

      const newSubtotalSo = updatedSoItems.reduce((acc, it) => acc + parseFloat(it.subtotal || 0), 0);
      const isTaxInclusive = linkedSo.metadata?.taxInclusive ?? true;
      const applyTax = Boolean(linkedSo.taxId || linkedSo.metadata?.applyTax);

      let newTaxAmount = 0;
      let newTotalAmount = newSubtotalSo;

      if (applyTax) {
        if (isTaxInclusive) {
          const dpp = newSubtotalSo / 1.11;
          newTaxAmount = Math.round(newSubtotalSo - dpp);
          newTotalAmount = newSubtotalSo;
        } else {
          newTaxAmount = Math.round(newSubtotalSo * 0.11);
          newTotalAmount = newSubtotalSo + newTaxAmount;
        }
      }

      // Record return history in SO metadata
      const existingReturns = linkedSo.metadata?.returns || [];
      existingReturns.push({
        returnId: returnDoc.id,
        returnNumber: returnDoc.returnNumber,
        returnDate: returnDoc.returnDate,
        totalAmount,
        status: targetStatus,
        items: returnItemsToSave.map(it => ({
          productId: it.productId,
          qty: it.qty,
          price: it.price,
          condition: it.condition,
          reason: it.reason
        }))
      });

      await linkedSo.update({
        subtotal: newSubtotalSo,
        taxAmount: newTaxAmount,
        totalAmount: newTotalAmount,
        metadata: {
          ...(linkedSo.metadata || {}),
          returns: existingReturns,
          totalReturnedAmount: (parseFloat(linkedSo.metadata?.totalReturnedAmount || 0) + totalAmount)
        }
      }, { transaction });

      // Synchronize linked invoice
      if (invoice) {
        const invPayments = await sequelize.models.Payment.findAll({
          where: { invoiceId: invoice.id, tenantId: req.tenantId },
          transaction
        });
        const paidAmount = invPayments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
        const newAmountDue = Math.max(0, newTotalAmount - paidAmount);

        await invoice.update({
          subtotal: newSubtotalSo,
          taxAmount: newTaxAmount,
          totalAmount: newTotalAmount,
          amountDue: newAmountDue,
          status: newAmountDue <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID')
        }, { transaction });
      }
    }

    // 3. Process stock movements ONLY if status === 'COMPLETED'
    if (targetStatus === 'COMPLETED') {
      for (const item of returnItemsToSave) {
        const destWhId = item.warehouseId || warehouseId;
        if (type === 'SALES_RETURN') {
          const lastBatch = await IncomingBatch.findOne({
            where: { productId: item.productId, tenantId: req.tenantId },
            order: [['receiveDate', 'DESC'], ['id', 'DESC']],
            transaction
          });
          const costPrice = lastBatch ? parseFloat(lastBatch.costPrice) : 0;
          const auditNotes = item.condition === 'DAMAGED'
            ? `[RETUR MASUK - RUSAK/KARANTINA] Retur #${returnDoc.returnNumber}${item.reason ? ' (' + item.reason + ')' : ''}`
            : `[RETUR MASUK - LAYAK JUAL] Retur #${returnDoc.returnNumber}`;

          await recordReturnIn({
            tenantId: req.tenantId,
            warehouseId: destWhId,
            productId: item.productId,
            qty: item.qty,
            costPrice,
            referenceId: returnDoc.id,
            customNotes: auditNotes,
            transaction
          });
        } else {
          await recordStockOut({
            tenantId: req.tenantId,
            warehouseId: destWhId,
            productId: item.productId,
            qty: item.qty,
            referenceType: 'RETURN',
            referenceId: returnDoc.id,
            customNotes: `[RETUR KELUAR KE SUPPLIER] Retur Pembelian #${returnDoc.returnNumber}`,
            transaction
          });
        }
      }
      await postReturnJournal(returnDoc, transaction);
    }

    await transaction.commit();

    const createdReturn = await Return.findByPk(returnDoc.id, {
      include: [
        { model: Invoice, as: 'invoice', attributes: ['invoiceNumber', 'type'] },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'type'] },
        {
          model: ReturnItem,
          as: 'items',
          include: [
            { model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] },
            { model: Warehouse, as: 'targetWarehouse', attributes: ['id', 'name', 'type'] }
          ]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'RETURNS',
      description: `Membuat dokumen retur #${returnDoc.returnNumber} (${returnDoc.type})`,
      metadata: { id: returnDoc.id, returnNumber: returnDoc.returnNumber, type: returnDoc.type, invoiceId: returnDoc.invoiceId }
    });

    return res.status(201).json({
      success: true,
      message: targetStatus === 'COMPLETED' 
        ? 'Dokumen Retur & Stok FIFO berhasil diperbarui.' 
        : 'Form Pengajuan Retur Sales berhasil diterbitkan.',
      data: createdReturn
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ret = await Return.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: Invoice, as: 'invoice', include: [{ model: sequelize.models.SalesOrder, as: 'salesOrder' }, { model: sequelize.models.PurchaseOrder, as: 'purchaseOrder' }] },
        { model: Warehouse, as: 'warehouse' },
        {
          model: ReturnItem,
          as: 'items',
          include: [
            { model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] },
            { model: Warehouse, as: 'targetWarehouse', attributes: ['id', 'name', 'type'] }
          ]
        }
      ]
    });

    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return document not found.' });
    }

    return res.status(200).json({ success: true, data: ret });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /returns/:id/process-surat (Terbitkan Surat Retur & Execute Stock FIFO)
// ─────────────────────────────────────────────────────────────
exports.processSuratRetur = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { suratNumber, suratDate, courierName, warehouseId, quarantineWarehouseId, notes, items } = req.body;

    const returnDoc = await Return.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        {
          model: ReturnItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ],
      transaction
    });

    if (!returnDoc) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Dokumen Retur tidak ditemukan.' });
    }

    if (returnDoc.status === 'COMPLETED') {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Surat Retur ini sudah diproses dan stok telah diperbarui sebelumnya.' });
    }

    const targetWarehouseId = warehouseId || returnDoc.warehouseId;
    const targetQuarantineWhId = quarantineWarehouseId || returnDoc.metadata?.quarantineWarehouseId || targetWarehouseId;
    const generatedSuratNumber = suratNumber || `SR-${returnDoc.returnNumber}`;
    const today = suratDate || new Date().toISOString().split('T')[0];

    // Map updated item conditions / warehouse / reasons if passed in request body
    const itemUpdatesMap = {};
    if (items && Array.isArray(items)) {
      items.forEach(it => {
        if (it.id) itemUpdatesMap[it.id] = it;
      });
    }

    // Process Stock Movements
    for (const item of returnDoc.items) {
      const updateData = itemUpdatesMap[item.id] || {};
      const finalCondition = updateData.condition !== undefined ? updateData.condition : item.condition;
      const finalReason = updateData.reason !== undefined ? updateData.reason : item.reason;
      
      let itemDestWarehouseId = updateData.warehouseId || item.warehouseId;
      if (!itemDestWarehouseId) {
        itemDestWarehouseId = finalCondition === 'DAMAGED' ? targetQuarantineWhId : targetWarehouseId;
      }

      // Update item record if changed
      if (item.condition !== finalCondition || item.warehouseId !== itemDestWarehouseId || item.reason !== finalReason) {
        await item.update({
          condition: finalCondition,
          warehouseId: itemDestWarehouseId,
          reason: finalReason
        }, { transaction });
      }

      if (returnDoc.type === 'SALES_RETURN') {
        const lastBatch = await IncomingBatch.findOne({
          where: { productId: item.productId, tenantId: req.tenantId },
          order: [['receiveDate', 'DESC'], ['id', 'DESC']],
          transaction
        });
        const costPrice = lastBatch ? parseFloat(lastBatch.costPrice) : 0;
        const auditNotes = finalCondition === 'DAMAGED'
          ? `[RETUR MASUK - RUSAK/KARANTINA] Surat Retur #${generatedSuratNumber}${finalReason ? ' (' + finalReason + ')' : ''}`
          : `[RETUR MASUK - LAYAK JUAL] Surat Retur #${generatedSuratNumber}`;

        await recordReturnIn({
          tenantId: req.tenantId,
          warehouseId: itemDestWarehouseId,
          productId: item.productId,
          qty: item.qty,
          costPrice,
          referenceId: returnDoc.id,
          customNotes: auditNotes,
          transaction
        });
      } else {
        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: itemDestWarehouseId,
          productId: item.productId,
          qty: item.qty,
          referenceType: 'RETURN',
          referenceId: returnDoc.id,
          customNotes: `[RETUR KELUAR KE SUPPLIER] Surat Retur Pembelian #${generatedSuratNumber}`,
          transaction
        });
      }
    }

    // Update Return document status & metadata
    returnDoc.status = 'COMPLETED';
    returnDoc.warehouseId = targetWarehouseId;
    returnDoc.metadata = {
      ...(returnDoc.metadata || {}),
      suratNumber: generatedSuratNumber,
      suratDate: today,
      courierName: courierName || 'Armada Logistik',
      deliveryNotes: notes || '',
      quarantineWarehouseId: targetQuarantineWhId,
      completedAt: new Date().toISOString()
    };

    await returnDoc.save({ transaction });
    await postReturnJournal(returnDoc, transaction);
    await transaction.commit();

    const updated = await Return.findByPk(returnDoc.id, {
      include: [
        { model: Invoice, as: 'invoice' },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name', 'type'] },
        {
          model: ReturnItem,
          as: 'items',
          include: [
            { model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] },
            { model: Warehouse, as: 'targetWarehouse', attributes: ['id', 'name', 'type'] }
          ]
        }
      ]
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'RETURNS',
      description: `Menerbitkan Surat Retur #${generatedSuratNumber} untuk Dokumen Retur #${returnDoc.returnNumber}`,
      metadata: { id: returnDoc.id, returnNumber: returnDoc.returnNumber, suratNumber: generatedSuratNumber }
    });

    return res.status(200).json({
      success: true,
      message: 'Surat Retur berhasil diterbitkan & stok FIFO gudang telah diperbarui.',
      data: updated
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


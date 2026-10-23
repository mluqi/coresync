const { Invoice, SalesOrder, PurchaseOrder, Tax, Customer, Supplier, Salesperson, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { postInvoiceJournal } = require('../utils/journalEngine');
const { logActivity } = require('../utils/logger');

exports.getAllInvoices = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status', 'createdAt'],
      defaultSortBy: 'invoiceDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.type === 'SALES' || req.query.type === 'PURCHASE') {
      whereClause.type = req.query.type;
    }
    if (req.query.status) whereClause.status = req.query.status;

    if (search) {
      whereClause[Op.or] = [
        { invoiceNumber: { [Op.like]: `%${search}%` } },
        { taxInvoiceNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where: whereClause,
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { model: SalesOrder, as: 'salesOrder', attributes: ['id', 'soNumber', 'soDate', 'metadata'],
          include: [
            { 
              model: Customer, 
              as: 'customer', 
              attributes: ['name', 'address', 'phone', 'salespersonCode', 'salespersonName', 'salespersonId'],
              include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code'] }]
            },
            { model: sequelize.models.SalesOrderItem, as: 'items', include: [{ model: sequelize.models.Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] }] }
          ]
        },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'poNumber', 'poDate'],
          include: [
            { model: Supplier, as: 'supplier', attributes: ['name', 'address', 'phone'] },
            { model: sequelize.models.PurchaseOrderItem, as: 'items', include: [{ model: sequelize.models.Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit'] }] }
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


exports.createInvoice = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { type, salesOrderId, purchaseOrderId, invoiceNumber, invoiceDate, dueDate, taxId, taxInvoiceNumber, metadata } = req.body;

    if (!type || !invoiceNumber || !invoiceDate || !dueDate) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Type, Invoice Number, Invoice Date, and Due Date are required.'
      });
    }

    if (type !== 'SALES' && type !== 'PURCHASE') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice type. Must be SALES or PURCHASE.'
      });
    }

    // Check unique Invoice Number per tenant + type
    const existingInvoice = await Invoice.findOne({
      where: { tenantId: req.tenantId, type, invoiceNumber },
      transaction
    });

    if (existingInvoice) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invoice Number '${invoiceNumber}' is already in use for type '${type}'.`
      });
    }

    let subtotal = 0;
    let finalTaxId = taxId || null;
    let finalTaxRate = 0;
    let salesOrder;
    let purchaseOrder;

    if (type === 'SALES') {
      if (!salesOrderId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Sales Order ID is required for Sales Invoice.' });
      }

      // Check if Sales Order has already been invoiced
      const doubleInvoice = await Invoice.findOne({ where: { salesOrderId }, transaction });
      if (doubleInvoice) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Sales Order has already been invoiced.' });
      }

      salesOrder = await SalesOrder.findOne({
        where: { id: salesOrderId, tenantId: req.tenantId },
        transaction
      });

      if (!salesOrder) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Sales Order not found.' });
      }

      subtotal = parseFloat(salesOrder.subtotal);
      finalTaxId = finalTaxId || salesOrder.taxId;

    } else {
      if (!purchaseOrderId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Purchase Order ID is required for Purchase Invoice.' });
      }

      // Check if Purchase Order has already been invoiced
      const doubleInvoice = await Invoice.findOne({ where: { purchaseOrderId }, transaction });
      if (doubleInvoice) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Purchase Order has already been invoiced.' });
      }

      purchaseOrder = await PurchaseOrder.findOne({
        where: { id: purchaseOrderId, tenantId: req.tenantId },
        transaction
      });

      if (!purchaseOrder) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Purchase Order not found.' });
      }

      subtotal = parseFloat(purchaseOrder.subtotal);
      finalTaxId = finalTaxId || purchaseOrder.taxId;
    }

    let totalAmount = 0;
    let taxAmount = 0;

    if (type === 'SALES' && salesOrder) {
      subtotal = parseFloat(salesOrder.subtotal);
      taxAmount = parseFloat(salesOrder.taxAmount || 0);
      totalAmount = parseFloat(salesOrder.totalAmount);
    } else if (type === 'PURCHASE' && purchaseOrder) {
      subtotal = parseFloat(purchaseOrder.subtotal);
      taxAmount = parseFloat(purchaseOrder.taxAmount || 0);
      totalAmount = parseFloat(purchaseOrder.totalAmount);
    } else {
      taxAmount = subtotal * (finalTaxRate / 100);
      totalAmount = subtotal + taxAmount;
    }

    // Check if linked SO or PO already has payments recorded
    let initialPaid = 0;
    if (type === 'SALES' && salesOrder) {
      initialPaid = parseFloat(salesOrder.metadata?.paidAmount || 0);
    } else if (type === 'PURCHASE' && purchaseOrder) {
      initialPaid = parseFloat(purchaseOrder.metadata?.paidAmount || 0);
    }

    const amountDue = Math.max(0, totalAmount - initialPaid);
    let initialStatus = 'UNPAID';
    if (initialPaid >= totalAmount - 0.01) {
      initialStatus = 'PAID';
    } else if (initialPaid > 0) {
      initialStatus = 'PARTIALLY_PAID';
    }

    const isTaxInclusive = type === 'PURCHASE'
      ? (purchaseOrder?.metadata?.taxInclusive === true || req.body.taxInclusive === true)
      : (salesOrder?.metadata?.taxInclusive === true || req.body.taxInclusive === true);

    // Create Invoice
    const invoice = await Invoice.create({
      tenantId: req.tenantId,
      type,
      salesOrderId: type === 'SALES' ? salesOrderId : null,
      purchaseOrderId: type === 'PURCHASE' ? purchaseOrderId : null,
      invoiceNumber,
      invoiceDate,
      dueDate,
      status: initialStatus,
      taxId: finalTaxId,
      taxInvoiceNumber,
      subtotal,
      taxAmount,
      totalAmount,
      amountDue,
      metadata: {
        ...(metadata || {}),
        taxInclusive: isTaxInclusive,
        paidAmount: initialPaid
      }
    }, { transaction });

    // Post Auto-Journal Entry
    await postInvoiceJournal(invoice, transaction);

    await transaction.commit();

    const createdInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Tax, as: 'tax', attributes: ['name', 'rate'] },
        { model: SalesOrder, as: 'salesOrder', attributes: ['soNumber', 'soDate', 'metadata'],
          include: [{ 
            model: Customer, 
            as: 'customer', 
            attributes: ['name', 'address', 'phone', 'salespersonCode', 'salespersonName', 'salespersonId'],
            include: [{ model: Salesperson, as: 'salesperson', attributes: ['id', 'name', 'code'] }]
          }]
        },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['poNumber', 'poDate'],
          include: [{ model: Supplier, as: 'supplier', attributes: ['name', 'address', 'phone'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'INVOICES',
      description: `Membuat Faktur / Invoice #${invoice.invoiceNumber} (${invoice.type})`,
      metadata: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, type: invoice.type, totalAmount: invoice.totalAmount }
    });

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: createdInvoice
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

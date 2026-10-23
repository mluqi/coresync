const { Payment, Invoice, ChartOfAccount, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { resolvePaymentAccountId, postPaymentJournal } = require('../utils/journalEngine');
const { checkAndUpdateSoStatus, checkAndUpdatePoStatus } = require('../utils/orderStatusEngine');
const { logActivity } = require('../utils/logger');

exports.getAllPayments = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['paymentNumber', 'paymentDate', 'paymentType', 'paymentMethod', 'amount', 'createdAt'],
      defaultSortBy: 'paymentDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.paymentType) whereClause.paymentType = req.query.paymentType;
    if (req.query.paymentMethod) whereClause.paymentMethod = req.query.paymentMethod;

    if (search) {
      whereClause[Op.or] = [
        { paymentNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Payment.findAndCountAll({
      where: whereClause,
      include: [
        { model: Invoice, as: 'invoice', attributes: ['invoiceNumber', 'totalAmount'] },
        { model: ChartOfAccount, as: 'account', attributes: ['accountCode', 'accountName'] }
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


exports.createPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { invoiceId, paymentNumber, paymentDate, paymentType, paymentMethod, amount, accountId, notes, metadata } = req.body;

    if (!paymentNumber || !paymentDate || !paymentType || amount === undefined || amount <= 0 || !accountId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment Number, Payment Date, Payment Type, amount > 0, and Account ID (Kas/Bank) are required.'
      });
    }

    // Check unique payment number per tenant
    const existing = await Payment.findOne({
      where: { tenantId: req.tenantId, paymentNumber },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment Number '${paymentNumber}' is already in use.`
      });
    }

    let linkedInvoice = null;

    if (invoiceId) {
      linkedInvoice = await Invoice.findOne({
        where: { id: invoiceId, tenantId: req.tenantId },
        transaction
      });

      if (!linkedInvoice) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Linked Invoice not found or access denied.'
        });
      }

      const due = parseFloat(linkedInvoice.amountDue);
      const payAmount = parseFloat(amount);

      if (payAmount > due) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Payment amount (${payAmount}) exceeds the invoice amount due (${due}).`
        });
      }

      // Update Invoice tagihan
      const newDue = Math.max(0, due - payAmount);
      const prevPaid = parseFloat(linkedInvoice.metadata?.paidAmount || (parseFloat(linkedInvoice.totalAmount || 0) - due));
      const newPaid = prevPaid + payAmount;
      
      let status = 'PARTIALLY_PAID';
      if (newDue <= 0.01) {
        status = 'PAID';
      }

      await linkedInvoice.update({
        amountDue: newDue,
        status,
        metadata: {
          ...(linkedInvoice.metadata || {}),
          paidAmount: newPaid
        }
      }, { transaction });

      // Sync back to SalesOrder or PurchaseOrder if linked
      if (linkedInvoice.salesOrderId) {
        const so = await sequelize.models.SalesOrder.findOne({
          where: { id: linkedInvoice.salesOrderId, tenantId: req.tenantId },
          transaction
        });
        if (so) {
          const currentMeta = so.metadata || {};
          const soTotal = parseFloat(so.totalAmount || 0);
          const newPaidAmount = newPaid;
          let newStatus = 'UNPAID';
          if (newPaidAmount >= soTotal - 0.01) newStatus = 'PAID';
          else if (newPaidAmount > 0) newStatus = 'PARTIAL';

          await so.update({
            metadata: {
              ...currentMeta,
              paidAmount: newPaidAmount,
              paymentStatus: newStatus
            }
          }, { transaction });
        }
      } else if (linkedInvoice.purchaseOrderId) {
        const po = await sequelize.models.PurchaseOrder.findOne({
          where: { id: linkedInvoice.purchaseOrderId, tenantId: req.tenantId },
          transaction
        });
        if (po) {
          const currentMeta = po.metadata || {};
          const poTotal = parseFloat(po.totalAmount || 0);
          const newPaidAmount = newPaid;
          let newStatus = 'UNPAID';
          if (newPaidAmount >= poTotal - 0.01) newStatus = 'PAID';
          else if (newPaidAmount > 0) newStatus = 'PARTIAL';

          await po.update({
            metadata: {
              ...currentMeta,
              paidAmount: newPaidAmount,
              paymentStatus: newStatus
            }
          }, { transaction });
        }
      }
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
    }

    const targetAccountId = await resolvePaymentAccountId(req.tenantId, paymentMethod, accountId, transaction);

    // Create Payment Record
    const payment = await Payment.create({
      tenantId: req.tenantId,
      invoiceId: invoiceId ? parseInt(invoiceId, 10) : null,
      paymentNumber,
      paymentDate,
      paymentType,
      paymentMethod: paymentMethod || 'CASH',
      amount,
      accountId: targetAccountId,
      notes,
      metadata: parsedMeta
    }, { transaction });

    // Post Auto-Journal Entry
    await postPaymentJournal(payment, transaction);

    await transaction.commit();

    // Auto-check completion status for linked Sales Order or Purchase Order
    if (linkedInvoice) {
      if (linkedInvoice.salesOrderId) {
        await checkAndUpdateSoStatus(linkedInvoice.salesOrderId, req.tenantId);
      } else if (linkedInvoice.purchaseOrderId) {
        await checkAndUpdatePoStatus(linkedInvoice.purchaseOrderId, req.tenantId);
      }
    }

    const createdPayment = await Payment.findByPk(payment.id, {
      include: [
        { model: Invoice, as: 'invoice', attributes: ['invoiceNumber', 'totalAmount'] },
        { model: ChartOfAccount, as: 'account', attributes: ['accountCode', 'accountName'] }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'PAYMENTS',
      description: `Mencatat pembayaran kas/bank #${payment.paymentNumber} (${payment.paymentType}) sebesar Rp ${parseFloat(payment.amount || 0).toLocaleString('id-ID')}`,
      metadata: { id: payment.id, paymentNumber: payment.paymentNumber, paymentType: payment.paymentType, amount: payment.amount, invoiceId: payment.invoiceId }
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded and auto-journal posted successfully.',
      data: createdPayment
    });

  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

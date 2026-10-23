const { SalesOrder, PurchaseOrder, Delivery, Invoice } = require('../models');

async function checkAndUpdateSoStatus(salesOrderId, tenantId, transaction = null) {
  if (!salesOrderId) return;
  const so = await SalesOrder.findOne({
    where: { id: salesOrderId, tenantId },
    include: [
      { model: Delivery, as: 'deliveries' },
      { model: Invoice, as: 'invoices' }
    ],
    transaction
  });

  if (!so || so.status === 'CANCELLED' || so.status === 'COMPLETED') return;

  const totalAmount = parseFloat(so.totalAmount || 0);
  const paidAmount = parseFloat(so.metadata?.paidAmount || 0);
  const paymentTerm = so.metadata?.paymentTerm;

  // 1. Check Payment Completion
  let isPaymentCompleted = false;
  if (paidAmount >= totalAmount - 0.01 || so.metadata?.paymentStatus === 'PAID') {
    isPaymentCompleted = true;
  } else if (so.invoices && so.invoices.length > 0) {
    const allInvoicesPaid = so.invoices.every(inv => inv.status === 'PAID' || parseFloat(inv.amountDue) <= 0.01);
    if (allInvoicesPaid) isPaymentCompleted = true;
  }

  // 2. Check Delivery Completion
  let isDeliveryCompleted = false;
  if (so.deliveries && so.deliveries.length > 0) {
    const allDeliveriesDelivered = so.deliveries.every(d => d.status === 'DELIVERED');
    if (allDeliveriesDelivered) isDeliveryCompleted = true;
  }
  if (!isDeliveryCompleted && (so.metadata?.manifestStatus === 'DELIVERED' || so.status === 'DELIVERED' || so.metadata?.fulfillmentType === 'PICKUP' || so.metadata?.isPickup === true)) {
    isDeliveryCompleted = true;
  }

  if (isPaymentCompleted && isDeliveryCompleted) {
    await so.update({
      status: 'COMPLETED',
      metadata: {
        ...(so.metadata || {}),
        completedAt: new Date().toISOString()
      }
    }, { transaction });
  } else if (isDeliveryCompleted && !isPaymentCompleted) {
    if (so.status !== 'SHIPPED') {
      await so.update({
        status: 'SHIPPED',
        metadata: {
          ...(so.metadata || {}),
          manifestStatus: so.metadata?.manifestStatus || 'DELIVERED'
        }
      }, { transaction });
    }
  }
}

async function checkAndUpdatePoStatus(purchaseOrderId, tenantId, transaction = null) {
  if (!purchaseOrderId) return;
  const po = await PurchaseOrder.findOne({
    where: { id: purchaseOrderId, tenantId },
    include: [
      { model: Invoice, as: 'bills' }
    ],
    transaction
  });

  if (!po || po.status === 'CANCELLED' || po.status === 'COMPLETED' || po.status === 'SELESAI') return;

  const totalAmount = parseFloat(po.totalAmount || 0);
  const paidAmount = parseFloat(po.metadata?.paidAmount || 0);
  const paymentTerm = po.metadata?.paymentTerm;

  // 1. Check Payment Completion
  let isPaymentCompleted = false;
  if (paidAmount >= totalAmount - 0.01 || po.metadata?.paymentStatus === 'PAID') {
    isPaymentCompleted = true;
  } else if (paymentTerm === 'CASH' || paymentTerm === 'LUNAS') {
    isPaymentCompleted = true;
  } else if (po.bills && po.bills.length > 0) {
    const allBillsPaid = po.bills.every(inv => inv.status === 'PAID' || parseFloat(inv.amountDue) <= 0.01);
    if (allBillsPaid) isPaymentCompleted = true;
  }

  // 2. Check Receipt Completion (PO status is RECEIVED or has receive logs)
  let isReceiptCompleted = po.status === 'RECEIVED' || !!po.metadata?.receiveDate || (Array.isArray(po.metadata?.receives) && po.metadata.receives.length > 0);

  if (isPaymentCompleted && isReceiptCompleted) {
    await po.update({
      status: 'COMPLETED',
      metadata: {
        ...(po.metadata || {}),
        completedAt: new Date().toISOString()
      }
    }, { transaction });
  }
}

module.exports = {
  checkAndUpdateSoStatus,
  checkAndUpdatePoStatus
};

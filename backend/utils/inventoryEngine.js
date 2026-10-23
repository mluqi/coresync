const { Op } = require('sequelize');
const { IncomingBatch, StockLedger, ProductWarehouse, Product } = require('../models');

/**
 * Record stock in (e.g. from Purchase Order receipt, stock opname adjustment, or manual entry)
 * Supports regular stock and bonus stock (isBonus: true)
 */
async function recordStockIn({
  tenantId,
  warehouseId,
  productId,
  purchaseOrderItemId,
  batchNumber,
  receiveDate,
  qty,
  costPrice = 0,
  isBonus = false,
  referenceType,
  referenceId,
  customNotes,
  transaction
}) {
  if (qty <= 0) throw new Error('Quantity must be greater than zero.');

  const effectiveCostPrice = isBonus ? 0 : parseFloat(costPrice || 0);
  const stockType = isBonus ? 'BONUS' : 'REGULAR';

  // 1. Create Incoming Batch
  const batch = await IncomingBatch.create({
    tenantId,
    warehouseId,
    productId,
    purchaseOrderItemId: purchaseOrderItemId || null,
    batchNumber,
    receiveDate,
    initialQty: qty,
    currentQty: qty,
    costPrice: effectiveCostPrice,
    isBonus: Boolean(isBonus)
  }, { transaction });

  // 2. Create Stock Ledger Entry
  const noteText = customNotes || (
    isBonus 
      ? `Barang Bonus Masuk Batch: ${batchNumber}` 
      : `Barang Masuk Batch: ${batchNumber}`
  );

  await StockLedger.create({
    tenantId,
    warehouseId,
    productId,
    incomingBatchId: batch.id,
    type: 'IN',
    stockType,
    qty,
    referenceType,
    referenceId,
    notes: noteText
  }, { transaction });

  // 3. Update Product Warehouse Stock
  const [productWh] = await ProductWarehouse.findOrCreate({
    where: { productId, warehouseId },
    defaults: { tenantId, stock: 0, bonusStock: 0 },
    transaction
  });

  if (isBonus) {
    await productWh.increment('bonusStock', { by: qty, transaction });
  } else {
    await productWh.increment('stock', { by: qty, transaction });
  }
  
  return batch;
}

/**
 * Record stock out (e.g. from Delivery Note, Stock Opname adjustment, or manual entry)
 * Automatically processes via FIFO (First In First Out)
 * Separates regular stock from bonus stock
 * Returns the total HPP (Cost of Goods Sold)
 */
async function recordStockOut({
  tenantId,
  warehouseId,
  productId,
  qty,
  isBonus = false,
  referenceType,
  referenceId,
  customNotes,
  notes,
  transaction
}) {
  if (qty <= 0) throw new Error('Quantity must be greater than zero.');

  const stockType = isBonus ? 'BONUS' : 'REGULAR';

  // 1. Verify aggregate stock is sufficient
  const productWh = await ProductWarehouse.findOne({
    where: { productId, warehouseId },
    transaction
  });

  const availableStock = productWh ? (isBonus ? parseFloat(productWh.bonusStock || 0) : parseFloat(productWh.stock || 0)) : 0;

  if (availableStock < qty) {
    const stockLabel = isBonus ? 'Stok Bonus' : 'Stok Reguler';
    const product = await Product.findByPk(productId, { attributes: ['id', 'sku', 'name', 'unit'], transaction });
    const prodName = product ? `"${product.name}" (${product.sku})` : `ID ${productId}`;
    const prodUnit = product?.unit ? ` ${product.unit}` : '';
    const err = new Error(`Stok ${stockLabel.toLowerCase()} tidak mencukupi untuk ${prodName}. Tersedia: ${availableStock}${prodUnit}, Dibutuhkan: ${qty}${prodUnit}`);
    err.name = 'InsufficientStockError';
    err.availableStock = availableStock;
    err.requiredQty = qty;
    err.productId = productId;
    err.productName = product?.name;
    err.productSku = product?.sku;
    throw err;
  }

  // 2. Fetch active batches sorted by receive date (FIFO) for the specific stock type
  const activeBatches = await IncomingBatch.findAll({
    where: {
      tenantId,
      warehouseId,
      productId,
      isBonus: Boolean(isBonus),
      currentQty: { [Op.gt]: 0 }
    },
    order: [    
      ['receiveDate', 'ASC'],
      ['id', 'ASC']
    ],
    transaction
  });

  let remainingToDeduct = qty;
  let totalHpp = 0;

  // 3. Deduct stock sequentially
  for (const batch of activeBatches) {
    if (remainingToDeduct <= 0) break;

    const qtyToDeductFromBatch = Math.min(remainingToDeduct, batch.currentQty);
    
    // Calculate HPP component for this batch (Bonus is always HPP 0)
    const hppFromBatch = isBonus ? 0 : (qtyToDeductFromBatch * parseFloat(batch.costPrice || 0));
    totalHpp += hppFromBatch;

    // Update batch current quantity
    await batch.update({
      currentQty: batch.currentQty - qtyToDeductFromBatch
    }, { transaction });

    // Create Stock Ledger Entry for this deduction
    const entryNote = customNotes || notes
      ? `${customNotes || notes} (${isBonus ? 'Bonus ' : ''}Batch: ${batch.batchNumber})`
      : `Potong Batch FIFO ${isBonus ? 'Bonus' : 'Reguler'}: ${batch.batchNumber}`;

    await StockLedger.create({
      tenantId,
      warehouseId,
      productId,
      incomingBatchId: batch.id,
      type: 'OUT',
      stockType,
      qty: qtyToDeductFromBatch,
      referenceType,
      referenceId,
      notes: entryNote
    }, { transaction });

    remainingToDeduct -= qtyToDeductFromBatch;
  }

  if (remainingToDeduct > 0) {
    // If batches ran short but aggregate warehouse stock is sufficient, create a fallback batch to fulfill deduction
    const product = await Product.findByPk(productId, { transaction });
    const costPrice = isBonus ? 0 : parseFloat(product?.purchasePrice || (parseFloat(product?.sellingPrice || 100000) * 0.9));
    
    const fallbackBatch = await IncomingBatch.create({
      tenantId,
      warehouseId,
      productId,
      batchNumber: `BATCH-AUTO-${isBonus ? 'BNS-' : ''}${Date.now().toString().slice(-6)}`,
      receiveDate: new Date().toISOString().split('T')[0],
      initialQty: remainingToDeduct,
      currentQty: 0,
      costPrice,
      isBonus: Boolean(isBonus)
    }, { transaction });

    const hppFromBatch = isBonus ? 0 : (remainingToDeduct * costPrice);
    totalHpp += hppFromBatch;

    const entryNote = customNotes || notes
      ? `${customNotes || notes} (Batch: ${fallbackBatch.batchNumber})`
      : `Potong Batch FIFO ${isBonus ? 'Bonus' : 'Reguler'}: ${fallbackBatch.batchNumber}`;

    await StockLedger.create({
      tenantId,
      warehouseId,
      productId,
      incomingBatchId: fallbackBatch.id,
      type: 'OUT',
      stockType,
      qty: remainingToDeduct,
      referenceType,
      referenceId,
      notes: entryNote
    }, { transaction });

    remainingToDeduct = 0;
  }

  // 4. Update Product Warehouse Stock (Decrement)
  if (isBonus) {
    await productWh.decrement('bonusStock', { by: qty, transaction });
  } else {
    await productWh.decrement('stock', { by: qty, transaction });
  }

  return totalHpp;
}

/**
 * Record return in (Sales Return)
 * Puts returned stock back as a new batch to preserve FIFO order
 */
async function recordReturnIn({
  tenantId,
  warehouseId,
  productId,
  qty,
  costPrice = 0,
  isBonus = false,
  referenceId,
  customNotes,
  transaction
}) {
  if (qty <= 0) throw new Error('Quantity must be greater than zero.');

  const effectiveCost = isBonus ? 0 : parseFloat(costPrice || 0);
  const stockType = isBonus ? 'BONUS' : 'REGULAR';

  // Create batch for returned item
  const batch = await IncomingBatch.create({
    tenantId,
    warehouseId,
    productId,
    batchNumber: `RET-${isBonus ? 'BNS-' : ''}${referenceId}`,
    receiveDate: new Date().toISOString().split('T')[0], // today
    initialQty: qty,
    currentQty: qty,
    costPrice: effectiveCost,
    isBonus: Boolean(isBonus)
  }, { transaction });

  // Record mutasi in stock ledger
  await StockLedger.create({
    tenantId,
    warehouseId,
    productId,
    incomingBatchId: batch.id,
    type: 'RETURN_IN',
    stockType,
    qty,
    referenceType: 'RETURN',
    referenceId,
    notes: customNotes || `Retur Masuk ${isBonus ? 'Bonus' : 'Reguler'}`
  }, { transaction });

  // Update product warehouse stock
  const [productWh] = await ProductWarehouse.findOrCreate({
    where: { productId, warehouseId },
    defaults: { tenantId, stock: 0, bonusStock: 0 },
    transaction
  });

  if (isBonus) {
    await productWh.increment('bonusStock', { by: qty, transaction });
  } else {
    await productWh.increment('stock', { by: qty, transaction });
  }

  return batch;
}

/**
 * Record internal mutation between Regular Stock and Bonus Stock
 */
async function recordStockTypeMutation({
  tenantId,
  warehouseId,
  productId,
  fromType, // 'REGULAR' | 'BONUS'
  toType,   // 'REGULAR' | 'BONUS'
  qty,
  notes,
  referenceType = 'STOCK_TRANSFER',
  referenceId,
  transaction
}) {
  if (qty <= 0) throw new Error('Kuantitas mutasi harus lebih dari 0.');
  if (fromType === toType) throw new Error('Tipe stok asal dan tujuan tidak boleh sama.');

  const isFromBonus = fromType === 'BONUS';
  const isToBonus = toType === 'BONUS';

  // 1. Deduct from source type
  await recordStockOut({
    tenantId,
    warehouseId,
    productId,
    qty,
    isBonus: isFromBonus,
    referenceType,
    referenceId,
    customNotes: notes || `Mutasi Keluar Tipe Stok (${fromType} -> ${toType})`,
    transaction
  });

  // 2. Add to destination type
  const batchNumber = `MUT-TYPE-${Date.now().toString().slice(-6)}`;
  const batch = await recordStockIn({
    tenantId,
    warehouseId,
    productId,
    batchNumber,
    receiveDate: new Date().toISOString().split('T')[0],
    qty,
    costPrice: 0,
    isBonus: isToBonus,
    referenceType,
    referenceId,
    customNotes: notes || `Mutasi Masuk Tipe Stok (${fromType} -> ${toType})`,
    transaction
  });

  return batch;
}

module.exports = {
  recordStockIn,
  recordStockOut,
  recordReturnIn,
  recordStockTypeMutation
};

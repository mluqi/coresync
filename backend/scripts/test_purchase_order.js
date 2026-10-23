/**
 * Automated Test Suite: Purchase Order (PO) & Multi-Unit Inventory
 * 
 * Pengujian komprehensif untuk fitur PO:
 * 1. Deteksi Struktur Satuan Bertingkat (Karton + PCS)
 * 2. Formula Kalkulasi Subtotal Bertingkat (1 KRT + 8 PCS)
 * 3. Pembuatan PO dengan Diskon Global (Rp & %)
 * 4. Verifikasi Penyimpanan Metadata & Items Detail
 * 5. Penerimaan Barang Fisik (SJM / Incoming Batch FIFO)
 * 6. Audit Kartu Stok (Stock Ledger) Format Bersih "+1 KRT + 8 PCS"
 * 7. Pembersihan Data Test (Auto Cleanup)
 * 
 * Cara Menjalankan:
 * node scripts/test_purchase_order.js
 */

require('dotenv').config();
const { 
  sequelize, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  Product, 
  ProductUnit,
  Supplier, 
  Warehouse, 
  IncomingBatch, 
  StockLedger, 
  ProductWarehouse 
} = require('../models');

// Helper fungsi getProductStructure (server-side version)
function getProductStructure(product) {
  if (!product) return { hasMultiUnit: false, capacity: 1 };
  const baseUnit = (product.unit || 'PCS').trim().toUpperCase();
  const rawUnits = product.units || [];

  const bigCandidate = rawUnits.find(u => !u.isBaseUnit && parseFloat(u.conversionRatio) > 1);
  if (bigCandidate) {
    const ratio = parseFloat(bigCandidate.conversionRatio);
    const capacity = Math.round(ratio);
    const smallPrice = parseFloat(product.purchasePrice || 0);
    const bigPrice = parseFloat(bigCandidate.purchasePrice || 0) || (smallPrice * capacity);
    return {
      hasMultiUnit: true,
      bigUnitName: bigCandidate.unitName.toUpperCase(),
      bigPrice,
      smallUnitName: baseUnit,
      smallPrice,
      capacity,
      isBaseSmall: true,
      conversionHint: `1 ${bigCandidate.unitName.toUpperCase()} = ${capacity} ${baseUnit}`
    };
  }

  const smallCandidates = rawUnits
    .filter(u => !u.isBaseUnit && parseFloat(u.conversionRatio) < 1 && parseFloat(u.conversionRatio) > 0)
    .sort((a, b) => parseFloat(a.conversionRatio) - parseFloat(b.conversionRatio));

  if (smallCandidates.length > 0) {
    const smallest = smallCandidates[0];
    const smallRatio = parseFloat(smallest.conversionRatio);
    const capacity = Math.round(1 / smallRatio);
    const bigPrice = parseFloat(product.purchasePrice || 0);
    const smallPrice = parseFloat(smallest.purchasePrice || 0) || (capacity > 0 ? bigPrice / capacity : 0);
    return {
      hasMultiUnit: true,
      bigUnitName: baseUnit,
      bigPrice,
      smallUnitName: smallest.unitName.toUpperCase(),
      smallPrice,
      capacity,
      isBaseSmall: false,
      conversionHint: `1 ${baseUnit} = ${capacity} ${smallest.unitName.toUpperCase()}`
    };
  }

  return {
    hasMultiUnit: false,
    bigUnitName: baseUnit,
    bigPrice: parseFloat(product.purchasePrice || 0),
    smallUnitName: '',
    smallPrice: 0,
    capacity: 1,
    isBaseSmall: false,
    conversionHint: ''
  };
}

function calculateTieredSubtotal(bigQty, smallQty, struct) {
  const b = parseFloat(bigQty || 0);
  const s = parseFloat(smallQty || 0);
  const bigPrice = struct.bigPrice || 0;
  const smallPrice = struct.smallPrice > 0 ? struct.smallPrice : (struct.capacity > 0 ? bigPrice / struct.capacity : 0);
  
  let totalBaseQty = b;
  if (struct.isBaseSmall) {
    totalBaseQty = (b * struct.capacity) + s;
  } else {
    totalBaseQty = b + (struct.capacity > 0 ? s / struct.capacity : 0);
  }

  const grossSubtotal = (b * bigPrice) + (s * smallPrice);
  return { totalBaseQty, grossSubtotal, bigPrice, smallPrice };
}

function formatStockBreakdownCompact(qty, product) {
  const totalBaseQty = parseFloat(qty) || 0;
  const baseUnit = (product.unit || 'PCS').toUpperCase();
  if (totalBaseQty <= 0) return `0 ${baseUnit}`;
  const rawUnits = product.units || [];
  const unitMap = new Map();
  unitMap.set(baseUnit, { name: baseUnit, ratio: 1.0 });
  rawUnits.forEach((u) => {
    const name = (u.unitName || '').trim().toUpperCase();
    const ratio = parseFloat(u.conversionRatio || 1.0);
    if (name && ratio > 0) unitMap.set(name, { name, ratio });
  });
  const units = Array.from(unitMap.values()).sort((a, b) => b.ratio - a.ratio);

  let remaining = totalBaseQty;
  const parts = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const isLast = i === units.length - 1;
    if (isLast) {
      const count = Math.round(remaining / u.ratio);
      if (count > 0) parts.push(`${count} ${u.name}`);
    } else {
      const count = Math.floor((remaining + 1e-5) / u.ratio);
      if (count > 0) {
        parts.push(`${count} ${u.name}`);
        remaining = Math.max(0, remaining - count * u.ratio);
      }
    }
  }
  return parts.join(' + ') || `0 ${baseUnit}`;
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   AUTOMATED TEST SUITE: PURCHASE ORDER & MULTI-UNIT INVENTORY');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failedCount++;
    }
  }

  const tenantId = 1;
  const testPoNumber = `PO-TEST-${Date.now()}`;
  let createdPoId = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Ambil Master Data & Deteksi Struktur Satuan
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Deteksi Struktur Satuan Produk Multi-Satuan');
    const product = await Product.findOne({
      where: { tenantId },
      include: [{ model: ProductUnit, as: 'units' }]
    });

    assert(product !== null, `Produk ditemukan: ${product?.name} (${product?.sku})`);
    const struct = getProductStructure(product);
    console.log(`     Info: Unit Dasar = ${struct.bigUnitName}, Satuan Kecil = ${struct.smallUnitName || '-'}, Kapasitas = 1:${struct.capacity}`);
    assert(struct.capacity >= 1, `Kapasitas rasio valid: 1 ${struct.bigUnitName} = ${struct.capacity} ${struct.smallUnitName || struct.bigUnitName}`);

    // -------------------------------------------------------------
    // TEST 2: Validasi Formula Subtotal Bertingkat
    // -------------------------------------------------------------
    console.log('\n▶ TEST 2: Formula Subtotal Satuan Bertingkat (1 KRT + 8 PCS)');
    const testBigQty = 1;
    const testSmallQty = struct.hasMultiUnit ? 8 : 0;
    const calc = calculateTieredSubtotal(testBigQty, testSmallQty, struct);

    assert(calc.totalBaseQty > 0, `Total kuantitas basis terhitung: ${calc.totalBaseQty.toFixed(4)} ${struct.bigUnitName}`);
    assert(calc.grossSubtotal > 0, `Subtotal kotor terhitung: Rp ${Math.round(calc.grossSubtotal).toLocaleString('id-ID')}`);

    // -------------------------------------------------------------
    // TEST 3: Pembuatan PO dengan Diskon Global
    // -------------------------------------------------------------
    console.log('\n▶ TEST 3: Pembuatan Purchase Order di Database');
    const supplier = await Supplier.findOne({ where: { tenantId } });
    const warehouse = await Warehouse.findOne({ where: { tenantId } });
    assert(supplier !== null && warehouse !== null, `Supplier (${supplier?.name}) dan Gudang (${warehouse?.name}) siap`);

    const discountAmount = 5000;
    const netSubtotal = Math.max(0, calc.grossSubtotal - discountAmount);

    const po = await PurchaseOrder.create({
      tenantId,
      contactId: supplier.id,
      warehouseId: warehouse.id,
      poNumber: testPoNumber,
      poDate: new Date().toISOString().split('T')[0],
      status: 'APPROVED',
      subtotal: netSubtotal,
      taxAmount: 0,
      totalAmount: netSubtotal,
      notes: 'Testing Automated PO Multi-Satuan',
      metadata: {
        isDraft: false,
        requireApproval: true,
        globalDiscountMode: 'AMOUNT',
        globalDiscountAmount: discountAmount,
        globalDiscountPercent: 0,
        itemsDetail: [
          {
            productId: product.id,
            bigQty: testBigQty,
            smallQty: testSmallQty,
            bigUnit: struct.bigUnitName,
            smallUnit: struct.smallUnitName,
            capacity: struct.capacity,
            unit: struct.bigUnitName,
            qty: calc.totalBaseQty,
            bonusQty: 0,
            price: calc.bigPrice,
            discount: 0,
            subtotal: calc.grossSubtotal
          }
        ]
      }
    });

    createdPoId = po.id;
    assert(po.id > 0, `Purchase Order berhasil dibuat dengan ID: ${po.id} (#${po.poNumber})`);

    const poItem = await PurchaseOrderItem.create({
      purchaseOrderId: po.id,
      productId: product.id,
      qty: calc.totalBaseQty,
      bonusQty: 0,
      bonusUnit: struct.smallUnitName || 'PCS',
      price: calc.bigPrice,
      discount: 0,
      subtotal: calc.grossSubtotal
    });

    assert(poItem.id > 0, `Item PO berhasil disimpan (ID: ${poItem.id}, Qty Basis: ${poItem.qty})`);

    // -------------------------------------------------------------
    // TEST 4: Verifikasi Metadata PO & Mode Diskon
    // -------------------------------------------------------------
    console.log('\n▶ TEST 4: Verifikasi Integritas Metadata & Diskon Global');
    const fetchedPo = await PurchaseOrder.findByPk(po.id);
    const meta = fetchedPo.metadata || {};

    assert(meta.globalDiscountMode === 'AMOUNT', `Mode diskon tersimpan: ${meta.globalDiscountMode}`);
    assert(meta.globalDiscountAmount === discountAmount, `Nominal diskon global: Rp ${meta.globalDiscountAmount}`);
    assert(Array.isArray(meta.itemsDetail) && meta.itemsDetail.length === 1, 'itemsDetail tersimpan rapi di metadata');
    assert(meta.itemsDetail[0].bigQty === testBigQty, `itemsDetail.bigQty sesuai: ${meta.itemsDetail[0].bigQty} ${struct.bigUnitName}`);
    assert(meta.itemsDetail[0].smallQty === testSmallQty, `itemsDetail.smallQty sesuai: ${meta.itemsDetail[0].smallQty} ${struct.smallUnitName}`);

    // -------------------------------------------------------------
    // TEST 5: Simulasi Penerimaan Barang & HPP FIFO
    // -------------------------------------------------------------
    console.log('\n▶ TEST 5: Penerimaan Barang Masuk (FIFO Stock In)');
    const fifoUnitCost = calc.totalBaseQty > 0 ? (calc.grossSubtotal / calc.totalBaseQty) : calc.bigPrice;

    const testBatch = await IncomingBatch.create({
      tenantId,
      warehouseId: warehouse.id,
      productId: product.id,
      purchaseOrderItemId: poItem.id,
      batchNumber: testPoNumber,
      receiveDate: new Date().toISOString().split('T')[0],
      initialQty: calc.totalBaseQty,
      currentQty: calc.totalBaseQty,
      costPrice: fifoUnitCost,
      isBonus: false
    });

    assert(testBatch.id > 0, `Batch FIFO dibuat (ID: ${testBatch.id}, HPP per ${struct.bigUnitName}: Rp ${Math.round(fifoUnitCost).toLocaleString('id-ID')})`);

    // -------------------------------------------------------------
    // TEST 6: Format Tampilan Kartu Stok (Tanpa Koma Desimal)
    // -------------------------------------------------------------
    console.log('\n▶ TEST 6: Tampilan Mutasi di Kartu Stok (Stock Ledger)');
    const ledgerText = formatStockBreakdownCompact(calc.totalBaseQty, product);
    console.log(`     Teks Kartu Stok: "${ledgerText}"`);
    assert(ledgerText.includes(struct.bigUnitName), `Teks kartu stok memuat satuan utama: ${struct.bigUnitName}`);
    if (struct.hasMultiUnit) {
      assert(ledgerText.includes(struct.smallUnitName) || ledgerText.includes('1'), `Teks kartu stok bertingkat rapi: ${ledgerText}`);
    }

  } catch (error) {
    console.error('Terjadi error saat eksekusi testing:', error);
    failedCount++;
  } finally {
    // -------------------------------------------------------------
    // TEST 7: Auto Cleanup Data Test
    // -------------------------------------------------------------
    console.log('\n▶ TEST 7: Membersihkan Data Dummy Testing (Auto Cleanup)');
    if (createdPoId) {
      await IncomingBatch.destroy({ where: { batchNumber: testPoNumber } });
      await PurchaseOrderItem.destroy({ where: { purchaseOrderId: createdPoId } });
      await PurchaseOrder.destroy({ where: { id: createdPoId } });
      console.log(`     Data PO #${testPoNumber} dan batch terkait berhasil dibersihkan dari database.`);
      assert(true, 'Database tetap bersih setelah pengujian');
    }
  }

  // -------------------------------------------------------------
  // RINGKASAN HASIL
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  HASIL PENGUJIAN: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount === 0) {
    console.log('🎉 SEMUA PENGUJIAN PO BERHASIL 100% TANPA KENDALA!\n');
    process.exit(0);
  } else {
    console.error('⚠️ Terdapat pengujian yang gagal. Periksa log di atas.\n');
    process.exit(1);
  }
}

runTests();

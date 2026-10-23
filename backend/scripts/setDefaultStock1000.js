const { sequelize, Product, Warehouse, ProductWarehouse, IncomingBatch, StockLedger } = require('../models');

/**
 * Script untuk Mengisi Default Stok 1000 untuk Seluruh Master Barang
 * - Memperbarui tabel `product_warehouses` (stok reguler = 1000, stok bonus = 100)
 * - Membuat record `incoming_batches` (untuk perhitungan HPP / FIFO)
 * - Mencatat mutasi di `stock_ledger` (sebagai saldo awal)
 * - Master data (produk, kategori, supplier, customer, dll) tetap 100% AMAN
 */
async function setDefaultStock1000() {
  console.log('\n===============================================================');
  console.log('🚀 MEMULAI PROSES PENGISIAN STOK DEFAULT (1.000 UNIT / BARANG)');
  console.log('===============================================================\n');

  try {
    const products = await Product.findAll({
      attributes: ['id', 'tenantId', 'name', 'sku', 'purchasePrice', 'unit']
    });

    const warehouses = await Warehouse.findAll({
      attributes: ['id', 'tenantId', 'name']
    });

    if (products.length === 0) {
      console.log('⚠️ Tidak ada data master produk yang ditemukan.');
      process.exit(0);
    }

    if (warehouses.length === 0) {
      console.log('⚠️ Tidak ada data gudang yang ditemukan.');
      process.exit(0);
    }

    console.log(`📦 Ditemukan ${products.length} Master Produk dan ${warehouses.length} Gudang.`);
    console.log(`🏢 Daftar Gudang: ${warehouses.map(w => `[ID ${w.id}] ${w.name}`).join(', ')}`);
    console.log('\nSedang memproses data stok...');

    // Nonaktifkan pemeriksaan Foreign Key sementara
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Bersihkan data stok lama agar tidak duplikat
    await sequelize.query('TRUNCATE TABLE `product_warehouses`;');
    await sequelize.query('TRUNCATE TABLE `incoming_batches`;');
    await sequelize.query('TRUNCATE TABLE `stock_ledger`;');

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    const now = new Date();
    const dateOnly = now.toISOString().split('T')[0];

    const DEFAULT_REGULAR_STOCK = 1000;
    const DEFAULT_BONUS_STOCK = 100;

    const pwRecords = [];
    const batchRecords = [];
    const ledgerRecords = [];

    for (const prod of products) {
      const tenantId = prod.tenantId || 1;
      const costPrice = parseFloat(prod.purchasePrice) || 0;

      for (const wh of warehouses) {
        // 1. Record ProductWarehouse
        pwRecords.push({
          tenantId,
          productId: prod.id,
          warehouseId: wh.id,
          stock: DEFAULT_REGULAR_STOCK,
          bonusStock: DEFAULT_BONUS_STOCK,
          createdAt: now,
          updatedAt: now
        });

        // 2. Incoming Batch Reguler
        batchRecords.push({
          tenantId,
          warehouseId: wh.id,
          productId: prod.id,
          batchNumber: `INIT-REG-${prod.sku || prod.id}-${wh.id}`,
          receiveDate: dateOnly,
          initialQty: DEFAULT_REGULAR_STOCK,
          currentQty: DEFAULT_REGULAR_STOCK,
          costPrice: costPrice,
          isBonus: false,
          createdAt: now,
          updatedAt: now
        });

        // 3. Incoming Batch Bonus
        batchRecords.push({
          tenantId,
          warehouseId: wh.id,
          productId: prod.id,
          batchNumber: `INIT-BNS-${prod.sku || prod.id}-${wh.id}`,
          receiveDate: dateOnly,
          initialQty: DEFAULT_BONUS_STOCK,
          currentQty: DEFAULT_BONUS_STOCK,
          costPrice: 0,
          isBonus: true,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Eksekusi bulk insert dengan batching untuk performa cepat
    await ProductWarehouse.bulkCreate(pwRecords);
    const createdBatches = await IncomingBatch.bulkCreate(batchRecords);

    // Hubungkan StockLedger ke Batch ID yang baru dibuat
    for (const batch of createdBatches) {
      ledgerRecords.push({
        tenantId: batch.tenantId,
        warehouseId: batch.warehouseId,
        productId: batch.productId,
        incomingBatchId: batch.id,
        type: 'ADJUSTMENT_IN',
        qty: batch.initialQty,
        referenceType: 'OPENING_BALANCE',
        referenceId: 0,
        stockType: batch.isBonus ? 'BONUS' : 'REGULAR',
        notes: batch.isBonus ? `Saldo Awal Stok Bonus (${DEFAULT_BONUS_STOCK})` : `Saldo Awal Stok Reguler (${DEFAULT_REGULAR_STOCK})`,
        createdAt: now,
        updatedAt: now
      });
    }

    await StockLedger.bulkCreate(ledgerRecords);

    console.log('\n===============================================================');
    console.log('✅ HASIL INISIALISASI STOK BERHASIL:');
    console.log('===============================================================');
    console.log(`  • Total Produk Diproses       : ${products.length} barang`);
    console.log(`  • Total Gudang                 : ${warehouses.length} gudang`);
    console.log(`  • Stok Reguler per Barang     : ${DEFAULT_REGULAR_STOCK.toLocaleString('id-ID')} unit`);
    console.log(`  • Stok Bonus per Barang       : ${DEFAULT_BONUS_STOCK.toLocaleString('id-ID')} unit`);
    console.log(`  • Total Record Stok Gudang    : ${pwRecords.length} baris`);
    console.log(`  • Total Batch FIFO Dibuat     : ${batchRecords.length} batch`);
    console.log(`  • Total Mutasi Kartu Stok     : ${ledgerRecords.length} entri`);
    console.log('\n🎉 Selesai! Semua barang sekarang memiliki stok 1.000 unit di setiap gudang.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat mengisi stok:', error);
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {}
    process.exit(1);
  }
}

// Jalankan script
setDefaultStock1000();

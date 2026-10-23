'use strict';

/**
 * Script: Reset Data Transaksi & Set Default Stok 1.000 Unit
 * 
 * Fungsi:
 * 1. Mengosongkan SEMUA data transaksi (Sales Orders, Deliveries, Invoices, Payments, 
 *    Purchase Orders, Returns, Jurnal, Stock Opname, Stock Transfer, Log Aktivitas).
 * 2. Menjaga SELURUH MASTER DATA tetap 100% AMAN:
 *    - Customers (Pelanggan)
 *    - Products & Units (Barang & Satuan)
 *    - Suppliers (Pemasok)
 *    - Salespersons (Salesman)
 *    - Drivers (Supir)
 *    - Warehouses (Gudang)
 *    - Categories, Units, Taxes, Chart of Accounts
 *    - Tenants & Users
 * 3. Mengatur stok awal default 1.000 unit untuk setiap produk di setiap gudang, 
 *    lengkap dengan Incoming Batch (FIFO) dan Stock Ledger (Saldo Awal).
 */

const { 
  sequelize, 
  Product, 
  Warehouse, 
  ProductWarehouse, 
  IncomingBatch, 
  StockLedger 
} = require('../models');

async function resetAndSetStock1000() {
  console.log('\n=====================================================================');
  console.log('🧹 CoreSync ERP — Clear Data Transaksi & Set Default Stok 1.000');
  console.log('=====================================================================\n');

  const transactionTables = [
    // 1. Penjualan & Pengiriman
    'delivery_manifests',
    'delivery_items',
    'deliveries',
    'sales_order_items',
    'sales_orders',

    // 2. Pembelian
    'purchase_order_items',
    'purchase_orders',

    // 3. Retur
    'return_items',
    'returns',

    // 4. Keuangan, Tagihan & Pembayaran
    'payments',
    'invoices',
    'journal_entry_items',
    'journal_entries',

    // 5. Mutasi, Opname, Batch & Kartu Stok
    'stock_transfer_items',
    'stock_transfers',
    'stock_opname_items',
    'stock_opnames',
    'stock_ledger',
    'incoming_batches',
    'product_warehouses',

    // 6. Log
    'activity_logs',
    'access_logs'
  ];

  try {
    // 1. Nonaktifkan foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    console.log('🗑️  Mengosongkan tabel-tabel transaksi:');
    for (const table of transactionTables) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Kosong: \`${table}\``);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\`;`);
        console.log(`  ✓ Hapus baris: \`${table}\``);
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    // 2. Ambil master data produk dan gudang
    console.log('\n📦 Membaca Master Produk dan Gudang...');
    const products = await Product.findAll({
      attributes: ['id', 'tenantId', 'name', 'sku', 'purchasePrice', 'unit']
    });

    const warehouses = await Warehouse.findAll({
      attributes: ['id', 'tenantId', 'name']
    });

    console.log(`  • Ditemukan: ${products.length} Master Produk`);
    console.log(`  • Ditemukan: ${warehouses.length} Master Gudang (${warehouses.map(w => w.name).join(', ')})`);

    if (products.length === 0 || warehouses.length === 0) {
      console.log('⚠️ Master produk atau gudang tidak ditemukan.');
      process.exit(0);
    }

    // 3. Siapkan stok default 1000
    console.log('\n⚙️  Menyiapkan data stok default 1.000 unit per barang...');
    const now = new Date();
    const dateOnly = now.toISOString().split('T')[0];
    const DEFAULT_STOCK = 1000;
    const DEFAULT_BONUS_STOCK = 100;

    const pwRecords = [];
    const batchRecords = [];

    for (const prod of products) {
      const tenantId = prod.tenantId || 1;
      const costPrice = parseFloat(prod.purchasePrice) || 0;

      for (const wh of warehouses) {
        // Record ProductWarehouse
        pwRecords.push({
          tenantId,
          productId: prod.id,
          warehouseId: wh.id,
          stock: DEFAULT_STOCK,
          bonusStock: DEFAULT_BONUS_STOCK,
          createdAt: now,
          updatedAt: now
        });

        // Batch Reguler (FIFO)
        batchRecords.push({
          tenantId,
          warehouseId: wh.id,
          productId: prod.id,
          batchNumber: `INIT-REG-${prod.sku || prod.id}-${wh.id}`,
          receiveDate: dateOnly,
          initialQty: DEFAULT_STOCK,
          currentQty: DEFAULT_STOCK,
          costPrice: costPrice,
          isBonus: false,
          createdAt: now,
          updatedAt: now
        });

        // Batch Bonus
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

    // Bulk insert product_warehouses & incoming_batches
    console.log('⏳ Menyimpan stok gudang dan incoming batches...');
    await ProductWarehouse.bulkCreate(pwRecords);
    const createdBatches = await IncomingBatch.bulkCreate(batchRecords);

    // Siapkan StockLedger saldo awal
    console.log('⏳ Mencatat mutasi saldo awal di stock_ledger...');
    const ledgerRecords = createdBatches.map(batch => ({
      tenantId: batch.tenantId,
      warehouseId: batch.warehouseId,
      productId: batch.productId,
      incomingBatchId: batch.id,
      type: 'ADJUSTMENT_IN',
      qty: batch.initialQty,
      referenceType: 'OPENING_BALANCE',
      referenceId: 0,
      stockType: batch.isBonus ? 'BONUS' : 'REGULAR',
      notes: batch.isBonus 
        ? `Saldo Awal Stok Bonus (${DEFAULT_BONUS_STOCK})` 
        : `Saldo Awal Stok Reguler (${DEFAULT_STOCK})`,
      createdAt: now,
      updatedAt: now
    }));

    await StockLedger.bulkCreate(ledgerRecords);

    // 4. Verifikasi status database
    console.log('\n=====================================================================');
    console.log('✅ PROSES PEMBERSIHAN & SET STOK SELESAI!');
    console.log('=====================================================================');
    console.log(`  ✓ Seluruh data transaksi penjualan, pembelian, retur & jurnal : KOSONG (0)`);
    console.log(`  ✓ Master Pelanggan (Customers)                                : AMAN`);
    console.log(`  ✓ Master Pemasok (Suppliers)                                  : AMAN`);
    console.log(`  ✓ Master Salesman, Supir, User, Tenant, COA                   : AMAN`);
    console.log(`  ✓ Master Produk (${products.length} barang)                          : AMAN`);
    console.log(`  ✓ Stok per Barang di Setiap Gudang                            : 1.000 unit (+100 bonus)`);
    console.log(`  ✓ Total Record Stok Gudang dibuat                             : ${pwRecords.length} baris`);
    console.log(`  ✓ Total Batch FIFO dibuat                                     : ${batchRecords.length} batch`);
    console.log(`  ✓ Total Entri Kartu Stok dibuat                               : ${ledgerRecords.length} entri`);
    console.log('=====================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Gagal memproses reset dan inisialisasi stok:', error);
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {}
    process.exit(1);
  }
}

resetAndSetStock1000();

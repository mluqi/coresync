const { sequelize, Product, Warehouse, ProductWarehouse, IncomingBatch, StockLedger } = require('../models');

async function resetTransactionsAndInitStock() {
  console.log('🚀 Memulai proses pembersihan transaksi dan inisialisasi default stok...\n');

  const tablesToClear = [
    'delivery_manifests',
    'delivery_items',
    'deliveries',
    'sales_order_items',
    'sales_orders',
    'purchase_order_items',
    'purchase_orders',
    'return_items',
    'returns',
    'payments',
    'invoices',
    'stock_transfer_items',
    'stock_transfers',
    'stock_opname_items',
    'stock_opnames',
    'journal_entry_items',
    'journal_entries',
    'stock_ledger',
    'incoming_batches',
    'product_warehouses'
  ];

  try {
    // 1. Kosongkan tabel transaksi
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const table of tablesToClear) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Berhasil mengosongkan tabel transaksi: \`${table}\``);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\`;`);
        console.log(`  ✓ Berhasil menghapus baris tabel: \`${table}\``);
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    // 2. Ambil master data produk dan gudang
    const products = await Product.findAll();
    const warehouses = await Warehouse.findAll();

    console.log(`\n📦 Ditemukan ${products.length} Master Produk dan ${warehouses.length} Gudang.`);

    const mainWarehouse = warehouses.find(w => w.id === 1) || warehouses[0];
    console.log(`🏢 Gudang Utama untuk inisialisasi stok: [ID ${mainWarehouse.id}] ${mainWarehouse.name}`);

    const now = new Date();
    const dateOnly = now.toISOString().split('T')[0];

    let pwCount = 0;
    let batchCount = 0;
    let ledgerCount = 0;

    // 3. Inisialisasi stok di product_warehouses, incoming_batches, dan stock_ledger
    for (const prod of products) {
      const tenantId = prod.tenantId || 1;
      const costPrice = parseFloat(prod.purchasePrice) || 0;

      for (const wh of warehouses) {
        const isMainWh = wh.id === mainWarehouse.id;
        const regStock = isMainWh ? 100 : 0;
        const bonusStock = isMainWh ? 10 : 0;

        await ProductWarehouse.create({
          tenantId,
          productId: prod.id,
          warehouseId: wh.id,
          stock: regStock,
          bonusStock: bonusStock
        });
        pwCount++;

        // Jika gudang utama, buat IncomingBatch & StockLedger
        if (isMainWh) {
          // Batch Reguler
          const regBatch = await IncomingBatch.create({
            tenantId,
            warehouseId: wh.id,
            productId: prod.id,
            batchNumber: `INIT-REG-${prod.sku || prod.id}`,
            receiveDate: dateOnly,
            initialQty: regStock,
            currentQty: regStock,
            costPrice: costPrice,
            isBonus: false
          });
          batchCount++;

          // Ledger Reguler
          await StockLedger.create({
            tenantId,
            warehouseId: wh.id,
            productId: prod.id,
            incomingBatchId: regBatch.id,
            type: 'ADJUSTMENT_IN',
            qty: regStock,
            referenceType: 'OPENING_BALANCE',
            referenceId: 0,
            stockType: 'REGULAR',
            notes: 'Saldo Awal Stok Reguler (Default 100)'
          });
          ledgerCount++;

          // Batch Bonus
          const bonusBatch = await IncomingBatch.create({
            tenantId,
            warehouseId: wh.id,
            productId: prod.id,
            batchNumber: `INIT-BONUS-${prod.sku || prod.id}`,
            receiveDate: dateOnly,
            initialQty: bonusStock,
            currentQty: bonusStock,
            costPrice: 0,
            isBonus: true
          });
          batchCount++;

          // Ledger Bonus
          await StockLedger.create({
            tenantId,
            warehouseId: wh.id,
            productId: prod.id,
            incomingBatchId: bonusBatch.id,
            type: 'ADJUSTMENT_IN',
            qty: bonusStock,
            referenceType: 'OPENING_BALANCE',
            referenceId: 0,
            stockType: 'BONUS',
            notes: 'Saldo Awal Stok Bonus (Default 10)'
          });
          ledgerCount++;
        }
      }
    }

    console.log(`\n✅ Inisialisasi Stok Berhasil:`);
    console.log(`  - Record ProductWarehouse dibuat: ${pwCount}`);
    console.log(`  - Incoming Batches dibuat: ${batchCount}`);
    console.log(`  - Stock Ledger Log dibuat: ${ledgerCount}`);

    // 4. Verifikasi master data tetap aman
    const masterSummary = [];
    const masterTables = [
      'products', 'product_units', 'customers', 'suppliers',
      'salespersons', 'drivers', 'warehouses', 'chart_of_accounts',
      'categories', 'units', 'taxes', 'users'
    ];

    for (const tbl of masterTables) {
      const [res] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${tbl}\`;`);
      masterSummary.push({
        'Master Table': tbl,
        'Status': 'TERJAGA / AMAN',
        'Total Data': res[0].total
      });
    }

    console.log('\n📊 Ringkasan Master Data yang Tersimpan:');
    console.table(masterSummary);

    console.log('\n🎉 Selesai! Data transaksi telah dibersihkan dan semua produk memiliki stok awal default (Reguler: 100, Bonus: 10).');
    process.exit(0);
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat reset data:', error);
    process.exit(1);
  }
}

resetTransactionsAndInitStock();

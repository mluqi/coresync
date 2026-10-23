const { sequelize } = require('./models');

async function clearSoPoInventoryProducts() {
  console.log('🧹 Memulai pembersihan data Transaksi (SO, PO), Pengiriman, Tagihan, Retur, Stock Opname, Mutasi Stok, dan Master Barang (Products)...\n');

  const tablesToClear = [
    // 1. Transaction & Item details
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
    // 2. Stock and ledger
    'stock_opname_items',
    'stock_opnames',
    'stock_ledger',
    'incoming_batches',
    'product_warehouses',
    // 3. Product units and master products
    'product_units',
    'products',
    // 4. Financial journals related to transactions
    'journal_entry_items',
    'journal_entries'
  ];

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    for (const table of tablesToClear) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Berhasil mengosongkan tabel: \`${table}\``);
      } catch (err) {
        // Fallback to DELETE if TRUNCATE fails
        await sequelize.query(`DELETE FROM \`${table}\`;`);
        console.log(`  ✓ Berhasil menghapus baris pada tabel: \`${table}\``);
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n🔍 Memverifikasi jumlah data tabel setelah pembersihan:');
    const verificationResults = [];

    for (const table of tablesToClear) {
      const [res] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${table}\`;`);
      verificationResults.push({
        'Nama Tabel': table,
        'Jumlah Baris': res[0].total
      });
    }

    // Also check preserved master tables
    const preservedTables = ['customers', 'salespersons', 'suppliers', 'users', 'warehouses', 'categories', 'units'];
    const preservedResults = [];
    for (const table of preservedTables) {
      const [res] = await sequelize.query(`SELECT COUNT(*) as total FROM \`${table}\`;`);
      preservedResults.push({
        'Master Tabel (Aman)': table,
        'Jumlah Baris Tersimpan': res[0].total
      });
    }

    console.log('\n📊 Tabel yang Berhasil Dibersihkan:');
    console.table(verificationResults);

    console.log('🛡️ Master Data yang Tetap Terjaga / Aman:');
    console.table(preservedResults);

    console.log('\n🎉 Seluruh data SO, PO, Data Barang, dan Stok berhasil dibersihkan dan siap untuk penginputan baru!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Gagal membersihkan data:', err);
    process.exit(1);
  }
}

clearSoPoInventoryProducts();

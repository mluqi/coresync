const { sequelize, Product, Warehouse, ProductWarehouse } = require('../models');

/**
 * Script untuk Membersihkan Seluruh Data Transaksi Dummy
 * Menjaga seluruh MASTER DATA tetap AMAN:
 * - Tenants, Tenant Modules, Users
 * - Products, Categories, Units, Product Units, Product Suppliers
 * - Customers, Suppliers, Salespersons, Drivers
 * - Warehouses, Taxes, Chart of Accounts
 */
async function clearTransactionalData() {
  console.log('\n===============================================================');
  console.log('🧹 MEMULAI PROSES PEMBERSIHAN DATA TRANSAKSI (RESET KE NOL)');
  console.log('===============================================================\n');

  // Tabel-tabel transaksi yang akan dikosongkan
  const transactionTables = [
    // 1. Transaksi Penjualan & Pengiriman
    'delivery_manifests',
    'delivery_items',
    'deliveries',
    'sales_order_items',
    'sales_orders',

    // 2. Transaksi Pembelian
    'purchase_order_items',
    'purchase_orders',

    // 3. Transaksi Retur
    'return_items',
    'returns',

    // 4. Keuangan, Tagihan & Jurnal
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

    // 6. Log Aktivitas & Akses Dummy
    'activity_logs',
    'access_logs'
  ];

  try {
    // Nonaktifkan pemeriksaan Foreign Key sementara
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    console.log('📌 Mengosongkan tabel transaksi:');
    for (const table of transactionTables) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Berhasil mengosongkan: \`${table}\``);
      } catch (err) {
        // Fallback jika truncate terhalang foreign key
        await sequelize.query(`DELETE FROM \`${table}\`;`);
        console.log(`  ✓ Berhasil menghapus baris: \`${table}\``);
      }
    }

    // Aktifkan kembali pemeriksaan Foreign Key
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n---------------------------------------------------------------');
    console.log('📦 Menyiapkan Record Stok Bersih (Stok = 0) per Gudang...');
    console.log('---------------------------------------------------------------');

    const products = await Product.findAll({ attributes: ['id', 'tenantId', 'name', 'sku'] });
    const warehouses = await Warehouse.findAll({ attributes: ['id', 'tenantId', 'name'] });

    let pwCount = 0;
    const pwRecords = [];

    for (const prod of products) {
      const tenantId = prod.tenantId || 1;
      for (const wh of warehouses) {
        pwRecords.push({
          tenantId,
          productId: prod.id,
          warehouseId: wh.id,
          stock: 0.0000,
          bonusStock: 0.0000,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        pwCount++;
      }
    }

    if (pwRecords.length > 0) {
      await ProductWarehouse.bulkCreate(pwRecords);
      console.log(`  ✓ Berhasil menginisialisasi ${pwCount} baris stok kosong (0) untuk ${products.length} barang di ${warehouses.length} gudang.`);
    }

    // Verifikasi Status Master Data & Transaksi
    console.log('\n===============================================================');
    console.log('📊 STATUS DATA SETELAH PROSES PEMBERSIHAN:');
    console.log('===============================================================');

    const masterTables = [
      { name: 'tenants', label: 'Tenants / Perusahaan' },
      { name: 'users', label: 'Pengguna (Users)' },
      { name: 'products', label: 'Master Barang (Products)' },
      { name: 'categories', label: 'Kategori Barang' },
      { name: 'units', label: 'Satuan Barang' },
      { name: 'customers', label: 'Pelanggan (Customers)' },
      { name: 'suppliers', label: 'Pemasok (Suppliers)' },
      { name: 'salespersons', label: 'Salespersons' },
      { name: 'drivers', label: 'Drivers & Armada' },
      { name: 'warehouses', label: 'Gudang (Warehouses)' },
      { name: 'taxes', label: 'Pajak (Taxes)' },
      { name: 'chart_of_accounts', label: 'Bagan Akun (COA)' }
    ];

    console.log('\n✅ MASTER DATA (AMAN & UTUH):');
    for (const m of masterTables) {
      try {
        const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${m.name}\`;`);
        console.log(`  • ${m.label.padEnd(28)} : ${count} data`);
      } catch (e) {
        // Abaikan jika tabel tidak ada
      }
    }

    console.log('\n✅ DATA TRANSAKSI (BERSIH 0):');
    const sampleCheck = ['sales_orders', 'purchase_orders', 'deliveries', 'invoices', 'payments', 'stock_opnames', 'stock_transfers', 'stock_ledger'];
    for (const t of sampleCheck) {
      const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count FROM \`${t}\`;`);
      console.log(`  • ${t.padEnd(28)} : ${count} data`);
    }

    console.log('\n🎉 PEMBERSIHAN SELESAI! Sistem siap digunakan untuk data riil.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat membersihkan data:', error);
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    } catch (e) {}
    process.exit(1);
  }
}

// Jalankan script
clearTransactionalData();

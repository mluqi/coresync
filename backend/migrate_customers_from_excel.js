/**
 * CLI Migration Script: Import Customer Master Data from Excel (.xlsx / .xls / .csv)
 * Usage: node migrate_customers_from_excel.js [filePath] [tenantId]
 * Example: node migrate_customers_from_excel.js customers.xlsx 1
 */

const path = require('path');
const fs = require('fs');
const { Customer, Salesperson, sequelize } = require('./models');
const { parseCustomerExcel } = require('./utils/customerExcelParser');

async function runCliMigration() {
  const filePath = process.argv[2] || 'customers.xlsx';
  const targetTenantId = parseInt(process.argv[3] || '1');

  console.log(`\n======================================================`);
  console.log(`🚀 CoreSync ERP — Migrasi Master Pelanggan dari Excel`);
  console.log(`======================================================`);
  console.log(`📁 File Excel Target : ${filePath}`);
  console.log(`🏢 Tenant ID Target  : ${targetTenantId}\n`);

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File tidak ditemukan di: ${resolvedPath}`);
    console.log(`\nPetunjuk: Letakkan file Excel Anda di folder backend atau berikan path lengkap.`);
    console.log(`Contoh: node migrate_customers_from_excel.js ./data_pelanggan.xlsx 1\n`);
    process.exit(1);
  }

  try {
    console.log(`⏳ Membaca dan menganalisis file Excel...`);
    const customers = parseCustomerExcel(resolvedPath);
    console.log(`📊 Berhasil mengekstrak ${customers.length} data calon pelanggan!\n`);

    if (customers.length === 0) {
      console.log(`⚠️ Tidak ada data pelanggan yang ditemukan dalam file.`);
      process.exit(0);
    }

    // Preview 2 data pertama
    console.log(`🔍 Contoh Data Pertama:`);
    console.log(JSON.stringify(customers[0], null, 2));

    // Pre-fetch salespersons
    const salespersons = await Salesperson.findAll({ where: { tenantId: targetTenantId } });
    const spMapByName = new Map();
    const spMapByCode = new Map();
    salespersons.forEach(sp => {
      spMapByName.set(sp.name.trim().toLowerCase(), sp);
      if (sp.id) spMapByCode.set(String(sp.id), sp);
    });

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    console.log(`\n⏳ Memulai proses penyimpanan ke database MySQL...`);

    for (let i = 0; i < customers.length; i++) {
      const row = customers[i];
      try {
        if (!row.name || !row.name.trim()) continue;

        // Match salesperson: map salespersonCode directly into salespersonId if numeric
        let matchedSpId = row.salespersonId || null;
        if (row.salespersonCode) {
          const cleanCode = String(row.salespersonCode).replace(/[^0-9]/g, '');
          if (cleanCode) matchedSpId = parseInt(cleanCode);
        }
        if (!matchedSpId && row.salespersonName) {
          const sp = spMapByName.get(row.salespersonName.trim().toLowerCase());
          if (sp) matchedSpId = sp.id;
        }

        // Find existing strictly by code or legacyCode
        let existing = null;
        if (row.code && String(row.code).trim()) {
          existing = await Customer.findOne({ where: { tenantId: targetTenantId, code: String(row.code).trim() } });
        }
        if (!existing && row.legacyCode && String(row.legacyCode).trim()) {
          existing = await Customer.findOne({ where: { tenantId: targetTenantId, legacyCode: String(row.legacyCode).trim() } });
        }

        if (existing) {
          await existing.update({
            ...row,
            salespersonId: matchedSpId || existing.salespersonId
          });
          updatedCount++;
        } else {
          let code = row.code;
          if (!code) {
            const cnt = await Customer.count({ where: { tenantId: targetTenantId } });
            code = `CUST-${String(cnt + 1).padStart(6, '0')}`;
          }

          await Customer.create({
            ...row,
            tenantId: targetTenantId,
            code,
            salespersonId: matchedSpId || null
          });
          createdCount++;
        }

        if ((i + 1) % 50 === 0 || i + 1 === customers.length) {
          process.stdout.write(`\r  Progress: ${i + 1}/${customers.length} data diproses...`);
        }
      } catch (err) {
        errorCount++;
        console.error(`\n  ❌ Gagal pada baris #${i + 1} (${row.name}):`, err.message);
      }
    }

    console.log(`\n\n======================================================`);
    console.log(`🎉 MIGRASI EXCEL SELESAI DENGAN SUKSES!`);
    console.log(`======================================================`);
    console.log(`✅ Data Baru Masuk : ${createdCount}`);
    console.log(`🔄 Data Diperbarui : ${updatedCount}`);
    console.log(`⚠️ Gagal / Lewat   : ${errorCount}`);
    console.log(`📊 Total Database  : ${createdCount + updatedCount} pelanggan siap digunakan.`);
    console.log(`======================================================\n`);

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error dalam proses migrasi Excel:`, err);
    process.exit(1);
  }
}

runCliMigration();

const { sequelize, Customer } = require('./models');

/**
 * Re-numbers customer codes to format CUST-000001, CUST-000002, ...
 * sorted ascending by the current code (and id).
 */
async function reformatCustomerCodes(targetTenantId = null) {
  const transaction = await sequelize.transaction();
  try {
    console.log('🔄 Memulai pembaruan format kode pelanggan menjadi C-TGL-000001 dst...');

    let tenantFilter = '';
    const replacements = {};
    if (targetTenantId) {
      tenantFilter = 'WHERE tenant_id = :tenantId';
      replacements.tenantId = targetTenantId;
    }

    // Get all tenants or target tenant
    const [tenants] = await sequelize.query(`
      SELECT DISTINCT tenant_id FROM customers ${tenantFilter} ORDER BY tenant_id ASC;
    `, { replacements, transaction });

    let totalUpdated = 0;

    for (const t of tenants) {
      const tenantId = t.tenant_id;
      console.log(`\n🏢 Memproses Tenant ID: ${tenantId}...`);

      // Fetch all customers for this tenant sorted by code ASC, id ASC
      const [customers] = await sequelize.query(`
        SELECT id, code, legacy_code, name 
        FROM customers 
        WHERE tenant_id = :tenantId 
        ORDER BY 
          CASE WHEN code IS NULL OR code = '' THEN 1 ELSE 0 END,
          code ASC, 
          id ASC;
      `, { replacements: { tenantId }, transaction });

      console.log(`  📊 Ditemukan ${customers.length} data pelanggan untuk diurutkan.`);

      // Update in chunks using batch CASE WHEN statements for extreme speed and efficiency
      const CHUNK_SIZE = 500;
      for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
        const chunk = customers.slice(i, i + CHUNK_SIZE);
        const casesCode = [];
        const casesLegacy = [];
        const ids = [];

        chunk.forEach((cust, indexInChunk) => {
          const globalIndex = i + indexInChunk + 1;
          const newCode = `C-TGL-${String(globalIndex).padStart(6, '0')}`;
          const currentCode = cust.code || '';
          const currentLegacy = cust.legacy_code || '';
          // Retain legacy code as the original code if legacy_code was empty or matched current code
          const finalLegacy = currentLegacy || currentCode;

          ids.push(cust.id);
          casesCode.push(`WHEN id = ${cust.id} THEN '${newCode}'`);
          casesLegacy.push(`WHEN id = ${cust.id} THEN ${finalLegacy ? `'${finalLegacy.replace(/'/g, "''")}'` : 'NULL'}`);
        });

        const updateSql = `
          UPDATE customers 
          SET 
            code = CASE ${casesCode.join(' ')} END,
            legacy_code = CASE ${casesLegacy.join(' ')} END
          WHERE id IN (${ids.join(',')});
        `;

        await sequelize.query(updateSql, { transaction });
        totalUpdated += chunk.length;
        process.stdout.write(`\r  Progress: ${Math.min(i + CHUNK_SIZE, customers.length)}/${customers.length} pelanggan diperbarui...`);
      }
      console.log(`\n  ✅ Selesai Tenant ID: ${tenantId}`);
    }

    await transaction.commit();
    console.log(`\n🎉 Berhasil memperbarui ${totalUpdated} kode pelanggan ke format C-TGL-000001 dst!`);

    // Verify first and last 5
    const [sample] = await sequelize.query(`
      SELECT id, tenant_id, code, legacy_code, name 
      FROM customers 
      ORDER BY code ASC 
      LIMIT 5;
    `);
    console.log('\n🔍 Contoh 5 Pelanggan Pertama:');
    console.table(sample);

    const [sampleLast] = await sequelize.query(`
      SELECT id, tenant_id, code, legacy_code, name 
      FROM customers 
      ORDER BY code DESC 
      LIMIT 5;
    `);
    console.log('\n🔍 Contoh 5 Pelanggan Terakhir:');
    console.table(sampleLast);

    return totalUpdated;
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Terjadi kesalahan saat reformat kode pelanggan:', err);
    throw err;
  }
}

// If run from command line
if (require.main === module) {
  const targetTenant = process.argv[2] ? parseInt(process.argv[2]) : null;
  reformatCustomerCodes(targetTenant)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { reformatCustomerCodes };

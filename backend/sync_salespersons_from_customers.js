const { sequelize, Salesperson, Customer } = require('./models');

/**
 * Syncs salespersons from distinct customer data, standardizes codes to SLS-0001,
 * and updates the customers table accordingly.
 */
async function syncSalespersonsFromCustomers(targetTenantId = null) {
  const transaction = await sequelize.transaction();
  try {
    console.log('🔄 Memeriksa dan memperbarui tabel salespersons & customers...');

    // 1. Ensure `code` column exists on `salespersons` table
    const [cols] = await sequelize.query("SHOW COLUMNS FROM salespersons LIKE 'code';", { transaction });
    if (cols.length === 0) {
      await sequelize.query("ALTER TABLE salespersons ADD COLUMN code VARCHAR(50) NULL AFTER tenant_id;", { transaction });
      console.log('✅ Kolom `code` berhasil ditambahkan ke tabel salespersons.');
    }

    // 2. Fetch distinct salespersons from customers table
    let tenantFilter = '';
    const replacements = {};
    if (targetTenantId) {
      tenantFilter = 'AND tenant_id = :tenantId';
      replacements.tenantId = targetTenantId;
    }

    const [distinctSalespersons] = await sequelize.query(`
      SELECT 
        tenant_id,
        MIN(salesperson_code) as sample_code,
        TRIM(salesperson_name) as clean_name,
        COUNT(*) as total_customers
      FROM customers 
      WHERE salesperson_name IS NOT NULL 
        AND TRIM(salesperson_name) != '' 
        ${tenantFilter}
      GROUP BY tenant_id, TRIM(salesperson_name)
      ORDER BY tenant_id, CAST(MIN(salesperson_code) AS UNSIGNED), TRIM(salesperson_name);
    `, { replacements, transaction });

    console.log(`📊 Ditemukan ${distinctSalespersons.length} nama salesperson unik dari data customer.\n`);

    const summary = [];
    const tenantCounters = {};

    for (const spData of distinctSalespersons) {
      const tenantId = spData.tenant_id;
      if (!tenantCounters[tenantId]) {
        // Find existing max SLS sequence in this tenant
        const [maxSp] = await sequelize.query(`
          SELECT code FROM salespersons 
          WHERE tenant_id = :tenantId AND code LIKE 'SLS-%' 
          ORDER BY id DESC LIMIT 1;
        `, { replacements: { tenantId }, transaction });

        let startSeq = 0;
        if (maxSp.length > 0 && maxSp[0].code) {
          const match = maxSp[0].code.match(/SLS-(\d+)/);
          if (match) startSeq = parseInt(match[1]);
        }
        tenantCounters[tenantId] = startSeq;
      }

      tenantCounters[tenantId]++;
      const newCode = `SLS-${String(tenantCounters[tenantId]).padStart(4, '0')}`;
      const legacyCode = spData.sample_code || '';
      const name = spData.clean_name;

      // Find or create in salespersons table
      let [salespersonRecord] = await Salesperson.findOrCreate({
        where: {
          tenantId,
          name
        },
        defaults: {
          tenantId,
          code: newCode,
          name,
          commissionRate: 0,
          isActive: true,
          metadata: { legacyCode }
        },
        transaction
      });

      // If code was not set or different, update code
      if (!salespersonRecord.code || salespersonRecord.code !== newCode) {
        await salespersonRecord.update({
          code: newCode,
          metadata: { ...(salespersonRecord.metadata || {}), legacyCode }
        }, { transaction });
      }

      const spId = salespersonRecord.id;

      // Update all customers with this salesperson name
      const [updateResult] = await sequelize.query(`
        UPDATE customers 
        SET 
          salesperson_id = :spId,
          salesperson_code = :newCode,
          salesperson_name = :name
        WHERE tenant_id = :tenantId 
          AND TRIM(salesperson_name) = :name;
      `, {
        replacements: { spId, newCode, name, tenantId },
        transaction
      });

      summary.push({
        Tenant: tenantId,
        'Legacy Code': legacyCode || '—',
        'New Code': newCode,
        'Salesperson Name': name,
        'Salesperson ID (DB)': spId,
        'Customers Linked': spData.total_customers
      });
    }

    await transaction.commit();

    console.log('🎉 Sinkronisasi Salesperson Selesai Berhasil!');
    console.table(summary);

    return summary;
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Terjadi kesalahan saat sinkronisasi:', err);
    throw err;
  }
}

// If run directly from command line
if (require.main === module) {
  const targetTenant = process.argv[2] ? parseInt(process.argv[2]) : null;
  syncSalespersonsFromCustomers(targetTenant)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { syncSalespersonsFromCustomers };

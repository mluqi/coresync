'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Insert Tenants
    await queryInterface.bulkInsert('tenants', [
      {
        id: 1,
        company_name: 'CoreSync Corp (PKP)',
        subdomain: 'coresync',
        tax_status: 'PKP',
        address: 'Jl. Sudirman No. 123, Jakarta',
        phone: '021-123456',
        email: 'info@coresync.com',
        npwp: '01.234.567.8-012.000',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        company_name: 'UMKM Sejahtera (Non-PKP)',
        subdomain: 'sejahtera',
        tax_status: 'NON_PKP',
        address: 'Jl. Merdeka No. 45, Bandung',
        phone: '022-654321',
        email: 'info@sejahtera.com',
        npwp: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // 2. Insert Tenant Modules (Activation)
    await queryInterface.bulkInsert('tenant_modules', [
      // Tenant 1 active modules
      { tenant_id: 1, module_name: 'INVENTORY_FIFO', is_enabled: true, created_at: new Date(), updated_at: new Date() },
      { tenant_id: 1, module_name: 'ACCOUNTING_DOUBLE_ENTRY', is_enabled: true, created_at: new Date(), updated_at: new Date() },
      // Tenant 2 active modules (simplified inventory, no double entry accounting module - only basic cashflow)
      { tenant_id: 2, module_name: 'INVENTORY_FIFO', is_enabled: true, created_at: new Date(), updated_at: new Date() },
      { tenant_id: 2, module_name: 'ACCOUNTING_DOUBLE_ENTRY', is_enabled: false, created_at: new Date(), updated_at: new Date() }
    ]);

    // 3. Insert Taxes
    await queryInterface.bulkInsert('taxes', [
      // Tenant 1
      { id: 1, tenant_id: 1, name: 'PPN 11%', rate: 11.00, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: 2, tenant_id: 1, name: 'Non-PPN', rate: 0.00, is_active: true, created_at: new Date(), updated_at: new Date() },
      // Tenant 2
      { id: 3, tenant_id: 2, name: 'PPN 11%', rate: 11.00, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: 4, tenant_id: 2, name: 'Non-PPN', rate: 0.00, is_active: true, created_at: new Date(), updated_at: new Date() }
    ]);

    // Update default tax for tenants
    await queryInterface.sequelize.query('UPDATE tenants SET default_tax_id = 1 WHERE id = 1');
    await queryInterface.sequelize.query('UPDATE tenants SET default_tax_id = 4 WHERE id = 2');

    // 4. Insert Warehouses
    await queryInterface.bulkInsert('warehouses', [
      // Tenant 1
      { id: 1, tenant_id: 1, name: 'Gudang Utama (Jakarta)', address: 'Kawasan Industri Sunter, Jakarta', is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: 2, tenant_id: 1, name: 'Gudang Cabang (Bandung)', address: 'Kopo Mas, Bandung', is_active: true, created_at: new Date(), updated_at: new Date() },
      // Tenant 2
      { id: 3, tenant_id: 2, name: 'Toko Utama', address: 'Pasar Baru Blok A, Bandung', is_active: true, created_at: new Date(), updated_at: new Date() }
    ]);

    // 5. Insert Users
    await queryInterface.bulkInsert('users', [
      // Tenant 1 Users
      {
        id: 1,
        tenant_id: 1,
        warehouse_id: 1,
        name: 'Admin CoreSync',
        email: 'admin@coresync.com',
        password_hash: hashedPassword,
        role: 'OWNER',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        tenant_id: 1,
        warehouse_id: 1,
        name: 'Staff Gudang CoreSync',
        email: 'staff@coresync.com',
        password_hash: hashedPassword,
        role: 'STAFF',
        created_at: new Date(),
        updated_at: new Date()
      },
      // Tenant 2 Users
      {
        id: 3,
        tenant_id: 2,
        warehouse_id: 3,
        name: 'Owner Sejahtera',
        email: 'owner@sejahtera.com',
        password_hash: hashedPassword,
        role: 'OWNER',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // 6. Insert Chart of Accounts (COA) for both tenants
    const coaData = [];
    const tenants = [1, 2];
    
    tenants.forEach(tId => {
      coaData.push(
        { tenant_id: tId, account_code: '10001', account_name: 'Kas', account_type: 'ASSET', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '10002', account_name: 'Bank', account_type: 'ASSET', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '11001', account_name: 'Piutang Dagang', account_type: 'ASSET', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '12001', account_name: 'Persediaan Barang', account_type: 'ASSET', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '21001', account_name: 'Hutang Dagang', account_type: 'LIABILITY', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '22001', account_name: 'Utang Pajak PPN', account_type: 'LIABILITY', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '30001', account_name: 'Modal Owner', account_type: 'EQUITY', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '40001', account_name: 'Pendapatan Penjualan', account_type: 'REVENUE', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '50001', account_name: 'Harga Pokok Penjualan (HPP)', account_type: 'EXPENSE', is_active: true, created_at: new Date(), updated_at: new Date() },
        { tenant_id: tId, account_code: '60001', account_name: 'Beban Operasional', account_type: 'EXPENSE', is_active: true, created_at: new Date(), updated_at: new Date() }
      );
    });

    await queryInterface.bulkInsert('chart_of_accounts', coaData);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('chart_of_accounts', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('warehouses', null, {});
    // Clear foreign key values in tenants first
    await queryInterface.sequelize.query('UPDATE tenants SET default_tax_id = NULL');
    await queryInterface.bulkDelete('taxes', null, {});
    await queryInterface.bulkDelete('tenant_modules', null, {});
    await queryInterface.bulkDelete('tenants', null, {});
  }
};

/**
 * Script: createSuperAdmin.js
 * Usage: node scripts/createSuperAdmin.js
 * 
 * Creates a SUPERADMIN user in Tenant 1 (CoreSync Corp).
 * SUPERADMIN can impersonate any tenant via X-Tenant-ID header.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { User, Tenant } = require('../models');

const SUPERADMIN_DATA = {
  email: 'superadmin@coresync.com',
  password: 'SuperAdmin@2026',
  name: 'Super Administrator',
  role: 'SUPERADMIN',
  tenantId: 1 // Platform home tenant
};

async function createSuperAdmin() {
  try {
    console.log('🔍 Checking existing SUPERADMIN...');

    // Check if superadmin already exists
    const existing = await User.findOne({
      where: { email: SUPERADMIN_DATA.email }
    });

    if (existing) {
      console.log(`⚠️  SUPERADMIN already exists: ${existing.email} (id: ${existing.id})`);
      console.log('   To reset password, delete the user and re-run this script.');
      process.exit(0);
    }

    // Verify Tenant 1 exists
    const tenant = await Tenant.findByPk(SUPERADMIN_DATA.tenantId);
    if (!tenant) {
      console.error(`❌ Tenant with id=${SUPERADMIN_DATA.tenantId} not found.`);
      console.error('   Please run seeders first: npx sequelize-cli db:seed:all');
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.companyName}`);

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(SUPERADMIN_DATA.password, salt);

    // Create SUPERADMIN
    const user = await User.create({
      tenantId: SUPERADMIN_DATA.tenantId,
      name: SUPERADMIN_DATA.name,
      email: SUPERADMIN_DATA.email,
      passwordHash,
      role: 'SUPERADMIN',
      warehouseId: null,
      metadata: {
        isSuperAdmin: true,
        createdBy: 'system_script'
      }
    });

    console.log('\n✅ SUPERADMIN created successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log(`  Name    : ${user.name}`);
    console.log(`  Email   : ${user.email}`);
    console.log(`  Password: ${SUPERADMIN_DATA.password}`);
    console.log(`  Role    : ${user.role}`);
    console.log(`  Tenant  : ${tenant.companyName} (id: ${tenant.id})`);
    console.log('═══════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change this password after first login!');
    console.log('   Tip: SUPERADMIN can switch between tenants via "Act As" dropdown.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating SUPERADMIN:', error.message);
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('   Email already exists in the database.');
    }
    process.exit(1);
  }
}

createSuperAdmin();

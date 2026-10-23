const bcrypt = require('bcryptjs');
const { Tenant, TenantModule, User, ChartOfAccount, Tax, SalesOrder, sequelize } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// GET /tenant/settings  (any auth'd user, read own tenant)
// ─────────────────────────────────────────────────────────────
exports.getTenantDetails = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.tenantId, {
      include: [{ model: TenantModule, as: 'modules' }]
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const modules = {};
    tenant.modules.forEach(m => { modules[m.moduleName] = m.isEnabled; });

    return res.status(200).json({
      success: true,
      data: {
        id: tenant.id,
        companyName: tenant.companyName,
        subdomain: tenant.subdomain,
        taxStatus: tenant.taxStatus,
        defaultTaxId: tenant.defaultTaxId,
        settings: tenant.settings,
        isActive: tenant.isActive,
        modules
      }
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// PUT /tenant/settings  (OWNER, ADMIN)
// ─────────────────────────────────────────────────────────────
exports.updateTenantDetails = async (req, res, next) => {
  try {
    const { companyName, taxStatus, defaultTaxId, settings } = req.body;

    const tenant = await Tenant.findByPk(req.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    if (companyName) tenant.companyName = companyName;
    if (taxStatus) tenant.taxStatus = taxStatus;
    if (defaultTaxId !== undefined) tenant.defaultTaxId = defaultTaxId || null;
    if (settings) tenant.settings = settings;

    await tenant.save();

    await logActivity(req, {
      action: 'UPDATE',
      module: 'TENANTS',
      description: `Mengubah pengaturan perusahaan: ${tenant.companyName}`,
      metadata: { id: tenant.id, companyName: tenant.companyName, taxStatus: tenant.taxStatus }
    });

    return res.status(200).json({ success: true, message: 'Tenant settings updated.', data: tenant });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// POST /tenant/modules/:moduleName/toggle  (OWNER, ADMIN)
// ─────────────────────────────────────────────────────────────
exports.toggleModule = async (req, res, next) => {
  try {
    const { moduleName } = req.params;
    const { isEnabled } = req.body;

    if (isEnabled === undefined) {
      return res.status(400).json({ success: false, message: 'isEnabled is required.' });
    }

    const [mod, created] = await TenantModule.findOrCreate({
      where: { tenantId: req.tenantId, moduleName },
      defaults: { isEnabled }
    });

    if (!created) { mod.isEnabled = isEnabled; await mod.save(); }

    await logActivity(req, {
      action: 'UPDATE',
      module: 'TENANTS',
      description: `${isEnabled ? 'Mengaktifkan' : 'Menonaktifkan'} modul ${moduleName}`,
      metadata: { moduleName, isEnabled }
    });

    return res.status(200).json({
      success: true,
      message: `Module '${moduleName}' ${isEnabled ? 'enabled' : 'disabled'}.`,
      data: mod
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// GET /tenant  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────
exports.getAllTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({
      include: [
        { model: TenantModule, as: 'modules' },
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'email', 'role'],
          required: false
        }
      ],
      order: [['companyName', 'ASC']]
    });

    // Enrich with modules dict + user count
    const data = tenants.map(t => {
      const modules = {};
      if (t.modules) t.modules.forEach(m => { modules[m.moduleName] = m.isEnabled; });
      return {
        id: t.id,
        companyName: t.companyName,
        subdomain: t.subdomain,
        taxStatus: t.taxStatus,
        email: t.email,
        phone: t.phone,
        address: t.address,
        npwp: t.npwp,
        isActive: t.isActive,
        settings: t.settings,
        metadata: t.metadata,
        createdAt: t.createdAt,
        modules,
        userCount: t.users ? t.users.length : 0
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// GET /tenant/:id  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────
exports.getTenantById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id, {
      include: [
        { model: TenantModule, as: 'modules' },
        {
          model: User,
          as: 'users',
          attributes: ['id', 'name', 'email', 'role', 'createdAt']
        }
      ]
    });

    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const modules = {};
    if (tenant.modules) tenant.modules.forEach(m => { modules[m.moduleName] = m.isEnabled; });

    return res.status(200).json({
      success: true,
      data: { ...tenant.toJSON(), modules }
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// POST /tenant  (SUPERADMIN only) — Create new tenant
// ─────────────────────────────────────────────────────────────
exports.createTenant = async (req, res, next) => {
  try {
    const { companyName, subdomain, taxStatus, email, phone, address, npwp, ownerName, ownerEmail, ownerPassword } = req.body;

    if (!companyName || !subdomain) {
      return res.status(400).json({ success: false, message: 'companyName and subdomain are required.' });
    }

    // Validate subdomain uniqueness
    const subdomainExists = await Tenant.findOne({ where: { subdomain: subdomain.toLowerCase() } });
    if (subdomainExists) {
      return res.status(400).json({ success: false, message: `Subdomain '${subdomain}' is already taken.` });
    }

    // Create tenant
    const tenant = await Tenant.create({
      companyName,
      subdomain: subdomain.toLowerCase(),
      taxStatus: taxStatus || 'NON_PKP',
      email: email || null,
      phone: phone || null,
      address: address || null,
      npwp: npwp || null,
      isActive: true,
      settings: { categories: [] }
    });

    // Create default modules
    const defaultModules = ['INVENTORY_FIFO', 'ACCOUNTING_DOUBLE_ENTRY'];
    await TenantModule.bulkCreate(
      defaultModules.map(moduleName => ({
        tenantId: tenant.id,
        moduleName,
        isEnabled: true
      }))
    );

    // Create default COA for the new tenant
    const coaDefaults = [
      { accountCode: '10001', accountName: 'Kas', accountType: 'ASSET' },
      { accountCode: '10002', accountName: 'Bank', accountType: 'ASSET' },
      { accountCode: '11001', accountName: 'Piutang Dagang', accountType: 'ASSET' },
      { accountCode: '12001', accountName: 'Persediaan Barang', accountType: 'ASSET' },
      { accountCode: '21001', accountName: 'Hutang Dagang', accountType: 'LIABILITY' },
      { accountCode: '22001', accountName: 'Utang Pajak PPN', accountType: 'LIABILITY' },
      { accountCode: '30001', accountName: 'Modal Owner', accountType: 'EQUITY' },
      { accountCode: '40001', accountName: 'Pendapatan Penjualan', accountType: 'REVENUE' },
      { accountCode: '50001', accountName: 'Harga Pokok Penjualan (HPP)', accountType: 'EXPENSE' },
      { accountCode: '60001', accountName: 'Beban Operasional', accountType: 'EXPENSE' }
    ];

    await ChartOfAccount.bulkCreate(
      coaDefaults.map(c => ({ ...c, tenantId: tenant.id, isActive: true }))
    );

    // Create default taxes
    const taxes = await Tax.bulkCreate([
      { tenantId: tenant.id, name: 'PPN 11%', rate: 11.00, isActive: true },
      { tenantId: tenant.id, name: 'Non-PPN', rate: 0.00, isActive: true }
    ]);

    // Set default tax to Non-PPN (rate 0)
    const nonPPNTax = taxes.find(t => t.rate === 0);
    if (nonPPNTax) {
      tenant.defaultTaxId = nonPPNTax.id;
      await tenant.save();
    }

    // Optionally create OWNER user for the tenant
    let ownerUser = null;
    if (ownerName && ownerEmail && ownerPassword) {
      const emailExists = await User.findOne({ where: { email: ownerEmail } });
      if (!emailExists) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(ownerPassword, salt);
        ownerUser = await User.create({
          tenantId: tenant.id,
          name: ownerName,
          email: ownerEmail,
          passwordHash,
          role: 'OWNER'
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Tenant '${tenant.companyName}' created successfully.`,
      data: {
        tenant,
        modules: defaultModules,
        owner: ownerUser ? { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email } : null
      }
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// PUT /tenant/:id  (SUPERADMIN only) — Update any tenant
// ─────────────────────────────────────────────────────────────
exports.updateTenantById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyName, subdomain, taxStatus, email, phone, address, npwp, isActive, settings } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    if (companyName !== undefined) tenant.companyName = companyName;
    if (subdomain !== undefined) tenant.subdomain = subdomain;
    if (taxStatus !== undefined) tenant.taxStatus = taxStatus;
    if (email !== undefined) tenant.email = email;
    if (phone !== undefined) tenant.phone = phone;
    if (address !== undefined) tenant.address = address;
    if (npwp !== undefined) tenant.npwp = npwp;
    if (isActive !== undefined) tenant.isActive = isActive;
    if (settings !== undefined) tenant.settings = settings;

    await tenant.save();
    return res.status(200).json({ success: true, message: 'Tenant updated.', data: tenant });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// POST /tenant/:id/modules/:moduleName/toggle  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────
exports.toggleModuleForTenant = async (req, res, next) => {
  try {
    const { id, moduleName } = req.params;
    const { isEnabled } = req.body;

    if (isEnabled === undefined) {
      return res.status(400).json({ success: false, message: 'isEnabled is required.' });
    }

    const tenant = await Tenant.findByPk(id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    const [mod, created] = await TenantModule.findOrCreate({
      where: { tenantId: id, moduleName },
      defaults: { isEnabled }
    });

    if (!created) { mod.isEnabled = isEnabled; await mod.save(); }

    return res.status(200).json({
      success: true,
      message: `Module '${moduleName}' ${isEnabled ? 'enabled' : 'disabled'} for tenant ${id}.`,
      data: mod
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// GET /tenant/:id/users  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────
exports.getTenantUsers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const users = await User.findAll({
      where: { tenantId: id },
      attributes: { exclude: ['passwordHash'] },
      order: [['name', 'ASC']]
    });
    return res.status(200).json({ success: true, data: users });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────
// GET /tenant/superadmin-dashboard  (SUPERADMIN only)
// ─────────────────────────────────────────────────────────────
exports.getSuperAdminDashboard = async (req, res, next) => {
  try {
    if (req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden. Superadmin role required.' });
    }

    // 1. Tenants summary
    const tenants = await Tenant.findAll({
      include: [
        { model: TenantModule, as: 'modules' },
        { model: User, as: 'users', attributes: ['id'] }
      ]
    });

    const totalTenants = tenants.length;
    const activeTenantsCount = tenants.filter(t => t.isActive).length;
    const totalUsersCount = tenants.reduce((acc, t) => acc + (t.users?.length || 0), 0);

    // Module usage breakdown
    const moduleCounts = {};
    tenants.forEach(t => {
      t.modules?.forEach(m => {
        if (m.isEnabled) {
          moduleCounts[m.moduleName] = (moduleCounts[m.moduleName] || 0) + 1;
        }
      });
    });

    const moduleDistribution = Object.keys(moduleCounts).map(name => ({
      name: name.replace(/_/g, ' '),
      total: moduleCounts[name]
    }));

    // 2. Platform Sales Volume
    const totalPlatformSales = await SalesOrder.sum('totalAmount') || 0;

    // 3. Sales per Tenant (Top 5)
    const tenantSales = await SalesOrder.findAll({
      attributes: [
        'tenantId',
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalSales'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount']
      ],
      group: ['tenantId'],
      order: [[sequelize.literal('totalSales'), 'DESC']],
      limit: 5
    });

    const topTenants = tenantSales.map(ts => {
      const tenantObj = tenants.find(t => t.id === ts.tenantId);
      return {
        name: tenantObj ? tenantObj.companyName : `Tenant #${ts.tenantId}`,
        sales: parseFloat(ts.getDataValue('totalSales') || 0),
        orders: parseInt(ts.getDataValue('orderCount') || 0, 10)
      };
    });

    // Recent 5 registered tenants
    const recentTenants = tenants
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        companyName: t.companyName,
        subdomain: t.subdomain,
        taxStatus: t.taxStatus,
        isActive: t.isActive,
        createdAt: t.createdAt,
        userCount: t.users?.length || 0
      }));

    return res.status(200).json({
      success: true,
      data: {
        kpi: {
          totalTenants,
          activeTenantsCount,
          totalUsersCount,
          totalPlatformSales: parseFloat(totalPlatformSales)
        },
        moduleDistribution,
        topTenants,
        recentTenants
      }
    });

  } catch (error) {
    next(error);
  }
};


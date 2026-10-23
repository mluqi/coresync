'use strict';

module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define('Tenant', {
    companyName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'company_name'
    },
    logoUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'logo_url'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    npwp: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    taxStatus: {
      type: DataTypes.ENUM('PKP', 'NON_PKP'),
      defaultValue: 'NON_PKP',
      allowNull: false,
      field: 'tax_status'
    },
    defaultTaxId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'default_tax_id'
    },
    subdomain: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    settings: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('settings');
        if (!rawValue) return null;
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('settings', null);
        } else if (typeof value === 'object') {
          this.setDataValue('settings', JSON.stringify(value));
        } else {
          this.setDataValue('settings', value);
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    metadata: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        if (!rawValue) return null;
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('metadata', null);
        } else if (typeof value === 'object') {
          this.setDataValue('metadata', JSON.stringify(value));
        } else {
          this.setDataValue('metadata', value);
        }
      }
    }
  }, {
    tableName: 'tenants',
    underscored: true,
    timestamps: true
  });

  Tenant.associate = (models) => {
    Tenant.hasMany(models.User, { foreignKey: 'tenantId', as: 'users' });
    Tenant.hasMany(models.TenantModule, { foreignKey: 'tenantId', as: 'modules' });
    Tenant.hasMany(models.Tax, { foreignKey: 'tenantId', as: 'taxes' });
    Tenant.hasMany(models.Warehouse, { foreignKey: 'tenantId', as: 'warehouses' });
    Tenant.hasMany(models.Customer, { foreignKey: 'tenantId', as: 'customers' });
    Tenant.hasMany(models.Supplier, { foreignKey: 'tenantId', as: 'suppliers' });
    Tenant.hasMany(models.Product, { foreignKey: 'tenantId', as: 'products' });
    Tenant.belongsTo(models.Tax, { foreignKey: 'defaultTaxId', as: 'defaultTax' });
  };

  return Tenant;
};

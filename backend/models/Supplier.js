'use strict';

module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define('Supplier', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    legacyCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'legacy_code'
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    address2: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'address_2'
    },
    phone: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    phone2: {
      type: DataTypes.STRING(25),
      allowNull: true,
      field: 'phone_2'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'shipping_address'
    },
    districtName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'district_name'
    },
    topDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'top_days'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'credit_limit'
    },
    contactPerson: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'contact_person'
    },
    contactPersonPhone: {
      type: DataTypes.STRING(25),
      allowNull: true,
      field: 'contact_person_phone'
    },
    nik: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    npwp: {
      type: DataTypes.STRING(35),
      allowNull: true
    },
    taxName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'tax_name'
    },
    taxAddress1: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'tax_address_1'
    },
    taxAddress2: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'tax_address_2'
    },
    taxCity: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_city'
    },
    taxProvince: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'tax_province'
    },
    priceTier: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'price_tier'
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
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'suppliers',
    underscored: true,
    timestamps: true
  });

  Supplier.associate = (models) => {
    Supplier.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Supplier.hasMany(models.Product, { foreignKey: 'supplierId', as: 'products' });
    Supplier.hasMany(models.ProductSupplier, { foreignKey: 'supplierId', as: 'productSuppliers', onDelete: 'CASCADE' });
    if (models.PurchaseOrder) {
      Supplier.hasMany(models.PurchaseOrder, { foreignKey: 'contactId', as: 'purchaseOrders' });
    }
  };

  return Supplier;
};

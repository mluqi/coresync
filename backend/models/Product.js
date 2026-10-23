'use strict';

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    taxId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'tax_id'
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'karton'
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'selling_price'
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'purchase_price'
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'category_id'
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'supplier_id'
    },
    minStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'min_stock'
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
    tableName: 'products',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'sku'],
        name: 'uq_tenant_sku'
      }
    ]
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Product.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
    Product.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    Product.belongsTo(models.Tax, { foreignKey: 'taxId', as: 'tax' });
    Product.hasMany(models.ProductWarehouse, { foreignKey: 'productId', as: 'warehouseStocks' });
    Product.hasMany(models.IncomingBatch, { foreignKey: 'productId', as: 'batches' });
    Product.hasMany(models.ProductUnit, { foreignKey: 'productId', as: 'units', onDelete: 'CASCADE' });
    Product.hasMany(models.ProductSupplier, { foreignKey: 'productId', as: 'productSuppliers', onDelete: 'CASCADE' });
  };

  return Product;
};

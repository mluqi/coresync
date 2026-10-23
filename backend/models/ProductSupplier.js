'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductSupplier = sequelize.define('ProductSupplier', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'supplier_id'
    },
    supplierProductCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'supplier_product_code'
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'purchase_price'
    },
    minOrderQty: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 1.00,
      field: 'min_order_qty'
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'lead_time_days'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_primary'
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'product_suppliers',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'product_id', 'supplier_id'],
        name: 'uq_product_supplier'
      }
    ]
  });

  ProductSupplier.associate = (models) => {
    ProductSupplier.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    ProductSupplier.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    ProductSupplier.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
  };

  return ProductSupplier;
};

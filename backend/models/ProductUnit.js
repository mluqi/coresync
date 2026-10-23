'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductUnit = sequelize.define('ProductUnit', {
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
    unitName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'unit_name'
    },
    conversionRatio: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1.0000,
      field: 'conversion_ratio'
    },
    isBaseUnit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_base_unit'
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'purchase_price'
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'selling_price'
    }
  }, {
    tableName: 'product_units',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['tenant_id', 'product_id'],
        name: 'idx_tenant_product_unit'
      }
    ]
  });

  ProductUnit.associate = (models) => {
    ProductUnit.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    ProductUnit.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return ProductUnit;
};

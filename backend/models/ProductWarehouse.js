'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProductWarehouse = sequelize.define('ProductWarehouse', {
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
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warehouse_id'
    },
    stock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0.0000
    },
    bonusStock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0.0000,
      field: 'bonus_stock'
    }
  }, {
    tableName: 'product_warehouses',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['product_id', 'warehouse_id'],
        name: 'uq_prod_wh'
      }
    ]
  });

  ProductWarehouse.associate = (models) => {
    ProductWarehouse.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    ProductWarehouse.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    ProductWarehouse.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
  };

  return ProductWarehouse;
};

'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReturnItem = sequelize.define('ReturnItem', {
    returnId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'return_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    qty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    condition: {
      type: DataTypes.ENUM('GOOD', 'DAMAGED'),
      allowNull: false,
      defaultValue: 'GOOD'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'warehouse_id'
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'return_items',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  ReturnItem.associate = (models) => {
    ReturnItem.belongsTo(models.Return, { foreignKey: 'returnId', as: 'return' });
    ReturnItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    ReturnItem.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'targetWarehouse' });
  };

  return ReturnItem;
};

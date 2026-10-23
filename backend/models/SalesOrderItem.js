'use strict';

module.exports = (sequelize, DataTypes) => {
  const SalesOrderItem = sequelize.define('SalesOrderItem', {
    salesOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sales_order_id'
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
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    }
  }, {
    tableName: 'sales_order_items',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  SalesOrderItem.associate = (models) => {
    SalesOrderItem.belongsTo(models.SalesOrder, { foreignKey: 'salesOrderId', as: 'salesOrder' });
    SalesOrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return SalesOrderItem;
};

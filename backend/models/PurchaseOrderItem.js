'use strict';

module.exports = (sequelize, DataTypes) => {
  const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
    purchaseOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'purchase_order_id'
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
    },
    bonusQty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0.0000,
      field: 'bonus_qty'
    },
    bonusUnit: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'bonus_unit'
    }
  }, {
    tableName: 'purchase_order_items',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  PurchaseOrderItem.associate = (models) => {
    PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
    PurchaseOrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    PurchaseOrderItem.hasMany(models.IncomingBatch, { foreignKey: 'purchaseOrderItemId', as: 'batches' });
  };

  return PurchaseOrderItem;
};

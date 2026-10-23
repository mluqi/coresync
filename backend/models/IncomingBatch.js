'use strict';

module.exports = (sequelize, DataTypes) => {
  const IncomingBatch = sequelize.define('IncomingBatch', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warehouse_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    purchaseOrderItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'purchase_order_item_id'
    },
    batchNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'batch_number'
    },
    receiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'receive_date'
    },
    initialQty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      field: 'initial_qty'
    },
    currentQty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      field: 'current_qty'
    },
    costPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'cost_price'
    },
    isBonus: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_bonus'
    }
  }, {
    tableName: 'incoming_batches',
    underscored: true,
    timestamps: true
  });

  IncomingBatch.associate = (models) => {
    IncomingBatch.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    IncomingBatch.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    IncomingBatch.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    IncomingBatch.belongsTo(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderItemId', as: 'purchaseOrderItem' });
  };

  return IncomingBatch;
};

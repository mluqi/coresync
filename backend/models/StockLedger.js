'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockLedger = sequelize.define('StockLedger', {
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
    incomingBatchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'incoming_batch_id'
    },
    type: {
      type: DataTypes.ENUM('IN', 'OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT'),
      allowNull: false
    },
    qty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'reference_type'
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reference_id'
    },
    stockType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'REGULAR',
      field: 'stock_type'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'stock_ledger',
    underscored: true,
    timestamps: true,
    updatedAt: false // Only createdAt is needed for a ledger/audit log
  });

  StockLedger.associate = (models) => {
    StockLedger.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    StockLedger.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    StockLedger.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    StockLedger.belongsTo(models.IncomingBatch, { foreignKey: 'incomingBatchId', as: 'batch' });
  };

  return StockLedger;
};

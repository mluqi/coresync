'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockTransferItem = sequelize.define('StockTransferItem', {
    stockTransferId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'stock_transfer_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    qty: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 1.0000
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    conversionRatio: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
      defaultValue: 1.0000,
      field: 'conversion_ratio'
    },
    sourceStockType: {
      type: DataTypes.STRING(20),
      defaultValue: 'REGULAR',
      allowNull: false,
      field: 'source_stock_type'
    },
    destinationStockType: {
      type: DataTypes.STRING(20),
      defaultValue: 'REGULAR',
      allowNull: false,
      field: 'destination_stock_type'
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'stock_transfer_items',
    underscored: true,
    timestamps: true
  });

  StockTransferItem.associate = (models) => {
    StockTransferItem.belongsTo(models.StockTransfer, { foreignKey: 'stockTransferId', as: 'transfer' });
    StockTransferItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return StockTransferItem;
};

'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockOpnameItem = sequelize.define('StockOpnameItem', {
    stockOpnameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'stock_opname_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    systemQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'system_qty'
    },
    actualQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'actual_qty'
    },
    adjustmentQty: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'adjustment_qty'
    },
    unitName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'unit_name'
    },
    conversionRatio: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true,
      defaultValue: 1.0000,
      field: 'conversion_ratio'
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
    tableName: 'stock_opname_items',
    underscored: true,
    timestamps: true,
    updatedAt: false // Only createdAt is needed
  });

  StockOpnameItem.associate = (models) => {
    StockOpnameItem.belongsTo(models.StockOpname, { foreignKey: 'stockOpnameId', as: 'stockOpname' });
    StockOpnameItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return StockOpnameItem;
};

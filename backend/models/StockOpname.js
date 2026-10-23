'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockOpname = sequelize.define('StockOpname', {
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
    opnameDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'opname_date'
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'COMPLETED'),
      defaultValue: 'DRAFT',
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    opnameNumber: {
      type: DataTypes.VIRTUAL,
      get() {
        const date = this.opnameDate;
        const cleanDate = date ? date.replace(/-/g, '') : '';
        return `OP-${this.warehouseId}-${cleanDate}-${this.id || 'DRAFT'}`;
      }
    }
  }, {
    tableName: 'stock_opnames',
    underscored: true,
    timestamps: true
  });

  StockOpname.associate = (models) => {
    StockOpname.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    StockOpname.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    StockOpname.hasMany(models.StockOpnameItem, { foreignKey: 'stockOpnameId', as: 'items' });
  };

  return StockOpname;
};

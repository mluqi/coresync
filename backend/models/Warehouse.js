'use strict';

module.exports = (sequelize, DataTypes) => {
  const Warehouse = sequelize.define('Warehouse', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    },
    type: {
      type: DataTypes.ENUM('REGULAR', 'QUARANTINE'),
      defaultValue: 'REGULAR',
      allowNull: false
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
    tableName: 'warehouses',
    underscored: true,
    timestamps: true
  });

  Warehouse.associate = (models) => {
    Warehouse.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Warehouse.hasMany(models.ProductWarehouse, { foreignKey: 'warehouseId', as: 'productStocks' });
  };

  return Warehouse;
};

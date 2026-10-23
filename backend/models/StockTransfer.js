'use strict';

module.exports = (sequelize, DataTypes) => {
  const StockTransfer = sequelize.define('StockTransfer', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    transferNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'transfer_number'
    },
    sourceWarehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'source_warehouse_id'
    },
    destinationWarehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'destination_warehouse_id'
    },
    transferDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'transfer_date'
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'),
      defaultValue: 'DRAFT',
      allowNull: false
    },
    transferType: {
      type: DataTypes.STRING(30),
      defaultValue: 'WAREHOUSE',
      allowNull: false,
      field: 'transfer_type'
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
    driverName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'driver_name'
    },
    vehicleNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'vehicle_number'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
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
    tableName: 'stock_transfers',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'transfer_number'],
        name: 'uq_tenant_transfer_number'
      }
    ]
  });

  StockTransfer.associate = (models) => {
    StockTransfer.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    StockTransfer.belongsTo(models.Warehouse, { foreignKey: 'sourceWarehouseId', as: 'sourceWarehouse' });
    StockTransfer.belongsTo(models.Warehouse, { foreignKey: 'destinationWarehouseId', as: 'destinationWarehouse' });
    StockTransfer.hasMany(models.StockTransferItem, { foreignKey: 'stockTransferId', as: 'items', onDelete: 'CASCADE' });
  };

  return StockTransfer;
};

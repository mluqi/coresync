'use strict';

module.exports = (sequelize, DataTypes) => {
  const DeliveryManifest = sequelize.define('DeliveryManifest', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    manifestNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'manifest_number'
    },
    manifestDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'manifest_date'
    },
    driverName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'driver_name'
    },
    vehiclePlate: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'vehicle_plate'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'warehouse_id'
    },
    warehouseName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'warehouse_name'
    },
    deliveryIds: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      field: 'delivery_ids',
      get() {
        const rawValue = this.getDataValue('deliveryIds');
        if (!rawValue) return [];
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return []; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('deliveryIds', JSON.stringify([]));
        } else if (typeof value === 'object') {
          this.setDataValue('deliveryIds', JSON.stringify(value));
        } else {
          this.setDataValue('deliveryIds', value);
        }
      }
    },
    summary: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('summary');
        if (!rawValue) return null;
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('summary', null);
        } else if (typeof value === 'object') {
          this.setDataValue('summary', JSON.stringify(value));
        } else {
          this.setDataValue('summary', value);
        }
      }
    },
    snapshot: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('snapshot');
        if (!rawValue) return null;
        if (typeof rawValue === 'object') return rawValue;
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue('snapshot', null);
        } else if (typeof value === 'object') {
          this.setDataValue('snapshot', JSON.stringify(value));
        } else {
          this.setDataValue('snapshot', value);
        }
      }
    },
    printCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'print_count'
    },
    lastPrintedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_printed_at'
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by_id'
    },
    createdByName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'created_by_name'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE',
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'delivery_manifests',
    underscored: true,
    timestamps: true
  });

  DeliveryManifest.associate = (models) => {
    DeliveryManifest.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    DeliveryManifest.belongsTo(models.User, { foreignKey: 'createdById', as: 'creator' });
    if (models.Warehouse) {
      DeliveryManifest.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    }
  };

  return DeliveryManifest;
};

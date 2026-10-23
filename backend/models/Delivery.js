'use strict';

module.exports = (sequelize, DataTypes) => {
  const Delivery = sequelize.define('Delivery', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    salesOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sales_order_id'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warehouse_id'
    },
    deliveryNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'delivery_number'
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'delivery_date'
    },
    status: {
      type: DataTypes.ENUM('SHIPPED', 'DELIVERED', 'CANCELLED'),
      defaultValue: 'SHIPPED',
      allowNull: false
    },
    driverName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'driver_name'
    },
    vehiclePlate: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'vehicle_plate'
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
    tableName: 'deliveries',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'delivery_number'],
        name: 'uq_tenant_sj'
      }
    ]
  });

  Delivery.associate = (models) => {
    Delivery.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Delivery.belongsTo(models.SalesOrder, { foreignKey: 'salesOrderId', as: 'salesOrder' });
    Delivery.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    Delivery.hasMany(models.DeliveryItem, { foreignKey: 'deliveryId', as: 'items' });
  };

  return Delivery;
};

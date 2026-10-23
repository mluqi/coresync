'use strict';

module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    contactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'contact_id'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warehouse_id'
    },
    poNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'po_number'
    },
    poDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'po_date'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'DRAFT',
      allowNull: false
    },
    taxId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'tax_id'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    taxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'tax_amount'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'total_amount'
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
    tableName: 'purchase_orders',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'po_number'],
        name: 'uq_tenant_po'
      }
    ]
  });

  PurchaseOrder.associate = (models) => {
    PurchaseOrder.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    PurchaseOrder.belongsTo(models.Supplier, { foreignKey: 'contactId', as: 'supplier', constraints: false }); // Supplier
    PurchaseOrder.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    PurchaseOrder.belongsTo(models.Tax, { foreignKey: 'taxId', as: 'tax' });
    PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderId', as: 'items' });
    PurchaseOrder.hasMany(models.Invoice, { foreignKey: 'purchaseOrderId', as: 'bills' });
  };

  return PurchaseOrder;
};

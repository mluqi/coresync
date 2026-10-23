'use strict';

module.exports = (sequelize, DataTypes) => {
  const SalesOrder = sequelize.define('SalesOrder', {
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
    soNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'so_number'
    },
    soDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'so_date'
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
    tableName: 'sales_orders',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'so_number'],
        name: 'uq_tenant_so'
      }
    ]
  });

  SalesOrder.associate = (models) => {
    SalesOrder.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    SalesOrder.belongsTo(models.Customer, { foreignKey: 'contactId', as: 'customer' });
    SalesOrder.belongsTo(models.Tax, { foreignKey: 'taxId', as: 'tax' });
    SalesOrder.hasMany(models.SalesOrderItem, { foreignKey: 'salesOrderId', as: 'items' });
    SalesOrder.hasMany(models.Delivery, { foreignKey: 'salesOrderId', as: 'deliveries' });
    SalesOrder.hasMany(models.Invoice, { foreignKey: 'salesOrderId', as: 'invoices' });
  };

  return SalesOrder;
};

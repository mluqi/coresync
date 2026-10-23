'use strict';

module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    type: {
      type: DataTypes.ENUM('SALES', 'PURCHASE'),
      allowNull: false
    },
    salesOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sales_order_id'
    },
    purchaseOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'purchase_order_id'
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'invoice_number'
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'invoice_date'
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'due_date'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'UNPAID',
      allowNull: false
    },
    taxId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'tax_id'
    },
    taxInvoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'tax_invoice_number'
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
    amountDue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
      field: 'amount_due'
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
    tableName: 'invoices',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'type', 'invoice_number'],
        name: 'uq_tenant_inv'
      }
    ]
  });

  Invoice.associate = (models) => {
    Invoice.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Invoice.belongsTo(models.SalesOrder, { foreignKey: 'salesOrderId', as: 'salesOrder' });
    Invoice.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
    Invoice.belongsTo(models.Tax, { foreignKey: 'taxId', as: 'tax' });
    Invoice.hasMany(models.Payment, { foreignKey: 'invoiceId', as: 'payments' });
    Invoice.hasMany(models.Return, { foreignKey: 'invoiceId', as: 'returns' });
  };

  return Invoice;
};

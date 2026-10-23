'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'invoice_id'
    },
    paymentNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'payment_number'
    },
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'payment_date'
    },
    paymentType: {
      type: DataTypes.ENUM('RECEIPT', 'DISBURSEMENT'),
      allowNull: false,
      field: 'payment_type'
    },
    paymentMethod: {
      type: DataTypes.ENUM('CASH', 'BANK_TRANSFER', 'E_WALLET', 'OTHERS'),
      defaultValue: 'CASH',
      allowNull: false,
      field: 'payment_method'
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'account_id'
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
    tableName: 'payments',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'payment_number'],
        name: 'uq_tenant_pay'
      }
    ]
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Payment.belongsTo(models.Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
    Payment.belongsTo(models.ChartOfAccount, { foreignKey: 'accountId', as: 'account' }); // Account (Kas/Bank) used for payment
  };

  return Payment;
};

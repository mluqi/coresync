'use strict';

module.exports = (sequelize, DataTypes) => {
  const Return = sequelize.define('Return', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'invoice_id'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'warehouse_id'
    },
    type: {
      type: DataTypes.ENUM('SALES_RETURN', 'PURCHASE_RETURN'),
      allowNull: false
    },
    returnNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'return_number'
    },
    returnDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'return_date'
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
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'FORM_ISSUED',
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
    tableName: 'returns',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'return_number'],
        name: 'uq_tenant_ret'
      }
    ]
  });

  Return.associate = (models) => {
    Return.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Return.belongsTo(models.Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
    Return.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    Return.hasMany(models.ReturnItem, { foreignKey: 'returnId', as: 'items' });
  };

  return Return;
};

'use strict';

module.exports = (sequelize, DataTypes) => {
  const JournalEntry = sequelize.define('JournalEntry', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'transaction_date'
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'reference_type'
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reference_id'
    },
    description: {
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
    tableName: 'journal_entries',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  JournalEntry.associate = (models) => {
    JournalEntry.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    JournalEntry.hasMany(models.JournalEntryItem, { foreignKey: 'journalEntryId', as: 'items' });
  };

  return JournalEntry;
};

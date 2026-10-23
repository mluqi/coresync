'use strict';

module.exports = (sequelize, DataTypes) => {
  const JournalEntryItem = sequelize.define('JournalEntryItem', {
    journalEntryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'journal_entry_id'
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'account_id'
    },
    type: {
      type: DataTypes.ENUM('DEBIT', 'CREDIT'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00
    }
  }, {
    tableName: 'journal_entry_items',
    underscored: true,
    timestamps: false // No timestamps needed on line items
  });

  JournalEntryItem.associate = (models) => {
    JournalEntryItem.belongsTo(models.JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });
    JournalEntryItem.belongsTo(models.ChartOfAccount, { foreignKey: 'accountId', as: 'account' });
  };

  return JournalEntryItem;
};

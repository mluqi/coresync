'use strict';

module.exports = (sequelize, DataTypes) => {
  const ChartOfAccount = sequelize.define('ChartOfAccount', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    accountCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'account_code'
    },
    accountName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'account_name'
    },
    accountType: {
      type: DataTypes.ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'),
      allowNull: false,
      field: 'account_type'
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'parent_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    }
  }, {
    tableName: 'chart_of_accounts',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'account_code'],
        name: 'uq_tenant_coa'
      }
    ]
  });

  ChartOfAccount.associate = (models) => {
    ChartOfAccount.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    ChartOfAccount.belongsTo(models.ChartOfAccount, { foreignKey: 'parentId', as: 'parent' });
    ChartOfAccount.hasMany(models.ChartOfAccount, { foreignKey: 'parentId', as: 'subAccounts' });
  };

  return ChartOfAccount;
};

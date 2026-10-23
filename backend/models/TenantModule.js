'use strict';

module.exports = (sequelize, DataTypes) => {
  const TenantModule = sequelize.define('TenantModule', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    moduleName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'module_name'
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_enabled'
    }
  }, {
    tableName: 'tenant_modules',
    underscored: true,
    timestamps: true
  });

  TenantModule.associate = (models) => {
    TenantModule.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  };

  return TenantModule;
};

'use strict';

module.exports = (sequelize, DataTypes) => {
  const Tax = sequelize.define('Tax', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    }
  }, {
    tableName: 'taxes',
    underscored: true,
    timestamps: true
  });

  Tax.associate = (models) => {
    Tax.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  };

  return Tax;
};

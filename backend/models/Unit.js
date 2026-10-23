'use strict';

module.exports = (sequelize, DataTypes) => {
  const Unit = sequelize.define('Unit', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'units',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['tenant_id', 'name'] }
    ]
  });

  Unit.associate = (models) => {
    Unit.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  };

  return Unit;
};

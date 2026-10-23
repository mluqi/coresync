'use strict';

module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    licenseNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'license_number'
    },
    vehicleNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'vehicle_number'
    },
    vehicleType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'vehicle_type'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'drivers',
    underscored: true,
    timestamps: true
  });

  Driver.associate = (models) => {
    Driver.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
  };

  return Driver;
};

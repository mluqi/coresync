'use strict';

module.exports = (sequelize, DataTypes) => {
  const AccessLog = sequelize.define('AccessLog', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'tenant_id'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id'
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    action: {
      type: DataTypes.ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('SUCCESS', 'FAILED'),
      allowNull: false,
      defaultValue: 'SUCCESS'
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    }
  }, {
    tableName: 'access_logs',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  AccessLog.associate = (models) => {
    AccessLog.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    AccessLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return AccessLog;
};

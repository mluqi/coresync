'use strict';

module.exports = (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define('ActivityLog', {
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
    userName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'user_name'
    },
    userRole: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'user_role'
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
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
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'activity_logs',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  ActivityLog.associate = (models) => {
    ActivityLog.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    ActivityLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ActivityLog;
};

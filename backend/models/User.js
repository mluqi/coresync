'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'warehouse_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },
    role: {
      type: DataTypes.ENUM('OWNER', 'ADMIN', 'STAFF', 'SUPERADMIN'),
      defaultValue: 'STAFF',
      allowNull: false
    },
    userToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_token'
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
    tableName: 'users',
    underscored: true,
    timestamps: true
  });

  User.associate = (models) => {
    User.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    User.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
  };

  return User;
};

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    tenantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'tenant_id'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active'
    }
  }, {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['tenant_id']
      },
      {
        unique: true,
        fields: ['tenant_id', 'name'],
        name: 'uq_tenant_category_name'
      }
    ]
  });

  Category.associate = (models) => {
    Category.belongsTo(models.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
    Category.hasMany(models.Product, { foreignKey: 'categoryId', as: 'products' });
  };

  return Category;
};

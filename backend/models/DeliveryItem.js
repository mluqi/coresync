'use strict';

module.exports = (sequelize, DataTypes) => {
  const DeliveryItem = sequelize.define('DeliveryItem', {
    deliveryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'delivery_id'
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id'
    },
    qtyShipped: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      field: 'qty_shipped'
    }
  }, {
    tableName: 'delivery_items',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  DeliveryItem.associate = (models) => {
    DeliveryItem.belongsTo(models.Delivery, { foreignKey: 'deliveryId', as: 'delivery' });
    DeliveryItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  };

  return DeliveryItem;
};

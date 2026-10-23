'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('purchase_order_items');
    if (!tableInfo.discount) {
      await queryInterface.addColumn('purchase_order_items', 'discount', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00,
        after: 'price'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('purchase_order_items');
    if (tableInfo.discount) {
      await queryInterface.removeColumn('purchase_order_items', 'discount');
    }
  }
};

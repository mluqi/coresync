'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('stock_ledger', 'qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('product_warehouses', 'stock', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0.0000
    });

    await queryInterface.changeColumn('incoming_batches', 'initial_qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('incoming_batches', 'current_qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('sales_order_items', 'qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('delivery_items', 'qty_shipped', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('purchase_order_items', 'qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });

    await queryInterface.changeColumn('return_items', 'qty', {
      type: Sequelize.DECIMAL(15, 4),
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('return_items', 'qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('purchase_order_items', 'qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('delivery_items', 'qty_shipped', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('sales_order_items', 'qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('incoming_batches', 'current_qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('incoming_batches', 'initial_qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });

    await queryInterface.changeColumn('product_warehouses', 'stock', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.changeColumn('stock_ledger', 'qty', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};

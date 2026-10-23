'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add 'type' column to warehouses table
    await queryInterface.addColumn('warehouses', 'type', {
      type: Sequelize.ENUM('REGULAR', 'QUARANTINE'),
      allowNull: false,
      defaultValue: 'REGULAR'
    });

    // 2. Add 'condition', 'warehouse_id', and 'reason' columns to return_items table
    await queryInterface.addColumn('return_items', 'condition', {
      type: Sequelize.ENUM('GOOD', 'DAMAGED'),
      allowNull: false,
      defaultValue: 'GOOD'
    });

    await queryInterface.addColumn('return_items', 'warehouse_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'warehouses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('return_items', 'reason', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('return_items', 'reason');
    await queryInterface.removeColumn('return_items', 'warehouse_id');
    await queryInterface.removeColumn('return_items', 'condition');
    await queryInterface.removeColumn('warehouses', 'type');
  }
};

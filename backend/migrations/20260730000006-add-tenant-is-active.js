'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('tenants', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'metadata'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('tenants', 'is_active');
  }
};

"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable(
      "stock_transfer_items",
    );

    if (!tableInfo.unit) {
      await queryInterface.addColumn("stock_transfer_items", "unit", {
        type: Sequelize.STRING(50),
        allowNull: true,
        after: "qty",
      });
    }

    if (!tableInfo.conversion_ratio) {
      await queryInterface.addColumn(
        "stock_transfer_items",
        "conversion_ratio",
        {
          type: Sequelize.DECIMAL(12, 4),
          allowNull: true,
          defaultValue: 1.0,
          after: "unit",
        },
      );
    }

    if (
      tableInfo.qty &&
      tableInfo.qty.type &&
      tableInfo.qty.type.includes("INT")
    ) {
      await queryInterface.changeColumn("stock_transfer_items", "qty", {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 1.0,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable(
      "stock_transfer_items",
    );
    if (tableInfo.conversion_ratio) {
      await queryInterface.removeColumn(
        "stock_transfer_items",
        "conversion_ratio",
      );
    }
    if (tableInfo.unit) {
      await queryInterface.removeColumn("stock_transfer_items", "unit");
    }
  },
};

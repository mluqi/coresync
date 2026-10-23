'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Invoices
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('SALES', 'PURCHASE'),
        allowNull: false
      },
      sales_order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sales_orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      purchase_order_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'purchase_orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      invoice_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'),
        defaultValue: 'UNPAID',
        allowNull: false
      },
      tax_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'taxes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      tax_invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      amount_due: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
    // Add unique constraint for tenant_id, type and invoice_number
    await queryInterface.addIndex('invoices', ['tenant_id', 'type', 'invoice_number'], {
      unique: true,
      name: 'uq_tenant_inv'
    });

    // 2. Returns
    await queryInterface.createTable('returns', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      warehouse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'warehouses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('SALES_RETURN', 'PURCHASE_RETURN'),
        allowNull: false
      },
      return_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      return_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'DRAFT',
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });
    // Add unique constraint for tenant_id and return_number
    await queryInterface.addIndex('returns', ['tenant_id', 'return_number'], {
      unique: true,
      name: 'uq_tenant_ret'
    });

    // 3. ReturnItems
    await queryInterface.createTable('return_items', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      return_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'returns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('return_items');
    await queryInterface.dropTable('returns');
    await queryInterface.dropTable('invoices');
  }
};

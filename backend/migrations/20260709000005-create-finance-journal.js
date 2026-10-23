'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. ChartOfAccounts (Bagan Akun)
    await queryInterface.createTable('chart_of_accounts', {
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
      account_code: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      account_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      account_type: {
        type: Sequelize.ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'),
        allowNull: false
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'chart_of_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
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
    // Add unique constraint for tenant_id and account_code
    await queryInterface.addIndex('chart_of_accounts', ['tenant_id', 'account_code'], {
      unique: true,
      name: 'uq_tenant_coa'
    });

    // 2. Payments (Pembayaran)
    await queryInterface.createTable('payments', {
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
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      payment_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      payment_type: {
        type: Sequelize.ENUM('RECEIPT', 'DISBURSEMENT'),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.ENUM('CASH', 'BANK_TRANSFER', 'E_WALLET', 'OTHERS'),
        defaultValue: 'CASH',
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'chart_of_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
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
    // Add unique constraint for tenant_id and payment_number
    await queryInterface.addIndex('payments', ['tenant_id', 'payment_number'], {
      unique: true,
      name: 'uq_tenant_pay'
    });

    // 3. JournalEntries (Jurnal Umum)
    await queryInterface.createTable('journal_entries', {
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
      transaction_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      reference_type: {
        type: Sequelize.ENUM('INVOICE', 'PAYMENT', 'RETURN', 'STOCK_DELIVERY', 'MANUAL'),
        allowNull: false
      },
      reference_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 4. JournalEntryItems (Detail Baris Jurnal)
    await queryInterface.createTable('journal_entry_items', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      journal_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'journal_entries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'chart_of_accounts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      type: {
        type: Sequelize.ENUM('DEBIT', 'CREDIT'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
      }
    });

    // 5. Add circular reference constraints safely (Tenants -> Taxes)
    await queryInterface.changeColumn('tenants', 'default_tax_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'taxes', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 6. Add circular references to IncomingBatches -> PurchaseOrderItems
    await queryInterface.changeColumn('incoming_batches', 'purchase_order_item_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'purchase_order_items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign keys first to avoid drop restrictions
    await queryInterface.changeColumn('incoming_batches', 'purchase_order_item_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('tenants', 'default_tax_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.dropTable('journal_entry_items');
    await queryInterface.dropTable('journal_entries');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('chart_of_accounts');
  }
};

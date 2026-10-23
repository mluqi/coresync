const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id'],
  exposedHeaders: ['Content-Disposition']
}));
const path = require('path');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'public/uploads')));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const taxRoutes = require('./routes/taxRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const customerRoutes = require('./routes/customerRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const productRoutes = require('./routes/productRoutes');
const stockOpnameRoutes = require('./routes/stockOpnameRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const coaRoutes = require('./routes/coaRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const journalRoutes = require('./routes/journalRoutes');
const reportRoutes = require('./routes/reportRoutes');
const returnRoutes = require('./routes/returnRoutes');
const userRoutes = require('./routes/userRoutes');
const stockLedgerRoutes = require('./routes/stockLedgerRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const salespersonRoutes = require('./routes/salespersonRoutes');
const unitRoutes = require('./routes/unitRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const logRoutes = require('./routes/logRoutes');
const stockTransferRoutes = require('./routes/stockTransferRoutes');
const driverRoutes = require('./routes/driverRoutes');

app.get('/', (req, res) => {
  res.send('OK!');
});

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock-opnames', stockOpnameRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/chart-of-accounts', coaRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/journal-entries', journalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stock-ledger', stockLedgerRoutes);
app.use('/api/stock-transfers', stockTransferRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/salespersons', salespersonRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/logs', logRoutes);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Auto-sync missing columns for critical production stability
    try {
      const queryInterface = sequelize.getQueryInterface();
      const stiCols = await queryInterface.describeTable('stock_transfer_items');
      if (!stiCols.unit) {
        await queryInterface.addColumn('stock_transfer_items', 'unit', {
          type: sequelize.Sequelize.STRING(50),
          allowNull: true,
          after: 'qty'
        });
        console.log('Successfully added unit column to stock_transfer_items table.');
      }
      if (!stiCols.conversion_ratio) {
        await queryInterface.addColumn('stock_transfer_items', 'conversion_ratio', {
          type: sequelize.Sequelize.DECIMAL(12, 4),
          allowNull: true,
          defaultValue: 1.0000,
          after: 'unit'
        });
        console.log('Successfully added conversion_ratio column to stock_transfer_items table.');
      }
      if (stiCols.qty && stiCols.qty.type && stiCols.qty.type.includes('INT')) {
        await queryInterface.changeColumn('stock_transfer_items', 'qty', {
          type: sequelize.Sequelize.DECIMAL(15, 4),
          allowNull: false,
          defaultValue: 1.0000
        });
        console.log('Successfully updated qty column to DECIMAL(15,4) in stock_transfer_items table.');
      }
    } catch (dbErr) {
      console.warn('Notice checking stock_transfer_items table:', dbErr.message);
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error);
    process.exit(1);
  }
}

startServer();

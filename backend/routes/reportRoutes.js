const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware); // All report routes require auth

router.get('/income-statement', reportController.getIncomeStatement);
router.get('/balance-sheet', reportController.getBalanceSheet);
router.get('/general-ledger', reportController.getGeneralLedger);
router.get('/inventory-valuation', reportController.getInventoryValuation);
router.get('/sales-details', reportController.getSalesDetails);
router.get('/purchase-details', reportController.getPurchaseDetails);
router.get('/sales-commission', reportController.getSalesCommission);
router.get('/stock-movements', reportController.getStockMovements);
router.get('/driver-invoices', reportController.getDriverInvoicesReport);
router.get('/tax-report', reportController.getTaxReport);
router.get('/dashboard-summary', reportController.getDashboardSummary);
router.get('/badge-counts', reportController.getBadgeCounts);

module.exports = router;

const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const { processEvidenceImage } = require('../middlewares/pictureMiddleware');

router.use(authMiddleware); // All SO routes require auth

router.get('/', permissionMiddleware('sales_orders.read'), salesOrderController.getAllSalesOrders);
router.get('/export-distribution', permissionMiddleware('sales_orders.read'), salesOrderController.getDistributionSalesExportData);
router.post('/', permissionMiddleware('sales_orders.create'), salesOrderController.createSalesOrder);
router.get('/:id', permissionMiddleware('sales_orders.read'), salesOrderController.getSalesOrderById);
router.post('/:id/payment', permissionMiddleware('sales_orders.update'), processEvidenceImage('evidence'), salesOrderController.recordSalesOrderPayment);
router.put('/:id/terms', permissionMiddleware('sales_orders.update'), salesOrderController.updatePaymentTerms);
router.put('/:id/cancel', permissionMiddleware('sales_orders.update'), salesOrderController.cancelSalesOrder);
router.put('/:id', permissionMiddleware('sales_orders.update'), salesOrderController.updateSalesOrder);
router.delete('/:id', permissionMiddleware('sales_orders.delete'), salesOrderController.deleteSalesOrder);

module.exports = router;

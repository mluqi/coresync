const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const { processEvidenceImage } = require('../middlewares/pictureMiddleware');

router.use(authMiddleware); // All PO routes require auth

router.get('/', permissionMiddleware('purchase_orders.read'), purchaseOrderController.getAllPurchaseOrders);
router.get('/:id', permissionMiddleware('purchase_orders.read'), purchaseOrderController.getPurchaseOrderById);
router.post('/', permissionMiddleware('purchase_orders.create'), purchaseOrderController.createPurchaseOrder);
router.post('/:id/payment', permissionMiddleware('purchase_orders.update'), processEvidenceImage('evidence'), purchaseOrderController.recordPurchaseOrderPayment);
router.put('/:id/approve', permissionMiddleware('purchase_orders.update'), purchaseOrderController.approvePurchaseOrder);
router.put('/:id/reject', permissionMiddleware('purchase_orders.update'), purchaseOrderController.rejectPurchaseOrder);
router.put('/:id/ship', permissionMiddleware('purchase_orders.update'), purchaseOrderController.shipPurchaseOrder);
router.post('/:id/receive', permissionMiddleware('purchase_orders.update'), processEvidenceImage('evidence'), purchaseOrderController.receivePurchaseOrder);
router.put('/:id/complete', permissionMiddleware('purchase_orders.update'), purchaseOrderController.completePurchaseOrder);
router.put('/:id/cancel', permissionMiddleware('purchase_orders.update'), purchaseOrderController.cancelPurchaseOrder);
router.put('/:id', permissionMiddleware('purchase_orders.update'), purchaseOrderController.updatePurchaseOrder);
router.delete('/:id', permissionMiddleware('purchase_orders.delete'), purchaseOrderController.deletePurchaseOrder);

module.exports = router;

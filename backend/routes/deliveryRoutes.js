const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const authMiddleware = require('../middlewares/authMiddleware');

const permissionMiddleware = require('../middlewares/permissionMiddleware');

const { processEvidenceImage } = require('../middlewares/pictureMiddleware');

router.use(authMiddleware); // All delivery routes require auth

router.get('/', permissionMiddleware('deliveries.read'), deliveryController.getAllDeliveries);
router.get('/manifest', permissionMiddleware('deliveries.read'), deliveryController.getDeliveryManifest);
router.get('/available-manifest-deliveries', permissionMiddleware('deliveries.read'), deliveryController.getAvailableDeliveries);
router.get('/manifests', permissionMiddleware('deliveries.read'), deliveryController.getManifestHistory);
router.post('/manifests', permissionMiddleware('deliveries.create'), deliveryController.createDeliveryManifest);
router.get('/manifests/:id', permissionMiddleware('deliveries.read'), deliveryController.getManifestById);
router.put('/manifests/:id', permissionMiddleware('deliveries.update'), deliveryController.updateDeliveryManifest);
router.put('/manifests/:id/status', permissionMiddleware('deliveries.update'), deliveryController.updateManifestStatus);
router.post('/manifests/:id/reprint', permissionMiddleware('deliveries.read'), deliveryController.reprintManifest);
router.delete('/manifests/:id', permissionMiddleware('deliveries.delete'), deliveryController.deleteManifest);
router.post('/', permissionMiddleware('deliveries.create'), processEvidenceImage('evidence'), deliveryController.createDelivery);
router.put('/:id/status', permissionMiddleware('deliveries.update'), processEvidenceImage('evidence'), deliveryController.updateDeliveryStatus);

module.exports = router;


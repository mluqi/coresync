const express = require('express');
const router = express.Router();
const stockTransferController = require('../controllers/stockTransferController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('inventory.read'), stockTransferController.getAllTransfers);
router.get('/:id', permissionMiddleware('inventory.read'), stockTransferController.getTransferById);
router.post('/', permissionMiddleware('inventory.create'), stockTransferController.createTransfer);
router.put('/:id/status', permissionMiddleware('inventory.update'), stockTransferController.updateTransferStatus);
router.delete('/:id', permissionMiddleware('inventory.delete'), stockTransferController.deleteTransfer);

module.exports = router;

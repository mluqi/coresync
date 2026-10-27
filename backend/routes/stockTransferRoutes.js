const express = require('express');
const router = express.Router();
const stockTransferController = require('../controllers/stockTransferController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware(['stock_transfers.read', 'inventory.read']), stockTransferController.getAllTransfers);
router.get('/:id', permissionMiddleware(['stock_transfers.read', 'inventory.read']), stockTransferController.getTransferById);
router.post('/', permissionMiddleware(['stock_transfers.create', 'inventory.create']), stockTransferController.createTransfer);
router.put('/:id/status', permissionMiddleware(['stock_transfers.update', 'inventory.update']), stockTransferController.updateTransferStatus);
router.delete('/:id', permissionMiddleware(['stock_transfers.delete', 'inventory.delete']), stockTransferController.deleteTransfer);

module.exports = router;

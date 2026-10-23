const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const authMiddleware = require('../middlewares/authMiddleware');
const settingsTabMiddleware = require('../middlewares/settingsTabMiddleware');

router.use(authMiddleware); // All warehouse routes require auth

router.get('/', warehouseController.getAllWarehouses);
router.post('/', settingsTabMiddleware('wh'), warehouseController.createWarehouse);
router.put('/:id', settingsTabMiddleware('wh'), warehouseController.updateWarehouse);
router.delete('/:id', settingsTabMiddleware('wh'), warehouseController.deleteWarehouse);

module.exports = router;

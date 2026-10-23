const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('sales.read'), driverController.getAllDrivers);
router.get('/:id', permissionMiddleware('sales.read'), driverController.getDriverById);
router.post('/', permissionMiddleware('sales.create'), driverController.createDriver);
router.put('/:id', permissionMiddleware('sales.update'), driverController.updateDriver);
router.delete('/:id', permissionMiddleware('sales.delete'), driverController.deleteDriver);

module.exports = router;

const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('units.read'), unitController.getAllUnits);
router.post('/', permissionMiddleware('units.create'), unitController.createUnit);
router.put('/:id', permissionMiddleware('units.update'), unitController.updateUnit);
router.delete('/:id', permissionMiddleware('units.delete'), unitController.deleteUnit);

module.exports = router;

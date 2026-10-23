const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('suppliers.read'), supplierController.getAllSuppliers);
router.get('/:id', permissionMiddleware('suppliers.read'), supplierController.getSupplierById);
router.post('/', permissionMiddleware('suppliers.create'), supplierController.createSupplier);
router.put('/:id', permissionMiddleware('suppliers.update'), supplierController.updateSupplier);
router.delete('/:id', permissionMiddleware('suppliers.delete'), supplierController.deleteSupplier);

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

router.use(authMiddleware);

router.get('/', permissionMiddleware('customers.read'), customerController.getAllCustomers);
router.get('/export', permissionMiddleware('customers.read'), customerController.exportCustomersExcel);
router.get('/:id', permissionMiddleware('customers.read'), customerController.getCustomerById);
router.post('/import', permissionMiddleware('customers.create'), upload.single('file'), customerController.importCustomers);
router.post('/', permissionMiddleware('customers.create'), customerController.createCustomer);
router.put('/:id', permissionMiddleware('customers.update'), customerController.updateCustomer);
router.patch('/:id/status', permissionMiddleware('customers.update'), customerController.toggleCustomerStatus);
router.delete('/:id', permissionMiddleware('customers.delete'), customerController.deleteCustomer);

module.exports = router;

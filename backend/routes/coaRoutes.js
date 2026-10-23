const express = require('express');
const router = express.Router();
const coaController = require('../controllers/coaController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware); // All COA routes require auth

router.get('/', permissionMiddleware(['finance.read', 'purchase_orders.read', 'sales_orders.read', 'invoices.read', 'payments.read']), coaController.getAllAccounts);
router.post('/', permissionMiddleware('finance.create'), coaController.createAccount);
router.put('/:id', permissionMiddleware('finance.update'), coaController.updateAccount);
router.delete('/:id', permissionMiddleware('finance.delete'), coaController.deleteAccount);

module.exports = router;

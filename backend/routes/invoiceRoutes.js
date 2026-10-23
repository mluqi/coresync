const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authMiddleware = require('../middlewares/authMiddleware');

const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware); // All invoice routes require auth

router.get('/', permissionMiddleware('invoices.read'), invoiceController.getAllInvoices);
router.post('/', permissionMiddleware('invoices.create'), invoiceController.createInvoice);

module.exports = router;

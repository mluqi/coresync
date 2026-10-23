const express = require('express');
const router = express.Router();
const stockLedgerController = require('../controllers/stockLedgerController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);
router.use(permissionMiddleware('stock_ledger.read'));

router.get('/', stockLedgerController.getAllStockLedgers);

module.exports = router;

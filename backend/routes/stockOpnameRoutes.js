const express = require('express');
const router = express.Router();
const stockOpnameController = require('../controllers/stockOpnameController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware); // All stock opname routes require auth

router.get('/', permissionMiddleware('stock_opname.read'), stockOpnameController.getAllStockOpnames);
router.get('/worksheet-data', permissionMiddleware('stock_opname.read'), stockOpnameController.getWorksheetData);
router.get('/:id', permissionMiddleware('stock_opname.read'), stockOpnameController.getStockOpnameById);
router.post('/', permissionMiddleware('stock_opname.create'), stockOpnameController.createStockOpname);
router.put('/:id', permissionMiddleware('stock_opname.update'), stockOpnameController.updateStockOpname);
router.delete('/:id', permissionMiddleware('stock_opname.delete'), stockOpnameController.deleteStockOpname);
router.post('/:id/finalize', permissionMiddleware('stock_opname.update'), stockOpnameController.finalizeStockOpname);

module.exports = router;

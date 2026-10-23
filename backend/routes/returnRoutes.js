const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const authMiddleware = require('../middlewares/authMiddleware');

const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware); // All return routes require auth

router.get('/', permissionMiddleware('transactions.read'), returnController.getAllReturns);
router.post('/', permissionMiddleware('transactions.create'), returnController.createReturn);
router.get('/:id', permissionMiddleware('transactions.read'), returnController.getReturnById);
router.post('/:id/process-surat', permissionMiddleware('transactions.create'), returnController.processSuratRetur);

module.exports = router;

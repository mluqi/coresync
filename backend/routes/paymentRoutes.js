const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');
const { processEvidenceImage } = require('../middlewares/pictureMiddleware');

router.use(authMiddleware); // All payment routes require auth

router.get('/', permissionMiddleware('finance.read'), paymentController.getAllPayments);
router.post('/', permissionMiddleware('finance.create'), processEvidenceImage('evidence'), paymentController.createPayment);

module.exports = router;

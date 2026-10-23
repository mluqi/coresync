const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const authMiddleware = require('../middlewares/authMiddleware');
const settingsTabMiddleware = require('../middlewares/settingsTabMiddleware');

router.use(authMiddleware); // All tax routes require auth

router.get('/', taxController.getAllTaxes);
router.post('/', settingsTabMiddleware('tx'), taxController.createTax);
router.put('/:id', settingsTabMiddleware('tx'), taxController.updateTax);
router.delete('/:id', settingsTabMiddleware('tx'), taxController.deleteTax);

module.exports = router;

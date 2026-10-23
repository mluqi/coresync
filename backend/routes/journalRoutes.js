const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');
const { processEvidenceImage } = require('../middlewares/pictureMiddleware');

router.use(authMiddleware); // All journal routes require auth

router.get('/', permissionMiddleware('finance.read'), journalController.getAllJournals);
router.post('/', permissionMiddleware('finance.create'), processEvidenceImage('evidence'), journalController.createManualJournal);

module.exports = router;

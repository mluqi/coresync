const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const authMiddleware = require('../middlewares/authMiddleware');

// All log endpoints require authentication
router.use(authMiddleware);

// Activity logs (Audit Trail) - scoped to user's tenant (or global for SUPERADMIN)
router.get('/activity', logController.getActivityLogs);

// Access logs (Login/Logout records) - scoped to user's tenant (or global for SUPERADMIN)
router.get('/access', logController.getAccessLogs);

module.exports = router;

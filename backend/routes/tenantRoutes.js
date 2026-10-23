const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const settingsTabMiddleware = require('../middlewares/settingsTabMiddleware');

router.use(authMiddleware);

// ── Own tenant (any auth'd user) ──────────────────────────────
router.get('/settings', tenantController.getTenantDetails);
router.put('/settings', settingsTabMiddleware('sys'), tenantController.updateTenantDetails);
router.post('/modules/:moduleName/toggle', settingsTabMiddleware('sys'), tenantController.toggleModule);

// ── SUPERADMIN-only routes ────────────────────────────────────
router.get('/', roleMiddleware(['SUPERADMIN']), tenantController.getAllTenants);
router.post('/', roleMiddleware(['SUPERADMIN']), tenantController.createTenant);
router.get('/superadmin-dashboard', roleMiddleware(['SUPERADMIN']), tenantController.getSuperAdminDashboard);
router.get('/:id', roleMiddleware(['SUPERADMIN']), tenantController.getTenantById);
router.put('/:id', roleMiddleware(['SUPERADMIN']), tenantController.updateTenantById);
router.post('/:id/modules/:moduleName/toggle', roleMiddleware(['SUPERADMIN']), tenantController.toggleModuleForTenant);
router.get('/:id/users', roleMiddleware(['SUPERADMIN']), tenantController.getTenantUsers);

module.exports = router;

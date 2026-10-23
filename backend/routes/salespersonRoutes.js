const express = require('express');
const router = express.Router();
const salespersonController = require('../controllers/salespersonController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

// Semua user yang login bisa melihat daftar salesperson (untuk dropdown di SO)
router.get('/', salespersonController.getAllSalespersons);

// CRUD salesperson dengan granular permission (salespersons atau transactions)
router.post('/', permissionMiddleware(['salespersons.create', 'transactions.create']), salespersonController.createSalesperson);
router.put('/:id', permissionMiddleware(['salespersons.update', 'transactions.update']), salespersonController.updateSalesperson);
router.delete('/:id', permissionMiddleware(['salespersons.delete', 'transactions.delete']), salespersonController.deleteSalesperson);

module.exports = router;

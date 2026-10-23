const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const settingsTabMiddleware = require('../middlewares/settingsTabMiddleware');

router.use(authMiddleware);

router.get('/', settingsTabMiddleware('usr'), userController.getAllUsers);
router.post('/', settingsTabMiddleware('usr'), userController.createUser);
router.put('/:id', settingsTabMiddleware('usr'), userController.updateUser);
router.delete('/:id', settingsTabMiddleware('usr'), userController.deleteUser);

module.exports = router;

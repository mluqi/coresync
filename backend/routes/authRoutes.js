const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const { processAvatarImage } = require('../middlewares/pictureMiddleware');

// Public Route
router.post('/login', authController.login);

// Protected Route
router.get('/me', authMiddleware, authController.me);
router.get('/profile', authMiddleware, authController.me);
router.put('/profile', authMiddleware, processAvatarImage('avatar'), authController.updateProfile);
router.put('/change-password', authMiddleware, authController.changePassword);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
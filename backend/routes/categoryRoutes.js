const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

router.use(authMiddleware);

router.get('/', permissionMiddleware('products.read'), categoryController.getAllCategories);
router.get('/:id', permissionMiddleware('products.read'), categoryController.getCategoryById);
router.post('/', permissionMiddleware('products.create'), categoryController.createCategory);
router.put('/:id', permissionMiddleware('products.update'), categoryController.updateCategory);
router.delete('/:id', permissionMiddleware('products.delete'), categoryController.deleteCategory);

module.exports = router;

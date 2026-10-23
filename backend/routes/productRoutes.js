const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const permissionMiddleware = require('../middlewares/permissionMiddleware');

const multer = require('multer');
const { processProductImage } = require('../middlewares/pictureMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

router.use(authMiddleware); // All product routes require auth

router.get('/', permissionMiddleware('products.read'), productController.getAllProducts);
router.get('/next-sku', permissionMiddleware('products.read'), productController.getNextSku);
router.get('/:id', permissionMiddleware('products.read'), productController.getProductById);
router.post('/import', permissionMiddleware('products.create'), upload.single('file'), productController.importProducts);
router.post('/', permissionMiddleware('products.create'), processProductImage('image'), productController.createProduct);
router.put('/:id', permissionMiddleware('products.update'), processProductImage('image'), productController.updateProduct);
router.delete('/:id', permissionMiddleware('products.delete'), productController.deleteProduct);

module.exports = router;

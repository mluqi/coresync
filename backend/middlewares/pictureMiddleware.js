const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Configure multer memory storage
const storage = multer.memoryStorage();

// File filter: Only allow jpg, jpeg, png, svg
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml';

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    return cb(new Error('Hanya file gambar dengan format JPG, JPEG, PNG, dan SVG yang diizinkan!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Middleware function to process single image upload with sharp
const processProductImage = (fieldName = 'image') => {
  const singleUpload = upload.single(fieldName);

  return (req, res, next) => {
    singleUpload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            success: false,
            message: `Ukuran file terlalu besar atau error upload: ${err.message}`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return next();
      }

      try {
        const uploadDir = path.join(__dirname, '../public/uploads/products');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `product-${uniqueSuffix}.jpg`;
        const outputPath = path.join(uploadDir, filename);

        // Compress and resize image using Sharp
        await sharp(req.file.buffer)
          .resize(800, 800, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(outputPath);

        // Attach public URL path to request
        req.uploadedImageUrl = `/uploads/products/${filename}`;
        next();
      } catch (sharpError) {
        console.error('Sharp Image Compression Error:', sharpError);
        return res.status(500).json({
          success: false,
          message: 'Gagal memproses dan mengompresi gambar.'
        });
      }
    });
  };
};

// Middleware function to process avatar image upload with sharp
const processAvatarImage = (fieldName = 'avatar') => {
  const singleUpload = upload.single(fieldName);

  return (req, res, next) => {
    singleUpload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            success: false,
            message: `Ukuran file terlalu besar atau error upload: ${err.message}`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return next();
      }

      try {
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `avatar-${uniqueSuffix}.jpg`;
        const outputPath = path.join(uploadDir, filename);

        // Compress and crop avatar image using Sharp
        await sharp(req.file.buffer)
          .resize(400, 400, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(outputPath);

        // Attach public URL path to request
        req.uploadedImageUrl = `/uploads/avatars/${filename}`;
        next();
      } catch (sharpError) {
        console.error('Sharp Avatar Compression Error:', sharpError);
        return res.status(500).json({
          success: false,
          message: 'Gagal memproses dan mengompresi foto profil.'
        });
      }
    });
  };
};

// Middleware function to process transaction evidence image upload (receipt/payment proof)
const processEvidenceImage = (fieldName = 'evidence') => {
  const singleUpload = upload.single(fieldName);

  return (req, res, next) => {
    singleUpload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            success: false,
            message: `Ukuran file terlalu besar atau error upload: ${err.message}`
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return next();
      }

      try {
        const uploadDir = path.join(__dirname, '../public/uploads/evidence');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `evidence-${uniqueSuffix}.jpg`;
        const outputPath = path.join(uploadDir, filename);

        // Compress image using Sharp with max 1400px width/height preserving receipt readability
        await sharp(req.file.buffer)
          .resize(1400, 1400, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(outputPath);

        // Attach public URL path to request
        req.uploadedImageUrl = `/uploads/evidence/${filename}`;
        next();
      } catch (sharpError) {
        console.error('Sharp Evidence Compression Error:', sharpError);
        return res.status(500).json({
          success: false,
          message: 'Gagal memproses dan mengompresi bukti transaksi.'
        });
      }
    });
  };
};

module.exports = {
  upload,
  processProductImage,
  processAvatarImage,
  processEvidenceImage
};

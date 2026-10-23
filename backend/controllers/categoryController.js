const { Category, Product } = require('../models');
const { Op } = require('sequelize');
const { logActivity } = require('../utils/logger');

exports.getAllCategories = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const whereClause = { tenantId: req.tenantId };

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: q } },
        { code: { [Op.like]: q } }
      ];
    }

    const categories = await Category.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id']
        }
      ],
      order: [['code', 'ASC'], ['name', 'ASC']]
    });

    const data = categories.map(c => {
      const plain = c.get({ plain: true });
      return {
        ...plain,
        productsCount: plain.products ? plain.products.length : 0
      };
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'sku', 'name', 'sellingPrice', 'purchasePrice', 'unit']
        }
      ]
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan.'
      });
    }

    return res.status(200).json({
      success: true,
      data: category
    });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama kategori wajib diisi.'
      });
    }

    const trimmedName = name.trim();

    // Check duplicate name for tenant
    const existing = await Category.findOne({
      where: { tenantId: req.tenantId, name: trimmedName }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Kategori '${trimmedName}' sudah ada.`
      });
    }

    // Generate code in CAT-001 format if not provided
    let finalCode = code ? code.trim().toUpperCase() : '';
    if (!finalCode) {
      const allCat = await Category.findAll({
        where: { tenantId: req.tenantId },
        attributes: ['code']
      });

      let maxNum = 0;
      allCat.forEach(c => {
        if (c.code) {
          const match = c.code.match(/CAT-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });

      finalCode = `CAT-${String(maxNum + 1).padStart(3, '0')}`;
    }

    const category = await Category.create({
      tenantId: req.tenantId,
      name: trimmedName,
      code: finalCode,
      description: description ? description.trim() : null,
      isActive: true
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'CATEGORIES',
      description: `Menambah kategori baru: ${category.name} (${category.code})`,
      metadata: { id: category.id, code: category.code, name: category.name }
    });

    return res.status(201).json({
      success: true,
      message: 'Kategori baru berhasil ditambahkan.',
      data: category
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const category = await Category.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori barang tidak ditemukan.'
      });
    }

    if (name && name.trim() !== category.name) {
      const trimmedName = name.trim();
      const existing = await Category.findOne({
        where: { tenantId: req.tenantId, name: trimmedName, id: { [Op.ne]: id } }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Kategori '${trimmedName}' sudah ada.`
        });
      }
      category.name = trimmedName;
    }

    if (code !== undefined) category.code = code ? code.trim().toUpperCase() : null;
    if (description !== undefined) category.description = description ? description.trim() : null;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    await logActivity(req, {
      action: 'UPDATE',
      module: 'CATEGORIES',
      description: `Mengubah kategori: ${category.name} (${category.code})`,
      metadata: { id: category.id, code: category.code, name: category.name }
    });

    return res.status(200).json({
      success: true,
      message: 'Kategori barang berhasil diperbarui.',
      data: category
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Kategori barang tidak ditemukan.'
      });
    }

    // Check if products are attached
    const productCount = await Product.count({
      where: { tenantId: req.tenantId, categoryId: id }
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Gagal menghapus: Kategori '${category.name}' masih digunakan oleh ${productCount} barang.`
      });
    }

    const deletedCatData = { id: category.id, code: category.code, name: category.name };

    await category.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'CATEGORIES',
      description: `Menghapus kategori: ${deletedCatData.name} (${deletedCatData.code})`,
      metadata: deletedCatData
    });

    return res.status(200).json({
      success: true,
      message: `Kategori '${category.name}' berhasil dihapus.`
    });
  } catch (err) {
    next(err);
  }
};

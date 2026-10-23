const {
  Product,
  Tax,
  ProductWarehouse,
  Warehouse,
  SalesOrder,
  SalesOrderItem,
  PurchaseOrderItem,
  StockLedger,
  ProductUnit,
  ProductSupplier,
  Category,
  Supplier,
  Sequelize,
} = require("../models");
const { Op } = require("sequelize");
const {
  getPaginationParams,
  buildSearchWhere,
  buildPaginationMeta,
} = require("../utils/paginationHelper");
const {
  generateProductSku,
  getNextProductSku,
} = require("../utils/skuGenerator");
const { deleteLocalFile } = require("../utils/fileHelper");
const { logActivity } = require("../utils/logger");
const { computeDiff } = require("../utils/auditHelper");

exports.getAllProducts = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } =
      getPaginationParams(req.query, {
        allowedSortCols: [
          "name",
          "sku",
          "sellingPrice",
          "purchasePrice",
          "stock",
          "createdAt",
        ],
        defaultSortBy: "name",
        defaultSortDir: "ASC",
      });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.categoryId) {
      whereClause.categoryId = req.query.categoryId;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    // Optional filter: taxStatus (PKP / NON_PKP) or taxId
    if (req.query.taxStatus === "PKP" || req.query.isPkp === "true") {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        Sequelize.literal(`(
          EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = Product.tax_id 
              AND taxes.rate > 0 
              AND taxes.name NOT LIKE '%Non%'
          )
        )`),
      ];
    } else if (
      req.query.taxStatus === "NON_PKP" ||
      req.query.isPkp === "false"
    ) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        Sequelize.literal(`(
          Product.tax_id IS NULL OR EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = Product.tax_id 
              AND (taxes.rate = 0 OR taxes.name LIKE '%Non%')
          )
        )`),
      ];
    } else if (req.query.taxId) {
      whereClause.taxId = req.query.taxId;
    }

    // Optional filter: categoryId or category name
    if (req.query.categoryId) {
      whereClause.categoryId = req.query.categoryId;
    } else if (req.query.category) {
      const cat = req.query.category.trim();
      if (cat) {
        if (!isNaN(parseInt(cat))) {
          whereClause.categoryId = parseInt(cat);
        } else {
          whereClause[Op.or] = [
            { "$category.name$": cat },
            { metadata: { [Op.like]: `%"category":"${cat}"%` } },
          ];
        }
      }
    }

    // Optional filter: supplierId or supplier name
    if (req.query.supplierId) {
      const supId = parseInt(req.query.supplierId);
      if (req.query.includeUnassigned === "true") {
        whereClause[Op.or] = [{ supplierId: supId }, { supplierId: null }];
      } else {
        whereClause.supplierId = supId;
      }
    } else if (req.query.supplier) {
      const sup = req.query.supplier.trim();
      if (sup) {
        if (!isNaN(parseInt(sup))) {
          whereClause.supplierId = parseInt(sup);
        } else {
          whereClause[Op.or] = [
            { "$supplier.name$": sup },
            { metadata: { [Op.like]: `%"supplier":"${sup}"%` } },
          ];
        }
      }
    }

    // Optional filter: lowStock (stock <= min_stock)
    if (req.query.lowStock === "true") {
      whereClause[Op.and] = [
        Sequelize.literal(
          "(SELECT COALESCE(SUM(stock), 0) FROM product_warehouses WHERE product_warehouses.product_id = Product.id) <= Product.min_stock",
        ),
      ];
    }

    let orderClause = [[sortBy, sortDir]];
    if (sortBy === "stock") {
      orderClause = [
        [
          Sequelize.literal(
            "(SELECT COALESCE(SUM(stock), 0) FROM product_warehouses WHERE product_warehouses.product_id = Product.id)",
          ),
          sortDir,
        ],
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where: whereClause,
      include: [
        { model: Category, as: "category", attributes: ["id", "name", "code"] },
        { model: Supplier, as: "supplier", attributes: ["id", "name", "code"] },
        { model: Tax, as: "tax", attributes: ["id", "name", "rate"] },
        { model: ProductUnit, as: "units" },
        {
          model: ProductSupplier,
          as: "productSuppliers",
          include: [
            {
              model: Supplier,
              as: "supplier",
              attributes: ["id", "name", "code", "phone"],
            },
          ],
        },
        {
          model: ProductWarehouse,
          as: "warehouseStocks",
          attributes: ["warehouseId", "stock", "bonusStock"],
          include: [
            { model: Warehouse, as: "warehouse", attributes: ["name"] },
          ],
        },
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true,
    });

    // Calculate pending allocated quantities from active SOs (not yet SHIPPED or CANCELLED)
    const activeSoItems = await SalesOrderItem.findAll({
      attributes: [
        "productId",
        [
          Sequelize.fn("SUM", Sequelize.col("SalesOrderItem.qty")),
          "totalAllocated",
        ],
      ],
      include: [
        {
          model: SalesOrder,
          as: "salesOrder",
          attributes: [],
          where: {
            tenantId: req.tenantId,
            status: { [Op.in]: ["DRAFT", "APPROVED", "CONFIRMED"] },
          },
        },
      ],
      group: ["productId"],
      raw: true,
    });

    const allocatedMap = {};
    for (const item of activeSoItems) {
      allocatedMap[item.productId] = parseFloat(item.totalAllocated) || 0;
    }

    const productData = rows.map((product) => {
      const plain = product.get({ plain: true });
      const img = plain.metadata?.image || plain.metadata?.imageUrl || null;

      // Fallback base unit if no explicit product_units row exists yet
      let unitsList = (plain.units || []).map((u) => ({
        ...u,
        conversionRatio: parseFloat(u.conversionRatio) || 1.0,
        purchasePrice: parseFloat(u.purchasePrice) || 0,
        sellingPrice: parseFloat(u.sellingPrice) || 0,
      }));
      if (unitsList.length === 0) {
        unitsList = [
          {
            id: 0,
            unitName: plain.unit || "karton",
            conversionRatio: 1.0,
            isBaseUnit: true,
            purchasePrice: parseFloat(plain.purchasePrice) || 0,
            sellingPrice: parseFloat(plain.sellingPrice) || 0,
          },
        ];
      }

      const physicalStock = plain.warehouseStocks
        ? plain.warehouseStocks.reduce(
            (sum, s) => sum + parseFloat(s.stock || 0),
            0,
          )
        : 0;
      const physicalBonusStock = plain.warehouseStocks
        ? plain.warehouseStocks.reduce(
            (sum, s) => sum + parseFloat(s.bonusStock || 0),
            0,
          )
        : 0;
      const allocatedStock = allocatedMap[plain.id] || 0;
      const availableStock = Math.max(0, physicalStock - allocatedStock);

      return {
        ...plain,
        image: img,
        units: unitsList,
        totalStock: physicalStock,
        totalBonusStock: physicalBonusStock,
        combinedStock: physicalStock + physicalBonusStock,
        allocatedStock,
        availableStock,
      };
    });

    return res.status(200).json({
      success: true,
      data: productData,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

const syncProductUnits = async (
  tenantId,
  productId,
  unitsPayload,
  defaultUnit,
  defaultSelling,
  defaultPurchase,
) => {
  let parsedUnits = unitsPayload;
  if (typeof unitsPayload === "string") {
    try {
      parsedUnits = JSON.parse(unitsPayload);
    } catch (e) {}
  }

  let unitsToCreate = [];
  const cleanBaseUnit = (defaultUnit || "KRT").trim().toUpperCase();
  const baseSelling = parseFloat(defaultSelling) || 0.0;
  const basePurchase = parseFloat(defaultPurchase) || 0.0;

  if (Array.isArray(parsedUnits) && parsedUnits.length > 0) {
    // Check if base unit is explicitly included in parsedUnits
    const hasExplicitBase = parsedUnits.some(
      (u) =>
        u.isBaseUnit ||
        (u.unitName &&
          u.unitName.toUpperCase() === cleanBaseUnit &&
          (parseFloat(u.conversionRatio) === 1 || !u.conversionRatio)),
    );

    if (!hasExplicitBase) {
      // Add base unit first
      unitsToCreate.push({
        tenantId,
        productId,
        unitName: cleanBaseUnit,
        conversionRatio: 1.0,
        isBaseUnit: true,
        purchasePrice: basePurchase,
        sellingPrice: baseSelling,
      });
    }

    parsedUnits.forEach((u) => {
      let uName = (u.unitName || u.name || "").trim().toUpperCase();
      if (!uName || /^\d+$/.test(uName)) {
        if (u.isBaseUnit) uName = cleanBaseUnit;
        else return; // Skip invalid unit names
      }

      let ratio = parseFloat(u.conversionRatio || u.ratio);
      if (isNaN(ratio) || ratio <= 0) {
        const factor = parseFloat(u.qtyFactor || u.factor);
        if (factor > 0) {
          ratio = 1 / factor;
        } else {
          ratio = u.isBaseUnit ? 1.0 : 1.0;
        }
      }

      const pBuy =
        parseFloat(u.purchasePrice) > 0
          ? parseFloat(u.purchasePrice)
          : ratio === 1
            ? basePurchase
            : Math.round(basePurchase * ratio);
      const pSell =
        parseFloat(u.sellingPrice) > 0
          ? parseFloat(u.sellingPrice)
          : ratio === 1
            ? baseSelling
            : Math.round(baseSelling * ratio);

      const isBase =
        u.isBaseUnit !== undefined
          ? !!u.isBaseUnit
          : ratio === 1 && uName === cleanBaseUnit;

      // Avoid duplicate base unit
      if (isBase && unitsToCreate.some((existing) => existing.isBaseUnit)) {
        return;
      }

      unitsToCreate.push({
        tenantId,
        productId,
        unitName: uName,
        conversionRatio: ratio,
        isBaseUnit: isBase,
        purchasePrice: pBuy,
        sellingPrice: pSell,
      });
    });

    const hasBase = unitsToCreate.some(
      (u) => u.isBaseUnit || u.conversionRatio === 1,
    );
    if (!hasBase && unitsToCreate.length > 0) {
      unitsToCreate[0].isBaseUnit = true;
      unitsToCreate[0].conversionRatio = 1.0;
    }
  } else {
    unitsToCreate = [
      {
        tenantId,
        productId,
        unitName: cleanBaseUnit,
        conversionRatio: 1.0,
        isBaseUnit: true,
        purchasePrice: basePurchase,
        sellingPrice: baseSelling,
      },
    ];
  }

  await ProductUnit.destroy({ where: { productId, tenantId } });
  const createdUnits = await ProductUnit.bulkCreate(unitsToCreate);
  return createdUnits;
};

const syncProductSuppliers = async (
  tenantId,
  productId,
  primarySupplierId,
  suppliersPayload,
  defaultPurchasePrice,
) => {
  let parsedSuppliers = suppliersPayload;
  if (typeof suppliersPayload === "string") {
    try {
      parsedSuppliers = JSON.parse(suppliersPayload);
    } catch (e) {}
  }

  let suppliersToCreate = [];
  const primaryId = primarySupplierId ? parseInt(primarySupplierId) : null;

  if (Array.isArray(parsedSuppliers) && parsedSuppliers.length > 0) {
    suppliersToCreate = parsedSuppliers
      .filter((s) => s && (s.supplierId || s.id))
      .map((s, idx) => {
        const suppId = parseInt(s.supplierId || s.id);
        const isPrimary =
          s.isPrimary !== undefined
            ? !!s.isPrimary
            : primaryId
              ? suppId === primaryId
              : idx === 0;
        return {
          tenantId,
          productId,
          supplierId: suppId,
          supplierProductCode: s.supplierProductCode || s.code || null,
          purchasePrice:
            s.purchasePrice !== undefined && s.purchasePrice !== ""
              ? parseFloat(s.purchasePrice)
              : parseFloat(defaultPurchasePrice) || 0,
          minOrderQty: parseFloat(s.minOrderQty) || 1,
          leadTimeDays: parseInt(s.leadTimeDays) || 0,
          isPrimary,
          notes: s.notes || null,
        };
      });
  }

  // If primarySupplierId is set and not yet in suppliersToCreate, add it as isPrimary = true
  if (primaryId && !suppliersToCreate.some((s) => s.supplierId === primaryId)) {
    suppliersToCreate.unshift({
      tenantId,
      productId,
      supplierId: primaryId,
      supplierProductCode: null,
      purchasePrice: parseFloat(defaultPurchasePrice) || 0,
      minOrderQty: 1,
      leadTimeDays: 0,
      isPrimary: true,
      notes: null,
    });
  }

  // Ensure primary supplier has isPrimary = true if any items exist
  if (suppliersToCreate.length > 0) {
    if (primaryId) {
      suppliersToCreate.forEach((s) => {
        s.isPrimary = s.supplierId === primaryId;
      });
    }
    if (!suppliersToCreate.some((s) => s.isPrimary)) {
      suppliersToCreate[0].isPrimary = true;
    }
  }

  // Remove duplicates by supplierId (prefer primary)
  const uniqueMap = new Map();
  for (const item of suppliersToCreate) {
    if (!uniqueMap.has(item.supplierId) || item.isPrimary) {
      uniqueMap.set(item.supplierId, item);
    }
  }
  const finalSuppliers = Array.from(uniqueMap.values());

  await ProductSupplier.destroy({ where: { productId, tenantId } });
  if (finalSuppliers.length > 0) {
    return await ProductSupplier.bulkCreate(finalSuppliers);
  }
  return [];
};

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: Category, as: "category", attributes: ["id", "name", "code"] },
        {
          model: Supplier,
          as: "supplier",
          attributes: [
            "id",
            "name",
            "code",
            "phone",
            "contactPerson",
            "email",
            "address",
          ],
        },
        { model: Tax, as: "tax", attributes: ["id", "name", "rate"] },
        { model: ProductUnit, as: "units" },
        {
          model: ProductSupplier,
          as: "productSuppliers",
          include: [
            {
              model: Supplier,
              as: "supplier",
              attributes: [
                "id",
                "name",
                "code",
                "phone",
                "contactPerson",
                "email",
                "address",
              ],
            },
          ],
        },
        {
          model: ProductWarehouse,
          as: "warehouseStocks",
          attributes: ["warehouseId", "stock", "bonusStock"],
          include: [
            { model: Warehouse, as: "warehouse", attributes: ["name"] },
          ],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or access denied.",
      });
    }

    const plainProduct = product.get({ plain: true });
    const totalStock = plainProduct.warehouseStocks
      ? plainProduct.warehouseStocks.reduce(
          (sum, item) => sum + parseFloat(item.stock || 0),
          0,
        )
      : 0;
    const totalBonusStock = plainProduct.warehouseStocks
      ? plainProduct.warehouseStocks.reduce(
          (sum, item) => sum + parseFloat(item.bonusStock || 0),
          0,
        )
      : 0;
    const img =
      plainProduct.metadata?.image || plainProduct.metadata?.imageUrl || null;

    let unitsList = (plainProduct.units || []).map((u) => ({
      ...u,
      conversionRatio: parseFloat(u.conversionRatio) || 1.0,
      purchasePrice: parseFloat(u.purchasePrice) || 0,
      sellingPrice: parseFloat(u.sellingPrice) || 0,
    }));
    if (unitsList.length === 0) {
      unitsList = [
        {
          id: 0,
          unitName: plainProduct.unit || "pcs",
          conversionRatio: 1.0,
          isBaseUnit: true,
          purchasePrice: parseFloat(plainProduct.purchasePrice) || 0,
          sellingPrice: parseFloat(plainProduct.sellingPrice) || 0,
        },
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        ...plainProduct,
        image: img,
        units: unitsList,
        totalStock,
        totalBonusStock,
        combinedStock: totalStock + totalBonusStock,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getNextSku = async (req, res, next) => {
  try {
    const nextSku = await getNextProductSku(req.tenantId);
    return res.status(200).json({
      success: true,
      data: { nextSku },
    });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const {
      categoryId,
      supplierId,
      minStock,
      sku,
      name,
      description,
      unit,
      sellingPrice,
      purchasePrice,
      taxId,
      metadata,
      units,
      suppliers,
    } = req.body;

    if (!name || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name and selling price are required.",
      });
    }

    let parsedMetadata = {};
    if (typeof metadata === "string") {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {}
    } else if (metadata && typeof metadata === "object") {
      parsedMetadata = { ...metadata };
    }

    let finalCategoryId = categoryId ? parseInt(categoryId) : null;
    let categoryName = parsedMetadata.category || "";

    if (finalCategoryId) {
      const catObj = await Category.findOne({
        where: { id: finalCategoryId, tenantId: req.tenantId },
      });
      if (catObj) categoryName = catObj.name;
    } else if (categoryName) {
      const catObj = await Category.findOne({
        where: { tenantId: req.tenantId, name: categoryName },
      });
      if (catObj) finalCategoryId = catObj.id;
    }

    let finalSku = sku ? sku.trim() : "";

    if (!finalSku) {
      finalSku = await getNextProductSku(req.tenantId);
    } else {
      const existingSku = await Product.findOne({
        where: { tenantId: req.tenantId, sku: finalSku },
      });

      if (existingSku) {
        return res.status(400).json({
          success: false,
          message: `SKU '${finalSku}' is already in use by another product.`,
        });
      }
    }

    if (taxId) {
      const tax = await Tax.findOne({
        where: { id: taxId, tenantId: req.tenantId },
      });
      if (!tax) {
        return res.status(400).json({
          success: false,
          message: "Invalid tax ID selected.",
        });
      }
    }

    if (req.uploadedImageUrl) {
      parsedMetadata.image = req.uploadedImageUrl;
    } else if (req.body.image) {
      parsedMetadata.image = req.body.image;
    }

    const product = await Product.create({
      tenantId: req.tenantId,
      categoryId: finalCategoryId,
      supplierId: supplierId ? parseInt(supplierId) : null,
      minStock:
        minStock !== undefined && !isNaN(parseInt(minStock))
          ? parseInt(minStock)
          : 10,
      sku: finalSku,
      name,
      description,
      unit: unit || "karton",
      sellingPrice,
      purchasePrice: purchasePrice || 0.0,
      taxId: taxId || null,
      metadata: parsedMetadata,
    });

    // Sync Multi Units
    const createdUnits = await syncProductUnits(
      req.tenantId,
      product.id,
      units,
      unit || "karton",
      sellingPrice,
      purchasePrice || 0,
    );

    // Sync Multi Suppliers
    const createdSuppliers = await syncProductSuppliers(
      req.tenantId,
      product.id,
      product.supplierId,
      suppliers,
      purchasePrice || 0,
    );

    const warehouses = await Warehouse.findAll({
      where: { tenantId: req.tenantId, isActive: true },
    });

    if (warehouses.length > 0) {
      const stockRecords = warehouses.map((wh) => ({
        tenantId: req.tenantId,
        productId: product.id,
        warehouseId: wh.id,
        stock: 0,
      }));
      await ProductWarehouse.bulkCreate(stockRecords);
    }

    const plainRes = product.get({ plain: true });

    await logActivity(req, {
      action: "CREATE",
      module: "PRODUCTS",
      description: `Menambah produk baru: ${product.name} (${product.sku})`,
      metadata: { id: product.id, sku: product.sku, name: product.name },
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: {
        ...plainRes,
        image: parsedMetadata.image || null,
        units: createdUnits,
        suppliers: createdSuppliers,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      supplierId,
      minStock,
      sku,
      name,
      description,
      unit,
      sellingPrice,
      purchasePrice,
      taxId,
      metadata,
      units,
      suppliers,
    } = req.body;

    const product = await Product.findOne({
      where: { id, tenantId: req.tenantId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or access denied.",
      });
    }

    if (sku && sku !== product.sku) {
      const existingSku = await Product.findOne({
        where: { tenantId: req.tenantId, sku },
      });
      if (existingSku) {
        return res.status(400).json({
          success: false,
          message: `SKU '${sku}' is already in use by another product.`,
        });
      }
    }

    if (taxId && taxId !== product.taxId) {
      const tax = await Tax.findOne({
        where: { id: taxId, tenantId: req.tenantId },
      });
      if (!tax) {
        return res.status(400).json({
          success: false,
          message: "Invalid tax ID selected.",
        });
      }
    }

    const oldImage = product.metadata?.image || product.metadata?.imageUrl;

    let currentMetadata = product.metadata || {};
    if (typeof metadata === "string") {
      try {
        currentMetadata = { ...currentMetadata, ...JSON.parse(metadata) };
      } catch (e) {}
    } else if (metadata && typeof metadata === "object") {
      currentMetadata = { ...currentMetadata, ...metadata };
    }

    let finalCategoryId =
      categoryId !== undefined
        ? categoryId
          ? parseInt(categoryId)
          : null
        : product.categoryId;
    if (!finalCategoryId && currentMetadata.category) {
      const catObj = await Category.findOne({
        where: { tenantId: req.tenantId, name: currentMetadata.category },
      });
      if (catObj) finalCategoryId = catObj.id;
    }

    if (req.uploadedImageUrl) {
      currentMetadata.image = req.uploadedImageUrl;
      if (oldImage && oldImage !== req.uploadedImageUrl) {
        deleteLocalFile(oldImage);
      }
    } else if (req.body.image !== undefined) {
      if (req.body.image === "" || req.body.image === null) {
        currentMetadata.image = null;
        if (oldImage) {
          deleteLocalFile(oldImage);
        }
      } else {
        currentMetadata.image = req.body.image;
      }
    }

    const previousData = product.toJSON();

    await product.update({
      categoryId: finalCategoryId,
      supplierId:
        supplierId !== undefined
          ? supplierId
            ? parseInt(supplierId)
            : null
          : product.supplierId,
      minStock:
        minStock !== undefined && !isNaN(parseInt(minStock))
          ? parseInt(minStock)
          : product.minStock,
      sku: sku || product.sku,
      name: name || product.name,
      description:
        description !== undefined ? description : product.description,
      unit: unit || product.unit,
      sellingPrice:
        sellingPrice !== undefined ? sellingPrice : product.sellingPrice,
      purchasePrice:
        purchasePrice !== undefined ? purchasePrice : product.purchasePrice,
      taxId:
        taxId !== undefined ? (taxId ? parseInt(taxId) : null) : product.taxId,
      metadata: currentMetadata,
    });

    // Sync Multi Units if provided or updated
    let updatedUnits = [];
    if (
      units !== undefined ||
      unit !== undefined ||
      sellingPrice !== undefined ||
      purchasePrice !== undefined
    ) {
      updatedUnits = await syncProductUnits(
        req.tenantId,
        product.id,
        units,
        product.unit,
        product.sellingPrice,
        product.purchasePrice,
      );
    } else {
      updatedUnits = await ProductUnit.findAll({
        where: { productId: product.id, tenantId: req.tenantId },
      });
    }

    // Sync Multi Suppliers if provided or updated
    let updatedSuppliers = [];
    if (
      suppliers !== undefined ||
      supplierId !== undefined ||
      purchasePrice !== undefined
    ) {
      updatedSuppliers = await syncProductSuppliers(
        req.tenantId,
        product.id,
        product.supplierId,
        suppliers,
        product.purchasePrice,
      );
    } else {
      updatedSuppliers = await ProductSupplier.findAll({
        where: { productId: product.id, tenantId: req.tenantId },
        include: [
          {
            model: Supplier,
            as: "supplier",
            attributes: ["id", "name", "code", "phone"],
          },
        ],
      });
    }

    const plainRes = product.get({ plain: true });

    const productDiffFields = [
      { field: "name", label: "Nama Produk", type: "TEXT" },
      { field: "sku", label: "SKU / Kode Barang", type: "TEXT" },
      { field: "sellingPrice", label: "Harga Jual", type: "CURRENCY" },
      { field: "purchasePrice", label: "Harga Beli (Modal)", type: "CURRENCY" },
      { field: "minStock", label: "Batas Stok Minimum", type: "NUMBER" },
      { field: "unit", label: "Satuan Dasar", type: "TEXT" },
      { field: "categoryId", label: "Kategori ID", type: "NUMBER" },
      { field: "supplierId", label: "Supplier ID", type: "NUMBER" },
    ];

    const changes = computeDiff(
      previousData,
      product.toJSON(),
      productDiffFields,
    );
    const changeDesc =
      changes.length > 0
        ? `Mengubah produk ${product.name} (${product.sku}): ` +
          changes
            .map(
              (c) =>
                `${c.label} dari ${c.beforeFormatted} ➔ ${c.afterFormatted}`,
            )
            .join(", ")
        : `Mengubah data produk: ${product.name} (${product.sku})`;

    await logActivity(req, {
      action: "UPDATE",
      module: "PRODUCTS",
      description: changeDesc,
      metadata: {
        targetType: "PRODUCT",
        targetId: product.id,
        targetCode: product.sku,
        targetName: product.name,
        changes,
        previous: previousData,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: {
        ...plainRes,
        image: currentMetadata.image || null,
        units: updatedUnits,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      where: { id, tenantId: req.tenantId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or access denied.",
      });
    }

    // Check transaction history (Sales Orders, Purchase Orders, and Stock Ledger)
    const hasSO = await SalesOrderItem.findOne({ where: { productId: id } });
    const hasPO = await PurchaseOrderItem.findOne({ where: { productId: id } });
    const hasLedger = await StockLedger.findOne({ where: { productId: id } });

    if (hasSO || hasPO || hasLedger) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete product with transaction history. Consider editing or clearing metadata instead.",
      });
    }

    const oldImage = product.metadata?.image || product.metadata?.imageUrl;
    const deletedProductData = product.toJSON();

    // Clean up product warehouse links
    await ProductWarehouse.destroy({ where: { productId: id } });

    // Destroy the product
    await product.destroy();

    // Delete image file from server storage
    if (oldImage) {
      deleteLocalFile(oldImage);
    }

    await logActivity(req, {
      action: "DELETE",
      module: "PRODUCTS",
      description: `Menghapus produk: ${deletedProductData.name} (${deletedProductData.sku}) - Harga Jual: Rp ${Number(deletedProductData.sellingPrice).toLocaleString("id-ID")}`,
      metadata: {
        targetType: "PRODUCT",
        targetId: deletedProductData.id,
        targetCode: deletedProductData.sku,
        targetName: deletedProductData.name,
        deletedSnapshot: deletedProductData,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

const { parseProductExcel } = require("../utils/productExcelParser");

exports.importProducts = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "File Excel wajib diunggah.",
      });
    }

    const rawProducts = parseProductExcel(req.file.buffer);

    if (!rawProducts || rawProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Tidak ada data produk yang valid ditemukan di dalam file Excel.",
      });
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // Pre-fetch categories, suppliers, taxes, and active warehouses
    const [categories, suppliers, taxes, warehouses] = await Promise.all([
      Category.findAll({ where: { tenantId: req.tenantId } }),
      Supplier.findAll({ where: { tenantId: req.tenantId } }),
      Tax.findAll({ where: { tenantId: req.tenantId } }),
      Warehouse.findAll({ where: { tenantId: req.tenantId, isActive: true } }),
    ]);

    const catById = new Map();
    const catByCode = new Map();
    const catByName = new Map();
    categories.forEach((c) => {
      catById.set(c.id, c);
      if (c.code) catByCode.set(c.code.trim().toUpperCase(), c);
      catByName.set(c.name.trim().toLowerCase(), c);
    });

    const suppById = new Map();
    const suppByCode = new Map();
    const suppByName = new Map();
    suppliers.forEach((s) => {
      suppById.set(s.id, s);
      if (s.code) suppByCode.set(s.code.trim().toUpperCase(), s);
      suppByName.set(s.name.trim().toLowerCase(), s);
    });

    const defaultCat =
      catByCode.get("CAT-00004") ||
      categories.find((c) => c.name.includes("Lain")) ||
      categories[0];
    const defaultSupp =
      suppByCode.get("SUP-00026") ||
      suppliers.find((s) => s.name.includes("UMUM")) ||
      suppliers[0];
    const defaultTax = taxes.find(
      (t) => parseFloat(t.rate) > 0 && !t.name.toLowerCase().includes("non"),
    );
    const nonTax = taxes.find(
      (t) => parseFloat(t.rate) === 0 || t.name.toLowerCase().includes("non"),
    );
    const defaultWarehouse = warehouses[0] || null;

    for (let i = 0; i < rawProducts.length; i++) {
      const row = rawProducts[i];
      try {
        if (!row.name || !row.name.trim()) continue;

        // 1. Resolve Category
        let categoryObj = null;
        const rawCatId = row.categoryId ? String(row.categoryId).trim() : "";
        const rawCatName = row.category ? String(row.category).trim() : "";

        if (rawCatId && catById.has(parseInt(rawCatId))) {
          categoryObj = catById.get(parseInt(rawCatId));
        } else if (rawCatId && catByCode.has(rawCatId.toUpperCase())) {
          categoryObj = catByCode.get(rawCatId.toUpperCase());
        } else if (rawCatId && catByName.has(rawCatId.toLowerCase())) {
          categoryObj = catByName.get(rawCatId.toLowerCase());
        } else if (rawCatName && catByName.has(rawCatName.toLowerCase())) {
          categoryObj = catByName.get(rawCatName.toLowerCase());
        } else if (rawCatName && catByCode.has(rawCatName.toUpperCase())) {
          categoryObj = catByCode.get(rawCatName.toUpperCase());
        } else if (rawCatName) {
          categoryObj = await Category.create({
            tenantId: req.tenantId,
            name: rawCatName,
            code: rawCatName
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 10),
          });
          catById.set(categoryObj.id, categoryObj);
          catByName.set(rawCatName.toLowerCase(), categoryObj);
        } else {
          categoryObj = defaultCat;
        }

        // 2. Resolve Supplier
        let supplierObj = null;
        const rawSuppId = row.supplierId ? String(row.supplierId).trim() : "";
        const rawSuppName = row.supplier ? String(row.supplier).trim() : "";

        if (rawSuppId && suppById.has(parseInt(rawSuppId))) {
          supplierObj = suppById.get(parseInt(rawSuppId));
        } else if (rawSuppId && suppByCode.has(rawSuppId.toUpperCase())) {
          supplierObj = suppByCode.get(rawSuppId.toUpperCase());
        } else if (rawSuppId && suppByName.has(rawSuppId.toLowerCase())) {
          supplierObj = suppByName.get(rawSuppId.toLowerCase());
        } else if (rawSuppName && suppByName.has(rawSuppName.toLowerCase())) {
          supplierObj = suppByName.get(rawSuppName.toLowerCase());
        } else if (rawSuppName && suppByCode.has(rawSuppName.toUpperCase())) {
          supplierObj = suppByCode.get(rawSuppName.toUpperCase());
        } else {
          supplierObj = defaultSupp;
        }

        // 3. Resolve Tax Status
        const isPkp =
          row.isTaxable === true ||
          (typeof row.isTaxable === "string" &&
            row.isTaxable.toLowerCase().includes("pkp") &&
            !row.isTaxable.toLowerCase().includes("non"));
        const statusPajak = isPkp ? "pkp" : "non pkp";
        const taxId = isPkp ? defaultTax?.id || 1 : nonTax?.id || 2;

        const categoryId = categoryObj ? categoryObj.id : null;
        const supplierId = supplierObj ? supplierObj.id : null;

        // 4. Resolve SKU
        let sku = row.sku ? row.sku.trim() : "";

        // Check if product exists by SKU or by exact Name
        let existingProduct = null;
        if (sku) {
          existingProduct = await Product.findOne({
            where: { tenantId: req.tenantId, sku },
          });
        }
        if (!existingProduct && row.name) {
          existingProduct = await Product.findOne({
            where: { tenantId: req.tenantId, name: row.name.trim() },
          });
        }

        const sellingPrice = parseFloat(row.sellingPrice) || 0;
        const purchasePrice = parseFloat(row.purchasePrice) || 0;
        const minStock =
          row.minStock !== undefined ? parseInt(row.minStock) : 10;
        const unit = row.unit ? row.unit.trim().toUpperCase() : "KRT";

        if (existingProduct) {
          const prevMetadata = existingProduct.metadata || {};
          const metadata = {
            ...prevMetadata,
            supplier: supplierObj ? supplierObj.name : "SUPPLIER UMUM",
            supplierId: supplierObj ? supplierObj.id : 26,
            supplierCode: supplierObj ? supplierObj.code : "SUP-00026",
            kategori: categoryObj ? categoryObj.name : "Lain-lain / Umum",
            category: categoryObj ? categoryObj.name : "Lain-lain / Umum",
            categoryCode: categoryObj ? categoryObj.code : "CAT-00004",
            statusPajak: statusPajak,
          };

          const updatePayload = {
            name: row.name.trim(),
            unit,
            sellingPrice,
            purchasePrice,
            minStock,
            categoryId,
            supplierId,
            taxId,
            metadata,
          };

          if (row.description) updatePayload.description = row.description;

          await existingProduct.update(updatePayload);

          // Sync Multi Units if provided
          if (row.units && row.units.length > 0) {
            await syncProductUnits(
              req.tenantId,
              existingProduct.id,
              row.units,
              unit,
              sellingPrice,
              purchasePrice,
            );
          }

          // Sync Product Supplier
          if (supplierId) {
            await syncProductSuppliers(
              req.tenantId,
              existingProduct.id,
              supplierId,
              [{ supplierId, purchasePrice, isPrimary: true }],
              purchasePrice,
            );
          }

          // Initial stock update if provided and product currently has 0 stock
          if (row.initialStock > 0 && defaultWarehouse) {
            const pw = await ProductWarehouse.findOne({
              where: {
                tenantId: req.tenantId,
                productId: existingProduct.id,
                warehouseId: defaultWarehouse.id,
              },
            });
            if (!pw) {
              await ProductWarehouse.create({
                tenantId: req.tenantId,
                productId: existingProduct.id,
                warehouseId: defaultWarehouse.id,
                stock: row.initialStock,
              });
            }
          }

          updatedCount++;
        } else {
          // Generate SKU if missing
          if (!sku) {
            sku = await getNextProductSku(req.tenantId);
          }

          const metadata = {
            supplier: supplierObj ? supplierObj.name : "SUPPLIER UMUM",
            supplierId: supplierObj ? supplierObj.id : 26,
            supplierCode: supplierObj ? supplierObj.code : "SUP-00026",
            kategori: categoryObj ? categoryObj.name : "Lain-lain / Umum",
            category: categoryObj ? categoryObj.name : "Lain-lain / Umum",
            categoryCode: categoryObj ? categoryObj.code : "CAT-00004",
            statusPajak: statusPajak,
          };

          const newProduct = await Product.create({
            tenantId: req.tenantId,
            categoryId,
            supplierId,
            minStock,
            sku,
            name: row.name.trim(),
            description: row.description || "",
            unit,
            sellingPrice,
            purchasePrice,
            taxId,
            metadata,
          });

          // Sync Multi Units
          await syncProductUnits(
            req.tenantId,
            newProduct.id,
            row.units || [],
            unit,
            sellingPrice,
            purchasePrice,
          );

          // Sync Product Supplier
          if (supplierId) {
            await syncProductSuppliers(
              req.tenantId,
              newProduct.id,
              supplierId,
              [{ supplierId, purchasePrice, isPrimary: true }],
              purchasePrice,
            );
          }

          // Setup initial warehouse stocks
          if (warehouses.length > 0) {
            for (const wh of warehouses) {
              const stock =
                wh.id === defaultWarehouse?.id && row.initialStock > 0
                  ? row.initialStock
                  : 0;
              await ProductWarehouse.create({
                tenantId: req.tenantId,
                productId: newProduct.id,
                warehouseId: wh.id,
                stock,
              });
            }
          }

          createdCount++;
        }
      } catch (err) {
        console.error(`Error processing product row ${i + 1}:`, err);
        errors.push({
          row: i + 2,
          sku: row.sku,
          name: row.name,
          error: err.message,
        });
      }
    }

    await logActivity(req, {
      action: "IMPORT",
      module: "PRODUCTS",
      description: `Import massal master barang: ${createdCount} baru, ${updatedCount} diperbarui dari total ${rawProducts.length} baris`,
      metadata: {
        totalProcessed: rawProducts.length,
        created: createdCount,
        updated: updatedCount,
        errorsCount: errors.length,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Import master barang selesai. ${createdCount} produk baru ditambahkan, ${updatedCount} produk diperbarui.`,
      stats: {
        totalProcessed: rawProducts.length,
        created: createdCount,
        updated: updatedCount,
        errors,
      },
    });
  } catch (error) {
    next(error);
  }
};

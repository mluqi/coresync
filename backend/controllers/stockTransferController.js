const {
  StockTransfer,
  StockTransferItem,
  Warehouse,
  Product,
  ProductWarehouse,
  ProductUnit,
  IncomingBatch,
  StockLedger,
  sequelize,
  Sequelize,
} = require("../models");
const { Op } = Sequelize;
const {
  getPaginationParams,
  buildPaginationMeta,
} = require("../utils/paginationHelper");
const { logActivity } = require("../utils/logger");
const { recordStockIn, recordStockOut } = require("../utils/inventoryEngine");

exports.getAllTransfers = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } =
      getPaginationParams(req.query, {
        allowedSortCols: [
          "transferNumber",
          "transferDate",
          "status",
          "createdAt",
          "transferType",
        ],
        defaultSortBy: "createdAt",
        defaultSortDir: "DESC",
      });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.status) {
      whereClause.status = req.query.status;
    }

    if (req.query.transferType) {
      whereClause.transferType = req.query.transferType;
    }

    if (req.query.sourceWarehouseId) {
      whereClause.sourceWarehouseId = req.query.sourceWarehouseId;
    }

    if (req.query.destinationWarehouseId) {
      whereClause.destinationWarehouseId = req.query.destinationWarehouseId;
    }

    if (search) {
      whereClause[Op.or] = [
        { transferNumber: { [Op.like]: `%${search}%` } },
        { driverName: { [Op.like]: `%${search}%` } },
        { vehicleNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await StockTransfer.findAndCountAll({
      where: whereClause,
      include: [
        { model: Warehouse, as: "sourceWarehouse", attributes: ["id", "name"] },
        {
          model: Warehouse,
          as: "destinationWarehouse",
          attributes: ["id", "name"],
        },
        {
          model: StockTransferItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "sku", "name", "unit", "purchasePrice"],
              include: [
                {
                  model: ProductUnit,
                  as: "units",
                  attributes: [
                    "id",
                    "unitName",
                    "conversionRatio",
                    "isBaseUnit",
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [[sortBy, sortDir]],
      limit,
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: buildPaginationMeta(count, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transfer = await StockTransfer.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        {
          model: Warehouse,
          as: "sourceWarehouse",
          attributes: ["id", "name", "address"],
        },
        {
          model: Warehouse,
          as: "destinationWarehouse",
          attributes: ["id", "name", "address"],
        },
        {
          model: StockTransferItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "sku", "name", "unit", "purchasePrice"],
              include: [
                {
                  model: ProductUnit,
                  as: "units",
                  attributes: [
                    "id",
                    "unitName",
                    "conversionRatio",
                    "isBaseUnit",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Dokumen mutasi transfer tidak ditemukan.",
      });
    }

    return res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    next(error);
  }
};

exports.createTransfer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      sourceWarehouseId,
      destinationWarehouseId,
      transferType = "WAREHOUSE",
      sourceStockType = "REGULAR",
      destinationStockType = "REGULAR",
      transferDate,
      driverName,
      vehicleNumber,
      notes,
      items,
      autoShip,
    } = req.body;

    if (!sourceWarehouseId || !destinationWarehouseId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Gudang asal dan gudang tujuan wajib dipilih.",
      });
    }

    if (
      transferType === "WAREHOUSE" &&
      parseInt(sourceWarehouseId) === parseInt(destinationWarehouseId)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Untuk mutasi antar gudang, gudang asal dan gudang tujuan tidak boleh sama.",
      });
    }

    if (
      transferType === "STOCK_TYPE" &&
      parseInt(sourceWarehouseId) === parseInt(destinationWarehouseId) &&
      sourceStockType === destinationStockType
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Tipe stok asal dan tujuan tidak boleh sama jika berada di gudang yang sama.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Daftar item barang yang ditransfer wajib diisi minimal 1 item.",
      });
    }

    // Auto-generate transfer number TRF-YYYYMMDD-0001
    const todayStr = (
      transferDate || new Date().toISOString().split("T")[0]
    ).replace(/-/g, "");
    const countToday = await StockTransfer.count({
      where: {
        tenantId: req.tenantId,
        createdAt: {
          [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      transaction,
    });
    const transferNumber = `TRF-${todayStr}-${String(countToday + 1).padStart(4, "0")}`;

    const initialStatus = autoShip ? "IN_TRANSIT" : "DRAFT";

    const stockTransfer = await StockTransfer.create(
      {
        tenantId: req.tenantId,
        transferNumber,
        transferType,
        sourceStockType,
        destinationStockType,
        sourceWarehouseId: parseInt(sourceWarehouseId),
        destinationWarehouseId: parseInt(destinationWarehouseId),
        transferDate: transferDate || new Date(),
        status: initialStatus,
        driverName: driverName || null,
        vehicleNumber: vehicleNumber || null,
        notes: notes || null,
      },
      { transaction },
    );

    // Validate and process items
    for (const it of items) {
      const productId = parseInt(it.productId);
      const qty = parseFloat(it.qty);
      const unit = it.unit ? String(it.unit).trim().toUpperCase() : null;
      const conversionRatio = parseFloat(it.conversionRatio) || 1.0;
      const baseQty = qty * conversionRatio;
      const itemSrcType = it.sourceStockType || sourceStockType || "REGULAR";
      const itemDestType =
        it.destinationStockType || destinationStockType || "REGULAR";

      if (!productId || isNaN(qty) || qty <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Kuantitas transfer barang harus berupa angka lebih dari 0.",
        });
      }

      await StockTransferItem.create(
        {
          stockTransferId: stockTransfer.id,
          productId,
          qty,
          unit,
          conversionRatio,
          sourceStockType: itemSrcType,
          destinationStockType: itemDestType,
          notes: it.notes || null,
        },
        { transaction },
      );

      // If autoShip, check & deduct stock immediately via inventoryEngine
      if (initialStatus === "IN_TRANSIT") {
        const isSrcBonus = itemSrcType === "BONUS";
        const typeLabel = isSrcBonus ? "Bonus" : "Reguler";

        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: parseInt(sourceWarehouseId),
          productId,
          qty: baseQty,
          isBonus: isSrcBonus,
          referenceType: "STOCK_TRANSFER",
          referenceId: stockTransfer.id,
          customNotes: `Mutasi Keluar (${typeLabel}) Dokumen No: ${transferNumber}${unit ? ` [${qty} ${unit}]` : ""}`,
          transaction,
        });
      }
    }

    await transaction.commit();

    await logActivity(req, {
      tenantId: req.tenantId,
      userId: req.user ? req.user.id : null,
      module: "STOCK_TRANSFER",
      action: "CREATE",
      description: `Membuat mutasi transfer stok: ${transferNumber} (${initialStatus}) [Tipe: ${transferType}]`,
      metadata: {
        transferId: stockTransfer.id,
        transferNumber,
        status: initialStatus,
        transferType,
      },
    });

    const fullData = await StockTransfer.findByPk(stockTransfer.id, {
      include: [
        { model: Warehouse, as: "sourceWarehouse" },
        { model: Warehouse, as: "destinationWarehouse" },
        {
          model: StockTransferItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "sku", "name", "unit", "purchasePrice"],
              include: [
                {
                  model: ProductUnit,
                  as: "units",
                  attributes: [
                    "id",
                    "unitName",
                    "conversionRatio",
                    "isBaseUnit",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: `Dokumen mutasi transfer ${transferNumber} berhasil dibuat.`,
      data: fullData,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.updateTransferStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { status, driverName, vehicleNumber, notes } = req.body;

    const transfer = await StockTransfer.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        {
          model: StockTransferItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
      ],
      transaction,
    });

    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Dokumen mutasi transfer tidak ditemukan.",
      });
    }

    const prevStatus = transfer.status;

    if (prevStatus === "COMPLETED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Dokumen transfer yang sudah SELESAI (COMPLETED) tidak dapat diubah statusnya.",
      });
    }

    if (prevStatus === "CANCELLED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Dokumen transfer yang sudah DIBATALKAN tidak dapat diubah.",
      });
    }

    // ── Transisi: DRAFT -> IN_TRANSIT (Kirim Barang / Deduct Stock) ────────────
    if (prevStatus === "DRAFT" && status === "IN_TRANSIT") {
      for (const it of transfer.items) {
        const itemSrcType =
          it.sourceStockType || transfer.sourceStockType || "REGULAR";
        const isSrcBonus = itemSrcType === "BONUS";
        const typeLabel = isSrcBonus ? "Bonus" : "Reguler";
        const ratio = parseFloat(it.conversionRatio) || 1.0;
        const baseQty = parseFloat(it.qty) * ratio;

        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: transfer.sourceWarehouseId,
          productId: it.productId,
          qty: baseQty,
          isBonus: isSrcBonus,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          customNotes: `Mutasi Keluar (${typeLabel}) Dokumen No: ${transfer.transferNumber}${it.unit ? ` [${it.qty} ${it.unit}]` : ""}`,
          transaction,
        });
      }
    }

    // ── Transisi: IN_TRANSIT -> COMPLETED (Barang Diterima di Tujuan) ────────
    if (prevStatus === "IN_TRANSIT" && status === "COMPLETED") {
      const today = new Date().toISOString().split("T")[0];

      for (const it of transfer.items) {
        const itemDestType =
          it.destinationStockType || transfer.destinationStockType || "REGULAR";
        const isDestBonus = itemDestType === "BONUS";
        const typeLabel = isDestBonus ? "Bonus" : "Reguler";
        const ratio = parseFloat(it.conversionRatio) || 1.0;
        const baseQty = parseFloat(it.qty) * ratio;

        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: transfer.destinationWarehouseId,
          productId: it.productId,
          batchNumber: `BATCH-TRF-${transfer.transferNumber}-${it.product?.sku || it.productId}`,
          receiveDate: today,
          qty: baseQty,
          costPrice: 0,
          isBonus: isDestBonus,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          customNotes: `Penerimaan Mutasi Masuk (${typeLabel}) No: ${transfer.transferNumber}${it.unit ? ` [${it.qty} ${it.unit}]` : ""}`,
          transaction,
        });
      }
    }

    // ── Transisi: DRAFT -> COMPLETED (Mutasi Langsung 1 Langkah) ─────────────
    if (prevStatus === "DRAFT" && status === "COMPLETED") {
      const today = new Date().toISOString().split("T")[0];

      for (const it of transfer.items) {
        const itemSrcType =
          it.sourceStockType || transfer.sourceStockType || "REGULAR";
        const itemDestType =
          it.destinationStockType || transfer.destinationStockType || "REGULAR";
        const isSrcBonus = itemSrcType === "BONUS";
        const isDestBonus = itemDestType === "BONUS";
        const ratio = parseFloat(it.conversionRatio) || 1.0;
        const baseQty = parseFloat(it.qty) * ratio;

        // 1. Deduct from source
        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: transfer.sourceWarehouseId,
          productId: it.productId,
          qty: baseQty,
          isBonus: isSrcBonus,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          customNotes: `Mutasi Keluar (${isSrcBonus ? "Bonus" : "Reguler"}) No: ${transfer.transferNumber}${it.unit ? ` [${it.qty} ${it.unit}]` : ""}`,
          transaction,
        });

        // 2. Add to destination
        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: transfer.destinationWarehouseId,
          productId: it.productId,
          batchNumber: `BATCH-TRF-${transfer.transferNumber}-${it.product?.sku || it.productId}`,
          receiveDate: today,
          qty: baseQty,
          costPrice: 0,
          isBonus: isDestBonus,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          customNotes: `Penerimaan Mutasi Masuk (${isDestBonus ? "Bonus" : "Reguler"}) No: ${transfer.transferNumber}${it.unit ? ` [${it.qty} ${it.unit}]` : ""}`,
          transaction,
        });
      }
    }

    // ── Transisi: IN_TRANSIT -> CANCELLED (Batalkan & Kembalikan Stok ke Asal) ─
    if (prevStatus === "IN_TRANSIT" && status === "CANCELLED") {
      const today = new Date().toISOString().split("T")[0];

      for (const it of transfer.items) {
        const itemSrcType =
          it.sourceStockType || transfer.sourceStockType || "REGULAR";
        const isSrcBonus = itemSrcType === "BONUS";
        const ratio = parseFloat(it.conversionRatio) || 1.0;
        const baseQty = parseFloat(it.qty) * ratio;

        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: transfer.sourceWarehouseId,
          productId: it.productId,
          batchNumber: `BATCH-CAN-${transfer.transferNumber}-${it.product?.sku || it.productId}`,
          receiveDate: today,
          qty: baseQty,
          costPrice: 0,
          isBonus: isSrcBonus,
          referenceType: "STOCK_TRANSFER_CANCEL",
          referenceId: transfer.id,
          customNotes: `Pengembalian Stok karena Pembatalan Mutasi No: ${transfer.transferNumber}${it.unit ? ` [${it.qty} ${it.unit}]` : ""}`,
          transaction,
        });
      }
    }

    await transfer.update(
      {
        status: status || transfer.status,
        driverName: driverName !== undefined ? driverName : transfer.driverName,
        vehicleNumber:
          vehicleNumber !== undefined ? vehicleNumber : transfer.vehicleNumber,
        notes: notes !== undefined ? notes : transfer.notes,
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      tenantId: req.tenantId,
      userId: req.user ? req.user.id : null,
      module: "STOCK_TRANSFER",
      action: "UPDATE_STATUS",
      description: `Mengubah status mutasi transfer ${transfer.transferNumber}: ${prevStatus} -> ${status}`,
      metadata: {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        prevStatus,
        status,
      },
    });

    const updatedData = await StockTransfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: "sourceWarehouse" },
        { model: Warehouse, as: "destinationWarehouse" },
        {
          model: StockTransferItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "sku", "name", "unit", "purchasePrice"],
              include: [
                {
                  model: ProductUnit,
                  as: "units",
                  attributes: [
                    "id",
                    "unitName",
                    "conversionRatio",
                    "isBaseUnit",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: `Status mutasi transfer berhasil diperbarui menjadi ${status}.`,
      data: updatedData,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
};

exports.deleteTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transfer = await StockTransfer.findOne({
      where: { id, tenantId: req.tenantId },
    });

    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: "Dokumen mutasi transfer tidak ditemukan.",
      });
    }

    if (transfer.status === "IN_TRANSIT" || transfer.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus mutasi dengan status ${transfer.status}. Silakan batalkan dokumen terlebih dahulu.`,
      });
    }

    await transfer.destroy();

    return res.status(200).json({
      success: true,
      message: "Dokumen mutasi transfer berhasil dihapus.",
    });
  } catch (error) {
    next(error);
  }
};

const {
  PurchaseOrder,
  PurchaseOrderItem,
  Tax,
  Product,
  Supplier,
  Warehouse,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const {
  getPaginationParams,
  buildPaginationMeta,
} = require("../utils/paginationHelper");
const { recordStockIn, recordStockOut } = require("../utils/inventoryEngine");
const {
  resolvePaymentAccountId,
  postPaymentJournal,
  postInvoiceJournal,
} = require("../utils/journalEngine");
const { checkAndUpdatePoStatus } = require("../utils/orderStatusEngine");
const { logActivity } = require("../utils/logger");

exports.getAllPurchaseOrders = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } =
      getPaginationParams(req.query, {
        allowedSortCols: [
          "poNumber",
          "poDate",
          "totalAmount",
          "status",
          "createdAt",
        ],
        defaultSortBy: "createdAt",
        defaultSortDir: "DESC",
      });

    const whereClause = { tenantId: req.tenantId };

    if (
      req.query.hasReceipt === "true" ||
      req.query.receivedOnly === "true" ||
      req.query.type === "SJM"
    ) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        {
          [Op.or]: [
            { status: { [Op.in]: ["RECEIVED", "COMPLETED", "SELESAI"] } },
            { metadata: { [Op.like]: '%"sjmNumber"%' } },
            { metadata: { [Op.like]: '%"receiveDate"%' } },
            { metadata: { [Op.like]: '%"receives"%' } },
          ],
        },
      ];
      if (
        req.query.showCancelled !== "true" &&
        req.query.includeCancelled !== "true"
      ) {
        whereClause.status = { [Op.ne]: "CANCELLED" };
      }
    } else if (req.query.status) {
      if (req.query.status.includes(",")) {
        whereClause.status = {
          [Op.in]: req.query.status.split(",").map((s) => s.trim()),
        };
      } else {
        whereClause.status = req.query.status;
      }
    } else if (
      req.query.showCancelled !== "true" &&
      req.query.includeCancelled !== "true"
    ) {
      whereClause.status = { [Op.ne]: "CANCELLED" };
    }
    if (req.query.warehouseId) whereClause.warehouseId = req.query.warehouseId;

    // Filter PKP vs Non-PKP purchase orders (only if explicitly filtered)
    if (req.query.filterTax === "PKP" || req.query.isPkp === "true") {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = PurchaseOrder.tax_id 
              AND taxes.rate > 0 
              AND taxes.name NOT LIKE '%Non%'
          )
        )`),
      ];
    } else if (
      req.query.filterTax === "NON_PKP" ||
      req.query.isPkp === "false"
    ) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          PurchaseOrder.tax_id IS NULL OR EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = PurchaseOrder.tax_id 
              AND (taxes.rate = 0 OR taxes.name LIKE '%Non%')
          )
        )`),
      ];
    } else if (req.query.taxId) {
      whereClause.taxId = req.query.taxId;
    }

    if (search) {
      whereClause[Op.or] = [
        { poNumber: { [Op.like]: `%${search}%` } },
        { metadata: { [Op.like]: `%${search}%` } },
        { "$supplier.name$": { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where: whereClause,
      include: [
        { model: Tax, as: "tax", attributes: ["name", "rate"] },
        {
          model: Supplier,
          as: "supplier",
          attributes: ["id", "name", "phone"],
        },
        { model: Warehouse, as: "warehouse", attributes: ["id", "name"] },
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "sku", "name", "unit", "purchasePrice"],
            },
          ],
        },
      ],
      order: [
        [sortBy, sortDir],
        ...(sortBy !== "createdAt" ? [["createdAt", "DESC"]] : []),
      ],
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

exports.createPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      poNumber,
      poDate,
      contactId,
      warehouseId,
      taxId,
      notes,
      items,
      metadata,
      autoReceive,
    } = req.body;

    if (
      !poNumber ||
      !poDate ||
      !contactId ||
      !warehouseId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Nomor PO, Tanggal, Supplier, Gudang, dan Item barang wajib diisi.",
      });
    }

    // Check duplicate products in item list
    const productIds = items.map((i) => parseInt(i.productId));
    if (new Set(productIds).size !== productIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Terdapat barang duplikat dalam daftar item. Harap gabungkan jumlah (Qty) pada satu baris produk yang sama.",
      });
    }

    const contactIdNum = parseInt(contactId);
    const warehouseIdNum = parseInt(warehouseId);

    if (!contactIdNum || isNaN(contactIdNum)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Silakan pilih Supplier yang valid.",
      });
    }

    if (!warehouseIdNum || isNaN(warehouseIdNum)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Silakan pilih Gudang Penerima yang valid.",
      });
    }

    const supplierExists = await Supplier.findOne({
      where: { id: contactIdNum, tenantId: req.tenantId },
      transaction,
    });
    if (!supplierExists) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Supplier tidak ditemukan." });
    }

    const warehouseExists = await Warehouse.findOne({
      where: { id: warehouseIdNum, tenantId: req.tenantId },
      transaction,
    });
    if (!warehouseExists) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Gudang Penerima tidak ditemukan." });
    }

    // Check unique PO number per tenant
    const existingPo = await PurchaseOrder.findOne({
      where: { tenantId: req.tenantId, poNumber },
      transaction,
    });

    if (existingPo) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `PO Number '${poNumber}' is already in use.`,
      });
    }

    // Calculate Tax rate
    let taxRate = 0;
    const { applyTax = true, taxInclusive = false } = req.body;
    const paymentTerm =
      req.body.paymentTerm || req.body.metadata?.paymentTerm || "LUNAS";
    const dpAmount =
      paymentTerm === "DP"
        ? parseFloat(req.body.dpAmount || req.body.metadata?.dpAmount || 0)
        : 0;
    const dueDate =
      paymentTerm === "TEMPO" || paymentTerm === "DP"
        ? req.body.dueDate || req.body.metadata?.dueDate || null
        : null;
    const isDraft =
      req.body.isDraft === true ||
      req.body.status === "DRAFT" ||
      req.body.metadata?.isDraft === true;

    if (applyTax && taxId) {
      const tax = await Tax.findOne({
        where: { id: taxId, tenantId: req.tenantId },
        transaction,
      });
      if (tax) {
        taxRate = parseFloat(tax.rate);
      }
    }

    // Calculate subtotal and tax
    let itemsSum = 0;
    const poItems = [];

    for (const item of items) {
      const { productId, qty, price, discount = 0 } = item;
      if (
        !productId ||
        qty === undefined ||
        qty <= 0 ||
        price === undefined ||
        price < 0
      ) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message:
            "Setiap baris item harus memiliki produk, jumlah (Qty) > 0, dan harga >= 0.",
        });
      }

      const prodId = parseInt(productId);
      const product = await Product.findOne({
        where: { id: prodId, tenantId: req.tenantId },
        transaction,
      });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Produk dengan ID ${productId} tidak ditemukan.`,
        });
      }

      const numQty = parseFloat(qty) || 0;
      const numPrice = parseFloat(price) || 0;
      const itemDiscount = parseFloat(discount || 0);
      const itemSubtotal =
        item.subtotal !== undefined
          ? parseFloat(item.subtotal)
          : numQty * finalPrice;
      itemsSum += itemSubtotal;

      poItems.push({
        productId: prodId,
        qty: numQty,
        bonusQty: parseFloat(item.bonusQty) || 0,
        bonusUnit: item.bonusUnit || item.unit || "PCS",
        price: numPrice,
        discount: itemDiscount,
        subtotal: itemSubtotal,
      });
    }

    const globalDiscountMode =
      req.body.globalDiscountMode ||
      req.body.metadata?.globalDiscountMode ||
      (parseFloat(req.body.globalDiscountAmount || 0) > 0 &&
      !parseFloat(req.body.globalDiscountPercent || 0)
        ? "AMOUNT"
        : "PERCENT");
    let globalDiscountPercent = parseFloat(
      req.body.globalDiscountPercent !== undefined
        ? req.body.globalDiscountPercent
        : req.body.metadata?.globalDiscountPercent || 0,
    );
    let globalDiscountAmount = 0;
    if (globalDiscountMode === "AMOUNT") {
      const reqAmount =
        req.body.globalDiscountAmount !== undefined
          ? req.body.globalDiscountAmount
          : req.body.metadata?.globalDiscountAmount || 0;
      globalDiscountAmount = Math.min(itemsSum, parseFloat(reqAmount || 0));
      globalDiscountPercent =
        itemsSum > 0 ? (globalDiscountAmount / itemsSum) * 100 : 0;
    } else {
      globalDiscountPercent = Math.min(100, Math.max(0, globalDiscountPercent));
      globalDiscountAmount = itemsSum * (globalDiscountPercent / 100);
    }

    let subtotal = Math.max(0, itemsSum - globalDiscountAmount);
    let taxAmount = 0;
    let totalAmount = subtotal;

    if (applyTax && taxRate > 0) {
      if (taxInclusive) {
        totalAmount = subtotal;
        subtotal = totalAmount / (1 + taxRate / 100);
        taxAmount = totalAmount - subtotal;
      } else {
        taxAmount = subtotal * (taxRate / 100);
        totalAmount = subtotal + taxAmount;
      }
    } else {
      taxAmount = 0;
      totalAmount = subtotal;
    }

    // Determine initial paid amount based on paymentTerm & dpAmount
    let initialPaid = 0;
    if (paymentTerm === "LUNAS") {
      initialPaid = totalAmount;
    } else if (paymentTerm === "DP") {
      initialPaid = dpAmount;
    } else if (paymentTerm === "TEMPO") {
      initialPaid = 0;
    }

    let initialPaymentStatus = "UNPAID";
    if (initialPaid >= totalAmount - 0.01) {
      initialPaymentStatus = "PAID";
    } else if (initialPaid > 0) {
      initialPaymentStatus = "PARTIAL";
    } else {
      initialPaymentStatus = "UNPAID";
    }

    // Approval mode: true = butuh approval (alur standar), false = tanpa approval (langsung selesai & stok masuk)
    const requireApproval =
      req.body.requireApproval !== false &&
      req.body.metadata?.requireApproval !== false;
    const isStaff = req.user?.role === "STAFF";
    const willAutoReceive = autoReceive || (!requireApproval && !isDraft);

    let initialStatus = "APPROVED";
    if (isDraft) {
      initialStatus = "DRAFT";
    } else if (!requireApproval) {
      initialStatus = "COMPLETED";
    } else if (isStaff) {
      initialStatus = "PENDING_APPROVAL";
    } else if (willAutoReceive) {
      initialStatus = "RECEIVED";
    } else {
      initialStatus = "APPROVED";
    }

    // Create PO
    const po = await PurchaseOrder.create(
      {
        tenantId: req.tenantId,
        contactId: contactIdNum,
        warehouseId: warehouseIdNum,
        poNumber,
        poDate,
        status: initialStatus,
        taxId: applyTax && taxId ? taxId : null,
        subtotal,
        taxAmount,
        totalAmount,
        notes,
        metadata: {
          ...metadata,
          applyTax,
          taxInclusive,
          globalDiscountMode,
          globalDiscountPercent,
          globalDiscountAmount,
          itemsDetail: items.map((it) => ({
            productId: it.productId,
            bigQty:
              it.bigQty !== undefined
                ? parseFloat(it.bigQty)
                : parseFloat(it.qty || 0),
            smallQty: parseFloat(it.smallQty || 0),
            bigBonusQty:
              it.bigBonusQty !== undefined
                ? parseFloat(it.bigBonusQty)
                : parseFloat(it.bonusQty || 0),
            smallBonusQty: parseFloat(it.smallBonusQty || 0),
            bigUnit: it.bigUnit || it.unit || "KRT",
            smallUnit: it.smallUnit || "",
            capacity: parseFloat(it.capacity || 1),
            unit: it.unit || it.bigUnit || "PCS",
            conversionRatio: parseFloat(it.conversionRatio || it.capacity || 1),
            qty: it.qty,
            bonusQty: parseFloat(it.bonusQty) || 0,
            bonusUnit: it.bonusUnit || it.unit || "PCS",
            price: it.price,
            discount: it.discount || 0,
            discountPercent: it.discountPercent || 0,
            subtotal: it.subtotal,
          })),
          isDraft,
          createdByRole: req.user?.role || "STAFF",
          createdByName: req.user?.name || "User",
          submittedAt: !isDraft ? new Date().toISOString() : null,
          paymentTerm,
          dpAmount,
          dueDate,
          paidAmount: initialPaid,
          paymentStatus: initialPaymentStatus,
          payments:
            initialPaid > 0
              ? [
                  {
                    id: `PAY-INIT-${Date.now()}`,
                    amount: initialPaid,
                    date: poDate,
                    method: "CASH",
                    notes:
                      paymentTerm === "DP"
                        ? "Pembayaran Uang Muka (DP) PO"
                        : "Pembayaran Lunas PO",
                  },
                ]
              : [],
        },
      },
      { transaction },
    );

    // Create PO Items linked to PO
    const itemsToSave = poItems.map((item) => ({
      ...item,
      purchaseOrderId: po.id,
    }));

    const createdPoItems = await PurchaseOrderItem.bulkCreate(itemsToSave, {
      transaction,
    });

    // Auto Generate Invoice (Faktur Pembelian)
    const autoInvoice = req.body.autoInvoice !== false;
    if (autoInvoice) {
      let invNumber = poNumber.startsWith("PO.")
        ? poNumber.replace(/^PO\./, "INV.")
        : `INV-${poNumber.replace(/^PO-/, "")}`;
      const existingInv = await sequelize.models.Invoice.findOne({
        where: {
          tenantId: req.tenantId,
          type: "PURCHASE",
          invoiceNumber: invNumber,
        },
        transaction,
      });
      if (existingInv) {
        invNumber = `${invNumber}-${Date.now().toString().slice(-4)}`;
      }

      const invAmountDue = Math.max(0, totalAmount - initialPaid);
      let invStatus = "UNPAID";
      if (initialPaid >= totalAmount - 0.01) {
        invStatus = "PAID";
      } else if (initialPaid > 0) {
        invStatus = "PARTIALLY_PAID";
      }

      const invoice = await sequelize.models.Invoice.create(
        {
          tenantId: req.tenantId,
          type: "PURCHASE",
          purchaseOrderId: po.id,
          invoiceNumber: invNumber,
          invoiceDate: poDate,
          dueDate: dueDate || poDate,
          status: invStatus,
          taxId: applyTax && taxId ? taxId : null,
          subtotal,
          taxAmount,
          totalAmount,
          amountDue: invAmountDue,
          metadata: {
            ...(metadata || {}),
            autoGenerated: true,
            poNumber,
            taxInclusive: taxInclusive === true,
            applyTax: applyTax === true,
            globalDiscountPercent,
            globalDiscountAmount,
            paidAmount: initialPaid,
          },
        },
        { transaction },
      );

      await postInvoiceJournal(invoice, transaction);

      if (initialPaid > 0) {
        const targetAccountId = await resolvePaymentAccountId(
          req.tenantId,
          "CASH",
          null,
          transaction,
        );
        if (targetAccountId) {
          const paymentNumber = `PAY-PO-${poNumber}-${Date.now().toString().slice(-4)}`;
          const paymentRecord = await sequelize.models.Payment.create(
            {
              tenantId: req.tenantId,
              invoiceId: invoice.id,
              paymentNumber,
              paymentDate: poDate,
              paymentType: "DISBURSEMENT",
              paymentMethod: "CASH",
              amount: initialPaid,
              accountId: targetAccountId,
              notes:
                paymentTerm === "DP"
                  ? `Pembayaran Uang Muka (DP) PO #${poNumber}`
                  : `Pelunasan PO #${poNumber}`,
            },
            { transaction },
          );

          await postPaymentJournal(paymentRecord, transaction);
        }
      }
    }

    if (willAutoReceive) {
      const sjmNumber = poNumber.startsWith("PO.")
        ? poNumber.replace(/^PO\./, "SJM.")
        : poNumber.startsWith("PO-")
          ? poNumber.replace(/^PO-/, "SJM-")
          : `SJM-${poNumber}`;

      for (const item of createdPoItems) {
        if (parseFloat(item.qty) > 0) {
          await recordStockIn({
            tenantId: req.tenantId,
            warehouseId: po.warehouseId,
            productId: item.productId,
            purchaseOrderItemId: item.id,
            batchNumber: po.poNumber,
            receiveDate: poDate,
            qty: parseFloat(item.qty),
            costPrice:
              parseFloat(item.qty) > 0
                ? parseFloat(item.subtotal || 0) / parseFloat(item.qty)
                : parseFloat(item.price || 0),
            isBonus: false,
            referenceType: "PURCHASE_RECEIPT",
            referenceId: po.id,
            transaction,
          });
        }

        if (parseFloat(item.bonusQty) > 0) {
          await recordStockIn({
            tenantId: req.tenantId,
            warehouseId: po.warehouseId,
            productId: item.productId,
            purchaseOrderItemId: item.id,
            batchNumber: `${po.poNumber}-BNS`,
            receiveDate: poDate,
            qty: parseFloat(item.bonusQty),
            costPrice: 0,
            isBonus: true,
            referenceType: "PURCHASE_RECEIPT",
            referenceId: po.id,
            customNotes: `Barang Bonus PO #${po.poNumber}`,
            transaction,
          });
        }
      }

      const receiveLog = {
        id: `RCV-${Date.now()}`,
        sjmNumber,
        deliveryNumber: sjmNumber,
        receiveDate: poDate,
        notes:
          !requireApproval && !isDraft
            ? "Diterima otomatis (PO Selesai Tanpa Approval)"
            : "Diterima otomatis saat pembuatan Purchase Order",
        evidence: null,
        receivedBy: req.user ? req.user.name : "Staff Gudang",
      };

      await po.update(
        {
          status: initialStatus, // 'COMPLETED' if !requireApproval, or 'RECEIVED' if autoReceive
          metadata: {
            ...po.metadata,
            autoReceive: true,
            requireApproval,
            sjmNumber,
            deliveryNumber: sjmNumber,
            receiveDate: poDate,
            receivedBy: receiveLog.receivedBy,
            receives: [receiveLog],
            ...(!requireApproval && !isDraft
              ? {
                  approvedBy: req.user?.name || "Sistem (Otomatis)",
                  approvedByRole: req.user?.role || "SYSTEM",
                  approvedAt: new Date().toISOString(),
                  completedAt: new Date().toISOString(),
                }
              : {}),
          },
        },
        { transaction },
      );
    }

    await transaction.commit();

    if (willAutoReceive) {
      await checkAndUpdatePoStatus(po.id, req.tenantId);
    }

    const createdPo = await PurchaseOrder.findByPk(po.id, {
      include: [
        { model: Tax, as: "tax", attributes: ["name", "rate"] },
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [
            { model: Product, as: "product", attributes: ["sku", "name"] },
          ],
        },
      ],
    });

    await logActivity(req, {
      action: "CREATE",
      module: "PURCHASE_ORDERS",
      description: `Membuat Purchase Order #${po.poNumber}`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        totalAmount: po.totalAmount,
        status: po.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Purchase Order created as DRAFT.",
      data: createdPo,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.receivePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    // Find PO
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      include: [{ model: PurchaseOrderItem, as: "items" }],
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found or access denied.",
      });
    }

    if (po.status === "PENDING_APPROVAL" || po.status === "PENDING") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Purchase Order masih berstatus Menunggu Persetujuan. Harap disetujui terlebih dahulu oleh Admin/Manager atau Owner sebelum stok fisik dapat diterima di gudang.",
      });
    }

    if (po.status === "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Purchase Order masih berstatus Draft. Harap ajukan dan setujui PO terlebih dahulu.",
      });
    }

    if (po.status === "REJECTED" || po.status === "CANCELLED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menerima barang karena status PO saat ini: ${po.status}`,
      });
    }

    const allowedStatuses = [
      "APPROVED",
      "SHIPPED",
      "IN_TRANSIT",
      "ORDERED",
      "PARTIAL",
    ];
    if (!allowedStatuses.includes(po.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menerima barang karena status PO saat ini: ${po.status}`,
      });
    }

    // Process receiving stock for each item using the FIFO Engine (recordStockIn)
    for (const item of po.items) {
      if (parseFloat(item.qty) > 0) {
        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: po.warehouseId,
          productId: item.productId,
          purchaseOrderItemId: item.id, // Store link to PO item
          batchNumber: po.poNumber,
          receiveDate: new Date().toISOString().split("T")[0], // received today
          qty: parseFloat(item.qty),
          costPrice:
            parseFloat(item.qty) > 0
              ? parseFloat(item.subtotal || 0) / parseFloat(item.qty)
              : parseFloat(item.price || 0),
          isBonus: false,
          referenceType: "PURCHASE_RECEIPT",
          referenceId: po.id,
          transaction,
        });
      }

      if (parseFloat(item.bonusQty) > 0) {
        await recordStockIn({
          tenantId: req.tenantId,
          warehouseId: po.warehouseId,
          productId: item.productId,
          purchaseOrderItemId: item.id,
          batchNumber: `${po.poNumber}-BNS`,
          receiveDate: new Date().toISOString().split("T")[0],
          qty: parseFloat(item.bonusQty),
          costPrice: 0,
          isBonus: true,
          referenceType: "PURCHASE_RECEIPT",
          referenceId: po.id,
          customNotes: `Barang Bonus PO #${po.poNumber}`,
          transaction,
        });
      }
    }

    // Update PO Status and save receive evidence with SJM (Surat Jalan Masuk) number
    const currentMeta = po.metadata || {};
    const receives = currentMeta.receives || [];
    const sjmNumber =
      currentMeta.sjmNumber ||
      (po.poNumber.startsWith("PO.")
        ? po.poNumber.replace(/^PO\./, "SJM.")
        : po.poNumber.startsWith("PO-")
          ? po.poNumber.replace(/^PO-/, "SJM-")
          : `SJM-${po.poNumber}`);

    const body = req.body || {};
    const newReceiveLog = {
      id: `RCV-${Date.now()}`,
      sjmNumber,
      deliveryNumber: sjmNumber,
      receiveDate: body.receiveDate || new Date().toISOString().split("T")[0],
      notes: body.notes || "Penerimaan barang PO",
      evidence: req.uploadedImageUrl || null,
      receivedBy: req.user ? req.user.name : "Staff Gudang",
      driverName: body.driverName || "Kurir Supplier",
      vehiclePlate: body.vehiclePlate || "-",
    };

    await po.update(
      {
        status: "RECEIVED",
        metadata: {
          ...currentMeta,
          sjmNumber,
          deliveryNumber: sjmNumber,
          receiveDate: newReceiveLog.receiveDate,
          receivedBy: newReceiveLog.receivedBy,
          receiveEvidence:
            req.uploadedImageUrl || currentMeta.receiveEvidence || null,
          receives: [...receives, newReceiveLog],
        },
      },
      { transaction },
    );

    await transaction.commit();

    await checkAndUpdatePoStatus(po.id, req.tenantId);

    await logActivity(req, {
      action: "RECEIVE",
      module: "PURCHASE_ORDERS",
      description: `Menerima stok fisik PO #${po.poNumber} (No. SJM: ${sjmNumber})`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        sjmNumber,
        receiveDate: newReceiveLog.receiveDate,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Purchase Order received successfully. Stock updated.",
      data: {
        evidence: req.uploadedImageUrl || null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.deletePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found.",
      });
    }

    if (po.status !== "DRAFT" && po.status !== "CANCELLED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Hanya Purchase Order berstatus DRAFT atau DIBATALKAN yang dapat dihapus.",
      });
    }

    const poData = {
      id: po.id,
      poNumber: po.poNumber,
      totalAmount: po.totalAmount,
    };

    // 1. Find and delete linked Invoices
    const linkedInvoices = await sequelize.models.Invoice.findAll({
      where: { purchaseOrderId: po.id, tenantId: req.tenantId },
      transaction,
    });

    for (const inv of linkedInvoices) {
      await sequelize.models.Payment.destroy({
        where: { invoiceId: inv.id },
        transaction,
      });
      await sequelize.models.JournalEntryItem.destroy({
        where: {
          journalEntryId: {
            [Op.in]: sequelize.literal(
              `(SELECT id FROM journal_entries WHERE reference_type = 'INVOICE' AND reference_id = ${inv.id})`,
            ),
          },
        },
        transaction,
      });
      await sequelize.models.JournalEntry.destroy({
        where: { referenceType: "INVOICE", referenceId: inv.id },
        transaction,
      });
      await inv.destroy({ transaction });
    }

    // 2. Delete PO Items
    await PurchaseOrderItem.destroy({
      where: { purchaseOrderId: po.id },
      transaction,
    });

    // 3. Delete PO
    await po.destroy({ transaction });

    await transaction.commit();

    await logActivity(req, {
      action: "DELETE",
      module: "PURCHASE_ORDERS",
      description: `Menghapus Purchase Order #${poData.poNumber}`,
      metadata: poData,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase Order dan Invoice terkait berhasil dihapus.",
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.updatePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      poNumber,
      poDate,
      contactId,
      warehouseId,
      taxId,
      notes,
      items,
      metadata,
      autoReceive,
    } = req.body;

    const po = await PurchaseOrder.findOne({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: [{ model: PurchaseOrderItem, as: "items" }],
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found.",
      });
    }

    const allowedEditStatuses = [
      "DRAFT",
      "PENDING_APPROVAL",
      "PENDING",
      "REJECTED",
      "ORDERED",
      "APPROVED",
    ];
    if (!allowedEditStatuses.includes(po.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Purchase Order dengan status '${po.status}' tidak dapat diubah karena barang sudah diproses/dikirim/selesai.`,
      });
    }

    if (
      !poNumber ||
      !poDate ||
      !contactId ||
      !warehouseId ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "PO Number, PO Date, Supplier ID, Warehouse ID, and items are required.",
      });
    }

    // Check duplicate products in item list
    const productIds = items.map((i) => parseInt(i.productId));
    if (new Set(productIds).size !== productIds.length) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Terdapat barang duplikat dalam daftar item. Harap gabungkan jumlah (Qty) pada satu baris produk yang sama.",
      });
    }

    // Check tax rate
    let taxRate = 0;
    if (taxId) {
      const tax = await Tax.findOne({
        where: { id: taxId, tenantId: req.tenantId },
      });
      if (tax) {
        taxRate = tax.rate / 100;
      }
    }

    // Delete old items
    await PurchaseOrderItem.destroy({
      where: { purchaseOrderId: po.id },
      transaction,
    });

    // Create new items and calculate totals
    let itemsSum = 0;
    const itemsData = [];
    for (const item of items) {
      if (!item.productId) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Setiap baris item harus memilih produk yang valid.",
        });
      }

      const prodId = parseInt(item.productId);
      const product = await Product.findOne({
        where: { id: prodId, tenantId: req.tenantId },
        transaction,
      });
      if (!product) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Produk dengan ID ${item.productId} tidak ditemukan.`,
        });
      }

      const qty = parseFloat(item.qty || 1);
      const price = parseFloat(item.price || 0);
      const discount = parseFloat(item.discount || 0);
      const lineSubtotal =
        item.subtotal !== undefined
          ? parseFloat(item.subtotal)
          : qty * finalPrice;
      itemsSum += lineSubtotal;

      itemsData.push({
        purchaseOrderId: po.id,
        productId: prodId,
        qty,
        bonusQty: parseFloat(item.bonusQty) || 0,
        bonusUnit: item.bonusUnit || item.unit || "PCS",
        price,
        discount,
        subtotal: lineSubtotal,
      });
    }

    const prevMetadata = po.metadata || {};

    // Apply global discount
    const globalDiscountMode =
      req.body.globalDiscountMode ||
      metadata?.globalDiscountMode ||
      prevMetadata.globalDiscountMode ||
      (parseFloat(req.body.globalDiscountAmount || 0) > 0 &&
      !parseFloat(req.body.globalDiscountPercent || 0)
        ? "AMOUNT"
        : "PERCENT");
    let globalDiscountPercent = parseFloat(
      req.body.globalDiscountPercent !== undefined
        ? req.body.globalDiscountPercent
        : metadata?.globalDiscountPercent !== undefined
          ? metadata.globalDiscountPercent
          : prevMetadata?.globalDiscountPercent || 0,
    );
    let globalDiscountAmount = 0;
    const reqDiscountAmount =
      req.body.globalDiscountAmount !== undefined
        ? req.body.globalDiscountAmount
        : metadata?.globalDiscountAmount !== undefined
          ? metadata?.globalDiscountAmount
          : prevMetadata?.globalDiscountAmount;

    if (globalDiscountMode === "AMOUNT") {
      globalDiscountAmount = Math.min(
        itemsSum,
        parseFloat(reqDiscountAmount || 0),
      );
      globalDiscountPercent =
        itemsSum > 0 ? (globalDiscountAmount / itemsSum) * 100 : 0;
    } else {
      globalDiscountPercent = Math.min(100, Math.max(0, globalDiscountPercent));
      globalDiscountAmount = itemsSum * (globalDiscountPercent / 100);
    }
    const netSubtotal = Math.max(0, itemsSum - globalDiscountAmount);

    // Calculate tax & grand total
    let taxAmount = 0;
    let grandTotal = netSubtotal;
    let subtotal = netSubtotal;

    const applyTax = req.body.applyTax !== false;
    const taxInclusive = req.body.taxInclusive === true;

    if (applyTax && taxId && taxRate > 0) {
      if (taxInclusive) {
        grandTotal = netSubtotal;
        subtotal = grandTotal / (1 + taxRate);
        taxAmount = grandTotal - subtotal;
      } else {
        subtotal = netSubtotal;
        taxAmount = subtotal * taxRate;
        grandTotal = subtotal + taxAmount;
      }
    } else {
      subtotal = netSubtotal;
      taxAmount = 0;
      grandTotal = netSubtotal;
    }

    const paymentTerm =
      req.body.paymentTerm ||
      metadata?.paymentTerm ||
      prevMetadata.paymentTerm ||
      "LUNAS";
    const dpAmount =
      paymentTerm === "DP"
        ? parseFloat(
            req.body.dpAmount ||
              metadata?.dpAmount ||
              prevMetadata.dpAmount ||
              0,
          )
        : 0;
    const dueDate =
      paymentTerm === "TEMPO" || paymentTerm === "DP"
        ? req.body.dueDate || metadata?.dueDate || prevMetadata.dueDate || null
        : null;

    let currentPaid = 0;
    if (
      prevMetadata.paidAmount !== undefined &&
      prevMetadata.paidAmount !== null
    ) {
      currentPaid = parseFloat(prevMetadata.paidAmount);
    } else if (paymentTerm === "LUNAS") {
      currentPaid = grandTotal;
    } else if (paymentTerm === "DP") {
      currentPaid = dpAmount;
    } else {
      currentPaid = 0;
    }

    let currentPaymentStatus = "UNPAID";
    if (currentPaid >= grandTotal - 0.01) {
      currentPaymentStatus = "PAID";
    } else if (currentPaid > 0) {
      currentPaymentStatus = "PARTIAL";
    } else {
      currentPaymentStatus = "UNPAID";
    }

    const isStaff = req.user?.role === "STAFF";
    const isDraft =
      req.body.isDraft === true ||
      req.body.metadata?.isDraft === true ||
      req.body.status === "DRAFT";
    const requireApproval =
      req.body.requireApproval !== false &&
      req.body.metadata?.requireApproval !== false;
    const willAutoReceive = autoReceive || (!requireApproval && !isDraft);

    let newStatus = po.status;
    if (isDraft) {
      newStatus = "DRAFT";
    } else if (!requireApproval) {
      newStatus = "COMPLETED";
    } else if (
      po.status === "DRAFT" ||
      po.status === "REJECTED" ||
      po.status === "PENDING_APPROVAL"
    ) {
      newStatus = isStaff
        ? "PENDING_APPROVAL"
        : willAutoReceive
          ? "RECEIVED"
          : "APPROVED";
    } else if (willAutoReceive) {
      newStatus = "RECEIVED";
    }

    // Update PO
    await po.update(
      {
        poNumber,
        poDate,
        contactId,
        warehouseId,
        status: newStatus,
        taxId: applyTax ? taxId : null,
        notes,
        subtotal,
        taxAmount,
        totalAmount: grandTotal,
        metadata: {
          ...prevMetadata,
          ...metadata,
          isDraft,
          requireApproval,
          taxInclusive,
          applyTax,
          globalDiscountMode,
          globalDiscountPercent,
          globalDiscountAmount,
          ...(!requireApproval && !isDraft
            ? {
                approvedBy: req.user?.name || "Sistem (Otomatis)",
                approvedByRole: req.user?.role || "SYSTEM",
                approvedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
              }
            : {}),
          itemsDetail: items.map((it) => ({
            productId: it.productId,
            bigQty:
              it.bigQty !== undefined
                ? parseFloat(it.bigQty)
                : parseFloat(it.qty || 0),
            smallQty: parseFloat(it.smallQty || 0),
            bigBonusQty:
              it.bigBonusQty !== undefined
                ? parseFloat(it.bigBonusQty)
                : parseFloat(it.bonusQty || 0),
            smallBonusQty: parseFloat(it.smallBonusQty || 0),
            bigUnit: it.bigUnit || it.unit || "KRT",
            smallUnit: it.smallUnit || "",
            capacity: parseFloat(it.capacity || 1),
            unit: it.unit || it.bigUnit || "PCS",
            conversionRatio: parseFloat(it.conversionRatio || it.capacity || 1),
            qty: it.qty,
            bonusQty: parseFloat(it.bonusQty) || 0,
            bonusUnit: it.bonusUnit || it.unit || "PCS",
            price: it.price,
            discount: it.discount || 0,
            discountPercent: it.discountPercent || 0,
            subtotal: it.subtotal,
          })),
          paymentTerm,
          dpAmount,
          dueDate,
          paidAmount: currentPaid,
          paymentStatus: currentPaymentStatus,
        },
      },
      { transaction },
    );

    // Bulk create new items
    const createdPoItems = await PurchaseOrderItem.bulkCreate(itemsData, {
      transaction,
    });

    // Auto receive flow if requested
    if (willAutoReceive) {
      for (const item of createdPoItems) {
        if (parseFloat(item.qty) > 0) {
          await recordStockIn({
            tenantId: req.tenantId,
            warehouseId,
            productId: item.productId,
            purchaseOrderItemId: item.id,
            batchNumber: poNumber,
            receiveDate: poDate,
            qty: parseFloat(item.qty),
            costPrice:
              parseFloat(item.qty) > 0
                ? parseFloat(item.subtotal || 0) / parseFloat(item.qty)
                : parseFloat(item.price || 0),
            isBonus: false,
            referenceType: "PURCHASE_RECEIPT",
            referenceId: po.id,
            transaction,
          });
        }

        if (parseFloat(item.bonusQty) > 0) {
          await recordStockIn({
            tenantId: req.tenantId,
            warehouseId,
            productId: item.productId,
            purchaseOrderItemId: item.id,
            batchNumber: `${poNumber}-BNS`,
            receiveDate: poDate,
            qty: parseFloat(item.bonusQty),
            costPrice: 0,
            isBonus: true,
            referenceType: "PURCHASE_RECEIPT",
            referenceId: po.id,
            customNotes: `Barang Bonus PO #${poNumber}`,
            transaction,
          });
        }
      }

      // Update PO Status
      const finalUpdateStatus =
        !requireApproval && !isDraft ? "COMPLETED" : "RECEIVED";
      await po.update({ status: finalUpdateStatus }, { transaction });
    }

    // Sync linked Invoice if exists
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { purchaseOrderId: po.id, tenantId: req.tenantId },
      transaction,
    });

    if (linkedInvoice) {
      const invAmountDue = Math.max(0, grandTotal - currentPaid);
      let invStatus = "UNPAID";
      if (currentPaid >= grandTotal - 0.01) {
        invStatus = "PAID";
      } else if (currentPaid > 0) {
        invStatus = "PARTIALLY_PAID";
      }

      await linkedInvoice.update(
        {
          subtotal,
          taxAmount,
          totalAmount: grandTotal,
          amountDue: invAmountDue,
          status: invStatus,
          metadata: {
            ...(linkedInvoice.metadata || {}),
            paidAmount: currentPaid,
            globalDiscountPercent,
            globalDiscountAmount,
            revisedAt: new Date().toISOString(),
          },
        },
        { transaction },
      );
    }

    await transaction.commit();

    const updatedPo = await PurchaseOrder.findByPk(po.id, {
      include: [
        { model: Tax, as: "tax", attributes: ["name", "rate"] },
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [
            { model: Product, as: "product", attributes: ["sku", "name"] },
          ],
        },
      ],
    });

    await checkAndUpdatePoStatus(po.id, req.tenantId);

    return res.status(200).json({
      success: true,
      message: "Purchase Order updated successfully.",
      data: updatedPo,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      include: [
        { model: Tax, as: "tax", attributes: ["name", "rate"] },
        { model: Supplier, as: "supplier" },
        { model: Warehouse, as: "warehouse" },
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "sku",
                "name",
                "unit",
                "purchasePrice",
                "sellingPrice",
              ],
            },
          ],
        },
        {
          model: sequelize.models.Invoice,
          as: "bills",
          include: [
            {
              model: sequelize.models.Payment,
              as: "payments",
              include: [
                {
                  model: sequelize.models.ChartOfAccount,
                  as: "account",
                  attributes: ["id", "accountCode", "accountName"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!po) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found." });
    }

    return res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.recordPurchaseOrderPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { amount, paymentDate, paymentMethod, accountId, notes } = req.body;

    const paymentVal = parseFloat(amount || 0);
    if (paymentVal <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Jumlah pembayaran harus lebih dari 0.",
      });
    }

    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order tidak ditemukan." });
    }

    const currentMeta = po.metadata || {};
    const totalAmount = parseFloat(po.totalAmount || 0);
    const existingPaid = parseFloat(currentMeta.paidAmount || 0);
    const newPaidAmount = existingPaid + paymentVal;

    let newStatus = "PARTIAL";
    if (newPaidAmount >= totalAmount - 0.01) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    } else {
      newStatus = "UNPAID";
    }

    // Otomatis tentukan akun Kas vs Bank berdasarkan metode bayar jika tidak disediakan
    const targetAccountId = await resolvePaymentAccountId(
      req.tenantId,
      paymentMethod,
      accountId,
      transaction,
    );

    const existingPayments = currentMeta.payments || [];
    const newPaymentRecord = {
      id: `PAY-${Date.now()}`,
      amount: paymentVal,
      date: paymentDate || new Date().toISOString().split("T")[0],
      method: paymentMethod || "CASH",
      accountId: targetAccountId,
      notes: notes || "Pembayaran supplier / angsuran PO",
      evidence: req.uploadedImageUrl || null,
    };

    const updatedMeta = {
      ...currentMeta,
      paidAmount: newPaidAmount,
      paymentStatus: newStatus,
      payments: [...existingPayments, newPaymentRecord],
    };

    await po.update({ metadata: updatedMeta }, { transaction });

    // Sync to linked Invoice if exists
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { purchaseOrderId: po.id, tenantId: req.tenantId },
      transaction,
    });

    if (linkedInvoice) {
      const invTotal = parseFloat(linkedInvoice.totalAmount || 0);
      const invPaid = newPaidAmount;
      const invDue = Math.max(0, invTotal - invPaid);

      let invStatus = "UNPAID";
      if (invPaid >= invTotal - 0.01) {
        invStatus = "PAID";
      } else if (invPaid > 0) {
        invStatus = "PARTIALLY_PAID";
      }

      await linkedInvoice.update(
        {
          amountDue: invDue,
          status: invStatus,
          metadata: {
            ...(linkedInvoice.metadata || {}),
            paidAmount: invPaid,
          },
        },
        { transaction },
      );
    }

    // Create official Payment DB record & post auto-journal for cash flow & reports
    if (targetAccountId) {
      const paymentNumber = `PAY-PO-${po.poNumber}-${Date.now().toString().slice(6)}`;
      const paymentRecord = await sequelize.models.Payment.create(
        {
          tenantId: req.tenantId,
          invoiceId: linkedInvoice ? linkedInvoice.id : null,
          paymentNumber,
          paymentDate: paymentDate || new Date().toISOString().split("T")[0],
          paymentType: "DISBURSEMENT",
          paymentMethod: paymentMethod || "CASH",
          amount: paymentVal,
          accountId: targetAccountId,
          notes: notes || `Pelunasan/Angsuran PO #${po.poNumber}`,
          metadata: req.uploadedImageUrl
            ? { evidence: req.uploadedImageUrl }
            : null,
        },
        { transaction },
      );

      await postPaymentJournal(paymentRecord, transaction);
    }

    await transaction.commit();

    await checkAndUpdatePoStatus(po.id, req.tenantId);

    await logActivity(req, {
      action: "PAYMENT",
      module: "PURCHASE_ORDERS",
      description: `Mencatat pembayaran PO #${po.poNumber} sebesar Rp ${paymentVal.toLocaleString("id-ID")}`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        amount: paymentVal,
        paymentMethod,
        newPaidAmount,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Pembayaran supplier sebesar Rp ${paymentVal.toLocaleString("id-ID")} berhasil dicatat.`,
      data: {
        paidAmount: newPaidAmount,
        paymentStatus: newStatus,
        remainingAmount: Math.max(0, totalAmount - newPaidAmount),
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.cancelPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order tidak ditemukan." });
    }

    if (po.status === "CANCELLED") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Purchase Order ini sudah dibatalkan sebelumnya.",
      });
    }

    if (po.status === "COMPLETED" || po.status === "SELESAI") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Purchase Order yang sudah SELESAI tidak dapat dibatalkan.",
      });
    }

    // 1. If PO was RECEIVED (stock was added), deduct incoming stock
    if (po.status === "RECEIVED") {
      const poItems = await PurchaseOrderItem.findAll({
        where: { purchaseOrderId: po.id },
        transaction,
      });

      for (const item of poItems) {
        await recordStockOut({
          tenantId: req.tenantId,
          warehouseId: po.warehouseId,
          productId: item.productId,
          qty: item.qty,
          referenceType: "STOCK_OPNAME",
          referenceId: po.id,
          transaction,
        });
      }
    }

    // 2. Update linked Invoice to CANCELLED if exists
    const linkedInvoice = await sequelize.models.Invoice.findOne({
      where: { purchaseOrderId: po.id, tenantId: req.tenantId },
      transaction,
    });

    if (linkedInvoice) {
      await linkedInvoice.update({ status: "CANCELLED" }, { transaction });
    }

    // 3. Update PO status to CANCELLED
    const currentMeta = po.metadata || {};
    await po.update(
      {
        status: "CANCELLED",
        metadata: {
          ...currentMeta,
          cancelReason: reason || "Dibatalkan pengguna",
          cancelledAt: new Date().toISOString(),
          cancelledBy: req.user ? req.user.name : "System",
        },
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      action: "CANCEL",
      module: "PURCHASE_ORDERS",
      description: `Membatalkan Purchase Order #${po.poNumber}`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        reason: reason || "Dibatalkan pengguna",
      },
    });

    return res.status(200).json({
      success: true,
      message: `Purchase Order #${po.poNumber} berhasil dibatalkan.`,
      data: po,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.shipPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order tidak ditemukan.",
      });
    }

    if (po.status === "PENDING_APPROVAL" || po.status === "PENDING") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Purchase Order masih berstatus Menunggu Persetujuan. Harap disetujui oleh Admin/Manager atau Owner terlebih dahulu sebelum ditandai dalam pengiriman.",
      });
    }

    if (po.status === "DRAFT") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Purchase Order masih berstatus Draft. Harap ajukan dan setujui PO terlebih dahulu.",
      });
    }

    if (
      ["RECEIVED", "COMPLETED", "CANCELLED", "REJECTED"].includes(po.status)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat mengubah status ke pengiriman karena status PO saat ini: ${po.status}`,
      });
    }

    const body = req.body || {};
    const currentMeta = po.metadata || {};
    await po.update(
      {
        status: "SHIPPED",
        metadata: {
          ...currentMeta,
          shippedAt: new Date().toISOString(),
          courierName: body.courierName || "Kurir Supplier / Ekspedisi",
          trackingNumber: body.trackingNumber || "-",
        },
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      action: "SHIP",
      module: "PURCHASE_ORDERS",
      description: `Menandai pengiriman supplier untuk PO #${po.poNumber}`,
      metadata: { id: po.id, poNumber: po.poNumber },
    });

    return res.status(200).json({
      success: true,
      message:
        "Status Purchase Order berhasil diperbarui: Barang Sedang Dikirim oleh Supplier.",
      data: po,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.approvePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order tidak ditemukan.",
      });
    }

    const approverRoles = ["ADMIN", "MANAGER", "OWNER", "SUPERADMIN"];
    if (!approverRoles.includes(req.user?.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message:
          "Hanya Admin/Manager atau Owner yang memiliki wewenang untuk menyetujui Purchase Order.",
      });
    }

    if (
      !["PENDING_APPROVAL", "PENDING", "DRAFT", "REJECTED"].includes(po.status)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menyetujui Purchase Order karena status saat ini: ${po.status}`,
      });
    }

    const currentMeta = po.metadata || {};
    const approverName = req.user?.name || "Manager / Admin";
    const approverRole = req.user?.role || "ADMIN";
    const approvedAt = new Date().toISOString();
    const approvalNotes =
      req.body?.notes || `Disetujui oleh ${approverName} (${approverRole})`;

    await po.update(
      {
        status: "APPROVED",
        metadata: {
          ...currentMeta,
          approvedBy: approverName,
          approvedByRole: approverRole,
          approvedAt,
          approvalNotes,
        },
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      action: "APPROVE",
      module: "PURCHASE_ORDERS",
      description: `Menyetujui Purchase Order #${po.poNumber} (${approvalNotes})`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        approvedBy: approverName,
        approvedAt,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Purchase Order #${po.poNumber} berhasil disetujui! Staff Gudang kini dapat melanjutkan proses penerimaan barang.`,
      data: po,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.rejectPurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order tidak ditemukan.",
      });
    }

    const approverRoles = ["ADMIN", "MANAGER", "OWNER", "SUPERADMIN"];
    if (!approverRoles.includes(req.user?.role)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message:
          "Hanya Admin/Manager atau Owner yang memiliki wewenang untuk menolak Purchase Order.",
      });
    }

    if (!["PENDING_APPROVAL", "PENDING", "DRAFT"].includes(po.status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menolak Purchase Order karena status saat ini: ${po.status}`,
      });
    }

    const currentMeta = po.metadata || {};
    const rejectorName = req.user?.name || "Manager / Admin";
    const rejectorRole = req.user?.role || "ADMIN";
    const rejectedAt = new Date().toISOString();
    const rejectionReason =
      req.body?.reason || req.body?.notes || "Ditolak oleh manajemen";

    await po.update(
      {
        status: "REJECTED",
        metadata: {
          ...currentMeta,
          rejectedBy: rejectorName,
          rejectedByRole: rejectorRole,
          rejectedAt,
          rejectionReason,
        },
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      action: "REJECT",
      module: "PURCHASE_ORDERS",
      description: `Menolak Purchase Order #${po.poNumber}. Alasan: ${rejectionReason}`,
      metadata: {
        id: po.id,
        poNumber: po.poNumber,
        rejectedBy: rejectorName,
        rejectionReason,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Purchase Order #${po.poNumber} telah ditolak.`,
      data: po,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.completePurchaseOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findOne({
      where: { id, tenantId: req.tenantId },
      transaction,
    });

    if (!po) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Purchase Order tidak ditemukan.",
      });
    }

    if (
      [
        "CANCELLED",
        "REJECTED",
        "DRAFT",
        "PENDING_APPROVAL",
        "PENDING",
      ].includes(po.status)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Tidak dapat menyelesaikan PO dengan status saat ini: ${po.status}`,
      });
    }

    const currentMeta = po.metadata || {};
    await po.update(
      {
        status: "COMPLETED",
        metadata: {
          ...currentMeta,
          completedAt: new Date().toISOString(),
          completedBy: req.user ? req.user.name : "User",
        },
      },
      { transaction },
    );

    await transaction.commit();

    await logActivity(req, {
      action: "COMPLETE",
      module: "PURCHASE_ORDERS",
      description: `Menyelesaikan Purchase Order #${po.poNumber}`,
      metadata: { id: po.id, poNumber: po.poNumber },
    });

    return res.status(200).json({
      success: true,
      message: `Purchase Order #${po.poNumber} berhasil diselesaikan.`,
      data: po,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

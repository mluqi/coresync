const { JournalEntry, JournalEntryItem, ChartOfAccount, sequelize } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');

exports.getAllJournals = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['transactionDate', 'createdAt'],
      defaultSortBy: 'transactionDate',
      defaultSortDir: 'DESC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (search) {
      whereClause[Op.or] = [
        { description: { [Op.like]: `%${search}%` } },
        { referenceType: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await JournalEntry.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: JournalEntryItem,
          as: 'items',
          include: [{ model: ChartOfAccount, as: 'account', attributes: ['accountCode', 'accountName', 'accountType'] }]
        }
      ],
      order: [[sortBy, sortDir], ['id', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: buildPaginationMeta(count, page, limit)
    });
  } catch (error) {
    next(error);
  }
};

exports.createManualJournal = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { transactionDate, description } = req.body;
    let items = req.body.items;

    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }

    if (!transactionDate || !description || !Array.isArray(items) || items.length < 2) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tanggal transaksi, keterangan, dan minimal 2 baris akun (Debit & Kredit) wajib diisi.'
      });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const validatedItems = [];

    for (const it of items) {
      const amt = parseFloat(it.amount);
      if (!it.accountId || isNaN(amt) || amt <= 0 || !['DEBIT', 'CREDIT'].includes(it.type)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Setiap baris akun harus memiliki Akun COA, tipe (DEBIT/CREDIT), dan nominal > 0.'
        });
      }

      if (it.type === 'DEBIT') totalDebit += amt;
      else totalCredit += amt;

      validatedItems.push({
        accountId: parseInt(it.accountId, 10),
        type: it.type,
        amount: amt
      });
    }

    // Double-entry validation: Debit must match Credit with rounding tolerance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Jurnal tidak seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) tidak sama dengan Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}).`
      });
    }

    let parsedMeta = {};
    if (req.body.metadata) {
      if (typeof req.body.metadata === 'string') {
        try { parsedMeta = JSON.parse(req.body.metadata); } catch (e) { parsedMeta = {}; }
      } else {
        parsedMeta = req.body.metadata;
      }
    }

    if (req.uploadedImageUrl) {
      parsedMeta.evidence = req.uploadedImageUrl;
    }

    const journal = await JournalEntry.create({
      tenantId: req.tenantId,
      transactionDate,
      referenceType: 'MANUAL',
      referenceId: 0,
      description,
      metadata: parsedMeta
    }, { transaction });

    // Update referenceId to its own ID
    await journal.update({ referenceId: journal.id }, { transaction });

    // Create journal items
    for (const vi of validatedItems) {
      await JournalEntryItem.create({
        journalEntryId: journal.id,
        accountId: vi.accountId,
        type: vi.type,
        amount: vi.amount
      }, { transaction });
    }

    await transaction.commit();

    // Fetch created journal with items & accounts
    const createdJournal = await JournalEntry.findOne({
      where: { id: journal.id, tenantId: req.tenantId },
      include: [
        {
          model: JournalEntryItem,
          as: 'items',
          include: [{ model: ChartOfAccount, as: 'account', attributes: ['accountCode', 'accountName', 'accountType'] }]
        }
      ]
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'JOURNALS',
      description: `Mencatat jurnal manual: ${journal.description} (Rp ${totalDebit.toLocaleString('id-ID')})`,
      metadata: { id: journal.id, totalAmount: totalDebit, transactionDate }
    });

    return res.status(201).json({
      success: true,
      message: 'Jurnal manual berhasil dicatat.',
      data: createdJournal
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


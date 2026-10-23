const { ChartOfAccount } = require('../models');
const { Op } = require('sequelize');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationHelper');
const { logActivity } = require('../utils/logger');

exports.getAllAccounts = async (req, res, next) => {
  try {
    const { page, limit, offset, search, sortBy, sortDir } = getPaginationParams(req.query, {
      allowedSortCols: ['accountCode', 'accountName', 'accountType', 'createdAt'],
      defaultSortBy: 'accountCode',
      defaultSortDir: 'ASC'
    });

    const whereClause = { tenantId: req.tenantId };

    if (req.query.accountType) {
      whereClause.accountType = req.query.accountType;
    }

    if (search) {
      whereClause[Op.or] = [
        { accountCode: { [Op.like]: `%${search}%` } },
        { accountName: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await ChartOfAccount.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortDir]],
      limit,
      offset
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


exports.createAccount = async (req, res, next) => {
  try {
    const { accountCode, accountName, accountType, parentId } = req.body;

    if (!accountCode || !accountName || !accountType) {
      return res.status(400).json({
        success: false,
        message: 'Account Code, Account Name, and Account Type are required.'
      });
    }

    // Check unique account code per tenant
    const existing = await ChartOfAccount.findOne({
      where: { tenantId: req.tenantId, accountCode }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Account Code '${accountCode}' is already in use.`
      });
    }

    const account = await ChartOfAccount.create({
      tenantId: req.tenantId,
      accountCode,
      accountName,
      accountType,
      parentId: parentId || null,
      isActive: true
    });

    await logActivity(req, {
      action: 'CREATE',
      module: 'COA',
      description: `Menambah akun COA: ${account.accountName} (${account.accountCode})`,
      metadata: { id: account.id, accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType }
    });

    return res.status(201).json({
      success: true,
      message: 'Chart of Account created successfully.',
      data: account
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountCode, accountName, accountType, isActive, parentId } = req.body;

    const account = await ChartOfAccount.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Akun COA tidak ditemukan.'
      });
    }

    if (accountCode && accountCode !== account.accountCode) {
      const existing = await ChartOfAccount.findOne({
        where: { tenantId: req.tenantId, accountCode }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Kode Akun '${accountCode}' sudah digunakan.`
        });
      }
    }

    await account.update({
      accountCode: accountCode || account.accountCode,
      accountName: accountName || account.accountName,
      accountType: accountType || account.accountType,
      parentId: parentId !== undefined ? parentId : account.parentId,
      isActive: isActive !== undefined ? isActive : account.isActive
    });

    await logActivity(req, {
      action: 'UPDATE',
      module: 'COA',
      description: `Mengubah akun COA: ${account.accountName} (${account.accountCode})`,
      metadata: { id: account.id, accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType }
    });

    return res.status(200).json({
      success: true,
      message: 'Akun COA berhasil diperbarui.',
      data: account
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await ChartOfAccount.findOne({
      where: { id, tenantId: req.tenantId }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Akun COA tidak ditemukan.'
      });
    }

    // Check if account is used in journals or payments
    const { JournalEntryItem, Payment } = require('../models');
    const usedInJournal = await JournalEntryItem.count({ where: { accountId: id } });
    const usedInPayment = await Payment.count({ where: { accountId: id } });

    if (usedInJournal > 0 || usedInPayment > 0) {
      return res.status(400).json({
        success: false,
        message: 'Akun ini tidak dapat dihapus karena sudah memiliki riwayat mutasi transaksi keuangan / jurnal. Silakan ubah status menjadi nonaktif.'
      });
    }

    await account.destroy();

    await logActivity(req, {
      action: 'DELETE',
      module: 'COA',
      description: `Menghapus akun COA: ${account.accountName} (${account.accountCode})`,
      metadata: { id: account.id, accountCode: account.accountCode }
    });

    return res.status(200).json({
      success: true,
      message: 'Akun COA berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
};

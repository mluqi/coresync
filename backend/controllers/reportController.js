const { 
  JournalEntry, 
  JournalEntryItem, 
  ChartOfAccount, 
  SalesOrder, 
  SalesOrderItem, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  Customer, 
  Supplier, 
  Product, 
  ProductUnit,
  ProductWarehouse, 
  Warehouse, 
  StockLedger, 
  StockOpname,
  Salesperson, 
  Delivery, 
  DeliveryItem, 
  Invoice, 
  Driver, 
  sequelize 
} = require('../models');
const { Op } = require('sequelize');

exports.getIncomeStatement = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate (YYYY-MM-DD) are required.'
      });
    }

    // 1. Fetch active accounts for the tenant
    const accounts = await ChartOfAccount.findAll({
      where: { tenantId: req.tenantId, isActive: true }
    });

    // 2. Fetch journal items for the tenant within range
    const journalItems = await JournalEntryItem.findAll({
      include: [
        {
          model: JournalEntry,
          as: 'journalEntry',
          where: {
            tenantId: req.tenantId,
            transactionDate: {
              [Op.between]: [startDate, endDate]
            }
          },
          attributes: []
        }
      ]
    });

    // 3. Compute balances per account
    const balances = {};
    accounts.forEach(acc => {
      balances[acc.id] = {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        debit: 0,
        credit: 0,
        balance: 0
      };
    });

    journalItems.forEach(item => {
      const acc = balances[item.accountId];
      if (acc) {
        const amt = parseFloat(item.amount);
        if (item.type === 'DEBIT') {
          acc.debit += amt;
        } else {
          acc.credit += amt;
        }
      }
    });

    // Calculate final accounting balance
    accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (acc.accountType === 'REVENUE') {
        // Revenue is increased by Credit
        bal.balance = bal.credit - bal.debit;
      } else if (acc.accountType === 'EXPENSE') {
        // Expense is increased by Debit
        bal.balance = bal.debit - bal.credit;
      } else {
        // Assets/Liabilities/Equity balance (not needed for Income Statement, but calculated for completeness)
        bal.balance = bal.debit - bal.credit;
      }
    });

    // 4. Summarize for Income Statement
    let totalRevenue = 0;
    let totalHpp = 0;
    let totalExpenses = 0;

    const revenueDetails = [];
    const hppDetails = [];
    const expenseDetails = [];

    Object.values(balances).forEach(bal => {
      if (bal.accountType === 'REVENUE') {
        totalRevenue += bal.balance;
        revenueDetails.push(bal);
      } else if (bal.accountType === 'EXPENSE') {
        if (bal.accountCode.startsWith('5')) { // Standard COA: 5xxxx is HPP/Cost of Sales
          totalHpp += bal.balance;
          hppDetails.push(bal);
        } else { // 6xxxx or other expenses are operating expenses
          totalExpenses += bal.balance;
          expenseDetails.push(bal);
        }
      }
    });

    const grossProfit = totalRevenue - totalHpp;
    const netProfit = grossProfit - totalExpenses;

    return res.status(200).json({
      success: true,
      data: {
        dateRange: { startDate, endDate },
        summary: {
          totalRevenue,
          totalHpp,
          grossProfit,
          totalExpenses,
          netProfit
        },
        details: {
          revenue: revenueDetails,
          costOfGoodsSold: hppDetails,
          expenses: expenseDetails
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getBalanceSheet = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'date (YYYY-MM-DD) is required.'
      });
    }

    // 1. Fetch active accounts
    const accounts = await ChartOfAccount.findAll({
      where: { tenantId: req.tenantId, isActive: true }
    });

    // 2. Fetch journal items up to the date
    const journalItems = await JournalEntryItem.findAll({
      include: [
        {
          model: JournalEntry,
          as: 'journalEntry',
          where: {
            tenantId: req.tenantId,
            transactionDate: {
              [Op.lte]: date
            }
          },
          attributes: []
        }
      ]
    });

    // Compute balances
    const balances = {};
    accounts.forEach(acc => {
      balances[acc.id] = {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        debit: 0,
        credit: 0,
        balance: 0
      };
    });

    journalItems.forEach(item => {
      const acc = balances[item.accountId];
      if (acc) {
        const amt = parseFloat(item.amount);
        if (item.type === 'DEBIT') {
          acc.debit += amt;
        } else {
          acc.credit += amt;
        }
      }
    });

    // Balance values
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let netIncome = 0;

    const assetDetails = [];
    const liabilityDetails = [];
    const equityDetails = [];

    accounts.forEach(acc => {
      const bal = balances[acc.id];
      if (!bal) return;

      const deb = bal.debit;
      const cred = bal.credit;

      if (acc.accountType === 'ASSET') {
        bal.balance = deb - cred;
        totalAssets += bal.balance;
        assetDetails.push(bal);
      } else if (acc.accountType === 'LIABILITY') {
        bal.balance = cred - deb;
        totalLiabilities += bal.balance;
        liabilityDetails.push(bal);
      } else if (acc.accountType === 'EQUITY') {
        bal.balance = cred - deb;
        totalEquity += bal.balance;
        equityDetails.push(bal);
      } else if (acc.accountType === 'REVENUE') {
        netIncome += (cred - deb);
      } else if (acc.accountType === 'EXPENSE') {
        netIncome -= (deb - cred);
      }
    });

    // Add Net income as an Equity detail for Retained Earnings
    equityDetails.push({
      id: 99999,
      accountCode: '3-9999',
      accountName: 'Laba Periode Berjalan',
      accountType: 'EQUITY',
      debit: 0,
      credit: netIncome >= 0 ? netIncome : 0,
      balance: netIncome
    });
    totalEquity += netIncome;

    return res.status(200).json({
      success: true,
      data: {
        asOfDate: date,
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalLiabilitiesAndEquity: totalLiabilities + totalEquity
        },
        details: {
          assets: assetDetails,
          liabilities: liabilityDetails,
          equity: equityDetails
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getGeneralLedger = async (req, res, next) => {
  try {
    const { startDate, endDate, accountId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate (YYYY-MM-DD) are required.'
      });
    }

    const whereClause = {
      tenantId: req.tenantId,
      transactionDate: {
        [Op.between]: [startDate, endDate]
      }
    };

    const itemWhere = {};
    if (accountId) {
      itemWhere.accountId = accountId;
    }

    // 1. Fetch entries
    const entries = await JournalEntry.findAll({
      where: whereClause,
      include: [
        {
          model: JournalEntryItem,
          as: 'items',
          where: itemWhere,
          include: [{ model: ChartOfAccount, as: 'account', attributes: ['id', 'accountCode', 'accountName', 'accountType'] }]
        }
      ],
      order: [['transactionDate', 'ASC'], ['id', 'ASC']]
    });

    // 2. Calculate beginning balances per account before startDate
    const accounts = await ChartOfAccount.findAll({
      where: { tenantId: req.tenantId, isActive: true },
      order: [['accountCode', 'ASC']]
    });

    const previousItems = await JournalEntryItem.findAll({
      include: [
        {
          model: JournalEntry,
          as: 'journalEntry',
          where: {
            tenantId: req.tenantId,
            transactionDate: {
              [Op.lt]: startDate
            }
          },
          attributes: []
        }
      ]
    });

    const accountBalancesMap = {};
    accounts.forEach(acc => {
      accountBalancesMap[acc.id] = {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        beginningBalance: 0,
        debits: 0,
        credits: 0
      };
    });

    previousItems.forEach(item => {
      const acc = accountBalancesMap[item.accountId];
      if (acc) {
        const amt = parseFloat(item.amount) || 0;
        if (item.type === 'DEBIT') acc.debits += amt;
        else acc.credits += amt;
      }
    });

    Object.values(accountBalancesMap).forEach(acc => {
      if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
        acc.beginningBalance = acc.debits - acc.credits;
      } else {
        acc.beginningBalance = acc.credits - acc.debits;
      }
    });

    let beginningBalance = 0;
    if (accountId && accountBalancesMap[accountId]) {
      beginningBalance = accountBalancesMap[accountId].beginningBalance;
    }

    return res.status(200).json({
      success: true,
      data: {
        dateRange: { startDate, endDate },
        beginningBalance,
        accountBalancesMap,
        entries
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getInventoryValuation = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { tenantId: req.tenantId },
      include: [
        {
          model: ProductWarehouse,
          as: 'warehouseStocks',
          attributes: ['warehouseId', 'stock']
        }
      ]
    });

    let totalValuation = 0;
    const items = products.map(p => {
      const totalStock = p.warehouseStocks?.reduce((sum, pw) => sum + parseFloat(pw.stock || 0), 0) || 0;
      const purchasePrice = parseFloat(p.purchasePrice || 0);
      const value = totalStock * purchasePrice;
      totalValuation += value;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        purchasePrice,
        sellingPrice: parseFloat(p.sellingPrice || 0),
        totalStock,
        valuation: value
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalValuation,
        items
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalesDetails = async (req, res, next) => {
  try {
    const start = req.query.startDate || '2000-01-01';
    const end = req.query.endDate || '2099-12-31';

    const whereClause = {
      tenantId: req.tenantId,
      soDate: { [Op.between]: [start, end] }
    };

    // Filter PKP vs Non-PKP sales in report
    if (req.query.taxStatus === 'PKP' || req.query.taxType === 'PKP' || req.query.isPkp === 'true') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND taxes.rate > 0 
              AND taxes.name NOT LIKE '%Non%'
          )
        )`)
      ];
    } else if (req.query.taxStatus === 'NON_PKP' || req.query.taxType === 'NON_PKP' || req.query.isPkp === 'false') {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(`(
          SalesOrder.tax_id IS NULL OR EXISTS (
            SELECT 1 FROM taxes 
            WHERE taxes.id = SalesOrder.tax_id 
              AND (taxes.rate = 0 OR taxes.name LIKE '%Non%')
          )
        )`)
      ];
    }

    const sales = await SalesOrder.findAll({
      where: whereClause,
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: sequelize.models.Tax, as: 'tax', attributes: ['id', 'name', 'rate'] },
        { 
          model: SalesOrderItem, 
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ],
      order: [['soDate', 'DESC'], ['id', 'DESC']]
    });

    return res.status(200).json({ success: true, data: sales });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseDetails = async (req, res, next) => {
  try {
    const start = req.query.startDate || '2000-01-01';
    const end = req.query.endDate || '2099-12-31';

    const purchases = await PurchaseOrder.findAll({
      where: {
        tenantId: req.tenantId,
        poDate: { [Op.between]: [start, end] }
      },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['name'] },
        { model: sequelize.models.Tax, as: 'tax', attributes: ['id', 'name', 'rate'] },
        { 
          model: PurchaseOrderItem, 
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['sku', 'name', 'unit'] }]
        }
      ],
      order: [['poDate', 'DESC'], ['id', 'DESC']]
    });

    return res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    next(error);
  }
};

exports.getTaxReport = async (req, res, next) => {
  try {
    const start = req.query.startDate || '2000-01-01';
    const end = req.query.endDate || '2099-12-31';

    // 1. Fetch Sales with Tax (PPN Keluaran)
    const sales = await SalesOrder.findAll({
      where: {
        tenantId: req.tenantId,
        soDate: { [Op.between]: [start, end] },
        status: { [Op.ne]: 'CANCELLED' }
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: sequelize.models.Tax, as: 'tax', attributes: ['id', 'name', 'rate'] }
      ],
      order: [['soDate', 'ASC'], ['id', 'ASC']]
    });

    // 2. Fetch Purchases with Tax (PPN Masukan)
    const purchases = await PurchaseOrder.findAll({
      where: {
        tenantId: req.tenantId,
        poDate: { [Op.between]: [start, end] },
        status: { [Op.ne]: 'CANCELLED' }
      },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['name'] },
        { model: sequelize.models.Tax, as: 'tax', attributes: ['id', 'name', 'rate'] }
      ],
      order: [['poDate', 'ASC'], ['id', 'ASC']]
    });

    let totalDppSales = 0;
    let totalPpnKeluaran = 0;
    let totalGrossSales = 0;
    let totalNonPkpSales = 0;

    const salesTaxRows = sales.map(s => {
      const gross = parseFloat(s.totalAmount || 0);
      const isPkp = Boolean((s.taxId && (!s.tax?.name || !s.tax.name.toLowerCase().includes('non'))) || s.metadata?.applyTax);
      const taxRate = isPkp ? parseFloat(s.tax?.rate || 0) : 0;
      let taxAmount = parseFloat(s.taxAmount || 0);
      let dpp = parseFloat(s.subtotal || 0);

      // If PKP and taxAmount is missing/zero, back-calculate
      if (isPkp && taxRate > 0) {
        if (taxAmount === 0) {
          dpp = parseFloat((gross / (1 + (taxRate / 100))).toFixed(2));
          taxAmount = parseFloat((gross - dpp).toFixed(2));
        }
      } else {
        dpp = gross;
        taxAmount = 0;
      }

      totalGrossSales += gross;
      if (isPkp && taxAmount > 0) {
        totalDppSales += dpp;
        totalPpnKeluaran += taxAmount;
      } else {
        totalNonPkpSales += gross;
      }

      return {
        id: s.id,
        soNumber: s.soNumber,
        date: s.soDate,
        contactName: s.customer?.name || '-',
        isPkp,
        taxName: isPkp ? (s.tax?.name || 'PPN') : 'Non-PKP',
        taxRate,
        dpp,
        taxAmount,
        grossAmount: gross
      };
    });

    let totalDppPurchases = 0;
    let totalPpnMasukan = 0;
    let totalGrossPurchases = 0;
    let totalNonPkpPurchases = 0;

    const purchaseTaxRows = purchases.map(p => {
      const gross = parseFloat(p.totalAmount || 0);
      const isPkp = Boolean((p.taxId && (!p.tax?.name || !p.tax.name.toLowerCase().includes('non'))) || p.metadata?.applyTax);
      const taxRate = isPkp ? parseFloat(p.tax?.rate || 0) : 0;
      let taxAmount = parseFloat(p.taxAmount || 0);
      let dpp = parseFloat(p.subtotal || 0);

      if (isPkp && taxRate > 0) {
        if (taxAmount === 0) {
          dpp = parseFloat((gross / (1 + (taxRate / 100))).toFixed(2));
          taxAmount = parseFloat((gross - dpp).toFixed(2));
        }
      } else {
        dpp = gross;
        taxAmount = 0;
      }

      totalGrossPurchases += gross;
      if (isPkp && taxAmount > 0) {
        totalDppPurchases += dpp;
        totalPpnMasukan += taxAmount;
      } else {
        totalNonPkpPurchases += gross;
      }

      return {
        id: p.id,
        poNumber: p.poNumber,
        date: p.poDate,
        contactName: p.supplier?.name || '-',
        isPkp,
        taxName: isPkp ? (p.tax?.name || 'PPN') : 'Non-PKP',
        taxRate,
        dpp,
        taxAmount,
        grossAmount: gross
      };
    });

    const netTaxPayable = totalPpnKeluaran - totalPpnMasukan;

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalGrossSales,
          totalDppSales,
          totalPpnKeluaran,
          totalNonPkpSales,
          totalGrossPurchases,
          totalDppPurchases,
          totalPpnMasukan,
          totalNonPkpPurchases,
          netTaxPayable
        },
        outputTax: salesTaxRows,
        inputTax: purchaseTaxRows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSalesCommission = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }

    const orders = await SalesOrder.findAll({
      where: {
        tenantId: req.tenantId,
        soDate: { [Op.between]: [startDate, endDate] },
        status: { [Op.in]: ['COMPLETED', 'SHIPPED', 'DELIVERED', 'SELESAI'] }
      },
      order: [['soDate', 'ASC']]
    });

    const activeSalespersons = await Salesperson.findAll({ where: { tenantId: req.tenantId } });

    const commissions = {};
    activeSalespersons.forEach(sp => {
      commissions[sp.id] = {
        salespersonId: sp.id,
        code: sp.code,
        name: sp.name,
        commissionRate: parseFloat(sp.commissionRate || 0),
        totalSales: 0,
        totalCommission: 0,
        ordersCount: 0
      };
    });

    orders.forEach(ord => {
      const spId = ord.metadata?.salespersonId;
      const spName = ord.metadata?.salesperson || ord.metadata?.salespersonName;
      const spCode = ord.metadata?.salespersonCode;

      // Match by ID, name, or code
      let matchedSp = null;
      if (spId && commissions[spId]) {
        matchedSp = commissions[spId];
      } else {
        matchedSp = Object.values(commissions).find(
          sp => (spName && sp.name.trim().toLowerCase() === spName.trim().toLowerCase()) ||
                (spCode && sp.code && sp.code.trim().toLowerCase() === spCode.trim().toLowerCase())
        );
      }

      if (matchedSp) {
        const total = parseFloat(ord.totalAmount || 0);
        matchedSp.totalSales += total;
        matchedSp.totalCommission += total * (matchedSp.commissionRate / 100);
        matchedSp.ordersCount += 1;
      }
    });

    return res.status(200).json({ success: true, data: Object.values(commissions) });
  } catch (error) {
    next(error);
  }
};

exports.getStockMovements = async (req, res, next) => {
  try {
    const { startDate, endDate, productId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }

    const whereClause = {
      tenantId: req.tenantId,
      createdAt: {
        [Op.between]: [
          new Date(startDate + 'T00:00:00Z'),
          new Date(endDate + 'T23:59:59Z')
        ]
      }
    };
    if (productId) {
      whereClause.productId = productId;
    }

    const movements = await StockLedger.findAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'sku', 'name', 'unit', 'metadata'],
          include: [{ model: ProductUnit, as: 'units' }]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
};

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // 1. Current month sales & purchases totals
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const salesThisMonth = await SalesOrder.sum('totalAmount', {
      where: {
        tenantId,
        status: { [Op.ne]: 'CANCELLED' },
        soDate: { [Op.between]: [startOfMonth, endOfMonth] }
      }
    }) || 0;

    const purchasesThisMonth = await PurchaseOrder.sum('totalAmount', {
      where: {
        tenantId,
        status: { [Op.ne]: 'CANCELLED' },
        poDate: { [Op.between]: [startOfMonth, endOfMonth] }
      }
    }) || 0;

    // Total products, low stock, out of stock, & bonus stock
    const products = await Product.findAll({
      where: { tenantId },
      include: [
        {
          model: ProductWarehouse,
          as: 'warehouseStocks',
          attributes: ['stock', 'bonusStock', 'warehouseId']
        },
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'code']
        }
      ]
    });

    let totalProductsCount = products.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValuation = 0;
    let totalPhysicalRegularStock = 0;
    let totalPhysicalBonusStock = 0;
    const lowStockItems = [];

    const categoryMap = {};

    products.forEach(p => {
      const regularSum = p.warehouseStocks?.reduce((acc, pw) => acc + parseFloat(pw.stock || 0), 0) || 0;
      const bonusSum = p.warehouseStocks?.reduce((acc, pw) => acc + parseFloat(pw.bonusStock || 0), 0) || 0;
      const minStockThreshold = p.minStock !== undefined ? p.minStock : 10;
      
      totalPhysicalRegularStock += regularSum;
      totalPhysicalBonusStock += bonusSum;

      if (regularSum === 0) {
        outOfStockCount++;
      }

      if (regularSum <= minStockThreshold) {
        lowStockCount++;
        lowStockItems.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          currentStock: regularSum,
          bonusStock: bonusSum,
          minStock: minStockThreshold,
          purchasePrice: parseFloat(p.purchasePrice || 0),
          sellingPrice: parseFloat(p.sellingPrice || 0),
          supplier: p.supplier?.name || p.metadata?.supplier || '-',
          supplierId: p.supplierId || p.supplier?.id || null
        });
      }
      const val = regularSum * parseFloat(p.purchasePrice || 0);
      totalStockValuation += val;

      const cat = p.metadata?.category || 'Lainnya';
      categoryMap[cat] = (categoryMap[cat] || 0) + regularSum;
    });

    // Sort low stock items: 0 stock first, then lowest stock
    lowStockItems.sort((a, b) => a.currentStock - b.currentStock);

    const categoryDistribution = Object.keys(categoryMap).map(name => ({
      name,
      value: categoryMap[name]
    }));

    // 2. Monthly Trend Chart (Last 6 Months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthLabel = d.toLocaleString('id-ID', { month: 'short' });

      const mSales = await SalesOrder.sum('totalAmount', {
        where: {
          tenantId,
          status: { [Op.ne]: 'CANCELLED' },
          soDate: { [Op.between]: [mStart, mEnd] }
        }
      }) || 0;

      const mPurchases = await PurchaseOrder.sum('totalAmount', {
        where: {
          tenantId,
          status: { [Op.ne]: 'CANCELLED' },
          poDate: { [Op.between]: [mStart, mEnd] }
        }
      }) || 0;

      monthlyTrend.push({
        month: monthLabel,
        Penjualan: parseFloat(mSales),
        Pembelian: parseFloat(mPurchases)
      });
    }

    // 3. Top 5 Best Selling Products
    const topItems = await SalesOrderItem.findAll({
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('SalesOrderItem.qty')), 'totalQty'],
        [sequelize.fn('SUM', sequelize.col('SalesOrderItem.subtotal')), 'totalRevenue']
      ],
      include: [
        {
          model: SalesOrder,
          as: 'salesOrder',
          where: { tenantId, status: { [Op.ne]: 'CANCELLED' } },
          attributes: []
        },
        {
          model: Product,
          as: 'product',
          attributes: ['name', 'sku', 'unit']
        }
      ],
      group: ['productId', 'product.id', 'product.name', 'product.sku', 'product.unit'],
      order: [[sequelize.literal('totalQty'), 'DESC']],
      limit: 5
    });

    const topProducts = topItems.map(item => ({
      name: item.product?.name || item.product?.sku || `Produk #${item.productId}`,
      unit: item.product?.unit || 'PCS',
      jumlah: parseInt(item.getDataValue('totalQty') || 0, 10),
      pendapatan: parseFloat(item.getDataValue('totalRevenue') || 0)
    }));

    // 4. Recent Transactions (latest 5 Sales Orders)
    const recentSales = await SalesOrder.findAll({
      where: { tenantId },
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      order: [['soDate', 'DESC'], ['id', 'DESC']],
      limit: 5
    });

    // 5. Outbound Delivery Queue (Pending SOs for Warehouse/Manager)
    const pendingShipments = await SalesOrder.findAll({
      where: {
        tenantId,
        status: { [Op.in]: ['DRAFT', 'CONFIRMED', 'APPROVED', 'PENDING'] }
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'address'] },
        { model: SalesOrderItem, as: 'items', attributes: ['id', 'qty'] }
      ],
      order: [['soDate', 'DESC'], ['id', 'DESC']],
      limit: 6
    });

    const pendingShipmentCount = await SalesOrder.count({
      where: {
        tenantId,
        status: { [Op.in]: ['DRAFT', 'CONFIRMED', 'APPROVED', 'PENDING'] }
      }
    });

    // 6. Inbound Purchase Orders Queue (Pending POs to receive for Warehouse)
    const pendingPurchases = await PurchaseOrder.findAll({
      where: {
        tenantId,
        status: { [Op.in]: ['DRAFT', 'ORDERED', 'PENDING'] }
      },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
        { model: PurchaseOrderItem, as: 'items', attributes: ['id', 'qty'] }
      ],
      order: [['poDate', 'DESC'], ['id', 'DESC']],
      limit: 6
    });

    const pendingPurchaseCount = await PurchaseOrder.count({
      where: {
        tenantId,
        status: { [Op.in]: ['DRAFT', 'ORDERED', 'PENDING'] }
      }
    });

    // 7. Recent Deliveries / Manifests
    const recentDeliveries = await Delivery.findAll({
      where: { tenantId },
      include: [
        {
          model: SalesOrder,
          as: 'salesOrder',
          attributes: ['soNumber'],
          include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
        },
        { model: Warehouse, as: 'warehouse', attributes: ['name'] }
      ],
      order: [['deliveryDate', 'DESC'], ['id', 'DESC']],
      limit: 5
    });

    // 8. Financial Liquidity & Receivables (For Owner & Manager)
    let totalKasBank = 0;
    try {
      const kasAccounts = await ChartOfAccount.findAll({
        where: {
          tenantId,
          isActive: true,
          accountType: 'ASSET',
          [Op.or]: [
            { accountCode: { [Op.like]: '10%' } },
            { accountCode: { [Op.like]: '11%' } },
            { accountName: { [Op.like]: '%kas%' } },
            { accountName: { [Op.like]: '%bank%' } }
          ]
        }
      });
      const kasAccountIds = kasAccounts.map(a => a.id);
      if (kasAccountIds.length > 0) {
        const kasJournalItems = await JournalEntryItem.findAll({
          where: { accountId: { [Op.in]: kasAccountIds } },
          include: [{
            model: JournalEntry,
            as: 'journalEntry',
            where: { tenantId },
            attributes: []
          }]
        });
        kasJournalItems.forEach(item => {
          const amt = parseFloat(item.amount || 0);
          if (item.type === 'DEBIT') totalKasBank += amt;
          else totalKasBank -= amt;
        });
      }
    } catch (e) {
      console.warn('KasBank calculation note:', e.message);
    }

    // Receivables (Unpaid Invoices)
    let totalReceivables = 0;
    try {
      const unpaidInvoices = await Invoice.findAll({
        where: {
          tenantId,
          type: 'SALES',
          status: { [Op.ne]: 'PAID' }
        },
        attributes: ['amountDue', 'totalAmount']
      });
      totalReceivables = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue || inv.totalAmount || 0), 0);
    } catch (e) {
      console.warn('Receivables calculation note:', e.message);
    }

    // Payables (Unpaid POs)
    let totalPayables = 0;
    try {
      const unpaidPurchases = await PurchaseOrder.findAll({
        where: {
          tenantId,
          status: { [Op.ne]: 'CANCELLED' }
        },
        attributes: ['totalAmount', 'metadata']
      });
      totalPayables = unpaidPurchases.reduce((sum, po) => {
        const isPaid = po.metadata?.paymentStatus === 'PAID';
        const paidAmt = parseFloat(po.metadata?.paidAmount || 0);
        const tot = parseFloat(po.totalAmount || 0);
        return isPaid ? sum : sum + Math.max(0, tot - paidAmt);
      }, 0);
    } catch (e) {
      console.warn('Payables calculation note:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        kpi: {
          salesThisMonth: parseFloat(salesThisMonth),
          purchasesThisMonth: parseFloat(purchasesThisMonth),
          totalProductsCount,
          lowStockCount,
          outOfStockCount,
          totalStockValuation,
          totalPhysicalRegularStock,
          totalPhysicalBonusStock,
          pendingShipmentCount,
          pendingPurchaseCount,
          totalKasBank,
          totalReceivables,
          totalPayables
        },
        lowStockItems: lowStockItems.slice(0, 15),
        monthlyTrend,
        topProducts,
        categoryDistribution,
        recentSales,
        pendingShipments,
        pendingPurchases,
        recentDeliveries
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reports/driver-invoices
 * Laporan Pengiriman & Invoice Barang per Driver / Armada
 */
exports.getDriverInvoicesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, driverName, vehicleNumber, status, limit = 50, page = 1 } = req.query;
    const tenantId = req.tenantId;

    const whereClause = { tenantId };

    if (startDate && endDate) {
      whereClause.deliveryDate = {
        [Op.between]: [new Date(`${startDate}T00:00:00.000Z`), new Date(`${endDate}T23:59:59.999Z`)]
      };
    } else if (startDate) {
      whereClause.deliveryDate = { [Op.gte]: new Date(`${startDate}T00:00:00.000Z`) };
    } else if (endDate) {
      whereClause.deliveryDate = { [Op.lte]: new Date(`${endDate}T23:59:59.999Z`) };
    }

    if (driverName) {
      whereClause[Op.or] = [
        { driverName: { [Op.like]: `%${driverName}%` } },
        { vehiclePlate: { [Op.like]: `%${driverName}%` } }
      ];
    }

    if (vehicleNumber) {
      whereClause.vehiclePlate = { [Op.like]: `%${vehicleNumber}%` };
    }

    const deliveries = await Delivery.findAll({
      where: whereClause,
      include: [
        {
          model: DeliveryItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'unit', 'sellingPrice'] }]
        },
        {
          model: SalesOrder,
          as: 'salesOrder',
          attributes: ['id', 'soNumber', 'soDate', 'totalAmount', 'status'],
          include: [
            { model: Customer, as: 'customer', attributes: ['id', 'name', 'code', 'phone', 'address'] },
            { model: Invoice, as: 'invoices', attributes: ['id', 'invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount', 'status'] }
          ]
        }
      ],
      order: [['deliveryDate', 'DESC'], ['id', 'DESC']]
    });

    let totalDeliveries = 0;
    let totalItemsQty = 0;
    let totalInvoiceAmount = 0;
    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;

    const driverStatsMap = {};

    const formattedRows = deliveries.map(d => {
      const orderDoc = d.salesOrder;
      const contact = d.salesOrder?.customer;
      
      const invoice = orderDoc?.invoices?.[0] || null;
      const invoiceNumber = invoice?.invoiceNumber || '-';
      const invoiceStatus = invoice?.status || 'UNPAID';
      const invoiceAmount = parseFloat(invoice?.totalAmount || orderDoc?.totalAmount || 0);

      const itemsCount = (d.items || []).length;
      const totalQty = (d.items || []).reduce((sum, it) => sum + (parseInt(it.qty) || 0), 0);

      const driverKey = d.driverName ? d.driverName.trim() : 'Tanpa Driver (Unassigned)';
      const vehicleNum = d.vehiclePlate || '-';

      if (!driverStatsMap[driverKey]) {
        driverStatsMap[driverKey] = {
          driverName: driverKey,
          vehicleNumber: vehicleNum,
          deliveriesCount: 0,
          totalQty: 0,
          totalInvoiceAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0
        };
      }

      driverStatsMap[driverKey].deliveriesCount += 1;
      driverStatsMap[driverKey].totalQty += totalQty;
      driverStatsMap[driverKey].totalInvoiceAmount += invoiceAmount;
      if (invoiceStatus === 'PAID') {
        driverStatsMap[driverKey].paidAmount += invoiceAmount;
      } else {
        driverStatsMap[driverKey].unpaidAmount += invoiceAmount;
      }

      totalDeliveries += 1;
      totalItemsQty += totalQty;
      totalInvoiceAmount += invoiceAmount;
      if (invoiceStatus === 'PAID') {
        totalPaidAmount += invoiceAmount;
      } else {
        totalUnpaidAmount += invoiceAmount;
      }

      return {
        id: d.id,
        deliveryNumber: d.deliveryNumber,
        deliveryDate: d.deliveryDate,
        status: d.status,
        driverName: d.driverName || '—',
        vehicleNumber: d.vehiclePlate || '—',
        orderType: 'SALES',
        orderNumber: orderDoc?.soNumber || '—',
        contactName: contact?.name || '—',
        contactCode: contact?.code || '',
        contactType: 'CUSTOMER',
        invoiceNumber,
        invoiceStatus,
        invoiceAmount,
        itemsCount,
        totalQty,
        items: (d.items || []).map(it => ({
          id: it.id,
          sku: it.product?.sku || '-',
          name: it.product?.name || '-',
          unit: it.product?.unit || 'PCS',
          qty: it.qty,
          price: it.product?.sellingPrice || 0
        }))
      };
    });

    // Filter by invoice payment status if requested
    let finalRows = formattedRows;
    if (status && status !== 'ALL') {
      finalRows = finalRows.filter(r => r.invoiceStatus === status);
    }

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalDeliveries,
          totalItemsQty,
          totalInvoiceAmount,
          totalPaidAmount,
          totalUnpaidAmount,
          driversCount: Object.keys(driverStatsMap).length
        },
        driverStats: Object.values(driverStatsMap),
        deliveries: finalRows
      }
    });

  } catch (error) {
    next(error);
  }
};

exports.getBadgeCounts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(200).json({
        success: true,
        data: {
          salesOrders: 0,
          purchaseOrders: 0,
          deliveries: 0,
          finance: 0,
          stockOpname: 0,
          lowStock: 0,
          transactionsTotal: 0,
          inventoryTotal: 0
        }
      });
    }

    // 1. Sales Orders: Belum Selesai (DRAFT, PENDING, CONFIRMED, APPROVED)
    const pendingSalesOrdersPromise = SalesOrder.count({
      where: {
        tenantId,
        status: {
          [Op.in]: ['DRAFT', 'PENDING', 'CONFIRMED', 'APPROVED']
        }
      }
    });

    // 2. Purchase Orders: Belum Selesai (DRAFT, PENDING, ORDERED, APPROVED)
    const pendingPurchaseOrdersPromise = PurchaseOrder.count({
      where: {
        tenantId,
        status: {
          [Op.in]: ['DRAFT', 'PENDING', 'ORDERED', 'APPROVED']
        }
      }
    });

    // 3. Deliveries: Sedang Berjalan / Belum Tiba (PENDING, SHIPPED)
    const activeDeliveriesPromise = Delivery.count({
      where: {
        tenantId,
        status: {
          [Op.in]: ['PENDING', 'SHIPPED']
        }
      }
    });

    // 4. Finance / Invoices: Belum Lunas (UNPAID, PARTIAL, PARTIALLY_PAID)
    const pendingInvoicesPromise = Invoice.count({
      where: {
        tenantId,
        status: {
          [Op.in]: ['UNPAID', 'PARTIAL', 'PARTIALLY_PAID']
        }
      }
    });

    // 5. Stock Opname: Masih Draft
    const draftStockOpnamesPromise = StockOpname.count({
      where: {
        tenantId,
        status: 'DRAFT'
      }
    });

    // 6. Low stock products (total regular stock <= minStock)
    const productsPromise = Product.findAll({
      where: { tenantId },
      attributes: ['id', 'minStock'],
      include: [
        {
          model: ProductWarehouse,
          as: 'warehouseStocks',
          attributes: ['stock']
        }
      ]
    });

    const [
      salesOrders,
      purchaseOrders,
      deliveries,
      invoices,
      stockOpnames,
      products
    ] = await Promise.all([
      pendingSalesOrdersPromise.catch(() => 0),
      pendingPurchaseOrdersPromise.catch(() => 0),
      activeDeliveriesPromise.catch(() => 0),
      pendingInvoicesPromise.catch(() => 0),
      draftStockOpnamesPromise.catch(() => 0),
      productsPromise.catch(() => [])
    ]);

    let lowStock = 0;
    if (Array.isArray(products)) {
      products.forEach(p => {
        const regularSum = p.warehouseStocks?.reduce((acc, pw) => acc + parseFloat(pw.stock || 0), 0) || 0;
        const minStockThreshold = p.minStock !== undefined ? p.minStock : 10;
        if (regularSum <= minStockThreshold) {
          lowStock++;
        }
      });
    }

    const soCount = Number(salesOrders) || 0;
    const poCount = Number(purchaseOrders) || 0;
    const delivCount = Number(deliveries) || 0;
    const invCount = Number(invoices) || 0;
    const soOpnameCount = Number(stockOpnames) || 0;

    return res.status(200).json({
      success: true,
      data: {
        salesOrders: soCount,
        purchaseOrders: poCount,
        deliveries: delivCount,
        finance: invCount,
        stockOpname: soOpnameCount,
        lowStock: lowStock,
        transactionsTotal: soCount + poCount + delivCount,
        inventoryTotal: soOpnameCount
      }
    });
  } catch (error) {
    next(error);
  }
};




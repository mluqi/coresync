const { JournalEntry, JournalEntryItem, ChartOfAccount } = require('../models');

/**
 * Helper to fetch accounts dictionary for a tenant by their standard codes
 */
async function getAccountsMap(tenantId, transaction) {
  const accounts = await ChartOfAccount.findAll({
    where: { tenantId, isActive: true },
    transaction
  });

  const map = {};
  accounts.forEach(acc => {
    map[acc.accountCode] = acc.id;
  });
  return map;
}

/**
 * Post journal entry for Sales Invoice or Purchase Invoice/Bill
 */
async function postInvoiceJournal(invoice, transaction) {
  const tenantId = invoice.tenantId;
  const accountsMap = await getAccountsMap(tenantId, transaction);
  
  const subtotal = parseFloat(invoice.subtotal);
  const taxAmount = parseFloat(invoice.taxAmount);
  const totalAmount = parseFloat(invoice.totalAmount);

  if (totalAmount <= 0) return;

  // Create base journal entry
  const journal = await JournalEntry.create({
    tenantId,
    transactionDate: invoice.invoiceDate,
    referenceType: 'INVOICE',
    referenceId: invoice.id,
    description: invoice.type === 'SALES'
      ? `Faktur Penjualan No. ${invoice.invoiceNumber}`
      : `Faktur Pembelian No. ${invoice.invoiceNumber}`
  }, { transaction });

  const items = [];

  if (invoice.type === 'SALES') {
    const piutangAccId = accountsMap['11001']; // Piutang Dagang
    const pendapatanAccId = accountsMap['40001']; // Pendapatan Penjualan
    const utangPpnAccId = accountsMap['22001']; // Utang Pajak PPN

    if (!piutangAccId || !pendapatanAccId) {
      throw new Error('Required accounts for Sales Invoice journaling are missing.');
    }

    // Debit: Piutang Dagang (Total Tagihan)
    items.push({
      journalEntryId: journal.id,
      accountId: piutangAccId,
      type: 'DEBIT',
      amount: totalAmount
    });

    // Credit: Pendapatan Penjualan (DPP / Subtotal)
    items.push({
      journalEntryId: journal.id,
      accountId: pendapatanAccId,
      type: 'CREDIT',
      amount: subtotal
    });

    // Credit: Utang Pajak PPN (PPN Keluaran) if applicable
    if (taxAmount > 0 && utangPpnAccId) {
      items.push({
        journalEntryId: journal.id,
        accountId: utangPpnAccId,
        type: 'CREDIT',
        amount: taxAmount
      });
    }

  } else { // PURCHASE Bill
    const persediaanAccId = accountsMap['12001']; // Persediaan Barang
    const utangDagangAccId = accountsMap['21001']; // Hutang Dagang
    const utangPpnAccId = accountsMap['22001']; // Utang Pajak PPN (Offsetting PPN Masukan)

    if (!persediaanAccId || !utangDagangAccId) {
      throw new Error('Required accounts for Purchase Invoice journaling are missing.');
    }

    // Check if purchase price is tax inclusive (didalam harga)
    let isTaxInclusive = invoice.metadata?.taxInclusive === true;
    if (invoice.metadata?.taxInclusive === undefined && invoice.purchaseOrderId) {
      const po = invoice.purchaseOrder || await sequelize.models.PurchaseOrder.findByPk(invoice.purchaseOrderId, { transaction });
      if (po?.metadata?.taxInclusive !== undefined) {
        isTaxInclusive = po.metadata.taxInclusive === true;
      }
    }

    if (isTaxInclusive) {
      // Jika harga sudah termasuk pajak (didalam harga):
      // Seluruh nominal pembelian langsung menjadi nilai persediaan barang (HPP utuh),
      // dan tidak masuk ke akun Utang Pajak PPN (22001).
      items.push({
        journalEntryId: journal.id,
        accountId: persediaanAccId,
        type: 'DEBIT',
        amount: totalAmount
      });
    } else {
      // Jika pajak di luar harga (ditambahkan / tax exclusive):
      // Debit: Persediaan Barang (Subtotal / DPP)
      items.push({
        journalEntryId: journal.id,
        accountId: persediaanAccId,
        type: 'DEBIT',
        amount: subtotal
      });

      // Debit: PPN Masukan ke akun Utang Pajak PPN (22001) hanya jika pajak di luar harga
      if (taxAmount > 0 && utangPpnAccId) {
        items.push({
          journalEntryId: journal.id,
          accountId: utangPpnAccId,
          type: 'DEBIT',
          amount: taxAmount
        });
      }
    }

    // Credit: Hutang Dagang (Total Tagihan)
    items.push({
      journalEntryId: journal.id,
      accountId: utangDagangAccId,
      type: 'CREDIT',
      amount: totalAmount
    });
  }

  await JournalEntryItem.bulkCreate(items, { transaction });
  return journal;
}

/**
 * Update existing journal entry for Invoice, or create new if not yet present
 */
async function syncOrPostInvoiceJournal(invoice, transaction) {
  const tenantId = invoice.tenantId;
  const accountsMap = await getAccountsMap(tenantId, transaction);
  const totalAmount = parseFloat(invoice.totalAmount || 0);
  const subtotal = parseFloat(invoice.subtotal || 0);
  const taxAmount = parseFloat(invoice.taxAmount || 0);

  if (totalAmount <= 0) return;

  const existingJournal = await JournalEntry.findOne({
    where: { tenantId, referenceType: 'INVOICE', referenceId: invoice.id },
    transaction
  });

  if (!existingJournal) {
    return await postInvoiceJournal(invoice, transaction);
  }

  // Update transactionDate & description
  await existingJournal.update({
    transactionDate: invoice.invoiceDate,
    description: invoice.type === 'SALES'
      ? `Faktur Penjualan No. ${invoice.invoiceNumber}`
      : `Faktur Pembelian No. ${invoice.invoiceNumber}`
  }, { transaction });

  // Re-create items with updated amounts
  await JournalEntryItem.destroy({
    where: { journalEntryId: existingJournal.id },
    transaction
  });

  const items = [];
  if (invoice.type === 'SALES') {
    const piutangAccId = accountsMap['11001'];
    const pendapatanAccId = accountsMap['40001'];
    const utangPpnAccId = accountsMap['22001'];

    if (piutangAccId && pendapatanAccId) {
      items.push({
        journalEntryId: existingJournal.id,
        accountId: piutangAccId,
        type: 'DEBIT',
        amount: totalAmount
      });
      items.push({
        journalEntryId: existingJournal.id,
        accountId: pendapatanAccId,
        type: 'CREDIT',
        amount: subtotal
      });
      if (taxAmount > 0 && utangPpnAccId) {
        items.push({
          journalEntryId: existingJournal.id,
          accountId: utangPpnAccId,
          type: 'CREDIT',
          amount: taxAmount
        });
      }
    }
  } else {
    const persediaanAccId = accountsMap['12001'];
    const utangDagangAccId = accountsMap['21001'];
    const utangPpnAccId = accountsMap['22001'];

    if (persediaanAccId && utangDagangAccId) {
      const isTaxInclusive = invoice.metadata?.taxInclusive === true;
      if (isTaxInclusive) {
        items.push({
          journalEntryId: existingJournal.id,
          accountId: persediaanAccId,
          type: 'DEBIT',
          amount: totalAmount
        });
      } else {
        items.push({
          journalEntryId: existingJournal.id,
          accountId: persediaanAccId,
          type: 'DEBIT',
          amount: subtotal
        });
        if (taxAmount > 0 && utangPpnAccId) {
          items.push({
            journalEntryId: existingJournal.id,
            accountId: utangPpnAccId,
            type: 'DEBIT',
            amount: taxAmount
          });
        }
      }
      items.push({
        journalEntryId: existingJournal.id,
        accountId: utangDagangAccId,
        type: 'CREDIT',
        amount: totalAmount
      });
    }
  }

  if (items.length > 0) {
    await JournalEntryItem.bulkCreate(items, { transaction });
  }

  return existingJournal;
}

/**
 * Post journal entry for Delivery Note (recognizes HPP & reduces inventory)
 */
async function postDeliveryJournal(delivery, calculatedHpp, transaction) {
  if (calculatedHpp <= 0) return;

  const tenantId = delivery.tenantId;
  const accountsMap = await getAccountsMap(tenantId, transaction);

  const hppAccId = accountsMap['50001']; // Harga Pokok Penjualan (HPP)
  const persediaanAccId = accountsMap['12001']; // Persediaan Barang

  if (!hppAccId || !persediaanAccId) {
    throw new Error('Required accounts for Delivery Note HPP journaling are missing.');
  }

  const journal = await JournalEntry.create({
    tenantId,
    transactionDate: delivery.deliveryDate,
    referenceType: 'STOCK_DELIVERY',
    referenceId: delivery.id,
    description: `HPP Pengiriman No. ${delivery.deliveryNumber}`
  }, { transaction });

  await JournalEntryItem.bulkCreate([
    // Debit: HPP
    {
      journalEntryId: journal.id,
      accountId: hppAccId,
      type: 'DEBIT',
      amount: calculatedHpp
    },
    // Credit: Persediaan Barang
    {
      journalEntryId: journal.id,
      accountId: persediaanAccId,
      type: 'CREDIT',
      amount: calculatedHpp
    }
  ], { transaction });

  return journal;
}

/**
 * Otomatis tentukan akun Kas atau Bank berdasarkan metode pembayaran:
 * - CASH / Tunai -> Akun Kas (10001 / Kas)
 * - BANK_TRANSFER, GIRO, QRIS, E_WALLET, OTHERS -> Akun Bank (10002 / Bank)
 */
async function resolvePaymentAccountId(tenantId, paymentMethod, requestedAccountId, transaction) {
  if (requestedAccountId) {
    const parsed = parseInt(requestedAccountId, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const accounts = await ChartOfAccount.findAll({
    where: { tenantId, isActive: true },
    transaction
  });

  if (!accounts || accounts.length === 0) return null;

  const isCash = !paymentMethod || paymentMethod.toUpperCase() === 'CASH';

  if (isCash) {
    const kasAcc = accounts.find(a => a.accountCode === '10001') ||
                   accounts.find(a => (a.accountName || '').toLowerCase().includes('kas') || (a.accountName || '').toLowerCase().includes('tunai')) ||
                   accounts.find(a => a.accountType === 'ASSET') ||
                   accounts[0];
    return kasAcc ? kasAcc.id : null;
  } else {
    const bankAcc = accounts.find(a => a.accountCode === '10002') ||
                    accounts.find(a => (a.accountName || '').toLowerCase().includes('bank')) ||
                    accounts.find(a => a.accountCode === '10001') ||
                    accounts.find(a => a.accountType === 'ASSET') ||
                    accounts[0];
    return bankAcc ? bankAcc.id : null;
  }
}

/**
 * Post journal entry for Payments (Receipts/Disbursements)
 */
async function postPaymentJournal(payment, transaction) {
  const tenantId = payment.tenantId;
  const accountsMap = await getAccountsMap(tenantId, transaction);
  const amount = parseFloat(payment.amount);

  if (amount <= 0) return;

  // Determine category description & target accounts
  let debitAccId = null;
  let creditAccId = null;
  let categoryDesc = '';

  let kasBankAccId = payment.accountId; // Kas/Bank used for payment (ASSET)
  if (!kasBankAccId) {
    kasBankAccId = await resolvePaymentAccountId(tenantId, payment.paymentMethod, null, transaction);
  }

  if (payment.paymentType === 'RECEIPT') {
    // Uang Masuk
    debitAccId = kasBankAccId;
    categoryDesc = 'Penerimaan';
    
    // Determine credit account based on invoice/category
    if (payment.invoiceId) {
      creditAccId = accountsMap['11001']; // Piutang Dagang
      categoryDesc += ` Pelunasan Piutang`;
    } else {
      creditAccId = accountsMap['30001']; // Default to Modal Owner/Others for manual cash-in
      categoryDesc += ' Kas Masuk Manual';
    }
  } else {
    // Uang Keluar (DISBURSEMENT)
    creditAccId = kasBankAccId;
    categoryDesc = 'Pengeluaran';

    if (payment.invoiceId) {
      debitAccId = accountsMap['21001']; // Hutang Dagang
      categoryDesc += ` Pelunasan Hutang`;
    } else {
      // Manual Disbursement mapping based on notes/category
      // (E.g. Operational Expense, Tax Payment)
      const notesLower = (payment.notes || '').toLowerCase();
      if (notesLower.includes('listrik') || notesLower.includes('gaji') || notesLower.includes('operasional') || notesLower.includes('sewa')) {
        debitAccId = accountsMap['60001']; // Beban Operasional
        categoryDesc += ' Beban Operasional';
      } else if (notesLower.includes('pajak') || notesLower.includes('ppn')) {
        debitAccId = accountsMap['22001']; // Utang Pajak PPN
        categoryDesc += ' Setor Pajak PPN';
      } else {
        debitAccId = accountsMap['60001']; // Default to Beban Operasional for safety
        categoryDesc += ' Kas Keluar Manual';
      }
    }
  }

  if (!debitAccId || !creditAccId) {
    throw new Error('Required accounts for Payment journaling are missing.');
  }

  const journal = await JournalEntry.create({
    tenantId,
    transactionDate: payment.paymentDate,
    referenceType: 'PAYMENT',
    referenceId: payment.id,
    description: `${categoryDesc} - No. ${payment.paymentNumber}`,
    metadata: payment.metadata || null
  }, { transaction });

  await JournalEntryItem.bulkCreate([
    // Debit Account
    {
      journalEntryId: journal.id,
      accountId: debitAccId,
      type: 'DEBIT',
      amount
    },
    // Credit Account
    {
      journalEntryId: journal.id,
      accountId: creditAccId,
      type: 'CREDIT',
      amount
    }
  ], { transaction });

  return journal;
}

/**
 * Post journal entry for Returns (Sales Return / Purchase Return)
 */
async function postReturnJournal(returnDoc, transaction) {
  const tenantId = returnDoc.tenantId;
  const accountsMap = await getAccountsMap(tenantId, transaction);
  const amount = parseFloat(returnDoc.totalAmount);

  if (amount <= 0) return;

  const persediaanAccId = accountsMap['12001']; // Persediaan Barang
  const piutangAccId = accountsMap['11001']; // Piutang Dagang
  const pendapatanAccId = accountsMap['40001']; // Pendapatan Penjualan
  const utangDagangAccId = accountsMap['21001']; // Hutang Dagang

  if (!persediaanAccId) {
    throw new Error('Required inventory account for Return journaling is missing.');
  }

  const journal = await JournalEntry.create({
    tenantId,
    transactionDate: returnDoc.returnDate || new Date().toISOString().split('T')[0],
    referenceType: 'RETURN',
    referenceId: returnDoc.id,
    description: returnDoc.type === 'SALES_RETURN'
      ? `Retur Penjualan No. ${returnDoc.returnNumber}`
      : `Retur Pembelian No. ${returnDoc.returnNumber}`
  }, { transaction });

  const items = [];

  if (returnDoc.type === 'SALES_RETURN') {
    items.push({
      journalEntryId: journal.id,
      accountId: persediaanAccId,
      type: 'DEBIT',
      amount
    });
    items.push({
      journalEntryId: journal.id,
      accountId: pendapatanAccId || piutangAccId,
      type: 'CREDIT',
      amount
    });
  } else {
    items.push({
      journalEntryId: journal.id,
      accountId: utangDagangAccId || persediaanAccId,
      type: 'DEBIT',
      amount
    });
    items.push({
      journalEntryId: journal.id,
      accountId: persediaanAccId,
      type: 'CREDIT',
      amount
    });
  }

  await JournalEntryItem.bulkCreate(items, { transaction });
  return journal;
}

module.exports = {
  resolvePaymentAccountId,
  postInvoiceJournal,
  syncOrPostInvoiceJournal,
  postDeliveryJournal,
  postPaymentJournal,
  postReturnJournal
};

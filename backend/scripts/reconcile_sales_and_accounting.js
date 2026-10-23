require('dotenv').config({ path: './.env' });
const {
  sequelize,
  Tenant,
  SalesOrder,
  SalesOrderItem,
  Invoice,
  Delivery,
  DeliveryItem,
  Product,
  JournalEntry,
  JournalEntryItem,
  ChartOfAccount,
  Payment,
  ProductWarehouse,
  IncomingBatch,
  StockLedger
} = require('../models');
const { postInvoiceJournal } = require('../utils/journalEngine');

async function reconcileTenant(tenantId, isDryRun) {
  const transaction = await sequelize.transaction();

  try {
    const tenant = await Tenant.findByPk(tenantId, { transaction });
    console.log(`\n===============================================================`);
    console.log(`[TENANT #${tenantId}] ${tenant?.companyName || 'Tenant'} - ${isDryRun ? 'DRY-RUN (SIMULASI)' : 'APPLY (KOMIT KE DATABASE)'}`);
    console.log(`===============================================================`);

    // 1. Chart of Accounts mapping
    const coas = await ChartOfAccount.findAll({ where: { tenantId }, transaction });
    const coaMap = {};
    coas.forEach(c => { coaMap[c.accountCode] = c.id; });

    // Fallbacks if standard codes differ
    const arAccId = coaMap['11001'] || coas.find(c => c.accountType === 'ASSET' && /piutang/i.test(c.accountName))?.id;
    const revAccId = coaMap['40001'] || coas.find(c => c.accountType === 'REVENUE')?.id;
    const taxAccId = coaMap['22001'] || coas.find(c => /ppn|pajak/i.test(c.accountName))?.id;
    const hppAccId = coaMap['50001'] || coas.find(c => c.accountType === 'EXPENSE' && /hpp|pokok/i.test(c.accountName))?.id;
    const invAccId = coaMap['12001'] || coas.find(c => c.accountType === 'ASSET' && /persediaan/i.test(c.accountName))?.id;
    const modalAccId = coaMap['30001'] || coas.find(c => c.accountType === 'EQUITY')?.id;

    console.log(`COA IDs Mapping:`, {
      '11001 Piutang': arAccId,
      '40001 Pendapatan': revAccId,
      '22001 Utang Pajak PPN': taxAccId,
      '50001 Beban HPP': hppAccId,
      '12001 Persediaan': invAccId,
      '30001 Modal Owner': modalAccId
    });

    if (!arAccId || !revAccId || !hppAccId || !invAccId) {
      console.warn(`[WARNING] Akun COA wajib belum lengkap untuk tenant #${tenantId}. Melewati tenant ini.`);
      await transaction.rollback();
      return;
    }

    // 2. Process Sales Orders without Invoice
    const sos = await SalesOrder.findAll({
      where: { tenantId },
      include: [
        { model: Invoice, as: 'invoices' },
        { model: SalesOrderItem, as: 'items' }
      ],
      order: [['id', 'ASC']],
      transaction
    });

    let newInvoicesCount = 0;
    let totalNewRevenue = 0;

    for (const so of sos) {
      if (so.status === 'CANCELLED') continue;

      let invoice = so.invoices && so.invoices.length > 0 ? so.invoices[0] : null;

      if (!invoice) {
        let invNumber = so.soNumber.startsWith('SO.') ? so.soNumber.replace(/^SO\./, 'INV.') : `INV-${so.soNumber.replace(/^SO-/, '')}`;
        const conflict = await Invoice.findOne({ where: { tenantId, invoiceNumber: invNumber }, transaction });
        if (conflict) {
          invNumber = `${invNumber}-${so.id}`;
        }

        const soMeta = so.metadata || {};
        const totalAmount = parseFloat(so.totalAmount || 0);

        // Cari riwayat pembayaran yang berhubungan dengan SO ini
        const matchingPayments = await Payment.findAll({
          where: {
            tenantId,
            paymentNumber: { [sequelize.Sequelize.Op.like]: `%${so.soNumber}%` }
          },
          transaction
        });

        let paidAmount = 0;
        matchingPayments.forEach(p => { paidAmount += parseFloat(p.amount || 0); });
        if (paidAmount === 0 && soMeta.paidAmount) {
          paidAmount = parseFloat(soMeta.paidAmount || 0);
        }

        const invAmountDue = Math.max(0, totalAmount - paidAmount);
        let invStatus = 'UNPAID';
        if (paidAmount >= totalAmount - 0.01) invStatus = 'PAID';
        else if (paidAmount > 0) invStatus = 'PARTIAL';

        const invDueDate = soMeta.dueDate || so.soDate || new Date();

        invoice = await Invoice.create({
          tenantId,
          salesOrderId: so.id,
          type: 'SALES',
          invoiceNumber: invNumber,
          invoiceDate: so.soDate || so.createdAt,
          dueDate: invDueDate,
          status: invStatus,
          subtotal: so.subtotal || totalAmount,
          taxAmount: so.taxAmount || 0,
          totalAmount: totalAmount,
          amountDue: invAmountDue,
          metadata: {
            contactName: soMeta.customerName || soMeta.contactName,
            salespersonName: soMeta.salespersonName || soMeta.salesperson
          }
        }, { transaction });

        // Terbitkan Jurnal Akrual Pendapatan Penjualan
        await postInvoiceJournal(invoice, transaction);
        newInvoicesCount++;
        totalNewRevenue += totalAmount;

        // Hubungkan payment yang sebelumnya invoiceId-nya kosong
        for (const p of matchingPayments) {
          await p.update({ invoiceId: invoice.id }, { transaction });

          // Perbaiki Jurnal Pembayaran jika sebelumnya salah mengkredit Modal Owner
          const pJournal = await JournalEntry.findOne({
            where: { tenantId, referenceType: 'PAYMENT', referenceId: p.id },
            include: [{ model: JournalEntryItem, as: 'items' }],
            transaction
          });

          if (pJournal && modalAccId) {
            for (const it of pJournal.items) {
              if (it.accountId === modalAccId && it.type === 'CREDIT') {
                await it.update({ accountId: arAccId }, { transaction });
              }
            }
          }
        }
      }
    }

    console.log(`✓ Penerbitan Faktur: ${newInvoicesCount} faktur baru dibuat. Total nilai pendapatan baru: Rp ${totalNewRevenue.toLocaleString('id-ID')}`);

    // 3. Normalisasi HPP Surat Jalan (Delivery) & Jurnal HPP
    const deliveries = await Delivery.findAll({
      where: { tenantId },
      include: [
        { model: DeliveryItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: SalesOrder, as: 'salesOrder' }
      ],
      order: [['id', 'ASC']],
      transaction
    });

    let correctedDeliveriesCount = 0;
    let totalOldHpp = 0;
    let totalNewHpp = 0;

    for (const d of deliveries) {
      const so = d.salesOrder;
      const itemsDetail = so?.metadata?.itemsDetail || [];
      let dTrueHpp = 0;

      for (const item of (d.items || [])) {
        const prod = item.product;
        const baseCost = prod ? Number(prod.purchasePrice || 0) : 0;
        const detail = itemsDetail.find(it => it.productId === item.productId);
        let ratio = 1;
        if (detail && detail.conversionRatio) {
          ratio = Number(detail.conversionRatio);
        }
        const baseQty = Number(item.qtyShipped) * ratio;
        dTrueHpp += (baseQty * baseCost);
      }

      dTrueHpp = Math.round(dTrueHpp);
      const oldHpp = Number(d.metadata?.calculatedHpp || 0);
      totalOldHpp += oldHpp;
      totalNewHpp += dTrueHpp;

      // Update metadata delivery
      await d.update({
        metadata: { ...(d.metadata || {}), calculatedHpp: dTrueHpp }
      }, { transaction });

      // Cari atau buat Jurnal STOCK_DELIVERY
      let dJournal = await JournalEntry.findOne({
        where: { tenantId, referenceType: 'STOCK_DELIVERY', referenceId: d.id },
        include: [{ model: JournalEntryItem, as: 'items' }],
        transaction
      });

      if (dJournal) {
        for (const it of dJournal.items) {
          await it.update({ amount: dTrueHpp }, { transaction });
        }
        correctedDeliveriesCount++;
      } else {
        dJournal = await JournalEntry.create({
          tenantId,
          transactionDate: d.deliveryDate || d.createdAt,
          referenceType: 'STOCK_DELIVERY',
          referenceId: d.id,
          description: `Pengeluaran Persediaan Surat Jalan ${d.deliveryNumber}`,
          metadata: { deliveryId: d.id, deliveryNumber: d.deliveryNumber }
        }, { transaction });

        await JournalEntryItem.bulkCreate([
          {
            journalEntryId: dJournal.id,
            accountId: hppAccId,
            type: 'DEBIT',
            amount: dTrueHpp
          },
          {
            journalEntryId: dJournal.id,
            accountId: invAccId,
            type: 'CREDIT',
            amount: dTrueHpp
          }
        ], { transaction });
        correctedDeliveriesCount++;
      }
    }

    console.log(`✓ Koreksi HPP: ${correctedDeliveriesCount} surat jalan dinormalisasi.`);
    console.log(`  - Total HPP Lama: Rp ${totalOldHpp.toLocaleString('id-ID')}`);
    console.log(`  - Total HPP Benar: Rp ${totalNewHpp.toLocaleString('id-ID')}`);

    // 4. Koreksi Kelebihan Potong Stok Akibat Belum Diterapkannya Rasio Satuan
    let restoredStockItemsCount = 0;

    for (const d of deliveries) {
      const itemsDetail = d.salesOrder?.metadata?.itemsDetail || [];
      for (const item of (d.items || [])) {
        const detail = itemsDetail.find(it => it.productId === item.productId);
        const ratio = Number(detail?.conversionRatio || 1);
        if (ratio < 1) {
          const ledger = await StockLedger.findOne({
            where: {
              tenantId,
              referenceType: 'DELIVERY_NOTE',
              referenceId: d.id,
              productId: item.productId
            },
            transaction
          });

          if (ledger) {
            const qtyDeducted = Number(ledger.qty);
            const correctDeductQty = parseFloat((Number(item.qtyShipped) * ratio).toFixed(4));
            const restoreQty = parseFloat((qtyDeducted - correctDeductQty).toFixed(4));

            if (restoreQty > 0.0001) {
              await ledger.update({ qty: correctDeductQty }, { transaction });

              const pwh = await ProductWarehouse.findOne({
                where: {
                  tenantId,
                  productId: item.productId,
                  warehouseId: ledger.warehouseId
                },
                transaction
              });
              if (pwh) {
                const newStock = parseFloat(pwh.stock || 0) + restoreQty;
                await pwh.update({ stock: newStock }, { transaction });
              }

              if (ledger.incomingBatchId) {
                const batch = await IncomingBatch.findByPk(ledger.incomingBatchId, { transaction });
                if (batch) {
                  const newBatchQty = parseFloat(batch.currentQty || 0) + restoreQty;
                  await batch.update({ currentQty: newBatchQty }, { transaction });
                }
              }

              restoredStockItemsCount++;
            }
          }
        }
      }
    }
    console.log(`✓ Restorasi Stok Gudang: ${restoredStockItemsCount} item disesuaikan kembali ke gudang.`);

    // 5. Verifikasi Laporan Laba Rugi Akhir
    const entries = await JournalEntry.findAll({
      where: { tenantId },
      include: [{ model: JournalEntryItem, as: 'items' }],
      transaction
    });

    const balances = {};
    coas.forEach(acc => {
      balances[acc.id] = { id: acc.id, code: acc.accountCode, name: acc.accountName, type: acc.accountType, debit: 0, credit: 0, balance: 0 };
    });

    entries.forEach(e => {
      e.items.forEach(it => {
        const b = balances[it.accountId];
        if (b) {
          if (it.type === 'DEBIT') b.debit += Number(it.amount);
          else b.credit += Number(it.amount);
        }
      });
    });

    let totalRev = 0, finalHpp = 0, totalExpenses = 0;
    Object.values(balances).forEach(b => {
      if (b.type === 'REVENUE') {
        b.balance = b.credit - b.debit;
        totalRev += b.balance;
      } else if (b.type === 'EXPENSE') {
        b.balance = b.debit - b.credit;
        if (b.code.startsWith('5')) finalHpp += b.balance;
        else totalExpenses += b.balance;
      }
    });

    const grossProfit = totalRev - finalHpp;
    const netProfit = grossProfit - totalExpenses;

    console.log(`\n--- RINGKASAN LABA RUGI TENANT #${tenantId} ---`);
    console.log(`Total Pendapatan (Revenue)      : Rp ${totalRev.toLocaleString('id-ID')}`);
    console.log(`Total Beban HPP (COGS)          : Rp ${finalHpp.toLocaleString('id-ID')}`);
    console.log(`Laba Kotor (Gross Profit)       : Rp ${grossProfit.toLocaleString('id-ID')}`);
    console.log(`Laba Bersih (Net Profit)        : Rp ${netProfit.toLocaleString('id-ID')}`);

    // Keseimbangan Jurnal
    let grandDebit = 0, grandCredit = 0;
    entries.forEach(e => {
      e.items.forEach(it => {
        if (it.type === 'DEBIT') grandDebit += Number(it.amount);
        else grandCredit += Number(it.amount);
      });
    });
    const isBalanced = Math.abs(grandDebit - grandCredit) < 0.01;
    console.log(`Status Keseimbangan Jurnal      : ${isBalanced ? 'BALANCE (100% SEIMBANG)' : 'TIDAK SEIMBANG'}`);

    if (isDryRun) {
      await transaction.rollback();
      console.log(`\n[HASIL]: DRY RUN SELESAI. Semua perubahan DI-ROLLBACK (data tidak disentuh).`);
    } else {
      await transaction.commit();
      console.log(`\n[HASIL]: SUKSES. Perubahan DI-COMMIT ke database.`);
    }

  } catch (err) {
    await transaction.rollback();
    console.error(`[ERROR] Terjadi kesalahan pada Tenant #${tenantId}:`, err);
    throw err;
  }
}

async function main() {
  const isApply = process.env.APPLY === 'true';
  const targetTenantEnv = process.env.TENANT_ID;

  let tenantIds = [];
  if (targetTenantEnv && targetTenantEnv.toLowerCase() === 'all') {
    const tenants = await Tenant.findAll();
    tenantIds = tenants.map(t => t.id);
  } else if (targetTenantEnv) {
    tenantIds = [parseInt(targetTenantEnv, 10)];
  } else {
    // Default tenant 1 jika tidak dispesifikasikan
    tenantIds = [1];
  }

  console.log(`Mode Eksekusi: ${isApply ? 'APPLY (KOMIT KE DATABASE)' : 'SIMULASI / DRY-RUN (AMAN)'}`);
  console.log(`Target Tenant : ${tenantIds.join(', ')}`);
  if (!isApply) {
    console.log(`Petunjuk: Jalankan dengan awalan 'APPLY=true' jika ingin menerapkan ke database.`);
  }

  for (const tId of tenantIds) {
    await reconcileTenant(tId, !isApply);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

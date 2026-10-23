/**
 * Script Simulasi 12 Faktur Sales Order (SO)
 * - 12 Faktur Sales Order ke 12 Toko Berbeda
 * - Masing-masing pemesanan berisi 5 barang berbeda
 * - Kombinasi 6 Faktur PKP (PPN 11%) dan 6 Faktur Non-PKP (Non-PPN 0%)
 * - Kombinasi pembayaran TUNAI (COD) dan TEMPO (Kredit)
 * - Otomatis menerbitkan Faktur Penjualan (Invoice) dan Surat Jalan (Delivery)
 *   yang langsung siap dimuat ke dalam Dokumen Manifest Pengiriman!
 *
 * Cara Menjalankan:
 * node scripts/simulate_12_invoices.js
 */

const { 
  sequelize, 
  SalesOrder, 
  SalesOrderItem, 
  Invoice, 
  Delivery, 
  DeliveryItem, 
  Product, 
  Customer, 
  Warehouse, 
  Tax, 
  Salesperson, 
  ProductWarehouse, 
  Supplier 
} = require('../models');

async function runSimulation() {
  console.log('\n================================================================');
  console.log('  SIMULASI 12 FAKTUR SALES ORDER (PKP & NON-PKP, 5 ITEM/FAKTUR)');
  console.log('================================================================\n');

  const tenantId = 1;
  const warehouseId = 1; // Gudang Tegal
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Ambil 12 Customer
  const customers = await Customer.findAll({
    where: { tenantId },
    limit: 12,
    order: [['id', 'ASC']]
  });

  if (customers.length < 12) {
    console.error(`Jumlah customer tidak cukup (hanya ada ${customers.length}). Butuh minimal 12 customer.`);
    process.exit(1);
  }

  // 2. Ambil Pajak (PPN 11% & Non-PPN)
  const taxPkp = await Tax.findOne({ where: { tenantId, rate: 11 } }) || await Tax.findOne({ where: { tenantId, id: 1 } });
  const taxNonPkp = await Tax.findOne({ where: { tenantId, rate: 0 } }) || await Tax.findOne({ where: { tenantId, id: 2 } });

  console.log(`Pajak PKP: ${taxPkp ? taxPkp.name + ' (' + taxPkp.rate + '%)' : 'PPN 11%'}`);
  console.log(`Pajak Non-PKP: ${taxNonPkp ? taxNonPkp.name + ' (' + taxNonPkp.rate + '%)' : 'Non-PPN 0%'}\n`);

  // 3. Ambil Salespersons
  const salespersons = await Salesperson.findAll({ where: { tenantId }, limit: 6 });

  // 4. Ambil Produk Valid (Stock > 0 & Selling Price > 0)
  const pwhs = await ProductWarehouse.findAll({
    where: { warehouseId },
    include: [{ 
      model: Product, 
      as: 'product', 
      include: [{ model: Supplier, as: 'supplier' }] 
    }]
  });

  const validProducts = pwhs
    .map(pw => pw.product)
    .filter(p => p && parseFloat(p.sellingPrice) > 0);

  if (validProducts.length < 25) {
    console.error(`Produk valid tidak mencukupi (hanya ada ${validProducts.length}).`);
    process.exit(1);
  }

  console.log(`Tersedia ${validProducts.length} produk siap jual di Gudang Tegal.\n`);

  // Nomor urut awal SO
  const latestSo = await SalesOrder.findOne({
    where: { tenantId },
    order: [['id', 'DESC']]
  });
  let nextSeq = (latestSo?.id || 0) + 1;

  const createdSummary = [];

  for (let i = 0; i < 12; i++) {
    const cust = customers[i];
    const isPkp = i % 2 === 0; // Genap = PKP, Ganjil = Non-PKP
    const effectiveTax = isPkp ? taxPkp : taxNonPkp;
    const taxRate = isPkp ? (parseFloat(effectiveTax?.rate) || 11.0) : 0.0;

    const isCash = i % 3 === 0; // Sebagian TUNAI, sebagian TEMPO
    const paymentTerm = isCash ? 'CASH' : (i % 2 === 0 ? 'TEMPO 14 HARI' : 'TEMPO 30 HARI');

    const sp = salespersons[i % salespersons.length];

    // Pilih 5 barang berbeda untuk faktur ini
    // Menggunakan offset agar variasi produk beragam antar faktur
    const startIdx = (i * 3) % (validProducts.length - 10);
    const selectedProds = validProducts.slice(startIdx, startIdx + 5);

    const yearMonth = todayStr.substring(0, 7).replace('-', '.');
    const soNumber = `SO.${yearMonth}.${String(nextSeq).padStart(5, '0')}`;
    const invNumber = `INV.${yearMonth}.${String(nextSeq).padStart(5, '0')}`;
    const sjNumber = `SJ.${yearMonth}.${String(nextSeq).padStart(5, '0')}`;
    nextSeq++;

    // Hitung Subtotal, PPN, dan Total
    let subtotal = 0;
    const itemsDetail = [];
    const soItemsToCreate = [];

    selectedProds.forEach((prod, pIdx) => {
      const qty = ((pIdx + i) % 3) + 1; // 1 s/d 3
      const price = parseFloat(prod.sellingPrice);
      const lineSubtotal = qty * price;
      subtotal += lineSubtotal;

      // Bonus sample untuk produk tertentu
      const bonusQty = (pIdx === 4 && i % 2 === 0) ? 1 : 0;
      const bonusUnit = prod.unit || 'KRT';

      itemsDetail.push({
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        unit: prod.unit || 'KRT',
        conversionRatio: 1,
        qty: qty,
        bonusQty: bonusQty,
        bonusUnit: bonusUnit,
        bonusConversionRatio: 1,
        price: price,
        discount: 0,
        discountPercent: 0
      });

      soItemsToCreate.push({
        productId: prod.id,
        qty: qty,
        price: price,
        discount: 0,
        subtotal: lineSubtotal
      });
    });

    const taxAmount = isPkp ? Math.round((subtotal * taxRate) / 100) : 0;
    const totalAmount = subtotal + taxAmount;
    const initialPaid = isCash ? totalAmount : 0;
    const initialPaymentStatus = isCash ? 'PAID' : 'UNPAID';
    const invStatus = isCash ? 'PAID' : 'UNPAID';

    // 1. Buat Sales Order
    const so = await SalesOrder.create({
      tenantId,
      contactId: cust.id,
      soNumber,
      soDate: todayStr,
      status: 'APPROVED',
      taxId: isPkp && effectiveTax ? effectiveTax.id : null,
      subtotal,
      taxAmount,
      totalAmount,
      notes: `Simulasi Faktur #${i + 1} - ${isPkp ? 'PKP (PPN 11%)' : 'Non-PKP (0%)'} - ${paymentTerm}`,
      metadata: {
        isDraft: false,
        applyTax: isPkp,
        taxInclusive: false,
        taxRate: taxRate,
        taxType: isPkp ? 'PKP' : 'NON_PKP',
        salespersonId: sp ? sp.id : null,
        salespersonCode: sp ? sp.code : '',
        salespersonName: sp ? sp.name : '',
        salesperson: sp ? sp.name : '',
        paymentTerm,
        paidAmount: initialPaid,
        paymentStatus: initialPaymentStatus,
        itemsDetail
      }
    });

    // 2. Buat Sales Order Items
    for (const it of soItemsToCreate) {
      await SalesOrderItem.create({
        salesOrderId: so.id,
        ...it
      });
    }

    // 3. Buat Invoice (Faktur Penjualan)
    const invoice = await Invoice.create({
      tenantId,
      type: 'SALES',
      salesOrderId: so.id,
      invoiceNumber: invNumber,
      invoiceDate: todayStr,
      dueDate: isCash ? todayStr : new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      subtotal,
      taxRate: isPkp ? taxRate : 0,
      taxAmount,
      totalAmount,
      amountDue: isCash ? 0 : totalAmount,
      status: invStatus,
      paymentTerm,
      notes: `Faktur Penjualan SO #${so.soNumber}`
    });

    // 4. Buat Delivery (Surat Jalan) Siap Kirim
    const delivery = await Delivery.create({
      tenantId,
      salesOrderId: so.id,
      warehouseId,
      deliveryNumber: sjNumber,
      deliveryDate: todayStr,
      driverName: '—',
      vehiclePlate: '—',
      status: 'SHIPPED',
      notes: `Surat Jalan Otomatis untuk SO #${so.soNumber} (Inv: ${invoice.invoiceNumber})`
    });

    // 5. Buat Delivery Items
    for (const it of itemsDetail) {
      await DeliveryItem.create({
        tenantId,
        deliveryId: delivery.id,
        productId: it.productId,
        qtyShipped: it.qty
      });
    }

    createdSummary.push({
      no: i + 1,
      soNumber,
      invNumber,
      sjNumber,
      customerName: cust.name,
      type: isPkp ? 'PKP (11%)' : 'Non-PKP (0%)',
      paymentTerm,
      itemsCount: itemsDetail.length,
      totalAmount: `Rp ${totalAmount.toLocaleString('id-ID')}`
    });

    console.log(`[Faktur ${String(i + 1).padStart(2, ' ')}/12] ${soNumber} | ${invNumber} | ${sjNumber}`);
    console.log(`  Pelanggan : ${cust.name} (${cust.code || '-'})`);
    console.log(`  Tipe Pajak: ${isPkp ? 'PKP (PPN 11%)' : 'Non-PKP (Tanpa Pajak)'} | Syarat: ${paymentTerm}`);
    console.log(`  Total     : Rp ${totalAmount.toLocaleString('id-ID')} | Sales: ${sp ? sp.name : '-'}`);
    console.log(`  Item (${itemsDetail.length} barang):`);
    itemsDetail.forEach((it, idx) => {
      console.log(`    ${idx + 1}. [${it.sku}] ${it.name} - ${it.qty} ${it.unit} @ Rp ${it.price.toLocaleString('id-ID')}${it.bonusQty > 0 ? ` (+Bonus ${it.bonusQty} ${it.bonusUnit})` : ''}`);
    });
    console.log('----------------------------------------------------------------');
  }

  console.log('\n================================================================');
  console.log(`  BERHASIL MEMBUAT 12 FAKTUR SALES ORDER!`);
  console.log(`  Semua 12 Surat Jalan (Delivery) berstatus READY_TO_SHIP.`);
  console.log(`  Sekarang Anda dapat membuka menu Manifest Pengiriman`);
  console.log(`  dan langsung memilih ke-12 faktur ini ke dalam 1 Manifest!`);
  console.log('================================================================\n');

  process.exit(0);
}

runSimulation().catch(err => {
  console.error('\n❌ Terjadi kesalahan:', err);
  process.exit(1);
});

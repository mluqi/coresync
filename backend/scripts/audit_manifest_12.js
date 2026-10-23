/**
 * Script Audit & Rekonsiliasi Data Manifest Pengiriman (12 Faktur)
 * Mencocokkan 100% item dan kuantitas antara:
 * 1. Rincian Titik Pengiriman (groups - Tab 1)
 * 2. Muatan per Supplier (table_data - Tab 2 & Cetak Dokumen)
 */

const { buildManifestDataFromDeliveries } = require('../controllers/deliveryController');
const { Delivery } = require('../models');

async function auditManifest() {
  console.log('\n========================================================================');
  console.log('  AUDIT REKONSILIASI: RINCIAN TITIK PENGIRIMAN vs MUATAN PER SUPPLIER');
  console.log('========================================================================\n');

  // Ambil 12 Delivery ID dari simulasi 12 faktur (ID 6 s/d 17)
  const deliveryIds = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  const req = {
    tenantId: 1,
    query: {
      deliveryIds: deliveryIds.join(','),
      deliveryDate: '2026-10-04',
      driverName: 'SUTRISNO',
      vehiclePlate: 'G 8912 AB',
      warehouseName: 'Gudang Tegal'
    }
  };
  let manifestData = null;
  const res = {
    status: () => ({
      json: (data) => { manifestData = data.data; }
    })
  };
  await require('../controllers/deliveryController').getDeliveryManifest(req, res, () => {});

  const groups = manifestData.groups || [];
  const tableData = manifestData.table_data || [];
  const summary = manifestData.summary || {};

  console.log(`Dokumen Manifest : ${manifestData.manifestNumber}`);
  console.log(`Tanggal Kirim    : ${manifestData.deliveryDate}`);
  console.log(`Supir / Armada   : ${manifestData.driverName} (${manifestData.vehiclePlate})`);
  console.log(`Total Stop/Faktur: ${groups.length} Toko`);
  console.log(`Total Pabrikan   : ${tableData.length} Supplier\n`);

  // 1. Agregasi dari RINCIAN TITIK PENGIRIMAN (groups)
  // Key: SKU produk
  const groupsProductMap = new Map();
  let totalGroupsQty = 0;
  let totalGroupsBonus = 0;
  let totalGroupsAmount = 0;
  let totalGroupsItemsCount = 0;

  groups.forEach((grp, gIdx) => {
    totalGroupsAmount += parseFloat(grp.invoiceAmount || 0);

    (grp.items || []).forEach(it => {
      totalGroupsItemsCount++;
      totalGroupsQty += it.qty;
      totalGroupsBonus += it.bonusQty || 0;

      const key = it.sku;
      if (!groupsProductMap.has(key)) {
        groupsProductMap.set(key, {
          sku: it.sku,
          name: it.name,
          unit: it.unit,
          supplierName: it.supplierName,
          qty: 0,
          bonus: 0,
          appearances: [] // Toko mana saja yang pesan
        });
      }

      const p = groupsProductMap.get(key);
      p.qty += it.qty;
      p.bonus += (it.bonusQty || 0);
      p.appearances.push({
        stop: gIdx + 1,
        customer: grp.customerName,
        inv: grp.invoiceNumber,
        qty: it.qty,
        bonus: it.bonusQty || 0
      });
    });
  });

  // 2. Agregasi dari MUATAN PER SUPPLIER (table_data)
  const tableProductMap = new Map();
  let totalTableBesar = 0;
  let totalTableKecil = 0;
  let totalTableBonus = 0;
  let totalTableItemsCount = 0;

  tableData.forEach(supp => {
    (supp.items || []).forEach(it => {
      totalTableItemsCount++;
      const besar = parseFloat(it.jumlah_barang_satuan_besar) || 0;
      const kecil = parseFloat(it.jumlah_barang_satuan_kecil) || 0;
      const bonus = parseFloat(it.bonus) || 0;

      totalTableBesar += besar;
      totalTableKecil += kecil;
      totalTableBonus += bonus;

      tableProductMap.set(it.kode, {
        kode: it.kode,
        nama: it.nama_barang,
        supplier: supp.supplier_name,
        satuanBesarStr: it.jumlah_barang_satuan_besar,
        satuanKecilStr: it.jumlah_barang_satuan_kecil,
        besarQty: besar,
        kecilQty: kecil,
        totalQty: besar + kecil,
        bonusQty: bonus,
        bonusStr: it.bonus
      });
    });
  });

  // 3. REKONSILIASI PENCOCOKAN:
  console.log('------------------------------------------------------------------------');
  console.log('  HASIL PENCOCOKAN PER PRODUK (RINCIAN TITIK PENGIRIMAN vs MUATAN SUPPLIER)');
  console.log('------------------------------------------------------------------------');
  console.log('NO | KODE SKU  | NAMA BARANG                   | TITIK PENGIRIMAN | MUATAN SUPPLIER | STATUS');
  console.log('---|-----------|-------------------------------|------------------|-----------------|-------');

  let matchCount = 0;
  let discrepancyCount = 0;
  const discrepancies = [];

  let idx = 1;
  for (const [sku, gProd] of groupsProductMap.entries()) {
    const tProd = tableProductMap.get(sku);

    if (!tProd) {
      discrepancyCount++;
      discrepancies.push({
        sku,
        name: gProd.name,
        issue: 'TIDAK DITEMUKAN di Muatan Supplier / Dokumen Cetak'
      });
      console.log(`${String(idx).padStart(2, ' ')} | ${sku.padEnd(9, ' ')} | ${gProd.name.substring(0, 29).padEnd(29, ' ')} | Qty: ${gProd.qty} Bns: ${gProd.bonus}   | HILANG / TIDAK ADA | ❌ GAGAL`);
    } else {
      // Periksa kuantitas
      const qtyMatch = gProd.qty === tProd.totalQty;
      const bonusMatch = gProd.bonus === tProd.bonusQty;

      if (qtyMatch && bonusMatch) {
        matchCount++;
        const gStr = `${gProd.qty} ${gProd.unit}${gProd.bonus > 0 ? ` +${gProd.bonus}` : ''}`;
        const tStr = `${tProd.totalQty} ${tProd.satuanBesarStr || tProd.satuanKecilStr}${tProd.bonusQty > 0 ? ` +${tProd.bonusQty}` : ''}`;
        console.log(`${String(idx).padStart(2, ' ')} | ${sku.padEnd(9, ' ')} | ${gProd.name.substring(0, 29).padEnd(29, ' ')} | ${gStr.padEnd(16, ' ')} | ${tStr.padEnd(15, ' ')} | ✓ COCOK`);
      } else {
        discrepancyCount++;
        discrepancies.push({
          sku,
          name: gProd.name,
          issue: `Selisih Qty/Bonus: Rincian=${gProd.qty}+${gProd.bonus}, Muatan=${tProd.totalQty}+${tProd.bonusQty}`
        });
        console.log(`${String(idx).padStart(2, ' ')} | ${sku.padEnd(9, ' ')} | ${gProd.name.substring(0, 29).padEnd(29, ' ')} | ${gProd.qty}+${gProd.bonus}         | ${tProd.totalQty}+${tProd.bonusQty}        | ❌ BEDA`);
      }
    }
    idx++;
  }

  // Periksa apakah ada barang di table_data yang tidak ada di groups
  for (const [kode, tProd] of tableProductMap.entries()) {
    if (!groupsProductMap.has(kode)) {
      discrepancyCount++;
      discrepancies.push({
        sku: kode,
        name: tProd.nama,
        issue: 'Ada di Muatan Supplier tapi tidak ada di Rincian Titik Pengiriman'
      });
    }
  }

  console.log('------------------------------------------------------------------------');
  console.log('\n========================================================================');
  console.log('  RINGKASAN AUDIT KONSISTENSI DATA');
  console.log('========================================================================');
  console.log(`1. Total Baris Item di Rincian Titik Pengiriman : ${totalGroupsItemsCount} baris (5 barang x 12 faktur)`);
  console.log(`2. Total Jenis Barang Unik                      : ${groupsProductMap.size} produk`);
  console.log(`3. Total Baris di Muatan per Supplier (Terkonsolidasi) : ${totalTableItemsCount} baris`);
  console.log(`4. Total Kuantitas Barang Fisik (Groups vs Table) : ${totalGroupsQty} Karton vs ${totalTableBesar + totalTableKecil} Karton`);
  console.log(`5. Total Bonus Barang (Groups vs Table)           : ${totalGroupsBonus} Bonus vs ${totalTableBonus} Bonus`);
  console.log(`6. Total Nominal Tagihan (Grand Total)            : Rp ${totalGroupsAmount.toLocaleString('id-ID')}`);
  console.log(`7. Jumlah Produk Berhasil Dicocokkan (Match 100%) : ${matchCount} dari ${groupsProductMap.size} produk`);
  console.log(`8. Jumlah Selisih / Barang Hilang                 : ${discrepancyCount}`);

  if (discrepancyCount === 0 && matchCount === groupsProductMap.size && totalGroupsQty === (totalTableBesar + totalTableKecil)) {
    console.log('\n>>> KESIMPULAN: DATA 100% SESUAI, PRESISI, DAN TIDAK ADA BARANG HILANG! <<<');
  } else {
    console.log('\n>>> KESIMPULAN: DITEMUKAN SELISIH DATA! <<<');
    console.log(discrepancies);
  }
  console.log('========================================================================\n');

  process.exit(0);
}

auditManifest().catch(e => {
  console.error('Audit Error:', e);
  process.exit(1);
});

'use strict';

/**
 * Script to import Real Stock & Synchronize Product Units & Conversion Ratios from Excel
 * 
 * Features:
 * 1. Reads Template_Input_Stok_Real.xlsx
 * 2. Updates Product.unit, ProductUnit (Satuan 1, 2, 3) and conversion ratios if changed
 * 3. Updates Product.taxId (PKP vs Non-PKP) if modified
 * 4. Applies real physical stock cutoff per warehouse
 * 5. Supports dry-run (--dry-run) to preview changes without modifying database
 */

require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const { Product, ProductUnit, ProductWarehouse, Warehouse, IncomingBatch, StockLedger, Tax, DeliveryManifest, Delivery, SalesOrder, sequelize } = require('../models');

async function importRealStock(options = {}) {
  const isDryRun = process.argv.includes('--dry-run') || options.dryRun;
  const filePath = options.filePath || path.resolve(__dirname, '../../Template_Input_Stok_Real.xlsx');
  const targetWarehouseId = options.warehouseId || 1; // Default: Gudang Tegal

  console.log(`\n=== IMPORT STOK REAL & UPDATE SATUAN CORESYNC ===`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulasi / Tidak Mengubah DB)' : 'LIVE EXECUTION'}`);
  console.log(`File: ${filePath}`);
  console.log(`Target Warehouse ID: ${targetWarehouseId}\n`);

  if (!require('fs').existsSync(filePath)) {
    console.error(`File tidak ditemukan: ${filePath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.includes('Input_Stok_Real') ? 'Input_Stok_Real' : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

  console.log(`Total baris ditemukan: ${rows.length}`);

  const warehouse = await Warehouse.findByPk(targetWarehouseId);
  if (!warehouse) {
    console.error(`Gudang dengan ID ${targetWarehouseId} tidak ditemukan!`);
    process.exit(1);
  }
  console.log(`Target Gudang: [${warehouse.id}] ${warehouse.name}`);

  const taxes = await Tax.findAll();
  const taxPkp = taxes.find(t => parseFloat(t.rate) > 0 && !t.name.toLowerCase().includes('non')) || { id: 1 };
  const taxNonPkp = taxes.find(t => parseFloat(t.rate) === 0 || t.name.toLowerCase().includes('non')) || { id: 2 };

  // Hitung kebutuhan stok untuk barang yang sudah masuk Agenda Pengiriman (SCHEDULED / IN_DELIVERY) tapi belum terkirim
  console.log(`Memeriksa agenda pengiriman (manifest) yang aktif/belum selesai...`);
  const activeManifests = await DeliveryManifest.findAll({
    where: { status: ['SCHEDULED', 'IN_DELIVERY'] },
    attributes: ['id', 'manifestNumber', 'status', 'deliveryIds']
  });

  let allDeliveryIds = [];
  activeManifests.forEach(m => allDeliveryIds.push(...(m.deliveryIds || [])));

  const pendingDeliveries = await Delivery.findAll({
    where: { id: allDeliveryIds },
    include: [{ model: SalesOrder, as: 'salesOrder', attributes: ['metadata'] }]
  });

  const pendingBaseQtyByProduct = {};
  pendingDeliveries.forEach(d => {
    const itemsDetail = d.salesOrder?.metadata?.itemsDetail || [];
    itemsDetail.forEach(item => {
      const pid = item.productId;
      const qty = parseFloat(item.qty || 0);
      const ratio = parseFloat(item.conversionRatio || 1);
      pendingBaseQtyByProduct[pid] = (pendingBaseQtyByProduct[pid] || 0) + (qty * ratio);
    });
  });

  console.log(`Ditemukan ${activeManifests.length} manifest aktif dengan ${Object.keys(pendingBaseQtyByProduct).length} produk yang sudah diagendakan.\n`);

  let updatedUnitsCount = 0;
  let updatedStockCount = 0;
  let reservedStockCount = 0;
  let skippedCount = 0;
  const summaryReport = [];

  const transaction = await sequelize.transaction();

  try {
    if (!isDryRun) {
      console.log(`Menolkan seluruh stok bonus dan stok retur/karantina...`);
      // 1. Nolkan stok bonus di product_warehouses
      await ProductWarehouse.update({ bonusStock: 0 }, { where: {}, transaction });

      // 2. Tutup semua batch bonus aktif di incoming_batches
      await IncomingBatch.update({ currentQty: 0 }, { where: { isBonus: true }, transaction });

      // 3. Nolkan stok di gudang retur / karantina (type: QUARANTINE atau nama Karantina/Retur)
      const quarantineWhs = await Warehouse.findAll({ 
        where: { 
          [sequelize.Sequelize.Op.or]: [
            { type: 'QUARANTINE' },
            { name: { [sequelize.Sequelize.Op.like]: '%retur%' } },
            { name: { [sequelize.Sequelize.Op.like]: '%karantina%' } }
          ]
        }, 
        transaction 
      });

      for (const qwh of quarantineWhs) {
        await ProductWarehouse.update({ stock: 0, bonusStock: 0 }, { where: { warehouseId: qwh.id }, transaction });
        await IncomingBatch.update({ currentQty: 0 }, { where: { warehouseId: qwh.id }, transaction });
      }
    }

    for (const row of rows) {
      const productId = parseInt(row['ID Produk']);
      if (!productId) {
        skippedCount++;
        continue;
      }

      const product = await Product.findByPk(productId, {
        include: [{ model: ProductUnit, as: 'units' }],
        transaction
      });

      if (!product) {
        console.warn(`Produk ID ${productId} (${row['Nama Barang']}) tidak ditemukan di DB!`);
        skippedCount++;
        continue;
      }

      // 1. Parse Units & Ratios
      const u1 = (row['Satuan 1 (Besar)'] || product.unit || 'KRT').trim().toUpperCase();
      let u2 = (row['Satuan 2 (Sedang)'] || '').trim().toUpperCase();
      let u3 = (row['Satuan 3 (Kecil)'] || '').trim().toUpperCase();
      if (u2 === '-') u2 = '';
      if (u3 === '-') u3 = '';

      let cap2 = parseFloat(row['Isi Satuan 2 per Satuan 1'] || 0);
      let cap3 = parseFloat(row['Isi Satuan 3 per Satuan 1'] || 0);

      // Fallback parsing from 'Panduan Rasio Isi' if numeric columns were left empty but text was edited
      const ratioText = (row['Panduan Rasio Isi'] || '').trim();
      if (ratioText && (!cap2 || !cap3)) {
        const parts = ratioText.split('=').map(p => p.trim());
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const m = parts[i].match(/([0-9.]+)\s*([A-Za-z0-9_-]+)/);
            if (m) {
              const num = parseFloat(m[1]);
              const name = m[2].toUpperCase();
              if (u2 && name === u2 && !cap2) cap2 = num;
              else if (u3 && name === u3 && !cap3) cap3 = num;
              else if (!u2 && !cap2) { u2 = name; cap2 = num; }
              else if (!u3 && !cap3) { u3 = name; cap3 = num; }
            }
          }
        }
      }

      // 2. Check if Units or Ratios Changed
      const existingUnits = (product.units || []).sort((a, b) => parseFloat(b.conversionRatio) - parseFloat(a.conversionRatio));
      const oldU1 = existingUnits[0]?.unitName || product.unit;
      const oldU2 = existingUnits[1]?.unitName || '';
      const oldCap2 = existingUnits[1] ? Math.round(1 / parseFloat(existingUnits[1].conversionRatio)) : 0;
      const oldU3 = existingUnits[2]?.unitName || '';
      const oldCap3 = existingUnits[2] ? Math.round(1 / parseFloat(existingUnits[2].conversionRatio)) : 0;

      const unitChanged = (u1 !== oldU1) || (u2 !== oldU2) || (u3 !== oldU3) || (cap2 !== oldCap2) || (cap3 !== oldCap3);

      if (unitChanged) {
        updatedUnitsCount++;
        if (!isDryRun) {
          // Update product base unit
          await product.update({ unit: u1 }, { transaction });

          // Rebuild product_units
          await ProductUnit.destroy({ where: { productId: product.id }, transaction });

          const unitsToInsert = [
            {
              tenantId: product.tenantId,
              productId: product.id,
              unitName: u1,
              conversionRatio: 1.0,
              isBaseUnit: true,
              purchasePrice: parseFloat(product.purchasePrice) || 0,
              sellingPrice: parseFloat(product.sellingPrice) || 0
            }
          ];

          if (u2 && cap2 > 0) {
            const ratio2 = 1 / cap2;
            unitsToInsert.push({
              tenantId: product.tenantId,
              productId: product.id,
              unitName: u2,
              conversionRatio: ratio2,
              isBaseUnit: false,
              purchasePrice: Math.round((parseFloat(product.purchasePrice) || 0) * ratio2),
              sellingPrice: Math.round((parseFloat(product.sellingPrice) || 0) * ratio2)
            });
          }

          if (u3 && cap3 > 0) {
            const ratio3 = 1 / cap3;
            unitsToInsert.push({
              tenantId: product.tenantId,
              productId: product.id,
              unitName: u3,
              conversionRatio: ratio3,
              isBaseUnit: false,
              purchasePrice: Math.round((parseFloat(product.purchasePrice) || 0) * ratio3),
              sellingPrice: Math.round((parseFloat(product.sellingPrice) || 0) * ratio3)
            });
          }

          await ProductUnit.bulkCreate(unitsToInsert, { transaction });
        }
      }

      // 3. Tax status update if changed
      const taxInput = (row['Tipe Pajak'] || '').trim().toUpperCase();
      if (taxInput === 'PKP' && product.taxId !== taxPkp.id) {
        if (!isDryRun) await product.update({ taxId: taxPkp.id }, { transaction });
      } else if (taxInput === 'NON-PKP' && product.taxId !== taxNonPkp.id) {
        if (!isDryRun) await product.update({ taxId: taxNonPkp.id }, { transaction });
      }

      // 4. Calculate Real Stock in Base Unit
      const q1 = parseFloat(row['Fisik Satuan 1'] || 0);
      const q2 = parseFloat(row['Fisik Satuan 2'] || 0);
      const q3 = parseFloat(row['Fisik Satuan 3'] || 0);

      const hasQ1 = row['Fisik Satuan 1'] !== undefined && row['Fisik Satuan 1'] !== '';
      const hasQ2 = row['Fisik Satuan 2'] !== undefined && row['Fisik Satuan 2'] !== '';
      const hasQ3 = row['Fisik Satuan 3'] !== undefined && row['Fisik Satuan 3'] !== '';
      const hasPhysicalInput = (hasQ1 || hasQ2 || hasQ3) && (q1 > 0 || q2 > 0 || q3 > 0);

      const pendingManifestQty = parseFloat(pendingBaseQtyByProduct[product.id] || 0);

      let totalBaseStock = 0;
      let stockSourceType = 'ZERO'; // 'EXCEL', 'RESERVED_MANIFEST', 'ZERO'
      let sourceNote = '';

      if (hasPhysicalInput) {
        // Jika diisi angka di Excel, gunakan angka Excel
        totalBaseStock = q1;
        if (q2 > 0 && cap2 > 0) totalBaseStock += (q2 / cap2);
        if (q3 > 0 && cap3 > 0) totalBaseStock += (q3 / cap3);
        stockSourceType = 'EXCEL';
        sourceNote = `Fisik Excel (${totalBaseStock.toFixed(4)} ${u1})`;
      } else if (pendingManifestQty > 0) {
        // Jika di Excel 0/kosong tapi ada di agenda manifest pengiriman yang belum terkirim,
        // sisakan stoknya sebesar kebutuhan agenda pengiriman (tidak di-0-kan)
        totalBaseStock = pendingManifestQty;
        stockSourceType = 'RESERVED_MANIFEST';
        reservedStockCount++;
        sourceNote = `Disisakan dari Agenda Pengiriman (${totalBaseStock.toFixed(4)} ${u1})`;
      } else {
        totalBaseStock = 0;
        stockSourceType = 'ZERO';
        sourceNote = `Stok 0 / Kosong`;
      }

      updatedStockCount++;

      if (!isDryRun) {
        // Set prior incoming batches for this product in target warehouse to currentQty = 0 (clean FIFO cut-off)
        await IncomingBatch.update(
          { currentQty: 0 },
          { 
            where: { 
              tenantId: product.tenantId, 
              warehouseId: targetWarehouseId, 
              productId: product.id 
            }, 
            transaction 
          }
        );

        // Set physical stock in product_warehouses (bonus stock di-0 kan semua)
        const [pw] = await ProductWarehouse.findOrCreate({
          where: { productId: product.id, warehouseId: targetWarehouseId },
          defaults: { tenantId: product.tenantId, stock: 0, bonusStock: 0 },
          transaction
        });

        const oldStock = parseFloat(pw.stock || 0);
        await pw.update({ stock: totalBaseStock, bonusStock: 0 }, { transaction });

        // Jika totalBaseStock > 0, buat IncomingBatch cut-off baru
        if (totalBaseStock > 0) {
          const batchNumber = `OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${product.id}`;
          
          await IncomingBatch.create({
            tenantId: product.tenantId,
            warehouseId: targetWarehouseId,
            productId: product.id,
            batchNumber,
            receiveDate: new Date(),
            initialQty: totalBaseStock,
            currentQty: totalBaseStock,
            costPrice: parseFloat(product.purchasePrice || 0),
            isBonus: false
          }, { transaction });
        }

        // Catat di StockLedger
        await StockLedger.create({
          tenantId: product.tenantId,
          warehouseId: targetWarehouseId,
          productId: product.id,
          type: totalBaseStock >= oldStock ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          stockType: 'REGULAR',
          qty: totalBaseStock,
          referenceType: 'STOCK_OPNAME',
          referenceId: product.id,
          notes: `Cut-off: ${sourceNote}`
        }, { transaction });
      }

      summaryReport.push({
        sku: product.sku,
        name: product.name,
        u1,
        q1,
        u2,
        q2,
        u3,
        q3,
        stockSourceType,
        sourceNote,
        finalBaseStock: totalBaseStock.toFixed(4)
      });
    }

    if (isDryRun) {
      await transaction.rollback();
      console.log(`\n[DRY RUN SELESAI - DATABASE TIDAK BERUBAH]`);
    } else {
      await transaction.commit();
      console.log(`\n[BERHASIL DISIMPAN KE DATABASE]`);
    }

    console.log(`- Produk dengan perubahan Satuan / Rasio: ${updatedUnitsCount}`);
    console.log(`- Produk dengan update Stok Fisik: ${updatedStockCount}`);
    console.log(`  * Dari Fisik Excel: ${updatedStockCount - reservedStockCount - (summaryReport.filter(s => s.stockSourceType === 'ZERO').length)}`);
    console.log(`  * Disisakan dari Agenda Pengiriman (Excel 0): ${reservedStockCount}`);
    console.log(`  * Stok 0 / Kosong Murni: ${summaryReport.filter(s => s.stockSourceType === 'ZERO').length}`);
    console.log(`- Produk dilewati: ${skippedCount}\n`);

    const reservedItems = summaryReport.filter(s => s.stockSourceType === 'RESERVED_MANIFEST');
    if (reservedItems.length > 0) {
      console.log(`Daftar ${reservedItems.length} Produk yang Disisakan dari Agenda Pengiriman:`);
      reservedItems.forEach(s => {
        console.log(`  [${s.sku}] ${s.name} -> ${s.finalBaseStock} ${s.u1} (Agenda Pengiriman Aktif)`);
      });
      console.log('');
    }

    if (summaryReport.length > 0) {
      console.log(`Sampel 10 Produk yang Diperbarui:`);
      summaryReport.slice(0, 10).forEach(s => {
        const detailParts = [];
        if (s.q1 > 0) detailParts.push(`${s.q1} ${s.u1}`);
        if (s.q2 > 0 && s.u2) detailParts.push(`${s.q2} ${s.u2}`);
        if (s.q3 > 0 && s.u3) detailParts.push(`${s.q3} ${s.u3}`);
        const detailStr = detailParts.length > 0 ? ` (Fisik: ${detailParts.join(' + ')})` : (s.stockSourceType === 'RESERVED_MANIFEST' ? ` (${s.sourceNote})` : ' (KOSONG / 0)');
        console.log(`[${s.sku}] ${s.name} -> ${s.finalBaseStock} ${s.u1}${detailStr}`);
      });
    }

  } catch (error) {
    await transaction.rollback();
    console.error('Terjadi kesalahan saat import:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  importRealStock().then(() => process.exit(0));
}

module.exports = importRealStock;

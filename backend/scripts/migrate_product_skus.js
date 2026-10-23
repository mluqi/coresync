/**
 * Script untuk Menormalisasi dan Memperbarui SKU Produk ke format PRD-00001 (5 Digit Berurutan)
 * Serta memperbarui seluruh snapshot dokumen pengiriman (Delivery Manifest) dan metadata Sales Order.
 *
 * Cara Menjalankan:
 * 1. Default (hanya ubah SKU yang belum berformat PRD-XXXXX agar meneruskan nomor terakhir):
 *    node scripts/migrate_product_skus.js
 *
 * 2. Renumber Semua Produk dari awal (1 sampai N):
 *    node scripts/migrate_product_skus.js --renumber-all
 */

const { sequelize, Product, DeliveryManifest, SalesOrder, Tenant } = require('../models');
const { Op } = require('sequelize');

async function migrateSkus() {
  const isRenumberAll = process.argv.includes('--renumber-all');
  console.log(`\n======================================================`);
  console.log(`  SKU MIGRATION & MANIFEST SYNC TOOL (CoreSync ERP)`);
  console.log(`  Mode: ${isRenumberAll ? 'RENUMBER ALL (1 s/d N)' : 'FILL & CONTINUE (Meneruskan nomor PRD terakhir)'}`);
  console.log(`======================================================\n`);

  const transaction = await sequelize.transaction();

  try {
    const tenants = await Tenant.findAll({ transaction });

    for (const tenant of tenants) {
      console.log(`\n▶ Memproses Tenant ID ${tenant.id} (${tenant.companyName || tenant.name || 'Tenant'})...`);

      const products = await Product.findAll({
        where: { tenantId: tenant.id },
        order: [['id', 'ASC']],
        transaction
      });

      if (products.length === 0) {
        console.log(`  Tidak ada produk pada tenant ini.`);
        continue;
      }

      console.log(`  Ditemukan ${products.length} produk.`);

      const skuMapping = new Map(); // oldSku -> newSku
      const idToNewSku = new Map(); // productId -> newSku

      if (isRenumberAll) {
        // Mode RENUMBER ALL: Berikan nomor berurutan 1 s/d N
        console.log(`  Mengurutkan ulang seluruh produk dari PRD-00001...`);
        for (let i = 0; i < products.length; i++) {
          const prod = products[i];
          const newSku = `PRD-${String(i + 1).padStart(5, '0')}`;
          if (prod.sku !== newSku) {
            skuMapping.set(prod.sku, newSku);
          }
          idToNewSku.set(prod.id, newSku);
        }
      } else {
        // Mode FILL & CONTINUE:
        // 1. Cari angka PRD-XXXXX tertinggi yang sudah ada
        let maxSeq = 0;
        const nonStandardProducts = [];

        for (const prod of products) {
          const match = (prod.sku || '').match(/^PRD-(\d{5})$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
            idToNewSku.set(prod.id, prod.sku);
          } else {
            nonStandardProducts.push(prod);
          }
        }

        console.log(`  Nomor SKU PRD-XXXXX tertinggi saat ini: PRD-${String(maxSeq).padStart(5, '0')} (${maxSeq})`);
        console.log(`  Jumlah produk dengan SKU non-standar: ${nonStandardProducts.length}`);

        // 2. Beri nomor lanjutan untuk produk non-standar
        let currentSeq = maxSeq;
        for (const prod of nonStandardProducts) {
          currentSeq++;
          const newSku = `PRD-${String(currentSeq).padStart(5, '0')}`;
          skuMapping.set(prod.sku, newSku);
          idToNewSku.set(prod.id, newSku);
        }
      }

      // 1. Update ke Tabel Products
      if (skuMapping.size > 0) {
        console.log(`\n  Mengupdate ${skuMapping.size} SKU produk di database...`);
        
        // Agar tidak bentrok unique constraint saat renumber, gunakan temporary prefix
        if (isRenumberAll) {
          for (const prod of products) {
            await prod.update({ sku: `TEMP-${prod.id}-${prod.sku}` }, { transaction });
          }
        }

        for (const prod of products) {
          const targetSku = idToNewSku.get(prod.id);
          if (targetSku && prod.sku !== targetSku) {
            await prod.update({ sku: targetSku }, { transaction });
            console.log(`   ✓ [ID: ${prod.id}] "${prod.name}" ➔ ${targetSku}`);
          }
        }
        console.log(`  ✓ Berhasil memperbarui SKU di tabel products.`);
      } else {
        console.log(`  ✓ Semua SKU sudah berformat PRD-XXXXX yang valid. Tidak ada produk yang perlu diubah.`);
      }

      // 2. Update Snapshot Dokumen Manifest Pengiriman
      console.log(`\n  Memeriksa Dokumen Manifest Pengiriman untuk Tenant ${tenant.id}...`);
      const manifests = await DeliveryManifest.findAll({
        where: { tenantId: tenant.id },
        transaction
      });

      let updatedManifestCount = 0;

      for (const manifest of manifests) {
        if (!manifest.snapshot) continue;

        let snap = manifest.snapshot;
        if (typeof snap === 'string') {
          try {
            snap = JSON.parse(snap);
          } catch (e) {
            continue;
          }
        }

        let snapModified = false;

        // Periksa & update di groups[].items
        if (Array.isArray(snap.groups)) {
          snap.groups.forEach(grp => {
            if (Array.isArray(grp.items)) {
              grp.items.forEach(it => {
                // Update via mapping oldSku atau idToNewSku
                if (it.sku && skuMapping.has(it.sku)) {
                  it.sku = skuMapping.get(it.sku);
                  snapModified = true;
                }
              });
            }
          });
        }

        // Periksa & update di table_data[].items
        if (Array.isArray(snap.table_data)) {
          snap.table_data.forEach(tGrp => {
            if (Array.isArray(tGrp.items)) {
              tGrp.items.forEach(it => {
                if (it.kode && skuMapping.has(it.kode)) {
                  it.kode = skuMapping.get(it.kode);
                  snapModified = true;
                }
              });
            }
          });
        }

        if (snapModified) {
          manifest.snapshot = snap;
          await manifest.save({ transaction });
          updatedManifestCount++;
          console.log(`   ✓ Manifest #${manifest.manifestNumber} snapshot diperbarui dengan SKU baru.`);
        }
      }

      console.log(`  ✓ Selesai memeriksa manifest: ${updatedManifestCount} dokumen manifest diperbarui.`);
    }

    await transaction.commit();
    console.log(`\n======================================================`);
    console.log(`  MIGRASI SKU & SINKRONISASI SELESAI DENGAN SUKSES!`);
    console.log(`======================================================\n`);
    process.exit(0);

  } catch (error) {
    await transaction.rollback();
    console.error(`\n❌ Terjadi kesalahan saat migrasi:`, error);
    process.exit(1);
  }
}

migrateSkus();

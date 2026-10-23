/**
 * Script untuk Menghitung Ulang & Memperbarui Snapshot Seluruh Manifest Pengiriman
 * 
 * Penggunaan:
 *   node scripts/recalculate_manifests.js
 * 
 * Deskripsi:
 *   Memperbarui kolom `snapshot` dan `summary` di tabel `delivery_manifests`
 *   menggunakan algoritma konsolidasi multi-unit terbaru (memperbaiki perbedaan satuan
 *   seperti 1 KRT + 3 BAL yang sebelumnya salah dijumlahkan menjadi 4 BAL).
 */

const { DeliveryManifest, sequelize } = require('../models');
const { buildManifestDataFromDeliveries } = require('../controllers/deliveryController');

async function recalculateAllManifests() {
  console.log('========================================================================');
  console.log('   REKALKULASI & SINKRONISASI DATA SNAPSHOT MANIFEST PENGIRIMAN');
  console.log('========================================================================\n');

  try {
    const manifests = await DeliveryManifest.findAll({
      order: [['id', 'ASC']]
    });

    console.log(`Ditemukan ${manifests.length} dokumen manifest di database.\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const m of manifests) {
      const dIds = (m.deliveryIds || []).map(id => parseInt(id, 10)).filter(Boolean);

      if (dIds.length === 0) {
        console.log(`[SKIP] ID: ${m.id} | ${m.manifestNumber} -> Tidak memiliki surat jalan terhubung.`);
        skipCount++;
        continue;
      }

      console.log(`[PROCESS] ID: ${m.id} | ${m.manifestNumber} (${m.manifestDate}) | Status: ${m.status} | ${dIds.length} Surat Jalan...`);

      try {
        const enriched = await buildManifestDataFromDeliveries({
          tenantId: m.tenantId,
          deliveryIds: dIds,
          deliveryDate: m.manifestDate,
          driverName: m.driverName,
          vehiclePlate: m.vehiclePlate,
          warehouseName: m.warehouseName,
          manifestNumber: m.manifestNumber
        });

        if (enriched && enriched.groups && enriched.groups.length > 0) {
          const oldTotalBesar = m.summary?.totalBesar || 0;
          const oldTotalKecil = m.summary?.totalKecil || 0;

          m.snapshot = enriched;
          m.summary = enriched.summary;
          await m.save();

          console.log(`  └─> ✅ Berhasil diperbarui:`);
          console.log(`      Muatan Pabrikan : ${enriched.table_data?.length || 0} Supplier`);
          console.log(`      Titik Toko      : ${enriched.groups?.length || 0} Stop`);
          console.log(`      Rekap Fisik     : ${enriched.summary?.qtyFormatted || '-'}`);
          if (oldTotalBesar !== enriched.summary?.totalBesar || oldTotalKecil !== enriched.summary?.totalKecil) {
            console.log(`      * Perubahan Kemasan: [Lama: ${oldTotalBesar} Besar / ${oldTotalKecil} Kecil] -> [Baru: ${enriched.summary?.totalBesar} Besar / ${enriched.summary?.totalKecil} Kecil]`);
          }
          successCount++;
        } else {
          console.log(`  └─> ⚠️ Tidak ada item aktif yang dapat dikalkulasi.`);
          skipCount++;
        }
      } catch (err) {
        console.error(`  └─> ❌ Gagal memproses manifest ID ${m.id}:`, err.message);
        errorCount++;
      }
      console.log('');
    }

    console.log('========================================================================');
    console.log(`SELESAI! Sukses: ${successCount} | Dilewati: ${skipCount} | Gagal: ${errorCount}`);
    console.log('========================================================================\n');

  } catch (globalErr) {
    console.error('Terjadi kesalahan fatal:', globalErr);
  } finally {
    await sequelize.close();
  }
}

recalculateAllManifests();

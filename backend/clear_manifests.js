const { sequelize, DeliveryManifest, Delivery, SalesOrder } = require('./models');

async function clearManifests() {
  console.log('🧹 Memulai pembersihan data Manifest Pengiriman...\n');

  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. Truncate delivery_manifests
    try {
      await sequelize.query('TRUNCATE TABLE `delivery_manifests`;');
      console.log('  ✓ Berhasil mengosongkan tabel: `delivery_manifests`');
    } catch (e) {
      await sequelize.query('DELETE FROM `delivery_manifests`;');
      console.log('  ✓ Berhasil menghapus baris tabel: `delivery_manifests`');
    }

    // 2. Clear manifest metadata from Sales Orders
    const salesOrders = await SalesOrder.findAll();
    for (const so of salesOrders) {
      if (so.metadata && (so.metadata.manifestNumber || so.metadata.manifestId)) {
        const newMeta = { ...so.metadata };
        delete newMeta.manifestNumber;
        delete newMeta.manifestId;
        delete newMeta.driverName;
        delete newMeta.vehiclePlate;
        await so.update({ metadata: newMeta });
      }
    }
    console.log('  ✓ Berhasil membersihkan metadata referensi manifest pada Sales Orders');

    // 3. Reset driver on Deliveries that were scheduled/un-delivered
    await Delivery.update({
      driverName: null,
      vehiclePlate: null
    }, {
      where: {
        status: 'SHIPPED'
      }
    });
    console.log('  ✓ Berhasil mereset penugasan driver pada Surat Jalan');

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    const [res] = await sequelize.query('SELECT COUNT(*) as total FROM `delivery_manifests`;');
    console.log(`\n✅ Pembersihan selesai. Total data manifest pengiriman saat ini: ${res[0].total}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat membersihkan data manifest:', err);
    process.exit(1);
  }
}

clearManifests();

'use strict';

/**
 * Script untuk Merge Produk Duplikat "KOBE BON CABE" ke "BON CABE"
 * 
 * Target yang dipertahankan:
 * - PRD-00156: BON CABE LV 10 6GR NEW (ID: 156)
 * - PRD-00157: BON CABE LV 15 6GR (ID: 157)
 * - PRD-00158: BON CABE LV 30 4.5GR (ID: 158)
 * - PRD-00159: BON CABE LV 50 3GR (ID: 159)
 * 
 * Target yang dihapus (digabungkan):
 * - PRD-00001: KOBE BON CABE LV 10 6GR NEW (ID: 1) -> Merge ke ID 156
 * - PRD-00002: KOBE BON CABE LV 15 6GR (ID: 2)     -> Merge ke ID 157
 * - PRD-00003: KOBE BON CABE LV 30 4.5GR (ID: 3)   -> Merge ke ID 158
 * - PRD-00004: KOBE BON CABE LV 50 3GR (ID: 4)     -> Merge ke ID 159
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize, Product } = require('../models');

const MAPPINGS = [
  { fromId: 1, fromSku: 'PRD-00001', toId: 156, toSku: 'PRD-00156', name: 'BON CABE LV 10 6GR NEW' },
  { fromId: 2, fromSku: 'PRD-00002', toId: 157, toSku: 'PRD-00157', name: 'BON CABE LV 15 6GR' },
  { fromId: 3, fromSku: 'PRD-00003', toId: 158, toSku: 'PRD-00158', name: 'BON CABE LV 30 4.5GR' },
  { fromId: 4, fromSku: 'PRD-00004', toId: 159, toSku: 'PRD-00159', name: 'BON CABE LV 50 3GR' }
];

async function mergeDuplicateProducts() {
  console.log('=== MEMULAI PROSES MERGE PRODUK DUPLIKAT BON CABE ===\n');

  const transaction = await sequelize.transaction();

  try {
    for (const item of MAPPINGS) {
      console.log(`--> Memproses: ${item.fromSku} (ID: ${item.fromId}) => ${item.toSku} (ID: ${item.toId}) [${item.name}]`);

      // 1. Verifikasi kedua produk ada di database
      const [oldProd] = await sequelize.query('SELECT id, sku, name FROM products WHERE id = ?', {
        replacements: [item.fromId],
        transaction
      });
      const [newProd] = await sequelize.query('SELECT id, sku, name FROM products WHERE id = ?', {
        replacements: [item.toId],
        transaction
      });

      if (!newProd || newProd.length === 0) {
        throw new Error(`Produk tujuan ${item.toSku} (ID: ${item.toId}) tidak ditemukan!`);
      }

      if (!oldProd || oldProd.length === 0) {
        console.log(`    [SKIP] Produk lama ${item.fromSku} (ID: ${item.fromId}) sudah tidak ada / telah dihapus.`);
        continue;
      }

      // 2. Update Sales Order Items
      const [resSo] = await sequelize.query(
        'UPDATE sales_order_items SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resSo.affectedRows > 0) {
        console.log(`    - Dialihkan ${resSo.affectedRows} baris di sales_order_items`);
      }

      // 2b. Update Sales Order Metadata (itemsDetail) jika ada
      const [sos] = await sequelize.query(
        "SELECT id, metadata FROM sales_orders WHERE metadata LIKE ?",
        { replacements: [`%"productId":${item.fromId}%`], transaction }
      );
      for (const so of sos) {
        if (!so.metadata) continue;
        try {
          const parsed = typeof so.metadata === 'object' ? so.metadata : JSON.parse(so.metadata);
          if (Array.isArray(parsed.itemsDetail)) {
            let changed = false;
            parsed.itemsDetail = parsed.itemsDetail.map(detail => {
              if (detail.productId === item.fromId) {
                detail.productId = item.toId;
                changed = true;
              }
              return detail;
            });
            if (changed) {
              await sequelize.query(
                'UPDATE sales_orders SET metadata = ? WHERE id = ?',
                { replacements: [JSON.stringify(parsed), so.id], transaction }
              );
              console.log(`    - Diperbarui metadata pada SO #${so.id}`);
            }
          }
        } catch (e) {
          // ignore json parse error
        }
      }

      // 3. Update Delivery Items
      const [resDel] = await sequelize.query(
        'UPDATE delivery_items SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resDel.affectedRows > 0) {
        console.log(`    - Dialihkan ${resDel.affectedRows} baris di delivery_items`);
      }

      // 4. Update Purchase Order Items (jika ada)
      const [resPo] = await sequelize.query(
        'UPDATE purchase_order_items SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resPo.affectedRows > 0) {
        console.log(`    - Dialihkan ${resPo.affectedRows} baris di purchase_order_items`);
      }

      // 5. Update Return Items (jika ada)
      const [resRet] = await sequelize.query(
        'UPDATE return_items SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resRet.affectedRows > 0) {
        console.log(`    - Dialihkan ${resRet.affectedRows} baris di return_items`);
      }

      // 6. Update Stock Transfer Items (jika ada)
      const [resTrf] = await sequelize.query(
        'UPDATE stock_transfer_items SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resTrf.affectedRows > 0) {
        console.log(`    - Dialihkan ${resTrf.affectedRows} baris di stock_transfer_items`);
      }

      // 7. Update Incoming Batches
      const [resBatch] = await sequelize.query(
        'UPDATE incoming_batches SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resBatch.affectedRows > 0) {
        console.log(`    - Dialihkan ${resBatch.affectedRows} baris di incoming_batches`);
      }

      // 8. Update Stock Ledger
      const [resLedger] = await sequelize.query(
        'UPDATE stock_ledger SET product_id = ? WHERE product_id = ?',
        { replacements: [item.toId, item.fromId], transaction }
      );
      if (resLedger.affectedRows > 0) {
        console.log(`    - Dialihkan ${resLedger.affectedRows} baris di stock_ledger`);
      }

      // 9. Transfer Saldo Stok di Product Warehouses
      const [oldWhs] = await sequelize.query(
        'SELECT warehouse_id, stock, bonus_stock FROM product_warehouses WHERE product_id = ?',
        { replacements: [item.fromId], transaction }
      );
      for (const w of oldWhs) {
        const stockQty = parseFloat(w.stock || 0);
        const bonusQty = parseFloat(w.bonus_stock || 0);
        if (stockQty > 0 || bonusQty > 0) {
          await sequelize.query(
            'UPDATE product_warehouses SET stock = stock + ?, bonus_stock = bonus_stock + ? WHERE product_id = ? AND warehouse_id = ?',
            { replacements: [stockQty, bonusQty, item.toId, w.warehouse_id], transaction }
          );
          console.log(`    - Menggabungkan stok gudang #${w.warehouse_id} (+${stockQty} reguler, +${bonusQty} bonus) ke produk ${item.toSku}`);
        }
      }
      await sequelize.query('DELETE FROM product_warehouses WHERE product_id = ?', {
        replacements: [item.fromId],
        transaction
      });

      // 10. Bersihkan Stock Opname Items produk lama
      const [resSoi] = await sequelize.query('DELETE FROM stock_opname_items WHERE product_id = ?', {
        replacements: [item.fromId],
        transaction
      });
      if (resSoi.affectedRows > 0) {
        console.log(`    - Dihapus ${resSoi.affectedRows} baris lama di stock_opname_items`);
      }

      // 11. Hapus relasi Unit & Supplier milik produk lama
      await sequelize.query('DELETE FROM product_units WHERE product_id = ?', {
        replacements: [item.fromId],
        transaction
      });
      await sequelize.query('DELETE FROM product_suppliers WHERE product_id = ?', {
        replacements: [item.fromId],
        transaction
      });

      // 12. Hapus Master Produk Lama
      await sequelize.query('DELETE FROM products WHERE id = ?', {
        replacements: [item.fromId],
        transaction
      });
      console.log(`    [SUCCESS] Produk ${item.fromSku} (${oldProd[0].name}) berhasil dihapus dan dimerge ke ${item.toSku}.\n`);
    }

    await transaction.commit();
    console.log('=== SEMUA PRODUK DUPLIKAT BERHASIL DIGABUNGKAN DENGAN AMAN! ===');
  } catch (error) {
    await transaction.rollback();
    console.error('\n[ERROR] Terjadi kegagalan, seluruh perubahan di-rollback:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  mergeDuplicateProducts().then(() => {
    process.exit(0);
  });
}

module.exports = { mergeDuplicateProducts };

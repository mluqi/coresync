const { sequelize } = require('../models');

/**
 * Mendapatkan nomor SKU otomatis berikutnya dengan format PRD-00001 (5 digit angka berurutan)
 * Menjamin SKU selalu meneruskan nomor PRD terbesar yang sudah ada di database.
 */
async function getNextProductSku(tenantId) {
  try {
    const [results] = await sequelize.query(`
      SELECT sku FROM products 
      WHERE tenant_id = :tenantId AND sku LIKE 'PRD-%'
    `, {
      replacements: { tenantId }
    });

    let maxNum = 0;
    (results || []).forEach(row => {
      const match = (row.sku || '').match(/^PRD-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    return `PRD-${String(maxNum + 1).padStart(5, '0')}`;
  } catch (err) {
    console.error('Error generating next SKU:', err);
    return 'PRD-00001';
  }
}

/**
 * Legacy / Name-based SKU generator fallback jika dibutuhkan
 */
function generateProductSku(category = '', name = '') {
  // Format utama sekarang berbasis sequence PRD-XXXXX
  return 'PRD-00001';
}

module.exports = { 
  getNextProductSku,
  generateProductSku 
};

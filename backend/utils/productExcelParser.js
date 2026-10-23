const xlsx = require('xlsx');

/**
 * Normalizes string keys for flexible header matching
 */
function cleanKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Cleans numbers (prices, qty, conversions)
 */
function parseNumber(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).replace(/[^0-9.-]/g, '').trim();
  if (!str) return defaultVal;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Checks if value represents taxable / PKP
 */
function parseTaxable(val) {
  if (!val) return false;
  if (val === true || val === 1 || val === '1') return true;
  const s = String(val).trim().toUpperCase();
  return ['PKP', 'PPN', 'TAX', 'YA', 'Y', 'YES', 'TRUE', '1', '11%'].includes(s);
}

/**
 * Normalizes unit names to match the master units table (KRT, BAL, KRG, RCG, PACK, PCS)
 */
function normalizeUnitName(str, defaultUnit = 'KRT') {
  if (!str) return defaultUnit;
  const s = String(str).trim().toUpperCase();
  if (s === 'KARTON' || s === 'KRT' || s === 'DUS' || s === 'BOX') return 'KRT';
  if (s === 'BAL') return 'BAL';
  if (s === 'KARUNG' || s === 'KRG' || s === 'SAK') return 'KRG';
  if (s === 'RENCENG' || s === 'RCG') return 'RCG';
  if (s === 'PACK' || s === 'PAK' || s === 'BUNGKUS') return 'PACK';
  if (s === 'PCS' || s === 'PIECES' || s === 'BUAH' || s === 'BIJI') return 'PCS';
  if (s === 'KG' || s === 'KILOGRAM') return 'KG';
  return s;
}

/**
 * Parse Excel Buffer or File into structured Product Objects
 */
function parseProductExcel(bufferOrPath) {
  const workbook = typeof bufferOrPath === 'string'
    ? xlsx.readFile(bufferOrPath)
    : xlsx.read(bufferOrPath, { type: 'buffer' });

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array matrix
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!matrix || matrix.length < 2) {
    throw new Error('File Excel kosong atau format tabel tidak sesuai.');
  }

  // Detect header row: find row containing keywords like "nama", "sku", "kode", "barang", "produk", "harga"
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(5, matrix.length); r++) {
    const rowStr = matrix[r].map(c => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('nama') || rowStr.includes('sku') || rowStr.includes('kode') || rowStr.includes('harga') || rowStr.includes('barang') || rowStr.includes('produk')) {
      headerRowIndex = r;
      break;
    }
  }

  const rawHeaders = matrix[headerRowIndex];
  const headerMap = {};

  rawHeaders.forEach((h, colIdx) => {
    const key = cleanKey(h);
    if (!key) return;

    if (key.includes('sku') || key === 'kode' || key === 'kodebarang' || key === 'kodeproduk' || key === 'itemcode' || key === 'barcode') {
      headerMap.sku = colIdx;
    } else if (key.includes('namabarang') || key.includes('namaproduk') || key.includes('itemname') || key === 'nama' || key === 'name') {
      headerMap.name = colIdx;
    } else if (key.includes('kategoriid') || key.includes('idkategori') || key.includes('categoryid') || key.includes('idcategory')) {
      headerMap.categoryId = colIdx;
    } else if (key.includes('kategori') || key.includes('category') || key.includes('golongan') || key.includes('kelompok')) {
      if (headerMap.categoryId === undefined && (key.endsWith('id') || key.startsWith('id'))) {
        headerMap.categoryId = colIdx;
      } else {
        headerMap.category = colIdx;
      }
    } else if (key.includes('supplierid') || key.includes('idsupplier') || key.includes('kodesupplier') || key.includes('suppliercode') || key.includes('pemasokid') || key.includes('vendorid')) {
      headerMap.supplierId = colIdx;
    } else if (key.includes('supplier') || key.includes('vendor') || key.includes('pemasok')) {
      if (headerMap.supplierId === undefined && (key.endsWith('id') || key.startsWith('id') || key.includes('kode'))) {
        headerMap.supplierId = colIdx;
      } else {
        headerMap.supplier = colIdx;
      }
    }
    // Multi-Unit Alternate Prices (Check prices FIRST to prevent collisions with unit names)
    if (key.includes('hargabelisatuan1') || key.includes('hargabeli1') || key.includes('purchaseprice2')) {
      headerMap.purchasePrice2 = colIdx;
    } else if (key.includes('hargajualsatuan1') || key.includes('hargajual1') || key.includes('sellingprice2')) {
      headerMap.sellingPrice2 = colIdx;
    } else if (key.includes('hargabelisatuan2') || key.includes('hargabeli2') || key.includes('hargabeli3') || key.includes('purchaseprice3')) {
      headerMap.purchasePrice3 = colIdx;
    } else if (key.includes('hargajualsatuan2') || key.includes('hargajual2') || key.includes('hargajual3') || key.includes('sellingprice3')) {
      headerMap.sellingPrice3 = colIdx;
    }
    // Alternate Multi Units Conversions
    else if (key.includes('konversisatuan1') || key.includes('konversi1') || key.includes('isi1') || key.includes('ratio1') || key.includes('isiper1')) {
      headerMap.conversion2 = colIdx;
    } else if (key.includes('konversisatuan2') || key.includes('konversi2') || key.includes('isi2') || key.includes('ratio2') || key.includes('isiper2') || key.includes('konversi3') || key.includes('isi3')) {
      headerMap.conversion3 = colIdx;
    }
    // Alternate Unit Names
    else if (key.includes('satuanalternatif1') || key.includes('satuanalt1') || key === 'satuan2' || key === 'unit2' || key === 'altunit1' || key === 'satuaneceran') {
      headerMap.unit2 = colIdx;
    } else if (key.includes('satuanalternatif2') || key.includes('satuanalt2') || key === 'satuan3' || key === 'unit3' || key === 'altunit2') {
      headerMap.unit3 = colIdx;
    }
    // Base Unit & Base Pricing
    else if (key.includes('satuandasar') || key === 'satuan' || key === 'unit' || key === 'uom' || key === 'baseunit') {
      headerMap.unit = colIdx;
    } else if (key.includes('hargajual') || key.includes('sellingprice') || key.includes('hjual') || key.includes('hrgjual') || key === 'hargasatuan' || key === 'jual') {
      if (headerMap.sellingPrice === undefined) headerMap.sellingPrice = colIdx;
    } else if (key.includes('hargabeli') || key.includes('purchaseprice') || key.includes('hbeli') || key.includes('hrgbeli') || key.includes('hpp') || key === 'beli') {
      if (headerMap.purchasePrice === undefined) headerMap.purchasePrice = colIdx;
    } else if (key.includes('stokmin') || key.includes('minstock') || key.includes('minimumstock') || key.includes('minimal')) {
      headerMap.minStock = colIdx;
    } else if (key.includes('pajak') || key.includes('tax') || key.includes('pkp') || key.includes('ppn')) {
      headerMap.taxStatus = colIdx;
    } else if (key.includes('stokawal') || key.includes('stok') || key.includes('stock') || key.includes('qtyawal')) {
      headerMap.initialStock = colIdx;
    } else if (key.includes('deskripsi') || key.includes('description') || key.includes('keterangan') || key.includes('catatan')) {
      headerMap.description = colIdx;
    }
  });

  const products = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;

    // Helper to get cell value
    const getCell = (colIdx) => (colIdx !== undefined && row[colIdx] !== undefined ? String(row[colIdx]).trim() : '');

    const name = getCell(headerMap.name);
    const sku = getCell(headerMap.sku);

    // Skip empty row if no name and no SKU
    if (!name && !sku) continue;

    const unit = normalizeUnitName(getCell(headerMap.unit), 'KRT');
    const categoryId = getCell(headerMap.categoryId);
    const category = getCell(headerMap.category);
    const supplierId = getCell(headerMap.supplierId);
    const supplier = getCell(headerMap.supplier);
    const sellingPrice = parseNumber(row[headerMap.sellingPrice], 0);
    const purchasePrice = parseNumber(row[headerMap.purchasePrice], 0);
    const minStock = parseNumber(row[headerMap.minStock], 10);
    const isTaxable = parseTaxable(getCell(headerMap.taxStatus));
    const initialStock = parseNumber(row[headerMap.initialStock], 0);
    const description = getCell(headerMap.description);

    // Multi-unit parsing
    const units = [];
    const unit2Name = normalizeUnitName(getCell(headerMap.unit2), '');
    const conv2 = parseNumber(row[headerMap.conversion2], 0);
    if (unit2Name && conv2 > 0) {
      units.push({
        unitName: unit2Name,
        relationType: 'ECERAN',
        qtyFactor: conv2,
        sellingPrice: parseNumber(row[headerMap.sellingPrice2], 0),
        purchasePrice: parseNumber(row[headerMap.purchasePrice2], 0),
        isBaseUnit: false
      });
    }

    const unit3Name = normalizeUnitName(getCell(headerMap.unit3), '');
    const conv3 = parseNumber(row[headerMap.conversion3], 0);
    if (unit3Name && conv3 > 0) {
      units.push({
        unitName: unit3Name,
        relationType: 'ECERAN',
        qtyFactor: conv3,
        sellingPrice: parseNumber(row[headerMap.sellingPrice3], 0),
        purchasePrice: parseNumber(row[headerMap.purchasePrice3], 0),
        isBaseUnit: false
      });
    }

    products.push({
      sku,
      name: name || sku,
      categoryId,
      category,
      supplierId,
      supplier,
      unit,
      sellingPrice,
      purchasePrice,
      minStock,
      isTaxable,
      initialStock,
      description,
      units
    });
  }

  return products;
}

module.exports = {
  cleanKey,
  parseNumber,
  parseTaxable,
  parseProductExcel
};

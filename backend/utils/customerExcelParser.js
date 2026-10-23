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
 * Parses dates formatted as Excel serial numbers, DD/MM/YY, DD/MM/YYYY, or YYYY-MM-DD
 */
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Handle DD/MM/YY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Cleans numbers (TOP, credit limit)
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
 * Checks if a cell value represents a checked checkbox (V, v, Y, y, 1, X, x, ✓, TRUE, YA)
 */
function isChecked(val) {
  if (!val) return false;
  if (val === true || val === 1 || val === '1') return true;
  const s = String(val).trim().toUpperCase();
  return ['V', 'Y', 'YES', 'YA', '1', '1.0', 'TRUE', 'X', '✓', 'OK', 'ADA'].includes(s);
}

/**
 * Parse Excel Buffer or File into structured Customer Objects
 * Supports 1-row unified header and 2-row multi-header with comprehensive fuzzy column matching
 */
function parseCustomerExcel(bufferOrPath) {
  const workbook = typeof bufferOrPath === 'string'
    ? xlsx.readFile(bufferOrPath)
    : xlsx.read(bufferOrPath, { type: 'buffer' });

  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array matrix
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!matrix || matrix.length < 2) {
    throw new Error('File Excel kosong atau format header tidak sesuai.');
  }

  // Detect header rows: Check row 0, 1, 2 for header keywords like "Nama", "Kode", "Alamat"
  let headerRowIndex = 0;
  let subHeaderRowIndex = -1;

  for (let r = 0; r < Math.min(4, matrix.length); r++) {
    const rowStr = matrix[r].map(c => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('nama') || rowStr.includes('langganan') || rowStr.includes('kode') || rowStr.includes('outlet')) {
      headerRowIndex = r;
      if (r + 1 < matrix.length) {
        const nextRowStr = matrix[r + 1].map(c => String(c).toLowerCase()).join(' ');
        // Check if next row is a sub-header (e.g. contains Wilayah, Tipe, Salesman, W.Pajak)
        if (nextRowStr.includes('wilayah') || nextRowStr.includes('tipe') || nextRowStr.includes('salesman') || nextRowStr.includes('w.pajak') || nextRowStr.includes('wajib pajak')) {
          subHeaderRowIndex = r + 1;
        }
      }
      break;
    }
  }

  const row1 = matrix[headerRowIndex] || [];
  const row2 = subHeaderRowIndex !== -1 ? matrix[subHeaderRowIndex] : [];

  // Build column metadata
  const maxCols = Math.max(row1.length, row2.length);
  const columnHeaders = [];

  let lastMainHeader = '';
  let sHeaderCount = 0;

  for (let c = 0; c < maxCols; c++) {
    let mainH = String(row1[c] || '').trim();
    let subH = String(row2[c] || '').trim();

    if (mainH) {
      lastMainHeader = mainH;
    } else if (subHeaderRowIndex !== -1) {
      mainH = lastMainHeader;
    }

    let combined = subHeaderRowIndex !== -1 ? `${mainH} ${subH}`.trim() : mainH;
    let mainClean = cleanKey(mainH);
    let subClean = cleanKey(subH);
    let combClean = cleanKey(combined);

    // Identify specific day column if header is single character 's', 'r', 'k', 'j' or day name
    let dayType = null;
    if (mainClean === 'senin' || subClean === 'senin') {
      dayType = 'SENIN';
    } else if (mainClean === 'selasa' || subClean === 'selasa') {
      dayType = 'SELASA';
    } else if (mainClean === 'rabu' || subClean === 'rabu' || mainClean === 'r' || subClean === 'r') {
      dayType = 'RABU';
    } else if (mainClean === 'kamis' || subClean === 'kamis' || mainClean === 'k' || subClean === 'k') {
      dayType = 'KAMIS';
    } else if (mainClean === 'jumat' || subClean === 'jumat' || mainClean === 'j' || subClean === 'j') {
      dayType = 'JUMAT';
    } else if (mainClean === 'sabtu' || subClean === 'sabtu') {
      dayType = 'SABTU';
    } else if (mainClean === 's' || subClean === 's') {
      if (sHeaderCount === 0) dayType = 'SENIN';
      else if (sHeaderCount === 1) dayType = 'SELASA';
      else dayType = 'SABTU';
      sHeaderCount++;
    }

    columnHeaders.push({
      index: c,
      raw: combined || mainH || subH || `col_${c}`,
      cleaned: combClean,
      mainCleaned: mainClean,
      subCleaned: subClean,
      dayType
    });
  }

  const dataStartRow = subHeaderRowIndex !== -1 ? subHeaderRowIndex + 1 : headerRowIndex + 1;
  const customers = [];

  for (let r = dataStartRow; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every(cell => String(cell || '').trim() === '')) {
      continue; // Skip empty rows
    }

    const item = {
      code: '',
      legacyCode: '',
      name: '',
      address: '',
      address2: '',
      phone: '',
      phone2: '',
      email: '',
      shippingAddress: '',
      regionCode: '',
      regionName: '',
      typeCode: '',
      typeName: '',
      areaCode: '',
      areaName: '',
      districtName: '',
      salespersonCode: '',
      salespersonName: '',
      salespersonId: null,
      topDays: 0,
      creditLimit: 0,
      contactPerson: '',
      contactPersonPhone: '',
      nik: '',
      npwp: '',
      taxName: '',
      taxAddress1: '',
      taxAddress2: '',
      taxBlock: '',
      taxHouseNumber: '',
      taxRt: '',
      taxRw: '',
      taxKelurahan: '',
      taxKecamatan: '',
      taxCity: '',
      taxProvince: '',
      priceTier: 'REGULER',
      visitDays: [],
      visitWeeks: [],
      visitTime: '',
      openOutletDate: null,
      metadata: {}
    };

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val === undefined || val === null || String(val).trim() === '') continue;
      const strVal = String(val).trim();

      const col = columnHeaders[c] || { cleaned: '', raw: '', mainCleaned: '', subCleaned: '', dayType: null };
      const k = col.cleaned;

      // 1. Visit Days directly by DayType if mapped (S, S, R, K, J, S)
      if (col.dayType) {
        if (isChecked(val)) {
          if (!item.visitDays.includes(col.dayType)) {
            item.visitDays.push(col.dayType);
          }
        }
      }
      // 2. Visit Weeks (MG-1, MG-2, MG-3, MG-4, Minggu-1, M1, etc.)
      else if (k.includes('mg1') || k.includes('minggu1') || k === 'm1' || k === 'w1' || k.includes('week1') || col.mainCleaned === 'mg1' || col.subCleaned === 'mg1') {
        if (isChecked(val) && !item.visitWeeks.includes('MG-1')) item.visitWeeks.push('MG-1');
      }
      else if (k.includes('mg2') || k.includes('minggu2') || k === 'm2' || k === 'w2' || k.includes('week2') || col.mainCleaned === 'mg2' || col.subCleaned === 'mg2') {
        if (isChecked(val) && !item.visitWeeks.includes('MG-2')) item.visitWeeks.push('MG-2');
      }
      else if (k.includes('mg3') || k.includes('minggu3') || k === 'm3' || k === 'w3' || k.includes('week3') || col.mainCleaned === 'mg3' || col.subCleaned === 'mg3') {
        if (isChecked(val) && !item.visitWeeks.includes('MG-3')) item.visitWeeks.push('MG-3');
      }
      else if (k.includes('mg4') || k.includes('minggu4') || k === 'm4' || k === 'w4' || k.includes('week4') || col.mainCleaned === 'mg4' || col.subCleaned === 'mg4') {
        if (isChecked(val) && !item.visitWeeks.includes('MG-4')) item.visitWeeks.push('MG-4');
      }
      // 3. Customer Code
      else if ((k.includes('kode') && !k.includes('wilayah') && !k.includes('tipe') && !k.includes('area') && !k.includes('sales') && !k.includes('lama') && !k.includes('pos')) || k === 'kode') {
        if (!item.code) item.code = strVal;
      }
      // 4. Legacy Code (Ensure alamat is NOT matched here)
      else if (k.includes('kodelama') || (k.includes('lama') && !k.includes('alamat')) || k === 'lama') {
        item.legacyCode = strVal;
      }
      // 5. Name
      else if (k.includes('namalangganan') || k.includes('namatoko') || k.includes('namaoutlet') || k.includes('namapelanggan') || (k.includes('nama') && !k.includes('wilayah') && !k.includes('tipe') && !k.includes('area') && !k.includes('kecamatan') && !k.includes('sales') && !k.includes('pajak') && !k.includes('wp'))) {
        item.name = strVal;
      }
      // 6. Tax Address (Check Tax Address BEFORE general Address)
      else if (k.includes('alamat2wajibpajak') || k.includes('alamat2wpajak') || k.includes('alamat2wp') || k.includes('alamat2pajak') || (k.includes('alamat2') && (k.includes('pajak') || k.includes('wp')))) {
        item.taxAddress2 = strVal;
      }
      else if (k.includes('alamat1wajibpajak') || k.includes('alamat1wpajak') || k.includes('alamat1wp') || k.includes('alamat1pajak') || ((k.includes('alamat1') || k.includes('alamat')) && (k.includes('pajak') || k.includes('wp')))) {
        if (!item.taxAddress1) item.taxAddress1 = strVal;
      }
      // 7. General Address 1 & 2
      else if (k.includes('alamat2') && !k.includes('pajak') && !k.includes('wp')) {
        item.address2 = strVal;
      }
      else if (k.includes('alamat1') || k === 'alamat' || k.includes('alamattoko') || k.includes('alamatoutlet') || (k.includes('alamat') && !k.includes('2') && !k.includes('pajak') && !k.includes('wp'))) {
        if (!item.address) item.address = strVal;
      }
      // 7. Phone 1 & 2 (Flexible matching: Telpon-1, Telp-1, Telepon 1, Phone 1, No Telp, etc.)
      else if (k.includes('telp2') || k.includes('telpon2') || k.includes('telepon2') || k.includes('phone2')) {
        item.phone2 = strVal;
      }
      else if (k.includes('telp1') || k.includes('telpon1') || k.includes('telepon1') || k.includes('phone1')) {
        item.phone = strVal;
      }
      else if ((k.includes('telp') || k.includes('telpon') || k.includes('telepon') || k.includes('phone')) && !k.includes('hp') && !k.includes('pic') && !k.includes('contact')) {
        if (!item.phone) item.phone = strVal;
      }
      // 8. Region Code & Name
      else if (k.includes('kodewilayah') || (col.mainCleaned.includes('wilayah') && col.subCleaned.includes('kode')) || (col.subCleaned.includes('wilayah') && col.mainCleaned.includes('kode'))) {
        item.regionCode = strVal;
      }
      else if (k.includes('namawilayah') || (col.mainCleaned.includes('wilayah') && col.subCleaned.includes('nama')) || (col.subCleaned.includes('wilayah') && col.mainCleaned.includes('nama')) || k === 'wilayah') {
        item.regionName = strVal;
      }
      // 9. Type Code & Name
      else if (k.includes('kodetipe') || (col.mainCleaned.includes('tipe') && col.subCleaned.includes('kode')) || (col.subCleaned.includes('tipe') && col.mainCleaned.includes('kode'))) {
        item.typeCode = strVal;
      }
      else if (k.includes('namatipe') || (col.mainCleaned.includes('tipe') && col.subCleaned.includes('nama')) || (col.subCleaned.includes('tipe') && col.mainCleaned.includes('nama')) || k === 'tipe') {
        item.typeName = strVal;
      }
      // 10. Area Code & Name
      else if (k.includes('kodearea') || (col.mainCleaned.includes('area') && col.subCleaned.includes('kode')) || (col.subCleaned.includes('area') && col.mainCleaned.includes('kode'))) {
        item.areaCode = strVal;
      }
      else if (k.includes('namaarea') || (col.mainCleaned.includes('area') && col.subCleaned.includes('nama')) || (col.subCleaned.includes('area') && col.mainCleaned.includes('nama')) || k === 'area') {
        item.areaName = strVal;
      }
      // 11. District (Kecamatan Outlet)
      else if (k.includes('namakecamatan') || (k.includes('kecamatan') && !k.includes('pajak') && !k.includes('wp'))) {
        item.districtName = strVal;
      }
      // 12. Combined or Separate Salesman Column (Kode sales/Nama salesman)
      else if (k.includes('kodesalesnamasalesman') || k.includes('salesmanname') || k.includes('salessalesman')) {
        // e.g. "103 / DANI" or "103 - DANI" or "DANI"
        if (strVal.includes('/') || strVal.includes('-')) {
          const parts = strVal.split(/[\/\-]/).map(s => s.trim());
          if (parts[0]) item.salespersonCode = parts[0];
          if (parts[1]) item.salespersonName = parts[1];
        } else if (/^\d+$/.test(strVal)) {
          item.salespersonCode = strVal;
        } else {
          item.salespersonName = strVal;
        }
      }
      else if (k.includes('kodesalesman') || k.includes('kodesales') || (col.mainCleaned.includes('salesman') && col.subCleaned.includes('kode'))) {
        item.salespersonCode = strVal;
      }
      else if (k.includes('namasalesman') || k.includes('namasales') || (col.mainCleaned.includes('salesman') && col.subCleaned.includes('nama')) || k === 'salesman' || k === 'sales') {
        item.salespersonName = strVal;
      }
      // 13. TOP & Plafon Kredit
      else if (k.includes('top') || k.includes('tempo')) {
        item.topDays = parseInt(parseNumber(val, 0));
      }
      else if (k.includes('plafon') || k.includes('kreditlimit') || k.includes('creditlimit') || k.includes('limit')) {
        item.creditLimit = parseNumber(val, 0);
      }
      // 14. Contact Person & No HP (Flexible matching: PIC, Kontak, CP, HP PIC, etc.)
      else if (k.includes('contactperson') || k.includes('kontakperson') || k.includes('namapic') || k === 'pic' || k === 'contact' || k === 'kontak' || k === 'cp') {
        item.contactPerson = strVal;
      }
      else if (k.includes('nomorhp') || k.includes('nohp') || k.includes('handphone') || k.includes('hppic') || k.includes('hpcontact') || k.includes('nohppic') || k === 'hp') {
        item.contactPersonPhone = strVal;
      }
      // 15. NIK & NPWP
      else if (k.includes('nik') || k.includes('ktp') || k.includes('nomorktp') || k.includes('noktp')) {
        item.nik = strVal;
      }
      else if (k.includes('npwp') || k.includes('nonpwp') || k.includes('nomornpwp')) {
        item.npwp = strVal;
      }
      // 16. Tax Master Data (Wajib Pajak)
      else if (k.includes('namawajibpajak') || k.includes('namawpajak') || k.includes('namawp') || k.includes('namapajak') || (k.includes('nama') && (k.includes('pajak') || k.includes('wp')))) {
        item.taxName = strVal;
      }
      else if (k.includes('noblok') || k.includes('blok') || k.includes('blokwp')) {
        item.taxBlock = strVal;
      }
      else if ((k.includes('rumah') && k.includes('rt')) || k.includes('nomorrumahnomorrt')) {
        // Fallback if combined
        if (strVal.includes('/') || strVal.includes('-')) {
          const parts = strVal.split(/[\/\-]/).map(s => s.trim());
          if (parts[0]) item.taxHouseNumber = parts[0];
          if (parts[1]) item.taxRt = parts[1];
        } else {
          item.taxHouseNumber = strVal;
        }
      }
      else if ((k.includes('nomorrumah') || k.includes('norumah') || k.includes('rumah')) && !k.includes('rt')) {
        item.taxHouseNumber = strVal;
      }
      else if (k.includes('nomorrt') || k.includes('nort') || k === 'rt' || k === 'rtwajibpajak' || k === 'rtwp' || k.includes('rtpajak')) {
        item.taxRt = strVal;
      }
      else if (k.includes('nomorrw') || k.includes('norw') || k === 'rw' || k === 'rwwajibpajak' || k === 'rwwp' || k.includes('rwpajak')) {
        item.taxRw = strVal;
      }
      else if (k.includes('kelurahan') || k.includes('desa')) {
        item.taxKelurahan = strVal;
      }
      else if (k.includes('kecamatanwajibpajak') || k.includes('kecamatanwpajak') || k.includes('kecamatanwp') || (k.includes('kecamatan') && (k.includes('pajak') || k.includes('wp')))) {
        item.taxKecamatan = strVal;
      }
      else if (k.includes('kabupaten') || k.includes('kota') || k.includes('kabkota') || k.includes('kab')) {
        item.taxCity = strVal;
      }
      else if (k.includes('propinsi') || k.includes('provinsi') || k.includes('prov')) {
        item.taxProvince = strVal;
      }
      // 17. Price Tier
      else if (k.includes('jenisharga') || k.includes('pricetier') || k === 'harga' || k.includes('tier')) {
        item.priceTier = strVal;
      }
      // 18. Visit Time & Open Date
      else if (k.includes('jamkunjungan') || k.includes('waktukunjungan') || k.includes('visittime') || (k.includes('jam') && !k.includes('pajak'))) {
        item.visitTime = strVal;
      }
      else if (k.includes('opennewoutlet') || k.includes('tglopen') || k.includes('openoutlet') || k.includes('tgloutlet') || k.includes('tglgabung') || k.includes('tanggalopen')) {
        item.openOutletDate = parseDate(val);
      }
    }

    // Only include rows with a valid customer name
    if (item.name && item.name.trim()) {
      customers.push(item);
    }
  }

  return customers;
}

module.exports = {
  parseCustomerExcel,
  cleanKey,
  parseDate,
  parseNumber,
  isChecked
};

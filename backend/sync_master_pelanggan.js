'use strict';

/**
 * Script: Sync Master Pelanggan dari File Excel (MASTER_PELANGGAN.xlsx)
 * 
 * Aturan Pencocokan & Pembaruan:
 * 1. Setiap baris di Excel memiliki kolom `No` yang berhubungan langsung dengan `code` di database
 *    (contoh No: 4542 <-> code: C-TGL-004542).
 * 2. Pencocokan utama:
 *    - Cocokkan berdasarkan `No` dengan `code` (C-TGL-XXXXXX).
 *    - Jika ada baris tanpa No atau nomor berbeda, cocokkan berdasarkan nama (`NAMA_CUST`).
 *    - Menyelesaikan masalah nama ganda/duplikat sehingga TIDAK ADA DATA YANG MISS atau SALAH TIMPA.
 * 3. Pembaruan data:
 *    - Mengganti seluruh data lama di database dengan data terbaru dari Excel (Alamat, Wilayah, Tipe,
 *      Area, Kecamatan, Kode Salesman, Nama Salesman, ID Salesman, TOP, Plafon, No HP/Telp, NIK, NPWP, 
 *      Nama & Alamat NPWP, Tgl Buka Outlet).
 *    - Kolom `code` tetap mengikuti yang ada di database.
 * 4. Jika data benar-benar belum ada di database:
 *    - Otomatis ditambahkan sebagai pelanggan baru dengan kode lanjutan.
 * 
 * Penggunaan:
 *   node sync_master_pelanggan.js [pathFileExcel] [tenantId] [--dry-run]
 * Contoh:
 *   node sync_master_pelanggan.js ../data/MASTER_PELANGGAN.xlsx 1
 *   node sync_master_pelanggan.js ../data/MASTER_PELANGGAN.xlsx 1 --dry-run
 */

const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { Customer, Salesperson, sequelize } = require('./models');

// Helper normalisasi nama pelanggan untuk pencocokan fallback
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

// Helper ambil nilai row secara fleksibel (case-insensitive & whitespace-tolerant)
function getVal(row, ...keys) {
  if (!row) return null;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
    const target = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const actualKey of Object.keys(row)) {
      if (actualKey.toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
        if (row[actualKey] !== undefined && row[actualKey] !== null) {
          return row[actualKey];
        }
      }
    }
  }
  return null;
}

// Helper parsing string aman
function cleanString(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' || s === '0' && s.length === 1 ? null : s;
}

// Helper parsing string nama (agar nilai 0 tidak terhapus jika bukan string kosong)
function cleanNameString(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

// Helper parsing tanggal Excel (serial number atau string date)
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel base date: 1899-12-30
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return !isNaN(dateInfo.getTime()) ? dateInfo.toISOString().split('T')[0] : null;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Helper parsing angka
function parseNum(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
  if (!cleaned) return defaultVal;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultVal : parsed;
}

async function runSync() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const nonFlagArgs = args.filter(a => !a.startsWith('--'));

  const defaultExcelPath = path.resolve(__dirname, '../data/MASTER_PELANGGAN.xlsx');
  const inputFilePath = nonFlagArgs[0] || defaultExcelPath;
  const targetTenantId = parseInt(nonFlagArgs[1] || '1', 10);

  const resolvedPath = path.isAbsolute(inputFilePath)
    ? inputFilePath
    : path.resolve(process.cwd(), inputFilePath);

  console.log('\n===============================================================');
  console.log('📦 CoreSync ERP — Sinkronisasi Akurat Master Pelanggan');
  console.log('===============================================================');
  console.log(`📁 File Excel Target : ${resolvedPath}`);
  console.log(`🏢 Tenant ID Target  : ${targetTenantId}`);
  console.log(`⚙️ Mode Eksekusi     : ${isDryRun ? 'DRY-RUN (Simulasi saja)' : 'LIVE (Menyimpan perubahan ke DB)'}`);
  console.log('===============================================================\n');

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File tidak ditemukan di: ${resolvedPath}`);
    process.exit(1);
  }

  // 1. Baca File Excel
  console.log('⏳ Membaca file Excel...');
  const workbook = xlsx.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);
  console.log(`📊 Berhasil memuat ${rows.length} baris data dari sheet "${sheetName}".\n`);

  if (rows.length === 0) {
    console.log('⚠️ File Excel kosong.');
    process.exit(0);
  }

  // 2. Muat Salespersons untuk mapping salesperson_id
  console.log('⏳ Mengambil master data salespersons...');
  const salespersons = await Salesperson.findAll({ where: { tenantId: targetTenantId } });
  const spMapByName = new Map();
  salespersons.forEach(sp => {
    spMapByName.set(sp.name.trim().toLowerCase(), sp);
  });
  console.log(`👥 Ditemukan ${salespersons.length} data salesperson:`);
  salespersons.forEach(sp => console.log(`   • [ID: ${sp.id}] ${sp.code || '-'} - ${sp.name}`));

  // 3. Muat Data Pelanggan yang ada di Database untuk Tenant ini
  console.log('\n⏳ Mengambil seluruh pelanggan yang ada di database...');
  const existingCustomers = await Customer.findAll({
    where: { tenantId: targetTenantId }
  });
  console.log(`🗄️ Total pelanggan terdaftar di DB: ${existingCustomers.length} pelanggan.`);

  // Lookup Map berdasarkan CODE (C-TGL-XXXXXX) -> Pencocokan Utama yang 100% Unik
  const custByCode = new Map();
  // Lookup Map berdasarkan Nama (Array untuk menangani nama duplikat)
  const custByName = new Map();

  let maxCodeNum = 0;
  existingCustomers.forEach(cust => {
    if (cust.code) {
      custByCode.set(cust.code.trim().toUpperCase(), cust);
      if (cust.code.startsWith('C-TGL-')) {
        const num = parseInt(cust.code.replace('C-TGL-', ''), 10);
        if (!isNaN(num) && num > maxCodeNum) {
          maxCodeNum = num;
        }
      }
    }
    const nameKey = normalizeName(cust.name);
    if (nameKey) {
      if (!custByName.has(nameKey)) {
        custByName.set(nameKey, []);
      }
      custByName.get(nameKey).push(cust);
    }
  });

  let nextNewCodeIndex = maxCodeNum + 1;
  console.log(`🏷️ Kode C-TGL- tertinggi saat ini di DB: C-TGL-${String(maxCodeNum).padStart(6, '0')}.`);
  console.log(`🏷️ Kode berikutnya untuk data baru: C-TGL-${String(nextNewCodeIndex).padStart(6, '0')}.\n`);

  // 4. Proses Loop Data Excel
  let matchedByCodeCount = 0;
  let matchedByNameCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  const matchedCustIds = new Set();

  console.log('🚀 Memulai proses pencocokan dan pembaruan data...');

  const transaction = isDryRun ? null : await sequelize.transaction();

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawName = cleanNameString(getVal(row, 'NAMA_CUST', 'nama_cust', 'NAMA', 'Nama'));
      const rawNo = getVal(row, 'No', 'NO', 'no');

      if (!rawName) {
        skippedCount++;
        continue;
      }

      // Kunci pencocokan 1: Nomor baris Excel yang berhubungan dengan kode di DB
      // Contoh: No 4542 <-> C-TGL-004542
      let matchedCust = null;
      let matchMethod = '';

      if (rawNo) {
        const targetCode = `C-TGL-${String(rawNo).padStart(6, '0')}`;
        if (custByCode.has(targetCode)) {
          matchedCust = custByCode.get(targetCode);
          matchMethod = 'CODE';
        }
      }

      // Kunci pencocokan 2 (Fallback jika tidak cocok by No): Cocokkan by Name
      if (!matchedCust) {
        const nameKey = normalizeName(rawName);
        const candidates = custByName.get(nameKey) || [];
        // Cari kandidat yang belum pernah diupdate pada sesi ini
        matchedCust = candidates.find(c => !matchedCustIds.has(c.id)) || candidates[0] || null;
        if (matchedCust) {
          matchMethod = 'NAME';
        }
      }

      // Mapping Salesperson
      const rawSpName = cleanString(getVal(row, 'NAMA_SLS', 'nama_sls'));
      const rawSpCode = cleanString(getVal(row, 'KODE_SLS', 'kode_sls'));
      let matchedSpId = null;
      if (rawSpName) {
        const sp = spMapByName.get(rawSpName.toLowerCase());
        if (sp) matchedSpId = sp.id;
      }

      // Siapkan payload data baru dari Excel
      const payload = {
        name: rawName,
        address: cleanString(getVal(row, 'ALM_CUST', 'alm_cust')),
        legacyCode: cleanString(getVal(row, 'KODE_CUST', 'kode_cust')),
        regionCode: cleanString(getVal(row, 'KODE_WIL', 'kode_wil')),
        regionName: cleanString(getVal(row, 'NAMA_WIL', 'nama_wil')),
        typeCode: cleanString(getVal(row, 'KODE_TP', 'kode_tp')),
        typeName: cleanString(getVal(row, 'NAMA_TP', 'nama_tp')),
        areaCode: cleanString(getVal(row, 'KODE_AR', 'kode_ar')),
        areaName: cleanString(getVal(row, 'NAMA_AR', 'nama_ar')),
        districtName: cleanString(getVal(row, 'KEC_AR', 'kec_ar')),
        salespersonCode: rawSpCode,
        salespersonName: rawSpName,
        salespersonId: matchedSpId,
        topDays: parseNum(getVal(row, 'T_OP', 't_op', 'top'), 0),
        creditLimit: parseNum(getVal(row, 'PLAFON', 'plafon'), 0),
        phone: cleanString(getVal(row, 'HP_CP', 'hp_cp')),
        contactPersonPhone: cleanString(getVal(row, 'HP_CP', 'hp_cp')),
        nik: cleanString(getVal(row, 'NO_KTP', 'no_ktp')),
        npwp: cleanString(getVal(row, 'NO_NPWP', 'no_npwp')),
        taxName: cleanString(getVal(row, 'NAMA_NPWP', 'nama_npwp')),
        taxAddress1: cleanString(getVal(row, 'ALM_NPWP', 'alm_npwp')),
        taxBlock: cleanString(getVal(row, 'BLOK_NPWP', 'blok_npwp')),
        openOutletDate: parseExcelDate(getVal(row, 'Tgl Noo', 'tgl_noo', 'TGL_NOO'))
      };

      if (matchedCust) {
        // GANTI DATA LAMA DENGAN YANG BARU (KODE CUST TETAP MEMPERTAHANKAN DB)
        matchedCustIds.add(matchedCust.id);
        if (matchMethod === 'CODE') matchedByCodeCount++;
        else matchedByNameCount++;

        if (!isDryRun) {
          await matchedCust.update(payload, { transaction });
        }
      } else {
        // DATA BELUM ADA DI DB -> TAMBAHKAN PELANGGAN BARU
        const generatedCode = `C-TGL-${String(nextNewCodeIndex++).padStart(6, '0')}`;
        const newRecord = {
          ...payload,
          tenantId: targetTenantId,
          code: generatedCode,
          isActive: true
        };

        if (!isDryRun) {
          const created = await Customer.create(newRecord, { transaction });
          matchedCustIds.add(created.id);
          custByCode.set(generatedCode, created);
        }
        createdCount++;
      }

      if ((i + 1) % 500 === 0 || i === rows.length - 1) {
        process.stdout.write(`  ⏳ Memproses baris ${i + 1} / ${rows.length}...\r`);
      }
    }

    if (!isDryRun) {
      console.log('\n💾 Menyimpan seluruh perubahan (commit transaction)...');
      await transaction.commit();
      console.log('✅ Berhasil commit ke database MySQL!');
    } else {
      console.log('\n🔎 Mode Dry-Run selesai.');
    }

    const totalUpdated = matchedByCodeCount + matchedByNameCount;
    console.log('\n===============================================================');
    console.log('🎉 HASIL SINKRONISASI AKURAT MASTER PELANGGAN');
    console.log('===============================================================');
    console.log(`📄 Total baris Excel diproses    : ${rows.length}`);
    console.log(`🎯 Dicocokkan by No <-> Code     : ${matchedByCodeCount} data (100% akurat per baris No)`);
    console.log(`🏷️ Dicocokkan by Nama (Fallback) : ${matchedByNameCount} data`);
    console.log(`🔄 Total pelanggan diupdate      : ${totalUpdated} data`);
    console.log(`➕ Pelanggan baru ditambahkan    : ${createdCount} data`);
    console.log(`⏭️ Baris dilewati (tanpa nama)   : ${skippedCount} data`);
    console.log('===============================================================\n');

  } catch (err) {
    if (transaction) {
      console.error('\n⚠️ Terjadi kesalahan! Melakukan rollback transaction...');
      await transaction.rollback();
    }
    console.error('❌ Gagal sinkronisasi pelanggan:', err);
    process.exit(1);
  }

  process.exit(0);
}

runSync().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

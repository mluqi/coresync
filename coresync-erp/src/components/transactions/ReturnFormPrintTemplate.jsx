import React from 'react';
import { formatQty } from '../../utils/format';

/**
 * ReturnFormPrintTemplate
 * 
 * Komponen cetak UI untuk 'Form Barang Balikan & Retur'.
 * Didesain khusus dalam format layout vertikal A4 untuk dicetak ke kertas dan diisi secara manual (tulisan tangan),
 * atau dapat juga merender item yang sudah tercatat di sistem dengan baris kosong pelengkap (blank rows).
 * 
 * Fitur:
 * 1. Layout vertikal A4 memuat 2 tabel utama:
 *    - Tabel 1 (Atas): FORM BARANG BALIKAN
 *    - Tabel 2 (Bawah): FORM BARANG RETUR
 * 2. Header judul di tengah (bold & underline) dan teks 'TANGGAL :' di sebelah kanan atas sebelum tabel.
 * 3. 4 kolom persis: NO, NAMA BARANG, JUMLAH (QTY), dan KETERANGAN dengan border grid hitam tegas.
 * 4. Perulangan 15 baris kosong bergaris (blank rows) bernomor per tabel untuk ruang tulis tangan.
 * 5. Dua kolom tanda tangan di bagian bawah: 'Diserahkan,' (Dropping) & 'Diterima,' (Gudang).
 */
const ReturnFormPrintTemplate = ({
  balikanItems = [],
  returItems = [],
  balikanDate = '',
  returDate = '',
  emptyRowsCount = 15,
  droppingRole = 'Dropping',
  gudangRole = 'Gudang',
  droppingName = '',
  gudangName = '',
  companyName = ''
}) => {
  // Helper to build rows array (items + empty padded rows up to emptyRowsCount)
  const buildRows = (items, minCount = 15) => {
    const totalRows = Math.max(items.length, minCount);
    const rows = [];
    for (let i = 0; i < totalRows; i++) {
      if (i < items.length) {
        const itemCondition = items[i].condition === 'DAMAGED' ? `[RUSAK] ${items[i].reason || ''}`.trim() : '';
        const combinedKet = items[i].notes || items[i].keterangan || itemCondition || items[i].reason || '';
        const rawQty = items[i].qty !== undefined && items[i].qty !== null ? items[i].qty : items[i].quantity;
        const qtyFormatted = rawQty !== undefined && rawQty !== null && rawQty !== '' ? formatQty(rawQty) : '';
        const unitStr = items[i].unit || items[i].product?.unit || '';
        rows.push({
          no: i + 1,
          name: items[i].name || items[i].productName || items[i].product?.name || '',
          qty: qtyFormatted ? `${qtyFormatted} ${unitStr}`.trim() : '',
          keterangan: combinedKet
        });
      } else {
        rows.push({
          no: i + 1,
          name: '',
          qty: '',
          keterangan: ''
        });
      }
    }
    return rows;
  };

  const balikanRows = buildRows(balikanItems, emptyRowsCount);
  const returRows = buildRows(returItems, emptyRowsCount);

  return (
    <div className="return-blank-form-print bg-white text-black font-sans text-xs p-2 print:p-0 w-full max-w-[210mm] mx-auto">
      {/* Optional Company Header if needed */}
      {companyName && (
        <div className="text-right text-[10px] text-zinc-500 font-mono mb-1 print:mb-0">
          {companyName}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TABEL 1: FORM BARANG BALIKAN                                           */}
      {/* ========================================================================= */}
      <div className="mb-5">
        {/* Header: Title & Tanggal */}
        <div className="flex justify-between items-end mb-1">
          <div className="w-1/4"></div>
          <div className="w-2/4 text-center">
            <h2 className="font-bold text-sm sm:text-base uppercase underline tracking-wider text-black">
              FORM BARANG BALIKAN
            </h2>
          </div>
          <div className="w-1/4 text-right">
            <span className="font-bold text-xs uppercase tracking-tight text-black">
              TANGGAL : {balikanDate ? <span className="font-mono">{balikanDate}</span> : '........................'}
            </span>
          </div>
        </div>

        {/* Tabel Balikan */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="border-b border-black font-bold bg-zinc-50 print:bg-transparent text-black">
              <th className="border border-black py-1 px-1 w-10 sm:w-12 text-center">NO</th>
              <th className="border border-black py-1 px-2 text-left">NAMA BARANG</th>
              <th className="border border-black py-1 px-2 w-28 sm:w-32 text-center">JUMLAH (QTY)</th>
              <th className="border border-black py-1 px-2 w-36 sm:w-44 text-center">KETERANGAN</th>
            </tr>
          </thead>
          <tbody>
            {balikanRows.map((row) => (
              <tr key={`balikan-${row.no}`} className="h-[21px] sm:h-[22px] border-b border-black">
                <td className="border border-black text-center font-mono text-[11px] py-0.5 px-1 font-semibold">
                  {row.no}
                </td>
                <td className="border border-black text-left px-2 py-0.5 text-[11px] overflow-hidden whitespace-nowrap text-ellipsis font-medium">
                  {row.name || <span className="invisible">&nbsp;</span>}
                </td>
                <td className="border border-black text-center px-2 py-0.5 text-[11px] font-mono">
                  {row.qty || <span className="invisible">&nbsp;</span>}
                </td>
                <td className="border border-black text-left px-2 py-0.5 text-[10px]">
                  {row.keterangan || <span className="invisible">&nbsp;</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABEL 2: FORM BARANG RETUR                                             */}
      {/* ========================================================================= */}
      <div className="mb-4">
        {/* Header: Title & Tanggal */}
        <div className="flex justify-between items-end mb-1">
          <div className="w-1/4"></div>
          <div className="w-2/4 text-center">
            <h2 className="font-bold text-sm sm:text-base uppercase underline tracking-wider text-black">
              FORM BARANG RETUR
            </h2>
          </div>
          <div className="w-1/4 text-right">
            <span className="font-bold text-xs uppercase tracking-tight text-black">
              TANGGAL : {returDate ? <span className="font-mono">{returDate}</span> : '........................'}
            </span>
          </div>
        </div>

        {/* Tabel Retur */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="border-b border-black font-bold bg-zinc-50 print:bg-transparent text-black">
              <th className="border border-black py-1 px-1 w-10 sm:w-12 text-center">NO</th>
              <th className="border border-black py-1 px-2 text-left">NAMA BARANG</th>
              <th className="border border-black py-1 px-2 w-28 sm:w-32 text-center">JUMLAH (QTY)</th>
              <th className="border border-black py-1 px-2 w-36 sm:w-44 text-center">KETERANGAN</th>
            </tr>
          </thead>
          <tbody>
            {returRows.map((row) => (
              <tr key={`retur-${row.no}`} className="h-[21px] sm:h-[22px] border-b border-black">
                <td className="border border-black text-center font-mono text-[11px] py-0.5 px-1 font-semibold">
                  {row.no}
                </td>
                <td className="border border-black text-left px-2 py-0.5 text-[11px] overflow-hidden whitespace-nowrap text-ellipsis font-medium">
                  {row.name || <span className="invisible">&nbsp;</span>}
                </td>
                <td className="border border-black text-center px-2 py-0.5 text-[11px] font-mono">
                  {row.qty || <span className="invisible">&nbsp;</span>}
                </td>
                <td className="border border-black text-left px-2 py-0.5 text-[10px]">
                  {row.keterangan || <span className="invisible">&nbsp;</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 3. AREA TANDA TANGAN (FOOTER DUA KOLOM)                                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-12 pt-2 text-center text-xs">
        {/* Kiri: Diserahkan, (Dropping) */}
        <div className="flex flex-col items-center">
          <p className="font-semibold text-xs mb-1">Diserahkan,</p>
          <div className="h-12 sm:h-14"></div>
          <div className="border-t border-black pt-1 px-6 min-w-[150px] text-center">
            <span className="font-bold text-xs uppercase tracking-wide">
              {droppingName ? `( ${droppingName} )` : `( ${droppingRole} )`}
            </span>
          </div>
        </div>

        {/* Kanan: Diterima, (Gudang) */}
        <div className="flex flex-col items-center">
          <p className="font-semibold text-xs mb-1">Diterima,</p>
          <div className="h-12 sm:h-14"></div>
          <div className="border-t border-black pt-1 px-6 min-w-[150px] text-center">
            <span className="font-bold text-xs uppercase tracking-wide">
              {gudangName ? `( ${gudangName} )` : `( ${gudangRole} )`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnFormPrintTemplate;

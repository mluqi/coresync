import React from 'react';
import { formatRupiah } from '../../utils/format';

/**
 * DeliveryManifestPrintTemplate
 * Exact implementation of 'DETAIL PENJUALAN ORDER' (DO Manifest)
 * Optimized for high-contrast, razor-sharp output on both Continuous Form (Dot-Matrix)
 * and Standard Sheet (Laser/Inkjet A4/F4) print formats.
 * 
 * Tuned with slightly larger, crisp regular-weight font (not overly bold)
 * for optimal dot-matrix ribbon and laser print legibility.
 */
const DeliveryManifestPrintTemplate = ({ manifestData, tenant }) => {
  if (!manifestData) return null;

  // Header Info
  const companyName = tenant?.companyName || 'TIMAS';
  const companyAddress = tenant?.address || 'JL. PERINTIS KEMERDEKAAN NO.38A';
  const companyPhone = tenant?.phone || '0812 2957 1878';

  const mobil = manifestData.vehiclePlate && manifestData.vehiclePlate !== '—' 
    ? `${manifestData.vehiclePlate} (${manifestData.driverName || 'Supir'})` 
    : (manifestData.driverName || 'TO 4');

  const nomorDo = manifestData.manifestNumber?.replace('MNF-', '') || manifestData.deliveryDate?.replace(/-/g, '') || '290802';
  const sales = manifestData.sales || 'SEMUA SALES';
  const dateFormatted = manifestData.deliveryDate 
    ? manifestData.deliveryDate.split('-').reverse().join('/') 
    : new Date().toLocaleDateString('id-ID');

  const tableData = manifestData.table_data || [];
  const summary = manifestData.summary || {};
  const referensiFt = summary.invoiceNumbersList || manifestData.referensi_ft || [];
  const totalFaktur = summary.totalInvoices || referensiFt.length || 0;

  // Calculate grand totals of Satuan Besar & Satuan Kecil
  let totalBesarCount = 0;
  let totalKecilCount = 0;
  let totalBonusCount = 0;

  tableData.forEach(grp => {
    (grp.items || []).forEach(it => {
      if (it.jumlah_barang_satuan_besar) {
        const val = parseFloat(it.jumlah_barang_satuan_besar) || 0;
        totalBesarCount += val;
      }
      if (it.jumlah_barang_satuan_kecil) {
        const val = parseFloat(it.jumlah_barang_satuan_kecil) || 0;
        totalKecilCount += val;
      }
      if (it.bonus) {
        const val = parseFloat(it.bonus) || 0;
        totalBonusCount += val;
      }
    });
  });

  return (
    <div 
      className="delivery-manifest-print bg-white text-black font-sans text-[13px] print:text-[13.5px] p-2 print:p-0 leading-normal w-full max-w-[22.5cm] mx-auto box-border font-normal"
      style={{
        fontFamily: "Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif",
        color: "#000000",
        fontWeight: 400
      }}
    >
      {/* ========================================================================= */}
      {/* 1. HEADER (3-Column Layout)                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-2 border-b-2 border-black pb-2 items-start print-avoid-break text-black font-normal">
        {/* Kiri: Informasi Perusahaan / Toko */}
        <div className="col-span-4 text-left leading-tight font-normal">
          <h2 className="font-semibold text-[16px] tracking-wide uppercase text-black">{companyName}</h2>
          <p className="text-[12.5px] text-black whitespace-pre-line mt-0.5 font-normal">{companyAddress}</p>
          <p className="text-[12.5px] font-mono text-black font-normal">{companyPhone}</p>
        </div>

        {/* Tengah: Judul & Detail DO */}
        <div className="col-span-5 text-center leading-tight font-normal">
          <h1 className="text-[17px] font-semibold tracking-wide uppercase text-black border-b-2 border-black pb-0.5 inline-block">
            DETAIL PENJUALAN ORDER
          </h1>
          <div className="grid grid-cols-3 gap-1 text-[12.5px] mt-1 text-black font-normal">
            <div className="text-left font-normal">
              <span className="text-black block text-[11px] font-normal">Mobil:</span>
              <strong className="font-semibold text-[13px] uppercase text-black">{mobil}</strong>
            </div>
            <div className="text-center font-normal">
              <span className="text-black block text-[11px] font-normal">Nomor DO:</span>
              <strong className="font-mono font-semibold text-[13px] text-black">{nomorDo}</strong>
            </div>
            <div className="text-right font-normal">
              <span className="text-black block text-[11px] font-normal">Sales:</span>
              <strong className="font-semibold text-[12.5px] text-black">{sales}</strong>
            </div>
          </div>
        </div>

        {/* Kanan: Tanggal & Halaman */}
        <div className="col-span-3 text-right leading-tight font-normal">
          <p className="text-[12.5px] text-black font-normal">
            <span className="text-black font-normal">Tanggal:</span> <strong className="font-semibold text-black">{dateFormatted}</strong>
          </p>
          <p className="text-[11.5px] text-black mt-0.5 font-normal">
            Halaman: <strong className="text-black font-normal">1 of 1</strong>
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABLE BODY (Grouped by Supplier with Clear Borders & Subtotals)        */}
      {/* ========================================================================= */}
      <table className="w-full border-collapse my-2.5 border-2 border-black text-[13px] text-black font-normal">
        <thead>
          <tr className="bg-zinc-100 print:bg-transparent font-semibold border-b-2 border-black text-black text-[11px] uppercase">
            <th className="py-1 px-1.5 text-center w-8 border-r border-black font-semibold text-black text-[11px]">NO</th>
            <th className="py-1 px-1.5 text-left w-24 border-r border-black font-semibold text-black text-[11px]">KODE</th>
            <th className="py-1 px-1.5 text-left border-r border-black font-semibold text-black text-[11px]">NAMA BARANG</th>
            <th className="py-1 px-1.5 text-center w-26 border-r border-black font-semibold text-black text-[11px]">SATUAN BESAR</th>
            <th className="py-1 px-1.5 text-center w-26 border-r border-black font-semibold text-black text-[11px]">SATUAN KECIL</th>
            <th className="py-1 px-1.5 text-center w-20 border-r border-black font-semibold text-black text-[11px]">BONUS</th>
            <th className="py-1 px-1 text-center w-10 font-semibold text-black text-[11px]">CEK</th>
          </tr>
        </thead>
        <tbody className="font-normal">
          {tableData.map((group, grpIdx) => {
            // Calculate subtotal for this supplier
            let subtotalBesar = 0;
            let subtotalKecil = 0;
            let subtotalBonus = 0;

            (group.items || []).forEach(it => {
              if (it.jumlah_barang_satuan_besar) {
                subtotalBesar += parseFloat(it.jumlah_barang_satuan_besar) || 0;
              }
              if (it.jumlah_barang_satuan_kecil) {
                subtotalKecil += parseFloat(it.jumlah_barang_satuan_kecil) || 0;
              }
              if (it.bonus) {
                subtotalBonus += parseFloat(it.bonus) || 0;
              }
            });

            return (
              <React.Fragment key={grpIdx}>
                {/* Row Header / Separator Supplier (Bold) */}
                <tr className="bg-zinc-100 print:bg-transparent border-t-2 border-b-2 border-black font-semibold text-[13.5px] text-black">
                  <td colSpan="7" className="py-1 px-2.5 uppercase tracking-wide font-semibold text-black">
                    {group.supplier_name}
                  </td>
                </tr>

                {/* Items under this Supplier */}
                {group.items?.map((item, itIdx) => (
                  <tr 
                    key={itIdx} 
                    className="border-b border-black/30 print:border-black bg-white text-black font-normal"
                  >
                    <td className="py-0.5 px-1.5 text-center font-mono text-[12.5px] border-r border-black/30 print:border-black text-black font-normal">
                      {item.no || (itIdx + 1)}
                    </td>
                    <td className="py-0.5 px-1.5 font-mono text-[12.5px] border-r border-black/30 print:border-black text-black font-normal">
                      {item.kode}
                    </td>
                    <td className="py-0.5 px-1.5 text-black text-[13.5px] border-r border-black/30 print:border-black font-normal">
                      {item.nama_barang}
                    </td>
                    <td className="py-0.5 px-1.5 text-center font-mono text-[13px] border-r border-black/30 print:border-black text-black font-normal">
                      {item.jumlah_barang_satuan_besar || ''}
                    </td>
                    <td className="py-0.5 px-1.5 text-center font-mono text-[13px] border-r border-black/30 print:border-black text-black font-normal">
                      {item.jumlah_barang_satuan_kecil || ''}
                    </td>
                    <td className="py-0.5 px-1.5 text-center font-mono text-[13px] border-r border-black/30 print:border-black text-black font-normal">
                      {item.bonus || ''}
                    </td>
                    <td className="py-0.5 px-1 text-center font-mono text-black text-[12px] font-normal">
                      
                    </td>
                  </tr>
                ))}

                {/* Subtotal per Supplier Row */}
                <tr className="bg-zinc-50 print:bg-transparent border-t border-b-2 border-black font-semibold text-[13px] text-black">
                  <td colSpan="3" className="py-1 px-2.5 text-right italic font-semibold text-black">
                    Subtotal {group.supplier_name}:
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-semibold border-r border-black/30 print:border-black text-black">
                    {subtotalBesar > 0 ? `${subtotalBesar}` : '-'}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-semibold border-r border-black/30 print:border-black text-black">
                    {subtotalKecil > 0 ? `${subtotalKecil}` : '-'}
                  </td>
                  <td className="py-1 px-1.5 text-center font-mono font-semibold text-black border-r border-black/30 print:border-black">
                    {subtotalBonus > 0 ? `${subtotalBonus}` : '-'}
                  </td>
                  <td className="py-1 px-1 text-center font-mono text-black text-[11px] font-normal">
                    ✓
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* ========================================================================= */}
      {/* 3. FOOTER (Summary, Tagihan Tunai vs Tempo, Referensi FT, Signatures)     */}
      {/* ========================================================================= */}
      <div className="space-y-2 pt-1 border-t-2 border-black text-[12.5px] text-black font-normal">
        {/* Row 1: Summary Muatan Fisik */}
        <div className="grid grid-cols-3 gap-2 bg-white p-2 border-2 border-black text-[12.5px] print-avoid-break font-normal">
          <div className="font-normal">
            <span className="text-black block text-[11px] font-normal">Total Faktur:</span>
            <span className="font-semibold text-[13.5px] text-black">{totalFaktur} Lembar</span>
          </div>
          <div className="text-center font-normal">
            <span className="text-black block text-[11px] font-normal">Total Kubikasi Muatan:</span>
            <span className="font-mono font-semibold text-[13.5px] text-black">{manifestData.jumlah_kubik || '—'}</span>
          </div>
          <div className="text-right font-normal">
            <span className="text-black block text-[11px] font-normal">Grand Total Muatan Fisik:</span>
            <span className="font-mono font-semibold text-[13.5px] text-black">
              {totalBesarCount > 0 ? `${totalBesarCount} Karton` : ''} 
              {totalBesarCount > 0 && totalKecilCount > 0 ? ' • ' : ''}
              {totalKecilCount > 0 ? `${totalKecilCount} Pcs` : ''}
              {totalBonusCount > 0 ? ` (+${totalBonusCount} Bonus)` : ''}
            </span>
          </div>
        </div>

        {/* Row 2: Rekapitulasi Tagihan Tunai (COD) vs Tempo (Kredit) */}
        {(summary.totalCashAmount !== undefined || summary.grandTotalAmount) && (
          <div className="grid grid-cols-3 gap-2 p-2 border-2 border-black bg-white text-[12.5px] print-avoid-break text-black font-normal">
            <div className="border-r border-black pr-2 font-normal">
              <span className="text-black block text-[11px] font-normal">1. TAGIHAN TUNAI / COD (Wajib Setor Supir):</span>
              <strong className="font-mono font-semibold text-[13.5px] text-black">
                {formatRupiah(summary.totalCashAmount || 0)}
              </strong>
              <span className="text-[11px] text-black block font-normal">({summary.cashInvoiceCount || 0} Faktur Tunai)</span>
            </div>
            <div className="border-r border-black pr-2 font-normal">
              <span className="text-black block text-[11px] font-normal">2. TAGIHAN TEMPO / GIRO (Stempel Toko):</span>
              <strong className="font-mono font-semibold text-[13.5px] text-black">
                {formatRupiah(summary.totalCreditAmount || 0)}
              </strong>
              <span className="text-[11px] text-black block font-normal">({summary.creditInvoiceCount || 0} Faktur Tempo)</span>
            </div>
            <div className="text-right font-normal">
              <span className="text-black block text-[11px] font-normal">TOTAL NILAI MUATAN MOBIL:</span>
              <strong className="font-mono font-semibold text-[14.5px] text-black">
                {formatRupiah(summary.grandTotalAmount || 0)}
              </strong>
              <span className="text-[11px] text-black block font-normal">({totalFaktur} Total Faktur)</span>
            </div>
          </div>
        )}

        {/* Row 3: Blok Referensi Nomor FT (Faktur Penjualan) */}
        {referensiFt && referensiFt.length > 0 && (
          <div className="p-2 border-2 border-black bg-white space-y-1 print-avoid-break text-black font-normal">
            <span className="font-semibold text-[11.5px] text-black uppercase tracking-wider block">
              REFERENSI NOMOR FAKTUR / FT ({referensiFt.length} Faktur):
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-[11.5px] text-black font-normal">
              {referensiFt.map((ftNum, idx) => (
                <span 
                  key={idx} 
                  className="border border-black px-1.5 py-0.5 bg-white text-black font-mono font-normal"
                >
                  {ftNum}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Row 4: Area Tanda Tangan */}
        <div className="grid grid-cols-2 gap-8 text-center pt-2 mt-2 border-t-2 border-black text-[12.5px] print-avoid-break font-normal">
          <div className="font-normal">
            <p className="text-[12px] font-semibold text-black uppercase tracking-wider">ADM GUDANG</p>
            <div className="h-12 flex items-end justify-center font-normal">
              <span className="font-normal text-black uppercase text-[12.5px]">
                ( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )
              </span>
            </div>
          </div>
          <div className="font-normal">
            <p className="text-[12px] font-semibold text-black uppercase tracking-wider">SUPIR / HELPER</p>
            <div className="h-12 flex items-end justify-center font-normal">
              <span className="font-normal text-black uppercase text-[12.5px]">
                {manifestData.driverName ? `( ${manifestData.driverName} )` : '( ...................................... )'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryManifestPrintTemplate;

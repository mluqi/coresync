import React from 'react';

/**
 * Format currency without symbol (e.g. 345,000 or 8,587,400)
 */
const formatNumberId = (val) => {
  if (val === undefined || val === null || val === '' || isNaN(val) || Number(val) === 0) return '';
  const num = Math.round(Number(val));
  return num.toLocaleString('en-US'); // Format with commas e.g. 8,587,400
};

/**
 * Format date string to DD/MM
 */
const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> DD/MM
      return `${parts[2]}/${parts[1]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

/**
 * Format date string to DD/MM/YYYY
 */
const formatDateFull = (dateStr) => {
  if (!dateStr) return new Date().toLocaleDateString('id-ID');
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

/**
 * DeliveryManifestSalesPerformanceTemplate
 * Standard Enterprise Report Component: 'SALES DATA PERFORMANCE - PENJUALAN ORDER'
 * Optimized for high-contrast, razor-sharp output on Continuous Form (Dot-Matrix)
 * and Standard Sheet (Laser/Inkjet A4/F4) print formats.
 * 
 * Tuned with slightly larger, crisp regular-weight font (not overly bold)
 * for optimal dot-matrix ribbon and laser print legibility.
 */
const DeliveryManifestSalesPerformanceTemplate = ({ manifestData, tenant }) => {
  if (!manifestData) return null;

  // Header Info
  const companyName = tenant?.companyName || 'CV. JATIMAS';
  const companyAddress = tenant?.address || 'JL. PERINTIS KEMERDEKAAN NO.38A';
  const companyPhone = tenant?.phone || '0812 2957 1878';

  const nomorDo = manifestData.manifestNumber?.replace('MNF-', '') || manifestData.deliveryDate?.replace(/-/g, '') || '050902';
  const dateFormatted = formatDateFull(manifestData.deliveryDate || manifestData.manifestDate);
  const dateShort = formatDateShort(manifestData.deliveryDate || manifestData.manifestDate);

  // Extract row items from groups or direct table rows
  const groups = manifestData.groups || [];
  const rawRows = manifestData.sales_performance_rows || [];

  let rows = [];
  if (rawRows.length > 0) {
    rows = rawRows;
  } else if (groups.length > 0) {
    rows = groups.map((grp, idx) => {
      const term = (grp.paymentTerm || '').toUpperCase();
      const isCash = term.includes('CASH') || term.includes('COD') || term.includes('TUNAI') || term === 'LUNAS';
      const amount = parseFloat(grp.invoiceAmount || 0);

      const customerLabel = `${grp.customerName || 'Langganan'}`.toUpperCase();

      const salesmanLabel = grp.salesman && grp.salesman !== '-'
        ? grp.salesman
        : (
          grp.salespersonCode && grp.salespersonName && !grp.salespersonName.includes(grp.salespersonCode)
            ? `${grp.salespersonName}`
            : (grp.salespersonName || grp.salespersonCode || grp.salesman || '—')
        );

      return {
        no: idx + 1,
        tgl: formatDateShort(grp.deliveryDate || manifestData.deliveryDate || manifestData.manifestDate) || dateShort,
        no_faktur: grp.invoiceNumber || grp.deliveryNumber || `FT-${idx + 1}`,
        salesman: String(salesmanLabel).toUpperCase(),
        langganan: customerLabel,
        tunai: isCash ? amount : 0,
        kredit: !isCash ? amount : 0
      };
    });
  }

  // Calculate totals
  let totalTunai = 0;
  let totalKredit = 0;

  rows.forEach(r => {
    totalTunai += typeof r.tunai === 'number' ? r.tunai : (parseFloat(String(r.tunai).replace(/,/g, '')) || 0);
    totalKredit += typeof r.kredit === 'number' ? r.kredit : (parseFloat(String(r.kredit).replace(/,/g, '')) || 0);
  });

  const jumlahFaktur = rows.length;
  const adminName = manifestData.createdByName || manifestData.created_by || 'RUDI';
  const driverName = manifestData.driverName && manifestData.driverName !== '—' ? manifestData.driverName : '';

  return (
    <div 
      className="sales-data-performance-print bg-white text-black font-sans text-[13px] print:text-[13.5px] p-2 print:p-0 leading-normal w-full max-w-[22.5cm] mx-auto box-border font-normal"
      style={{
        fontFamily: "Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif",
        color: "#000000",
        fontWeight: 400
      }}
    >
      {/* ========================================================================= */}
      {/* 1. HEADER (3-Column Grid)                                                 */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-2 border-b-2 border-black pb-2 items-start print-avoid-break text-black font-normal">
        {/* Kiri: Nama dan Alamat Perusahaan */}
        <div className="col-span-4 text-left leading-tight font-normal">
          <h2 className="font-semibold text-[16px] tracking-wide uppercase text-black">{companyName}</h2>
          <p className="text-[12.5px] text-black whitespace-pre-line mt-0.5 font-normal">{companyAddress}</p>
          <p className="text-[12.5px] font-mono text-black font-normal">{companyPhone}</p>
        </div>

        {/* Tengah: Judul Laporan & Nomor D.O */}
        <div className="col-span-5 text-center leading-tight font-normal">
          <h1 className="text-[17px] font-semibold tracking-wide uppercase text-black border-b-2 border-black pb-0.5 inline-block">
            SALES DATA PERFORMANCE
          </h1>
          <p className="text-[13px] font-semibold tracking-wide text-black uppercase mt-0.5">
            PENJUALAN ORDER
          </p>
          <p className="text-[13px] font-mono text-black mt-0.5 font-normal">
            Nomor DO : <span className="text-[14px] font-semibold">{nomorDo}</span>
          </p>
        </div>

        {/* Kanan: Tanggal & Halaman (Aligned Right) */}
        <div className="col-span-3 text-right leading-tight font-normal">
          <p className="text-[12.5px] text-black font-normal">
            <span className="text-black font-normal">Tanggal:</span> <strong className="font-semibold text-black">{dateFormatted}</strong>
          </p>
          <p className="text-[12px] text-black font-mono mt-0.5 font-normal">
            Hal: <strong className="font-normal">1 of 1</strong>
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABEL UTAMA (Data-dense table with sharp enterprise borders)           */}
      {/* ========================================================================= */}
      <table className="w-full border-collapse my-2.5 border-2 border-black text-[13px] text-black font-normal">
        <thead>
          <tr className="bg-zinc-100 print:bg-transparent text-black font-semibold text-[11px] border-b-2 border-black uppercase">
            <th className="py-1 px-1.5 text-center w-8 border-r border-black font-semibold text-black text-[11px]">NO</th>
            <th className="py-1 px-1.5 text-center w-14 border-r border-black font-semibold text-black text-[11px]">TGL</th>
            <th className="py-1 px-1.5 text-left w-28 border-r border-black font-semibold text-black text-[11px]">NO. FAKTUR</th>
            <th className="py-1 px-1.5 text-left w-28 border-r border-black font-semibold text-black text-[11px]">SALESMAN</th>
            <th className="py-1 px-1.5 text-left border-r border-black font-semibold text-black text-[11px]">LANGGANAN</th>
            <th className="py-1 px-1.5 text-right w-28 border-r border-black font-semibold text-black text-[11px]">TUNAI</th>
            <th className="py-1 px-1.5 text-right w-28 font-semibold text-black text-[11px]">KREDIT</th>
          </tr>
        </thead>
        <tbody className="font-normal">
          {rows.length === 0 ? (
            <tr>
              <td colSpan="7" className="py-6 text-center text-black italic font-normal">
                Tidak ada data faktur pada pengiriman ini.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const tunaiVal = typeof row.tunai === 'number' ? row.tunai : (parseFloat(String(row.tunai).replace(/,/g, '')) || 0);
              const kreditVal = typeof row.kredit === 'number' ? row.kredit : (parseFloat(String(row.kredit).replace(/,/g, '')) || 0);

              return (
                <tr 
                  key={idx} 
                  className="border-b border-black/30 print:border-black bg-white text-black font-normal"
                >
                  {/* NO */}
                  <td className="py-0.5 px-1.5 text-center font-mono text-black border-r border-black/30 print:border-black text-[12.5px] font-normal">
                    {row.no || idx + 1}
                  </td>

                  {/* TGL */}
                  <td className="py-0.5 px-1.5 text-center font-mono text-black border-r border-black/30 print:border-black whitespace-nowrap text-[12.5px] font-normal">
                    {row.tgl || dateShort}
                  </td>

                  {/* NO. FAKTUR */}
                  <td className="py-0.5 px-1.5 font-mono text-black border-r border-black/30 print:border-black whitespace-nowrap text-[12.5px] font-normal">
                    {row.no_faktur}
                  </td>

                  {/* SALESMAN */}
                  <td className="py-0.5 px-1.5 text-black border-r border-black/30 print:border-black whitespace-nowrap uppercase text-[12.5px] font-normal">
                    {row.salesman}
                  </td>

                  {/* LANGGANAN */}
                  <td className="py-0.5 px-1.5 text-black border-r border-black/30 print:border-black uppercase text-[13.5px] font-normal">
                    {row.langganan}
                  </td>

                  {/* TUNAI */}
                  <td className="py-0.5 px-1.5 text-right font-mono text-black border-r border-black/30 print:border-black whitespace-nowrap text-[13px] font-normal">
                    {tunaiVal > 0 ? formatNumberId(tunaiVal) : ''}
                  </td>

                  {/* KREDIT */}
                  <td className="py-0.5 px-1.5 text-right font-mono text-black whitespace-nowrap text-[13px] font-normal">
                    {kreditVal > 0 ? formatNumberId(kreditVal) : ''}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>

        {/* ========================================================================= */}
        {/* 3. BARIS TOTAL (Footer Tabel - Rapi & Tegas)                             */}
        {/* ========================================================================= */}
        <tfoot>
          <tr className="bg-zinc-100 print:bg-transparent font-semibold border-t-2 border-b-2 border-black text-[12.5px] text-black">
            {/* Kolom Kiri: Jumlah Faktur */}
            <td colSpan="2" className="py-1 px-1.5 text-left font-normal text-black border-r border-black">
              Jumlah Faktur: <span className="font-semibold text-black">{jumlahFaktur} Lbr</span>
            </td>

            {/* Kolom Tengah: Label TOTAL */}
            <td colSpan="3" className="py-1 px-1.5 text-right font-semibold tracking-wider text-black border-r border-black">
              TOTAL :
            </td>

            {/* Kolom TUNAI Total */}
            <td className="py-1 px-1.5 text-right font-mono font-semibold text-[13.5px] text-black border-r border-black">
              {totalTunai > 0 ? formatNumberId(totalTunai) : '0'}
            </td>

            {/* Kolom KREDIT Total */}
            <td className="py-1 px-1.5 text-right font-mono font-semibold text-[13.5px] text-black">
              {totalKredit > 0 ? formatNumberId(totalKredit) : ''}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ========================================================================= */}
      {/* 4. AREA TANDA TANGAN (Grid 4 Kolom Sejajar)                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-4 gap-4 text-center pt-2 mt-2 border-t-2 border-black text-[12.5px] print-avoid-break text-black font-normal">
        {/* 1. Admin */}
        <div className="flex flex-col justify-between font-normal">
          <p className="font-semibold text-black uppercase text-[12px]">Admin :</p>
          <div className="h-12 flex items-end justify-center font-normal">
            <span className="font-normal text-black uppercase underline text-[12.5px]">
              {adminName}
            </span>
          </div>
        </div>

        {/* 2. Droping */}
        <div className="flex flex-col justify-between font-normal">
          <p className="font-semibold text-black uppercase text-[12px]">Droping :</p>
          <div className="h-12 flex items-end justify-center font-normal">
            <span className="text-black font-mono text-[12.5px] font-normal">
              ( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )
            </span>
          </div>
        </div>

        {/* 3. Supir */}
        <div className="flex flex-col justify-between font-normal">
          <p className="font-semibold text-black uppercase text-[12px]">Supir :</p>
          <div className="h-12 flex items-end justify-center font-normal">
            <span className="font-normal text-black uppercase text-[12.5px]">
              {driverName ? `( ${driverName} )` : '(                                      )'}
            </span>
          </div>
        </div>

        {/* 4. Bag. Gudang */}
        <div className="flex flex-col justify-between font-normal">
          <p className="font-semibold text-black uppercase text-[12px]">Bag. Gudang :</p>
          <div className="h-12 flex items-end justify-center font-normal">
            <span className="text-black font-mono text-[12.5px] font-normal">
              ( &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; )
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryManifestSalesPerformanceTemplate;

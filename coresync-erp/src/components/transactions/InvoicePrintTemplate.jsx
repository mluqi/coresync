import React, { useEffect } from "react";
import { formatQty, formatTieredQtyDisplay, formatTieredBonusDisplay } from "../../utils/format";

/**
 * Helper function to convert number to Indonesian words (Terbilang)
 */
export const terbilang = (angka) => {
  const bilangan = [
    "",
    "SATU",
    "DUA",
    "TIGA",
    "EMPAT",
    "LIMA",
    "ENAM",
    "TUJUH",
    "DELAPAN",
    "SEMBILAN",
    "SEPULUH",
    "SEBELAS",
  ];

  const num = Math.floor(Math.abs(Number(angka) || 0));
  if (num === 0) return "NOL RUPIAH";

  const convert = (n) => {
    if (n < 12) return bilangan[n];
    if (n < 20) return convert(n - 10) + " BELAS";
    if (n < 100)
      return convert(Math.floor(n / 10)) + " PULUH " + convert(n % 10);
    if (n < 200) return "SERATUS " + convert(n - 100);
    if (n < 1000)
      return convert(Math.floor(n / 100)) + " RATUS " + convert(n % 100);
    if (n < 2000) return "SERIBU " + convert(n - 1000);
    if (n < 1000000)
      return convert(Math.floor(n / 1000)) + " RIBU " + convert(n % 1000);
    if (n < 1000000000)
      return convert(Math.floor(n / 1000000)) + " JUTA " + convert(n % 1000000);
    if (n < 1000000000000)
      return (
        convert(Math.floor(n / 1000000000)) +
        " MILYAR " +
        convert(n % 1000000000)
      );
    return (
      convert(Math.floor(n / 1000000000000)) +
      " TRILIUN " +
      convert(n % 1000000000000)
    );
  };

  return (convert(num).replace(/\s+/g, " ").trim() + " RUPIAH").toUpperCase();
};

/**
 * Format currency without prefix for compact POS tables (e.g. 95.000)
 */
const formatNumberId = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "0";
  const num = Math.round(Number(val));
  return num.toLocaleString("en-US");
};

/**
 * Format date string to DD/MM/YYYY or DD/MM/YY
 */
const formatDateSlash = (dateStr, shortYear = false) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = shortYear
      ? String(d.getFullYear()).slice(-2)
      : String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

/**
 * Dedicated, clean, high-precision Print Template Component for:
 * - Faktur Penjualan (Sales Invoice / INV) [Dot-Matrix / POS Professional Format 24cm x 14cm Landscape]
 * - Surat Pesanan Penjualan (Sales Order / SO - A4 Portrait)
 * - Surat Pesanan Pembelian (Purchase Order / PO - A4 Portrait)
 * - Surat Jalan Pengiriman (SJ / Delivery - A4 Portrait)
 * - Surat Jalan Penerimaan (SJM / Goods Receipt - A4 Portrait)
 */
const InvoicePrintTemplate = ({ type, data, tenant, isBulk = false }) => {
  const isSO = type === "SO";
  const isPO = type === "PO";
  const isSJ = type === "SJ";
  const isSJM = type === "SJM";
  const isINV =
    type === "INV" || type === "INVOICE" || isSO || isPO || (!isSJ && !isSJM);

  // Dynamically inject @page directive directly into document.head so browser print engines (Chrome/Edge) strictly respect Landscape for Invoices and Portrait for others
  useEffect(() => {
    let styleEl = document.getElementById("core-print-page-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "core-print-page-style";
      document.head.appendChild(styleEl);
    }

    if (isINV) {
      styleEl.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    @page {
      /* Gunakan ukuran continuous form standar 9.5in x 5.5in */
      size: 9.5in 5.5in;
      margin: 0;
    }
    @media print {
      @page {
        size: 9.5in 5.5in;
        margin: 0;
      }
      html, body {
        width: 9.5in !important;
        height: auto !important;
        min-height: 5.5in !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        overflow: visible !important;
      }
      #print-area {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }
      .invoice-pos-print {
        /* Batasi lebar konten agar tidak menabrak lubang tractor feed */
        width: 100% !important;
        max-width: 9.5in !important;
        height: 5.5in !important;
        max-height: 5.5in !important;
        box-sizing: border-box !important;
        margin: 0 auto !important;
        /* Padding ringkas: Top 1.5mm, Right 12mm, Bottom 1mm, Left 12mm */
        padding: 1.5mm 12mm 1mm 12mm !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
        color: #000000 !important;
        font-family: Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif !important;
        font-weight: 300 !important;
        letter-spacing: 0px !important;
        font-variant-numeric: tabular-nums !important;
        -webkit-font-smoothing: none !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: crispEdges !important;
      }
      .invoice-pos-print:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .invoice-pos-print table,
      .invoice-pos-print th,
      .invoice-pos-print td,
      .invoice-pos-print p,
      .invoice-pos-print span,
      .invoice-pos-print div,
      .invoice-pos-print strong,
      .invoice-pos-print h1,
      .invoice-pos-print h2 {
        color: #000000 !important;
        font-family: Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif !important;
        font-weight: 300 !important;
        letter-spacing: 0px !important;
      }
    }
  `;
    } else {
      styleEl.innerHTML = `
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            width: auto !important;
            height: auto !important;
          }
          #print-area {
            width: auto !important;
            max-width: 100% !important;
            height: auto !important;
          }
          .invoice-pos-print {
            width: 210mm !important;
            max-width: 210mm !important;
            font-weight: 700 !important;
            color: #000000 !important;
          }
          .invoice-pos-print table,
          .invoice-pos-print th,
          .invoice-pos-print td,
          .invoice-pos-print p,
          .invoice-pos-print span,
          .invoice-pos-print div {
            color: #000000 !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
    }

    return () => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isINV, type]);

  if (!data) return null;

  const companyName =
    tenant?.companyName || data.company_info?.name || "CV. JATIMAS";
  const companyAddress =
    tenant?.address ||
    data.company_info?.address ||
    "JL. PERINTIS KEMERDEKAAN NO 38A";
  const companyPhone =
    tenant?.phone || data.company_info?.phone || "0812 2957 1878";
  const bankAccountInfo =
    tenant?.bankAccount || "Rek BCA 047 207 7269 a.n JATIMAS CV";

  // -------------------------------------------------------------
  // 1. SURAT JALAN PENERIMAAN BARANG (SJM)
  // -------------------------------------------------------------
  if (type === "SJM") {
    return (
      <div className="print-template font-sans text-xs text-zinc-900 bg-white p-2">
        <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-3">
          <div>
            <h1 className="text-lg font-black tracking-tight uppercase text-zinc-900">
              SURAT JALAN PENERIMAAN BARANG
            </h1>
            <p className="text-xs font-mono font-bold text-zinc-700 mt-0.5">
              No. SJM:{" "}
              {data.metadata?.sjmNumber ||
                data.metadata?.deliveryNumber ||
                `SJM-${data.poNumber}`}
            </p>
            <p className="text-[11px] text-zinc-500">
              Ref Purchase Order: #{data.poNumber}
            </p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-sm text-zinc-900">{companyName}</h2>
            <p className="text-[11px] text-zinc-500">
              Tanggal Masuk: {data.metadata?.receiveDate || data.poDate}
            </p>
            <p className="text-[11px] font-bold text-emerald-700">
              STATUS: DITERIMA DI GUDANG
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="p-3 border border-zinc-300 rounded-lg bg-white">
            <p className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
              Diterima Dari (Supplier):
            </p>
            <p className="font-bold text-sm text-zinc-900 mt-0.5">
              {data.supplier?.name || "Supplier"}
            </p>
            <p className="text-[11px] text-zinc-600">
              {data.supplier?.address || "-"}
            </p>
            <p className="text-[11px] text-zinc-600">
              {data.supplier?.phone || ""}
            </p>
          </div>
          <div className="p-3 border border-zinc-300 rounded-lg bg-white space-y-0.5">
            <p className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
              Gudang & Petugas Penerima:
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">Gudang:</span>{" "}
              <strong className="font-bold">
                {data.warehouse?.name || "Gudang Utama"}
              </strong>
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">Petugas:</span>{" "}
              <strong className="font-bold">
                {data.metadata?.receivedBy || "Staff Gudang"}
              </strong>
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">Kurir / Supir:</span>{" "}
              <strong>
                {data.metadata?.receives?.[0]?.driverName || "Kurir Supplier"}
              </strong>
            </p>
          </div>
        </div>

        <table className="w-full border-collapse my-4 border border-zinc-300">
          <thead>
            <tr className="bg-zinc-100 font-bold text-[11px] border-b border-zinc-300 text-zinc-800">
              <th className="py-2 px-2 text-center w-10 border-r border-zinc-300">
                No
              </th>
              <th className="py-2 px-2 text-left w-28 border-r border-zinc-300">
                SKU
              </th>
              <th className="py-2 px-2 text-left border-r border-zinc-300">
                Nama Barang
              </th>
              <th className="py-2 px-2 text-center w-28 border-r border-zinc-300">
                Qty Dipesan
              </th>
              <th className="py-2 px-2 text-center w-28 border-r border-zinc-300">
                Qty Masuk Fisik
              </th>
              <th className="py-2 px-2 text-center w-28">Kondisi Barang</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.items?.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="py-2 px-2 text-center font-mono border-r border-zinc-200">
                  {idx + 1}
                </td>
                <td className="py-2 px-2 font-mono font-semibold border-r border-zinc-200">
                  {item.product?.sku || "-"}
                </td>
                <td className="py-2 px-2 font-bold border-r border-zinc-200">
                  {item.product?.name || "Barang"}
                </td>
                <td className="py-2 px-2 text-center font-mono border-r border-zinc-200">
                  {formatTieredQtyDisplay(item.qty, (data.metadata?.itemsDetail || []).find(it => String(it.productId) === String(item.productId)), item.product, item.unit || item.product?.unit || "PCS")}
                </td>
                <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700 border-r border-zinc-200">
                  {formatTieredQtyDisplay(item.qty, (data.metadata?.itemsDetail || []).find(it => String(it.productId) === String(item.productId)), item.product, item.unit || item.product?.unit || "PCS")}
                </td>
                <td className="py-2 px-2 text-center font-bold text-emerald-700">
                  SESUAI / BAIK
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.metadata?.receives?.[0]?.notes && (
          <div className="p-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-[11px] mb-4">
            <span className="font-bold">Catatan Penerimaan: </span>
            <span>{data.metadata.receives[0].notes}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 text-center pt-6 mt-4 border-t border-dashed border-zinc-300">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Pengantar / Driver Supplier
            </p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-zinc-400 pt-1 text-xs">
              {data.metadata?.receives?.[0]?.driverName ||
                "..................."}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Petugas Penerima Gudang
            </p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-zinc-400 pt-1 text-xs">
              {data.metadata?.receivedBy || "Staff Gudang"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. SURAT JALAN PENGIRIMAN (SJ / PROOF OF DELIVERY)
  // -------------------------------------------------------------
  if (type === "SJ") {
    const totalQtyShipped =
      data.items?.reduce(
        (acc, it) => acc + parseFloat(it.qtyShipped || it.qty || 0),
        0,
      ) || 0;

    return (
      <div className="print-template font-sans text-xs text-zinc-900 bg-white p-2">
        <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-3">
          <div>
            <h1 className="text-lg font-black tracking-tight uppercase text-zinc-900">
              SURAT JALAN PENGIRIMAN
            </h1>
            <p className="text-xs font-mono font-bold text-zinc-700 mt-0.5">
              No. SJ: {data.deliveryNumber}
            </p>
            {data.salesOrder?.soNumber && (
              <p className="text-[11px] text-zinc-500">
                Ref SO: #{data.salesOrder.soNumber}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="font-bold text-sm text-zinc-900">{companyName}</h2>
            <p className="text-[11px] text-zinc-600">
              Tanggal Kirim:{" "}
              <strong className="text-zinc-900">{data.deliveryDate}</strong>
            </p>
            <p className="text-[10px] text-zinc-500">
              Dokumen Bukti Serah Terima Fisik Barang
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="p-3 border border-zinc-300 rounded-lg bg-white">
            <p className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
              Tujuan / Penerima:
            </p>
            <p className="font-bold text-sm text-zinc-900 mt-0.5">
              {data.salesOrder?.customer?.code
                ? `[${data.salesOrder.customer.code}] `
                : ""}
              {data.salesOrder?.customer?.name || "Pelanggan"}
            </p>
            <p className="text-[11px] text-zinc-600">
              {data.salesOrder?.customer?.address || "-"}
            </p>
            <p className="text-[11px] text-zinc-600">
              Telp/WA: {data.salesOrder?.customer?.phone || "-"}
            </p>
          </div>
          <div className="p-3 border border-zinc-300 rounded-lg bg-white space-y-0.5">
            <p className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">
              Armada Logistik & Pengantar:
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">Driver / Supir:</span>{" "}
              <strong className="font-bold text-zinc-900">
                {data.driverName || "—"}
              </strong>
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">No. Polisi Armada:</span>{" "}
              <strong className="font-mono font-bold text-zinc-900">
                {data.vehiclePlate || "—"}
              </strong>
            </p>
            <p className="text-[11px]">
              <span className="text-zinc-500">Gudang Asal:</span>{" "}
              <strong className="font-bold text-zinc-900">
                {data.warehouse?.name || "Gudang Utama"}
              </strong>
            </p>
          </div>
        </div>

        <table className="w-full border-collapse my-4 border border-zinc-300 text-xs">
          <thead>
            <tr className="bg-zinc-100 font-bold text-[11px] border-b-2 border-zinc-900 text-zinc-800">
              <th className="py-2 px-2 text-center w-10 border-r border-zinc-300">
                No
              </th>
              <th className="py-2 px-2 text-left w-28 border-r border-zinc-300">
                Kode SKU
              </th>
              <th className="py-2 px-2 text-left border-r border-zinc-300">
                Nama & Spesifikasi Barang
              </th>
              <th className="py-2 px-2 text-center w-28 border-r border-zinc-300">
                Qty Dipesan
              </th>
              <th className="py-2 px-2 text-center w-28 border-r border-zinc-300">
                Qty Dikirim
              </th>
              <th className="py-2 px-2 text-center w-36">Kondisi / Diterima</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.items?.map((item, idx) => {
              const soItem = data.salesOrder?.items?.find(
                (si) => si.productId === item.productId,
              );
              const qtyOrdered = parseFloat(soItem?.qty || item.qty || 0);
              const bonusOrdered = parseFloat(soItem?.bonusQty || 0);
              const qtyShipped = parseFloat(item.qtyShipped || item.qty || 0);
              const unit = item.unit || item.product?.unit || "pcs";

              return (
                <tr
                  key={item.id || idx}
                  className={idx % 2 === 1 ? "bg-zinc-50/50" : "bg-white"}
                >
                  <td className="py-2 px-2 text-center font-mono border-r border-zinc-200">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-2 font-mono font-semibold text-zinc-700 border-r border-zinc-200">
                    {item.product?.sku || item.sku || "-"}
                  </td>
                  <td className="py-2 px-2 font-bold text-zinc-900 border-r border-zinc-200">
                    {item.product?.name || item.name || "Barang"}
                  </td>
                  <td className="py-2 px-2 text-center font-mono border-r border-zinc-200">
                    {formatQty(qtyOrdered)} {unit}
                    {bonusOrdered > 0 && (
                      <span className="block text-[10px] text-emerald-700 font-bold">
                        +{formatQty(bonusOrdered)} Bonus
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center font-mono font-bold border-r border-zinc-200 text-zinc-900">
                    {formatQty(qtyShipped)} {unit}
                  </td>
                  <td className="py-2 px-2 text-center font-semibold text-emerald-700">
                    [ &nbsp; ] BAIK & SESUAI
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="grid grid-cols-12 gap-4 items-start pt-1 border-t border-zinc-300">
          <div className="col-span-8 p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[11px] text-zinc-600 space-y-0.5">
            <p className="font-bold text-zinc-800">
              Catatan Penerimaan / Retur di Tempat (Jika ada):
            </p>
            <p className="italic text-zinc-500">
              .......................................................................................................................................................
            </p>
          </div>
          <div className="col-span-4 text-right p-2.5 bg-zinc-100/80 border border-zinc-300 rounded-lg">
            <span className="text-[10px] font-bold text-zinc-500 block uppercase">
              Total Barang Fisik Dikirim:
            </span>
            <strong className="text-base font-black font-mono text-zinc-950">
              {totalQtyShipped} Unit / Item
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center pt-8 mt-4 border-t border-dashed border-zinc-300">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Penerima (Tanda Tangan & Cap Toko)
            </p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-zinc-400 pt-1 text-xs">
              {data.salesOrder?.customer?.name || "..................."}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Driver / Kurir Pengantar
            </p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-zinc-400 pt-1 text-xs">
              {data.driverName || "..................."}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Hormat Kami (Gudang Logistik)
            </p>
            <div className="h-16"></div>
            <p className="font-bold border-t border-zinc-400 pt-1 text-xs">
              {companyName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. FAKTUR PENJUALAN (INVOICE / POS / DOT-MATRIX FORMAT)
  // -------------------------------------------------------------
  // Document Title & Number
  const docTitle = isPO
    ? "SURAT PESANAN PEMBELIAN"
    : data.invoice_header?.title || "FAKTUR";

  // Prioritas nomor faktur resmi (INV / FT):
  const officialInvoiceNumber =
    data.invoice_header?.invoice_number ||
    data.invoiceNumber ||
    data.invoices?.[0]?.invoiceNumber ||
    data.salesOrder?.invoices?.[0]?.invoiceNumber ||
    (data.soNumber
      ? (data.soNumber.startsWith("SO.") ? data.soNumber.replace(/^SO\./, "INV.") : `INV-${data.soNumber.replace(/^SO-/, "")}`)
      : null);

  const invoiceNumber =
    officialInvoiceNumber ||
    data.soNumber ||
    data.poNumber ||
    (data.id ? `FT-${data.id}` : "FT032432352");

  // Nomor referensi pesanan (SO)
  const refSoNumber =
    data.soNumber ||
    data.salesOrder?.soNumber ||
    data.metadata?.soNumber ||
    null;

  // Customer Info - Hanya Nama Pelanggan (Tanpa Kode/ID)
  const customerName =
    data.customer?.name ||
    data.salesOrder?.customer?.name ||
    data.customer_info?.name ||
    (data.customer_info?.customer_id_name
      ? data.customer_info.customer_id_name
          .replace(/^[A-Z0-9-]+\s+-\s+/, "")
          .replace(/^[A-Z0-9-]+\s+/, "")
          .trim()
      : null) ||
    data.supplier?.name ||
    "HM JAYA";
  const customerAddress =
    data.customer_info?.address ||
    data.customer?.address ||
    data.salesOrder?.customer?.address ||
    data.supplier?.address ||
    "BUMIJAWA";

  // Invoice Meta
  const rawDate =
    data.invoice_meta?.tanggal ||
    data.invoiceDate ||
    data.soDate ||
    data.poDate ||
    new Date().toISOString().split("T")[0];
  const dateFormatted = data.invoice_meta?.tanggal
    ? data.invoice_meta.tanggal
    : formatDateSlash(rawDate);

  const rawDueDate = data.invoice_meta?.jatuh_tempo || data.dueDate || rawDate;
  const dueDateFormatted = data.invoice_meta?.jatuh_tempo
    ? data.invoice_meta.jatuh_tempo
    : formatDateSlash(rawDueDate);

  // Calculate TOP (Term of Payment in days)
  let topString = data.invoice_meta?.top;
  if (!topString) {
    if (rawDate && rawDueDate && rawDate !== "-" && rawDueDate !== "-") {
      const d1 = new Date(rawDate);
      const d2 = new Date(rawDueDate);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.max(
          0,
          Math.round(diffTime / (1000 * 60 * 60 * 24)),
        );
        topString = `${diffDays} HR`;
      } else {
        topString = "0 HR";
      }
    } else {
      topString = data.paymentTerm === "TEMPO" ? "30 HR" : "0 HR";
    }
  }

  // Salesman Resolution
  // Salesman Resolution: Mengikuti salesperson yang dipilih saat input Sales Order
  const resolveSalesman = (d) => {
    if (!d) return "—";

    // 1. Explicit invoice_meta salesman (jika ada override khusus cetak)
    if (d.invoice_meta?.salesman) return d.invoice_meta.salesman;

    // Helper to format code + name
    const formatSp = (code, name) => {
      const cleanName = (name || "").trim();
      const cleanCode = (code || "").trim();
      if (!cleanName && !cleanCode) return null;
      if (!cleanCode) return cleanName;
      if (!cleanName) return cleanCode;
      // Jika nama sudah diawali dengan kode (contoh: "107 SILO"), jangan duplikat
      if (cleanName.toLowerCase().startsWith(cleanCode.toLowerCase())) {
        return cleanName;
      }
      return `${cleanCode} ${cleanName}`;
    };

    // 2. PRIORITAS UTAMA: Salesperson yang dipilih saat input Sales Order (dari metadata SO)
    const meta = d.metadata || d.salesOrder?.metadata;
    if (meta) {
      if (meta.salespersonName || meta.salespersonCode) {
        const formatted = formatSp(meta.salespersonCode, meta.salespersonName);
        if (formatted) return formatted;
      }
      if (meta.salesperson && typeof meta.salesperson === "string" && isNaN(meta.salesperson)) {
        return meta.salesperson.trim();
      }
    }

    // 3. Relasi salesperson langsung pada objek order (jika ada)
    const directSp = d.salesperson || d.salesOrder?.salesperson;
    if (directSp) {
      const formatted = formatSp(directSp.code, directSp.name);
      if (formatted) return formatted;
    }

    // 4. FALLBACK: Jika di SO tidak dipilih salesperson khusus, gunakan default dari Master Pelanggan
    const cust = d.customer || d.salesOrder?.customer;
    if (cust?.salesperson) {
      const code = cust.salespersonCode || cust.salesperson.code;
      const name = cust.salesperson.name || cust.salespersonName;
      const formatted = formatSp(code, name);
      if (formatted) return formatted;
    }

    // 5. Field flat salesperson pada master pelanggan
    if (cust?.salespersonName || cust?.salespersonCode) {
      const formatted = formatSp(cust.salespersonCode, cust.salespersonName);
      if (formatted) return formatted;
    }

    return "—";
  };

  const salesmanStr = resolveSalesman(data);

  // Table Items
  const rawItems =
    data.items || data.salesOrder?.items || data.purchaseOrder?.items || [];
  let calculatedSubtotal = 0;
  let totalDiscountAmount = 0;

  const formattedItems = rawItems.map((item, idx) => {
    // Check if item already has manual string fields
    if (item.nama_barang) {
      const brutoVal =
        parseFloat(String(item.bruto).replace(/\./g, "").replace(/,/g, ".")) ||
        0;
      const subVal =
        parseFloat(
          String(item.sub_total).replace(/\./g, "").replace(/,/g, "."),
        ) || brutoVal;
      calculatedSubtotal += subVal;
      return {
        no: item.no || String(idx + 1),
        nama_barang: item.nama_barang,
        quantity: item.quantity,
        harga_rp: item.harga_rp,
        bruto: item.bruto,
        disc_1_2_3: item.disc_1_2_3 || "",
        disc_rp: item.disc_rp || "",
        sub_total: item.sub_total,
      };
    }

    const name = item.product?.name || item.name || "Barang";
    const qty = parseFloat(item.qty || item.quantity || 1);
    const bonusQty = parseFloat(item.bonusQty || item.bonus_qty || 0);
    const unit = (item.unit || item.product?.unit || "PCS").toUpperCase();
    const price = parseFloat(
      item.price || item.unitPrice || item.product?.sellingPrice || 0,
    );
    const bruto = price * qty;

    // Discounts
    let disc123 = "";
    let discRp = "";
    let discAmount = 0;

    if (item.discountPercent || item.discount_percent) {
      disc123 = `${item.discountPercent || item.discount_percent}%`;
    }

    const rawSubtotal = (item.subtotal !== undefined && item.subtotal !== null) ? parseFloat(item.subtotal) : null;

    if (rawSubtotal !== null && rawSubtotal >= 0) {
      if (item.discount || item.discountAmount) {
        const uDisc = parseFloat(item.discount || item.discountAmount || 0);
        discAmount = (uDisc * qty <= bruto + 1) ? (uDisc * qty) : uDisc;
        discRp = formatNumberId(discAmount);
      } else if (item.discountPercent) {
        discAmount = (bruto * parseFloat(item.discountPercent)) / 100;
        discRp = formatNumberId(discAmount);
      } else if (bruto > rawSubtotal) {
        discAmount = bruto - rawSubtotal;
        discRp = formatNumberId(discAmount);
      }
    } else {
      if (item.discount || item.discountAmount) {
        const uDisc = parseFloat(item.discount || item.discountAmount || 0);
        discAmount = (uDisc * qty <= bruto + 1) ? (uDisc * qty) : uDisc;
        discRp = formatNumberId(discAmount);
      } else if (item.discountPercent) {
        discAmount = (bruto * parseFloat(item.discountPercent)) / 100;
        discRp = formatNumberId(discAmount);
      }
    }

    const lineSubtotal = rawSubtotal !== null ? rawSubtotal : Math.max(0, bruto - discAmount);
    calculatedSubtotal += lineSubtotal;
    totalDiscountAmount += discAmount;

    // Check if PO with tiered multi-unit metadata
    const metaItem = (data.metadata?.itemsDetail || []).find(it => String(it.productId) === String(item.productId));
    const hasTieredMeta = isPO && metaItem && metaItem.bigUnit && (parseFloat(metaItem.bigQty || 0) > 0 || parseFloat(metaItem.smallQty || 0) > 0);

    let qtyString;
    if (hasTieredMeta) {
      const tieredQty = formatTieredQtyDisplay(qty, metaItem, item.product, unit);
      const tieredBonus = formatTieredBonusDisplay(bonusQty, metaItem, item.product, item.bonusUnit || unit);
      qtyString = tieredBonus ? `${tieredQty} (+${tieredBonus} Bns)` : tieredQty;
    } else {
      const bonusUnit = (item.bonusUnit || unit).toUpperCase();
      const bonusStr = bonusQty > 0 ? ` (+${formatQty(bonusQty)} ${bonusUnit} Bns)` : "";
      qtyString = `${formatQty(qty)} ${unit}${bonusStr}`;
    }

    return {
      no: String(idx + 1),
      nama_barang: name,
      quantity: qtyString,
      harga_rp: formatNumberId(price),
      bruto: formatNumberId(bruto),
      disc_1_2_3: disc123,
      disc_rp: discRp,
      sub_total: formatNumberId(lineSubtotal),
    };
  });

  // Totals
  const effGlobalDiskonPercent = data.globalDiscountPercent !== undefined && data.globalDiscountPercent !== null
    ? data.globalDiscountPercent
    : (data.metadata?.globalDiscountPercent || 0);
  const effGlobalDiskonAmount = data.globalDiscountAmount !== undefined && data.globalDiscountAmount !== null
    ? data.globalDiscountAmount
    : (data.metadata?.globalDiscountAmount || 0);

  // Gross subtotal: Total sebelum dipotong diskon faktur / global discount
  const grossSubtotal =
    calculatedSubtotal > 0
      ? calculatedSubtotal
      : parseFloat(data.subtotal || 0) > 0
      ? parseFloat(data.subtotal) + (parseFloat(effGlobalDiskonAmount) || 0)
      : 0;

  const calculatedGlobalDiskon =
    parseFloat(effGlobalDiskonAmount) > 0
      ? parseFloat(effGlobalDiskonAmount)
      : parseFloat(effGlobalDiskonPercent) > 0
      ? Math.round(
          (grossSubtotal * parseFloat(effGlobalDiskonPercent)) / 100,
        )
      : 0;

  const subTotalStr =
    data.totals?.sub_total ||
    formatNumberId(grossSubtotal);
  const globalDiskonPercent =
    data.totals?.diskon_fak ||
    (parseFloat(effGlobalDiskonPercent) > 0 ? `${effGlobalDiskonPercent}%` : "0.00%");
  const globalDiskonVal =
    data.totals?.diskon_value ||
    (calculatedGlobalDiskon > 0
      ? formatNumberId(calculatedGlobalDiskon)
      : "0");

  const nettoNumeric =
    data.totalAmount !== undefined && data.totalAmount !== null
      ? parseFloat(data.totalAmount)
      : data.grandTotal !== undefined && data.grandTotal !== null
      ? parseFloat(data.grandTotal)
      : Math.max(0, grossSubtotal - calculatedGlobalDiskon);
  const nettoStr = data.totals?.netto || formatNumberId(nettoNumeric);

  const taxRateVal = parseFloat(
    data.tax?.rate || data.taxRate || (data.taxId ? 11 : 0),
  );
  const isPkpDoc = Boolean(
    data.isPkp ||
      data.taxStatus === "PKP" ||
      (data.taxId &&
        (!data.tax?.name || !data.tax.name.toLowerCase().includes("non"))) ||
      data.applyTax ||
      data.metadata?.applyTax ||
      data.metadata?.isPkp,
  );
  const taxAmountVal = parseFloat(
    data.taxAmount ||
      (isPkpDoc
        ? nettoNumeric -
          nettoNumeric / (1 + (taxRateVal > 0 ? taxRateVal / 100 : 0.11))
        : 0),
  );
  const dppVal = isPkpDoc
    ? Math.round(nettoNumeric - taxAmountVal)
    : nettoNumeric;

  // Terbilang
  const terbilangText = data.terbilang || terbilang(nettoNumeric);

  // Bank Account lines
  const rawBank =
    tenant?.bankAccount || "Rek BCA 047 207 7269 a.n JATIMAS CV";
  let bankRek = "Rek BCA 047 207 7269";
  let bankAn = "a.n JATIMAS CV";
  if (rawBank.includes("\n")) {
    const parts = rawBank.split("\n").map((s) => s.trim()).filter(Boolean);
    bankRek = parts[0] || bankRek;
    bankAn = parts.slice(1).join(" ") || bankAn;
  } else if (/a\.?n\.?/i.test(rawBank)) {
    const parts = rawBank.split(/(?=a\.?n\.?)/i);
    bankRek = parts[0].trim();
    bankAn = parts.slice(1).join(" ").trim();
  } else {
    bankRek = rawBank;
    bankAn = "";
  }

  // Signatures
  const adminName = data.signatures?.admin || tenant?.adminName || "RUDI";
  const pengirimName = data.signatures?.pengirim || "";
  const penerimaLabel =
    data.signatures?.penerima || "Nama & Cap / Tanda Tgn Toko";

  // Print Meta
  const now = new Date();
  const currentHourMinSec = now.toTimeString().split(" ")[0];
  const printDateStr = formatDateSlash(now, true);
  const defaultPrintMeta = `Di cetak : 03 TGL : ${printDateStr} 1x - Jam : ${currentHourMinSec} Hal : 1`;
  const printMetaText = data.print_meta || defaultPrintMeta;

  return (
    <div
      className={`invoice-pos-print bg-white text-black font-sans text-[12px] leading-[1.25] font-light tabular-nums w-full max-w-[22.5cm] min-h-[12.8cm] mx-auto flex flex-col justify-between select-none box-border`}
      style={{
        fontFamily: "Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif",
        fontWeight: 300,
        letterSpacing: "0px",
        fontVariantNumeric: "tabular-nums",
        padding: "1.5mm 12mm 1mm 12mm",
        boxSizing: "border-box",
        width: "100%",
        color: "#000000"
      }}
    >
      {/* ========================================================================= */}
      {/* TOP SECTION: HEADER, META BAR, TABLE OF ITEMS                            */}
      {/* ========================================================================= */}
      <div className="w-full font-normal">
        {/* 1. HEADER 3 KOLOM */}
        <div className="grid grid-cols-12 gap-2 pb-2 items-start text-black font-normal">
          {/* Kolom 1 (Kiri): Identitas Perusahaan */}
          <div className="col-span-4 text-left leading-tight font-normal">
            <h2 className="font-normal text-[17.5px] uppercase tracking-wide text-black">
              {companyName}
            </h2>
            <p className="text-[12.5px] font-normal uppercase text-black mt-0.5">
              {companyAddress}
            </p>
            <p className="text-[12.5px] font-normal text-black mt-0.5">
              Telpon: {companyPhone}
            </p>
          </div>

          {/* Kolom 2 (Tengah): Judul Dokumen & Nomor Faktur */}
          <div className="col-span-4 text-center leading-tight font-normal">
            <h1 className="font-normal text-[18px] uppercase tracking-wider text-black">
              {docTitle} :
            </h1>
            <p className="font-normal text-[18px] tracking-tight text-black mt-0.5">
              No : {invoiceNumber}
            </p>
          </div>

          {/* Kolom 3 (Kanan): Identitas Pelanggan (Toko) */}
          <div className="col-span-4 text-left pl-2 leading-tight font-normal">
            <p className="text-[12.5px] font-normal text-black">
              {data.customer_info?.label || "Kepada Yth."}
            </p>
            <p className="font-normal text-[16px] uppercase text-black mt-0.5">
              {customerName}
            </p>
            <p className="text-[12.5px] font-normal uppercase truncate text-black">
              {customerAddress}
            </p>
          </div>
        </div>

        {/* 2. SUB-HEADER / META LINE - 4 Kolom Simetris & Tegas */}
        <div className="grid grid-cols-4 gap-2 py-1 px-1 text-[13px] text-black border-y-2 border-dashed border-black my-1.5 items-center font-normal">
          <div className="text-left font-normal">
            <span className="font-normal uppercase">TANGGAL : </span>
            <span className="font-normal">{dateFormatted}</span>
          </div>
          <div className="text-left font-normal">
            <span className="font-normal uppercase">JT. TEMPO : </span>
            <span className="font-normal">{dueDateFormatted}</span>
          </div>
          <div className="text-center font-normal">
            <span className="font-normal uppercase">TOP : </span>
            <span className="font-normal">{topString}</span>
          </div>
          <div className="text-right font-normal">
            <span className="font-normal uppercase">SALESMAN : </span>
            <span className="font-normal">{salesmanStr}</span>
          </div>
        </div>

        {/* 3. TABEL ITEM BARANG DOT-MATRIX DENGAN GARIS DASHED TEGAS */}
        <div className="w-full mt-1 font-normal">
          <table className="w-full border-collapse leading-tight font-normal">
            <thead>
              <tr className="border-t-2 border-b-2 border-dashed border-black text-black leading-tight text-[14px] uppercase font-normal">
                <th className="py-1 px-0.5 text-center w-8 font-normal">NO</th>
                <th className="py-1 px-1 text-left font-normal">
                  NAMA BARANG
                </th>
                <th className="py-1 px-1 text-center w-24 font-normal">
                  QUANTITY
                </th>
                <th className="py-1 px-1 text-right w-22 font-normal">
                  HARGA-RP
                </th>
                <th className="py-1 px-1 text-right w-24 font-normal">
                  BRUTO
                </th>
                <th className="py-1 px-0.5 text-center w-18 font-normal">
                  DISC 1,2,3
                </th>
                <th className="py-1 px-1 text-right w-20 font-normal">
                  DISC-RP
                </th>
                <th className="py-1 px-1 text-right w-26 font-normal">
                  SUB TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {formattedItems.map((item) => (
                <tr
                  key={item.no}
                  className="border-b border-dashed border-black text-black leading-tight text-[13.5px] font-normal"
                >
                  <td className="py-1 px-0.5 text-center font-normal">{item.no}</td>
                  <td className="py-1 px-1 text-left uppercase truncate font-normal text-[15px] tracking-tight">
                    {item.nama_barang}
                  </td>
                  <td className="py-1 px-1 text-center whitespace-nowrap font-normal text-[13.5px]">
                    {item.quantity}
                  </td>
                  <td className="py-1 px-1 text-right font-normal text-[13.5px]">
                    {item.harga_rp}
                  </td>
                  <td className="py-1 px-1 text-right font-normal text-[13.5px]">
                    {item.bruto}
                  </td>
                  <td className="py-1 px-0.5 text-center font-normal text-[13px]">
                    {item.disc_1_2_3 || ""}
                  </td>
                  <td className="py-1 px-1 text-right font-normal text-[13px]">
                    {item.disc_rp || ""}
                  </td>
                  <td className="py-1 px-1 text-right font-normal text-[13.5px]">
                    {item.sub_total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: FOOTER (TERMS, SIGNATURES, TOTALS, PRINT META)            */}
      {/* ========================================================================= */}
      <div className="w-full pt-1.5 pb-1 border-t-2 border-dashed border-black text-black mt-2 font-normal">
        <div className="grid grid-cols-12 gap-2 items-start font-normal">
          {/* Kolom 1 (Kiri): Info Transfer & Terbilang */}
          <div className="col-span-4 space-y-1.5 text-left leading-tight pr-1 font-normal">
            <div className="text-[12px] text-black border-l-2 border-black pl-1.5 py-0.5 leading-tight font-normal">
              <p className="leading-tight uppercase font-normal text-[11.5px]">PEMBAYARAN TRANSFER</p>
              <p className="leading-tight font-normal text-[13.5px]">{bankRek}</p>
              {bankAn && <p className="leading-tight font-normal text-[11.5px] uppercase">{bankAn}</p>}
            </div>
          </div>

          {/* Kolom 2 (Tengah): Tanda Tangan (Admin, Pengirim, Penerima) */}
          <div className="col-span-5 grid grid-cols-3 gap-1.5 text-center text-[12.5px] px-1 font-normal">
            {/* Admin */}
            <div className="flex flex-col items-center justify-between min-h-[58px]">
              <p className="font-normal uppercase tracking-wider text-[12.5px]">ADMIN :</p>
              <div className="h-6 sm:h-7" />
              <div>
                <p className="font-normal uppercase tracking-wider text-[12.5px]">
                  {adminName || "RUDI"}
                </p>
                <div className="text-[9px] mt-0.5 leading-none invisible">&nbsp;</div>
              </div>
            </div>

            {/* Pengirim */}
            <div className="flex flex-col items-center justify-between min-h-[58px] w-full px-1">
              <p className="font-normal uppercase tracking-wider text-[12.5px]">PENGIRIM :</p>
              <div className="h-6 sm:h-7" />
              <div className="w-full">
                <div className="w-full flex items-center justify-between px-0.5 text-[12.5px] font-normal">
                  <span>(</span>
                  <span className="flex-1 text-center font-normal uppercase truncate px-1">
                    {pengirimName || ""}
                  </span>
                  <span>)</span>
                </div>
                <div className="text-[9px] mt-0.5 leading-none invisible">&nbsp;</div>
              </div>
            </div>

            {/* Penerima */}
            <div className="flex flex-col items-center justify-between min-h-[58px] w-full px-1">
              <p className="font-normal uppercase tracking-wider text-[12.5px]">PENERIMA :</p>
              <div className="h-6 sm:h-7" />
              <div className="w-full">
                <div className="w-full flex items-center justify-between px-0.5 text-[12.5px] font-normal">
                  <span>(</span>
                  <span className="flex-1 text-center font-normal">&nbsp;</span>
                  <span>)</span>
                </div>
                <div className="text-[9px] mt-0.5 leading-none invisible">&nbsp;</div>
              </div>
            </div>
          </div>

          {/* Kolom 3 (Kanan): Subtotal, Diskon Fak, Netto */}
          <div className="col-span-3 text-[12.5px] space-y-0.5 leading-tight pl-1 font-normal">
            <div className="flex justify-between items-center font-normal">
              <span>SUB TOTAL :</span>
              <span className="font-normal tabular-nums">{subTotalStr}</span>
            </div>
            <div className="flex justify-between items-center font-normal">
              <span>DISKON FAK :</span>
              <span className="font-normal tabular-nums">{globalDiskonVal}</span>
            </div>
            {isPkpDoc && taxAmountVal > 0 ? (
              <div className="flex justify-between items-center font-normal text-[11.5px] text-black">
                <span>PPN ({taxRateVal}% TERMASUK) :</span>
                <span className="tabular-nums font-normal">{formatNumberId(taxAmountVal)}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center font-normal">
                <span>&nbsp;</span>
                <span className="tabular-nums font-normal">0</span>
              </div>
            )}
            <div className="border-t-2 border-dashed border-black pt-1 mt-1 flex justify-between items-center font-normal text-[17px] text-black">
              <span>NETTO :</span>
              <span className="font-normal tabular-nums">{nettoStr}</span>
            </div>
          </div>
        </div>

        {/* Print Meta Line (Bottom Left) */}
        <div className="text-[10px] font-normal text-left pt-1.5 text-black">
          <span>{printMetaText}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintTemplate;

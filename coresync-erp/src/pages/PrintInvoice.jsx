import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import InvoicePrintTemplate from '../components/transactions/InvoicePrintTemplate';
import { Printer, X, FileText, CheckCircle2, RotateCcw, Layers } from 'lucide-react';

const PrintInvoice = () => {
  const { id, type: pathType } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isBulk = id === 'bulk' || location.pathname.includes('/bulk') || searchParams.has('ids') || searchParams.get('bulk') === 'true';
  const docType = (pathType || searchParams.get('type') || 'SO').toUpperCase();
  const paperParam = searchParams.get('paper') || 'continuous'; // 'continuous' (9.5"x5.5") or 'a4'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docsData, setDocsData] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [paperSize, setPaperSize] = useState(paperParam); // 'continuous' or 'a4'
  const [autoPrinted, setAutoPrinted] = useState(false);
  const DEFAULT_CONTENT_WIDTH = 225; // Baku 225 mm (22.5 cm)
  const DEFAULT_LEFT_OFFSET = -8;    // Baku geser ke kiri 8 mm (-8 mm)

  const [leftOffset, setLeftOffset] = useState(() => {
    const saved = localStorage.getItem('coresync_print_left_offset');
    return saved !== null ? Number(saved) : DEFAULT_LEFT_OFFSET;
  });

  const [contentWidth, setContentWidth] = useState(() => {
    const saved = localStorage.getItem('coresync_print_content_width');
    return saved !== null ? Number(saved) : DEFAULT_CONTENT_WIDTH;
  });

  const updateLeftOffset = (newVal) => {
    // Batasi dari -30mm sampai +20mm
    const clamped = Math.max(-30, Math.min(20, newVal));
    setLeftOffset(clamped);
    localStorage.setItem('coresync_print_left_offset', String(clamped));
  };

  const updateContentWidth = (newVal) => {
    // Batasi dari 195mm sampai 240mm
    const clamped = Math.max(195, Math.min(240, newVal));
    setContentWidth(clamped);
    localStorage.setItem('coresync_print_content_width', String(clamped));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Ambil profil tenant dari localStorage jika ada
      const storedTenant = localStorage.getItem('tenant');
      if (storedTenant) {
        try {
          setTenant(JSON.parse(storedTenant));
        } catch (_) {}
      }

      if (isBulk) {
        // -------------------------------------------------------------
        // BULK PRINT MODE (Banyak Faktur Sekaligus)
        // -------------------------------------------------------------
        const cached = sessionStorage.getItem('bulk_print_docs');
        const paramIds = searchParams.get('ids')?.split(',').map(s => s.trim()).filter(Boolean) || [];

        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.tenant) setTenant(parsed.tenant);
            const cachedDocs = Array.isArray(parsed.docs) ? parsed.docs : [];

            if (cachedDocs.length > 0) {
              const cachedMap = new Map(cachedDocs.map(d => [String(d.id), d]));
              const missingIds = paramIds.filter(reqId => !cachedMap.has(String(reqId)));

              if (missingIds.length === 0) {
                const orderedDocs = paramIds.length > 0
                  ? paramIds.map(reqId => cachedMap.get(String(reqId))).filter(Boolean)
                  : cachedDocs;
                setDocsData(orderedDocs);
                setLoading(false);

                // Fetch fresh full detailed records asynchronously to ensure 100% full relations (Customer code, relations, etc.)
                if (paramIds.length > 0) {
                  let endpointPrefix = '/sales-orders/';
                  if (docType === 'PO' || docType === 'SJM') endpointPrefix = '/purchase-orders/';
                  Promise.all(paramIds.map(reqId => api.get(`${endpointPrefix}${reqId}`)))
                    .then(responses => {
                      const fullDocs = responses.map(r => r.data?.data || r.data).filter(Boolean);
                      if (fullDocs.length > 0) {
                        setDocsData(fullDocs);
                      }
                    })
                    .catch(err => {
                      console.warn('Gagal memuat detail lengkap bulk print, menggunakan cached docs:', err);
                    });
                }
                return;
              } else {
                let endpointPrefix = '/sales-orders/';
                if (docType === 'PO' || docType === 'SJM') endpointPrefix = '/purchase-orders/';
                const missingResponses = await Promise.all(
                  missingIds.map(missingId => api.get(`${endpointPrefix}${missingId}`))
                );
                const missingDocs = missingResponses.map(r => r.data?.data || r.data);
                const allDocsMap = new Map([...cachedDocs, ...missingDocs].map(d => [String(d.id), d]));
                const orderedDocs = paramIds.map(reqId => allDocsMap.get(String(reqId))).filter(Boolean);
                setDocsData(orderedDocs);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.warn('Gagal membaca cached bulk_print_docs:', e);
          }
        }

        // Jika tidak ada di sessionStorage, fetch semua dari query param 'ids'
        if (paramIds.length > 0) {
          try {
            let endpointPrefix = '/sales-orders/';
            if (docType === 'PO' || docType === 'SJM') endpointPrefix = '/purchase-orders/';
            const responses = await Promise.all(
              paramIds.map(reqId => api.get(`${endpointPrefix}${reqId}`))
            );
            const fetched = responses.map(r => r.data?.data || r.data);
            setDocsData(fetched);
          } catch (err) {
            console.error('Error fetching bulk documents:', err);
            setError(err.response?.data?.message || 'Gagal memuat dokumen untuk dicetak massal.');
          } finally {
            setLoading(false);
          }
          return;
        }

        setError('Tidak ada dokumen yang dipilih untuk dicetak.');
        setLoading(false);
        return;
      }

      // -------------------------------------------------------------
      // SINGLE DOCUMENT PRINT MODE
      // -------------------------------------------------------------
      const cached = sessionStorage.getItem('print_current_doc');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (String(parsed.id || parsed.data?.id) === String(id)) {
            setDocsData([parsed.data || parsed]);
            if (parsed.tenant) setTenant(parsed.tenant);
            setLoading(false);

            // Re-fetch in background to ensure any live updates to SO are immediately reflected
            let bgEndpoint = `/sales-orders/${id}`;
            if (docType === 'PO' || docType === 'SJM') {
              bgEndpoint = `/purchase-orders/${id}`;
            }
            api.get(bgEndpoint).then(res => {
              const fresh = res.data?.data || res.data;
              if (fresh) setDocsData([fresh]);
            }).catch(e => console.warn('Background sync print doc failed:', e));

            return;
          }
        } catch (e) {
          console.warn('Gagal membaca cached print doc:', e);
        }
      }

      try {
        let endpoint = `/sales-orders/${id}`;
        if (docType === 'PO' || docType === 'SJM') {
          endpoint = `/purchase-orders/${id}`;
        }

        const res = await api.get(endpoint);
        const data = res.data?.data || res.data;
        setDocsData([data]);
      } catch (err) {
        console.error('Error fetching document for print:', err);
        setError(err.response?.data?.message || 'Gagal memuat dokumen untuk dicetak.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, docType, isBulk, searchParams]);

  // Efek injeksi CSS @page dinamis sesuai ukuran kertas yang dipilih (Continuous Form vs A4)
  useEffect(() => {
    let styleTag = document.getElementById('custom-standalone-print-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'custom-standalone-print-style';
      document.head.appendChild(styleTag);
    }

    if (paperSize === 'continuous' && (docType === 'SO' || docType === 'INV')) {
      const padLeft = leftOffset > 0 ? `${leftOffset}mm` : '0mm';
      const marLeft = leftOffset < 0 ? `${leftOffset}mm` : '0mm';
      styleTag.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @page {
          size: 9.5in 5.5in;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 9.5in !important;
            height: auto !important;
            min-height: 5.5in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #standalone-print-container,
          .standalone-print-page {
            width: ${contentWidth}mm !important;
            height: 5.5in !important;
            max-height: 5.5in !important;
            min-height: 5.5in !important;
            padding-top: 3.5mm !important;
            padding-bottom: 5mm !important;
            padding-left: ${padLeft} !important;
            margin-left: ${marLeft} !important;
            margin-right: auto !important;
            background: #ffffff !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          .standalone-print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .invoice-pos-print {
            width: 100% !important;
            max-width: 9.5in !important;
            height: 5.5in !important;
            max-height: 5.5in !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 1.5mm 12mm 1mm 12mm !important;
            page-break-after: avoid !important;
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
      styleTag.innerHTML = `
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        @media print {
          html, body {
            width: auto !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #standalone-print-container,
          .standalone-print-page {
            width: 100% !important;
            padding: 0 !important;
            margin: 0 0 10mm 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
          }
          .standalone-print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
        }
      `;
    }

    return () => {
      if (styleTag && styleTag.parentNode) {
        styleTag.parentNode.removeChild(styleTag);
      }
    };
  }, [paperSize, docType, leftOffset, contentWidth]);

  // Auto trigger print setelah data selesai di-render
  useEffect(() => {
    if (!loading && docsData.length > 0 && !error && !autoPrinted) {
      const timer = setTimeout(() => {
        window.print();
        setAutoPrinted(true);
      }, isBulk ? 800 : 600);
      return () => clearTimeout(timer);
    }
  }, [loading, docsData, error, autoPrinted, isBulk]);

  const handleManualPrint = () => {
    window.print();
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-zinc-300">
          {isBulk ? `Menyiapkan ${searchParams.get('ids')?.split(',').length || ''} dokumen faktur untuk cetak massal...` : 'Menyiapkan dokumen faktur untuk dicetak...'}
        </p>
      </div>
    );
  }

  if (error || docsData.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-black">
          ✕
        </div>
        <h2 className="text-lg font-bold text-rose-300">Gagal Membuka Dokumen Cetak</h2>
        <p className="text-xs text-zinc-400 max-w-md">{error || 'Data pesanan tidak ditemukan atau telah dihapus.'}</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Kembali ke Aplikasi
        </button>
      </div>
    );
  }

  const singleDoc = docsData[0];
  const docNumber = singleDoc?.soNumber || singleDoc?.invoiceNumber || singleDoc?.poNumber || `DOC-${id}`;

  return (
    <div className="min-h-screen bg-zinc-800 text-zinc-900 flex flex-col items-center print:bg-white print:min-h-0">
      {/* ========================================================================= */}
      {/* FLOATING ACTION CONTROL BAR (Hanya tampil di layar, tersembunyi saat cetak) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 w-full bg-zinc-900/95 backdrop-blur-md border-b border-zinc-700 px-4 py-3 shadow-xl print:hidden">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold shrink-0">
              {isBulk ? <Layers size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-black text-white">
                  {isBulk ? (
                    <>
                      Pratinjau Cetak Massal: <span className="text-indigo-400 font-mono">{docsData.length} Faktur SO</span>
                    </>
                  ) : (
                    <>
                      Pratinjau Dokumen: <span className="text-indigo-400 font-mono">{docNumber}</span>
                    </>
                  )}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  {isBulk ? `Cetak Sekaligus (${docsData.length})` : (docType === 'SO' ? 'Faktur Penjualan' : docType === 'SJ' ? 'Surat Jalan' : docType)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Gunakan dialog cetak peramban. Untuk continuous form pastikan Margin: None / Minimum.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Pilihan Ukuran Kertas */}
            <div className="flex items-center bg-zinc-800 p-1 rounded-xl border border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setPaperSize('continuous')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === 'continuous'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Continuous Form 9.5 x 5.5 inch (Dot Matrix Epson LX/LQ)"
              >
                Dot Matrix (9.5"x5.5")
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  paperSize === 'a4'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Kertas Standar A4 / F4 (Laser / Inkjet / PDF)"
              >
                A4 (Standar)
              </button>
            </div>

            {/* Kontrol Lebar & Posisi untuk Dot Matrix Continuous Form */}
            {paperSize === 'continuous' && (
              <div className="flex items-center gap-2">
                {/* Lebar Konten Faktur (Membentang ke Kiri & Kanan) */}
                <div className="flex items-center gap-1.5 bg-zinc-800/90 px-2.5 py-1 rounded-xl border border-zinc-700 text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] whitespace-nowrap">Lebar:</span>
                  <button
                    type="button"
                    onClick={() => updateContentWidth(contentWidth - 2)}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white rounded font-bold transition-all cursor-pointer text-[11px]"
                    title="Perkecil / Rampingkan lebar faktur"
                  >
                    -
                  </button>
                  <span className="px-1 font-mono font-bold text-emerald-300 min-w-[3.8rem] text-center text-[11px]">
                    {contentWidth} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => updateContentWidth(contentWidth + 2)}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white rounded font-bold transition-all cursor-pointer text-[11px]"
                    title="Lebarkan ukuran faktur"
                  >
                    +
                  </button>
                  {contentWidth !== DEFAULT_CONTENT_WIDTH && (
                    <button
                      type="button"
                      onClick={() => updateContentWidth(DEFAULT_CONTENT_WIDTH)}
                      className="ml-0.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Reset ke lebar default (225 mm)"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>

                {/* Offset Margin Kiri (Menggeser seluruh kertas ke kiri / kanan) */}
                <div className="flex items-center gap-1.5 bg-zinc-800/90 px-2.5 py-1 rounded-xl border border-zinc-700 text-xs">
                  <span className="text-zinc-400 font-semibold text-[11px] whitespace-nowrap">Margin Kiri:</span>
                  <button
                    type="button"
                    onClick={() => updateLeftOffset(leftOffset - 2)}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white rounded font-bold transition-all cursor-pointer text-[11px]"
                    title="Geser lebih ke kiri (menjauhi lubang kanan)"
                  >
                    ←
                  </button>
                  <span className="px-1 font-mono font-bold text-amber-300 min-w-[3.2rem] text-center text-[11px]">
                    {leftOffset > 0 ? `+${leftOffset}` : leftOffset} mm
                  </span>
                  <button
                    type="button"
                    onClick={() => updateLeftOffset(leftOffset + 2)}
                    className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 active:scale-95 text-white rounded font-bold transition-all cursor-pointer text-[11px]"
                    title="Geser lebih ke kanan"
                  >
                    →
                  </button>
                  {leftOffset !== DEFAULT_LEFT_OFFSET && (
                    <button
                      type="button"
                      onClick={() => updateLeftOffset(DEFAULT_LEFT_OFFSET)}
                      className="ml-0.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Reset ke margin default (-8 mm)"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tombol Cetak Manual */}
            <button
              onClick={handleManualPrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer size={15} />
              <span>{isBulk ? `Cetak ${docsData.length} Faktur Sekarang` : 'Cetak Sekarang (Print)'}</span>
            </button>

            {/* Tombol Tutup Tab */}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
              title="Tutup Halaman Cetak Ini"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CANVAS LEMBAR CETAK (Paper Container)                                     */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full flex flex-col items-center justify-start p-4 sm:p-8 print:p-0 gap-6 print:gap-0">
        {docsData.map((doc, idx) => (
          <div key={doc.id || idx} className="w-full flex flex-col items-center">
            {/* On-screen badge/header for bulk preview */}
            {isBulk && (
              <div 
                className="print:hidden mb-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-100 rounded border border-zinc-700 text-[11px] font-mono flex justify-between items-center select-none shadow-sm"
                style={{ width: paperSize === 'continuous' ? `${contentWidth}mm` : '210mm' }}
              >
                <span className="font-semibold text-zinc-300">Faktur #{idx + 1} dari {docsData.length}</span>
                <span className="font-bold text-amber-400">{doc.soNumber || doc.invoiceNumber || `DOC-${doc.id}`}</span>
              </div>
            )}
            <div
              id={idx === 0 ? "standalone-print-container" : undefined}
              className="standalone-print-page bg-white text-black shadow-2xl rounded-sm print:shadow-none print:rounded-none transition-all duration-150"
              style={{
                width: paperSize === 'continuous' ? `${contentWidth}mm` : '210mm',
                height: paperSize === 'continuous' ? '13.97cm' : undefined,
                maxHeight: paperSize === 'continuous' ? '13.97cm' : undefined,
                minHeight: paperSize === 'continuous' ? '13.97cm' : '297mm',
                paddingTop: paperSize === 'continuous' ? '3.5mm' : '6mm',
                paddingBottom: paperSize === 'continuous' ? '5mm' : '6mm',
                paddingLeft: paperSize === 'continuous' && leftOffset > 0 ? `${leftOffset}mm` : undefined,
                marginLeft: paperSize === 'continuous' && leftOffset < 0 ? `${leftOffset}mm` : undefined,
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}
            >
              <InvoicePrintTemplate
                type={docType}
                data={doc}
                tenant={tenant}
                isBulk={isBulk}
              />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default PrintInvoice;

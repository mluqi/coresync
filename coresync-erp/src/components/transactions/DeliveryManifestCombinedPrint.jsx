import React, { useEffect } from 'react';
import DeliveryManifestPrintTemplate from './DeliveryManifestPrintTemplate';
import DeliveryManifestSalesPerformanceTemplate from './DeliveryManifestSalesPerformanceTemplate';

/**
 * DeliveryManifestCombinedPrint
 * Master print container for Manifest Pengiriman (DO 1 Mobil)
 * 
 * Supports:
 * - docType === 'ALL': Prints both DO Detail Muatan (Doc 1) & Sales Data Performance (Doc 2) with clean page break
 * - docType === 'DO_DETAIL': Prints Document 1 only (Detail Muatan per Supplier)
 * - docType === 'SALES_PERFORMANCE': Prints Document 2 only (Sales Data Performance Rekap Tagihan)
 * 
 * Features print engine rules identical to InvoicePrintTemplate:
 * - Pure black text (#000) & high-contrast solid borders
 * - Crisp edge rendering for dot-matrix continuous and laser print
 * - Clean page breaks and table row protection
 * - Slightly enlarged font with non-bold (regular 400) weight for maximum clarity
 */
const DeliveryManifestCombinedPrint = ({ manifestData, tenant, docType = 'ALL' }) => {
  useEffect(() => {
    let styleEl = document.getElementById('manifest-print-page-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'manifest-print-page-style';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      @page {
        size: auto;
        margin: 4mm 6mm 4mm 6mm;
      }
      @media print {
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          overflow: visible !important;
        }
        #print-area {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .delivery-manifest-print-wrapper,
        .delivery-manifest-print,
        .sales-data-performance-print {
          background: #ffffff !important;
          color: #000000 !important;
          font-family: Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif !important;
          font-size: 13px !important;
          font-weight: 400 !important;
          line-height: 1.25 !important;
          font-variant-numeric: tabular-nums !important;
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: crispEdges !important;
        }
        .delivery-manifest-print-wrapper *,
        .delivery-manifest-print *,
        .sales-data-performance-print * {
          color: #000000 !important;
          border-color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .delivery-manifest-print table td,
        .sales-data-performance-print table td {
          font-size: 13px !important;
          font-weight: 400 !important;
        }
        .delivery-manifest-print table th,
        .sales-data-performance-print table th {
          font-size: 11px !important;
          font-weight: 600 !important;
        }
        .print-avoid-break,
        tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .page-break-divider {
          page-break-before: always !important;
          break-before: page !important;
          height: 0 !important;
          display: block !important;
        }
        thead {
          display: table-header-group !important;
        }
        tfoot {
          display: table-footer-group !important;
        }
      }
    `;

    return () => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  if (!manifestData) return null;

  return (
    <div 
      className="delivery-manifest-print-wrapper bg-white text-black font-sans text-[13px] print:text-[13.5px] w-full max-w-[22.5cm] mx-auto box-border font-normal"
      style={{
        fontFamily: "Arial, 'Segoe UI', Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, sans-serif",
        color: "#000000",
        fontWeight: 400
      }}
    >
      {/* Document 1: Detail Penjualan Order (DO Manifest Muatan per Supplier) */}
      {(docType === 'ALL' || docType === 'DO_DETAIL') && (
        <div className="do-manifest-doc-page">
          <DeliveryManifestPrintTemplate manifestData={manifestData} tenant={tenant} />
        </div>
      )}

      {/* Page break divider when printing both documents */}
      {docType === 'ALL' && (
        <div 
          className="print:block page-break-divider" 
          style={{ pageBreakBefore: 'always', breakBefore: 'page', height: 0, margin: 0, padding: 0 }} 
        />
      )}

      {/* Document 2: Sales Data Performance (Rekap Faktur & Tagihan) */}
      {(docType === 'ALL' || docType === 'SALES_PERFORMANCE') && (
        <div className="sales-performance-doc-page">
          <DeliveryManifestSalesPerformanceTemplate manifestData={manifestData} tenant={tenant} />
        </div>
      )}
    </div>
  );
};

export default DeliveryManifestCombinedPrint;

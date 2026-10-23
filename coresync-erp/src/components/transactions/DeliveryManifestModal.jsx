import React, { useState, useEffect } from 'react';
import { X, Printer, Truck, Calendar, Loader2, FileText, CheckCircle2, User, Building, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatRupiah } from '../../utils/format';

const EMPTY_ARRAY = [];

const DeliveryManifestModal = ({
  isOpen,
  onClose,
  initialDriverName = '',
  initialDate = '',
  selectedDeliveryIds = EMPTY_ARRAY
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manifestData, setManifestData] = useState(null);

  const [filterDate, setFilterDate] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [driversList, setDriversList] = useState([]);

  // Sync filter state when modal opens with initial props
  useEffect(() => {
    if (isOpen) {
      setFilterDate(initialDate || new Date().toISOString().split('T')[0]);
      setFilterDriver(initialDriverName || '');
    }
  }, [isOpen, initialDate, initialDriverName]);

  // Load active drivers for filter dropdown
  useEffect(() => {
    if (isOpen) {
      api.get('/drivers?isActive=true&limit=100')
        .then(res => setDriversList(res.data.data || []))
        .catch(err => console.error('Failed to load drivers for manifest:', err));
    }
  }, [isOpen]);

  const selectedIdsKey = (selectedDeliveryIds || []).join(',');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchManifestData = async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams();
        
        if (selectedIdsKey) {
          params.set('deliveryIds', selectedIdsKey);
        } else {
          if (filterDate) params.set('deliveryDate', filterDate);
          if (filterDriver) params.set('driverName', filterDriver);
        }

        const res = await api.get(`/deliveries/manifest?${params.toString()}`);
        if (isMounted) {
          setManifestData(res.data.data || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Gagal memuat dokumen manifest pengiriman.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchManifestData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, filterDate, filterDriver, selectedIdsKey]);

  const handlePrint = async () => {
    if (manifestData) {
      try {
        const payload = {
          manifestNumber: manifestData.manifestNumber,
          manifestDate: manifestData.deliveryDate || filterDate,
          driverName: manifestData.driverName || filterDriver,
          vehiclePlate: manifestData.vehiclePlate || '—',
          warehouseName: manifestData.warehouseName || 'Gudang Utama',
          deliveryIds: selectedDeliveryIds?.length ? selectedDeliveryIds : (manifestData.groups || []).map(g => g.deliveryId).filter(Boolean),
          summary: manifestData.summary,
          snapshot: manifestData,
          notes: 'Dicetak dari Transaksi Modal'
        };
        await api.post('/deliveries/manifests', payload);
      } catch (e) {
        console.error('Failed to log manifest history from modal:', e);
      }
    }
    window.print();
  };

  if (!isOpen) return null;

  const summary = manifestData?.summary || {
    totalInvoices: 0,
    totalQty: 0,
    totalBonus: 0,
    grandTotalAmount: 0,
    invoiceNumbersList: []
  };

  const groups = manifestData?.groups || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[94vh] print:border-none print:shadow-none print:max-w-none print:max-h-none print:h-auto overflow-hidden">
        
        {/* Top Action Header (Hidden when printing) */}
        <div className="px-6 py-3.5 border-b border-zinc-200 bg-zinc-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Surat Pengiriman Barang (Manifest 1 Mobil)</h3>
              <p className="text-xs text-zinc-500">Rangkuman seluruh muatan dan faktur customer dalam satu kendaraan.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || groups.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Cetak Surat Pengiriman</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Controls (Hidden when printing or when specific IDs selected) */}
        {(!selectedDeliveryIds || selectedDeliveryIds.length === 0) && (
          <div className="px-6 py-2.5 bg-zinc-100/60 border-b border-zinc-200 flex flex-wrap items-center gap-3 text-xs shrink-0 print:hidden">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-zinc-600">Tanggal Kirim:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-zinc-600">Driver / Supir:</span>
              <select
                value={filterDriver}
                onChange={(e) => setFilterDriver(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Semua Driver / Mobil</option>
                {driversList.map(d => (
                  <option key={d.id} value={d.name}>
                    {d.name} ({d.vehicleNumber || 'No Plat'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Modal Body / Printable Form */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs text-zinc-900 bg-white print:p-4 print:space-y-4 print:text-black">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-zinc-500">Menyusun data surat pengiriman mobil...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 space-y-2">
              <Truck size={36} className="mx-auto text-zinc-300" />
              <p className="font-semibold">Tidak ada data pengiriman untuk driver/tanggal yang dipilih.</p>
              <p className="text-[11px]">Pastikan Surat Jalan telah diterbitkan dengan supir dan tanggal terkait.</p>
            </div>
          ) : (
            <div className="space-y-6 print:space-y-4">
              
              {/* Document Header */}
              <div className="border-b-2 border-zinc-900 pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 uppercase">
                      SURAT PENGANTAR PENGIRIMAN BARANG
                    </h1>
                    <p className="text-[11px] font-bold text-zinc-600 uppercase tracking-wide">
                      MANIFEST MUATAN ARMADA (1 MOBIL)
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-xs font-bold text-zinc-900">{manifestData.manifestNumber}</p>
                    <p className="text-[11px] text-zinc-500">Tanggal: {manifestData.deliveryDate}</p>
                  </div>
                </div>

                {/* Info Grid Mobil & Driver */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-zinc-200 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Nama Driver / Supir:</span>
                    <span className="font-bold text-zinc-900">{manifestData.driverName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">No. Polisi (Plat):</span>
                    <span className="font-mono font-bold text-zinc-900 uppercase">{manifestData.vehiclePlate || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Gudang Asal Muat:</span>
                    <span className="font-semibold text-zinc-900">{manifestData.warehouseName || 'Gudang Utama'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Total Titik Antar:</span>
                    <span className="font-bold text-indigo-700">{groups.length} Customer / Tujuan</span>
                  </div>
                </div>
              </div>

              {/* Tabel Data Barang Berdasarkan Supplier / Customer */}
              <div className="space-y-4">
                <div className="border border-zinc-300 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-800 font-bold uppercase tracking-wider">
                        <th className="py-2 px-2.5 w-10 text-center">No</th>
                        <th className="py-2 px-2.5 w-28">Kode (SKU)</th>
                        <th className="py-2 px-3">Nama Barang</th>
                        <th className="py-2 px-3 text-right w-28">Jumlah Barang</th>
                        <th className="py-2 px-3 text-center w-24">Bonus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {groups.map((grp) => (
                        <React.Fragment key={grp.deliveryId}>
                          {/* Group Header: Supplier / Customer */}
                          <tr className="bg-zinc-50 font-bold text-zinc-900 border-t-2 border-zinc-300">
                            <td colSpan="5" className="py-2 px-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div className="flex items-center space-x-2">
                                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-extrabold uppercase">
                                    TUJUAN #{grp.groupIndex}
                                  </span>
                                  <span className="text-xs font-extrabold">{grp.customerName}</span>
                                  {grp.customerPhone !== '-' && (
                                    <span className="text-[10px] font-normal text-zinc-500">({grp.customerPhone})</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-600 font-mono">
                                  <span>No. SJ: {grp.deliveryNumber}</span>
                                  {grp.invoiceNumber && grp.invoiceNumber !== '—' && (
                                    <span className="ml-2 pl-2 border-l border-zinc-300">Faktur: {grp.invoiceNumber}</span>
                                  )}
                                </div>
                              </div>
                              {grp.customerAddress !== '-' && (
                                <p className="text-[10px] font-normal text-zinc-500 mt-0.5">
                                  Alamat: {grp.customerAddress} {grp.customerDistrict ? `(Kec. ${grp.customerDistrict})` : ''}
                                </p>
                              )}
                            </td>
                          </tr>

                          {/* Item Rows for this Supplier / Customer */}
                          {grp.items.map((it) => (
                            <tr key={it.no} className="hover:bg-zinc-50/50">
                              <td className="py-1.5 px-2.5 text-center font-mono text-zinc-500">{it.no}</td>
                              <td className="py-1.5 px-2.5 font-mono font-bold text-zinc-800">{it.sku}</td>
                              <td className="py-1.5 px-3">
                                <span className="font-semibold text-zinc-900 block">{it.name}</span>
                                <span className="text-[10px] text-zinc-400">{it.supplierName}</span>
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-zinc-900">
                                {it.qtyFormatted}
                              </td>
                              <td className="py-1.5 px-3 text-center font-mono font-semibold text-zinc-700">
                                {it.bonusFormatted}
                              </td>
                            </tr>
                          ))}

                          {/* Subtotal Per Customer / Supplier */}
                          <tr className="bg-zinc-50/50 text-[10px] font-bold text-zinc-700 border-b border-zinc-300">
                            <td colSpan="3" className="py-1.5 px-3 text-right uppercase">
                              Subtotal Tujuan #{grp.groupIndex} ({grp.customerName}):
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-zinc-900">
                              {grp.groupQty} Item
                            </td>
                            <td className="py-1.5 px-3 text-center font-mono">
                              {grp.groupBonus > 0 ? `${grp.groupBonus} Bonus` : '-'}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary / Rekapitulasi Footer Section */}
              <div className="border border-zinc-300 rounded-lg p-3.5 bg-zinc-50 space-y-2">
                <p className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider border-b border-zinc-200 pb-1.5">
                  Rekapitulasi Muatan & Faktur:
                </p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block">Jumlah Faktur:</span>
                    <span className="font-mono font-extrabold text-zinc-900 text-xs">
                      {summary.totalInvoices} Faktur / SJ
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Jumlah Barang (Jml):</span>
                    <span className="font-mono font-extrabold text-zinc-900 text-xs">
                      {summary.totalQty.toLocaleString('id-ID')} Barang
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Total Bonus:</span>
                    <span className="font-mono font-extrabold text-zinc-900 text-xs">
                      {summary.totalBonus > 0 ? `${summary.totalBonus} Barang` : '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Grand Total Nilai:</span>
                    <span className="font-mono font-extrabold text-indigo-700 text-xs">
                      {formatRupiah(summary.grandTotalAmount)}
                    </span>
                  </div>
                </div>

                {/* List Kode Faktur */}
                <div className="pt-2 border-t border-zinc-200">
                  <span className="text-zinc-500 font-semibold text-[10px] block mb-0.5">List Kode Faktur / Surat Jalan:</span>
                  <p className="font-mono font-bold text-zinc-800 text-[11px] break-words">
                    {summary.invoiceNumbersList && summary.invoiceNumbersList.length > 0
                      ? summary.invoiceNumbersList.join(', ')
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Tanda Tangan Pengesahan (Admin Gudang & Driver / Supplier) */}
              <div className="pt-4 border-t border-zinc-300">
                <div className="grid grid-cols-2 gap-8 text-center text-[11px]">
                  <div>
                    <p className="font-bold text-zinc-700 uppercase">Admin Gudang / Checker</p>
                    <div className="h-16 border-b border-zinc-400 mx-auto w-44 mt-4"></div>
                    <p className="text-[10px] text-zinc-400 mt-1">( Nama Terang & Tanda Tangan )</p>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-700 uppercase">Driver / Supir / Supplier</p>
                    <div className="h-16 border-b border-zinc-400 mx-auto w-44 mt-4"></div>
                    <p className="text-[10px] text-zinc-400 mt-1">({manifestData.driverName || ' Nama Terang '} )</p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DeliveryManifestModal;

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Truck, 
  Calendar, 
  Building, 
  User, 
  Package, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Play,
  RotateCcw,
  Edit2,
  Layers,
  MapPin,
  Store,
  Phone,
  Loader2,
  ChevronDown
} from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatRupiah } from '../../utils/format';
import DeliveryManifestPrintTemplate from './DeliveryManifestPrintTemplate';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../ConfirmationModal';

const DeliveryManifestDetailModal = ({
  isOpen,
  onClose,
  manifestId,
  onEdit,
  onStatusChange,
  onPrint
}) => {
  const { tenant } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [manifest, setManifest] = useState(null);
  const [activeTab, setActiveTab] = useState('STOPS'); // 'STOPS', 'SUPPLIER_GROUPING'
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);

  // Confirmation Modal state
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    type: 'warning',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (!isOpen || !manifestId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/deliveries/manifests/${manifestId}`);
        setManifest(res.data.data || null);
      } catch (err) {
        console.error('Failed to load manifest detail:', err);
        toast({
          title: 'Gagal Memuat Detail',
          description: err.response?.data?.message || 'Dokumen manifest tidak ditemukan.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, manifestId]);

  if (!isOpen) return null;

  const snapshot = manifest?.snapshot || {};
  const groups = snapshot.groups || [];
  const supplierTableData = snapshot.table_data || [];
  const summary = manifest?.summary || snapshot.summary || {};

  const status = manifest?.status || 'SCHEDULED';
  const isScheduled = status === 'SCHEDULED' || status === 'ACTIVE';
  const isInDelivery = status === 'IN_DELIVERY';
  const isDelivered = status === 'DELIVERED';
  const isCancelled = status === 'CANCELLED';

  const handlePrint = async (docType = 'ALL') => {
    if (!manifest) return;
    setPrintMenuOpen(false);
    try {
      await api.post(`/deliveries/manifests/${manifest.id}/reprint`);
    } catch (e) {
      console.error('Reprint log error:', e);
    }
    
    const printData = snapshot.manifestNumber ? snapshot : {
      ...manifest,
      groups,
      table_data: supplierTableData,
      summary
    };

    if (onPrint) {
      onPrint({
        manifestData: printData,
        docType
      });
    } else {
      window.print();
    }
  };

  const handleUpdateStatus = (newStatus) => {
    if (!manifest) return;

    const isCancel = newStatus === 'CANCELLED';
    const isDeliver = newStatus === 'DELIVERED';

    setConfirmConfig({
      isOpen: true,
      title: isCancel ? 'Batalkan Manifest' : isDeliver ? 'Konfirmasi Selesai Pengiriman' : 'Berangkatkan Armada',
      message: isCancel
        ? `Batalkan Manifest #${manifest.manifestNumber}? Semua Surat Jalan akan dikembalikan ke daftar antrian siap kirim.`
        : isDeliver
        ? `Tandai seluruh pengiriman pada Manifest #${manifest.manifestNumber} SELESAI DITERIMA oleh pelanggan?`
        : `Berangkatkan armada untuk Manifest #${manifest.manifestNumber}? Seluruh Surat Jalan akan ditandai DALAM PENGIRIMAN.`,
      confirmText: isCancel ? 'Ya, Batalkan' : isDeliver ? 'Ya, Selesai' : 'Ya, Berangkatkan',
      cancelText: 'Kembali',
      type: isCancel ? 'danger' : isDeliver ? 'success' : 'warning',
      onConfirm: async () => {
        try {
          setUpdatingStatus(true);
          const res = await api.put(`/deliveries/manifests/${manifest.id}/status`, { status: newStatus });
          setManifest(res.data.data);
          toast({
            title: 'Status Diperbarui',
            description: `Status manifest berhasil diubah menjadi ${newStatus}.`,
            type: 'success'
          });
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          if (onStatusChange) onStatusChange();
        } catch (err) {
          console.error('Update status error:', err);
          toast({
            title: 'Gagal Memperbarui Status',
            description: err.response?.data?.message || 'Terjadi kesalahan.',
            type: 'error'
          });
        } finally {
          setUpdatingStatus(false);
        }
      }
    });
  };

  const getStatusBadge = () => {
    if (isDelivered) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={13} /> SELESAI DIKIRIM
        </span>
      );
    }
    if (isInDelivery) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-300 animate-pulse">
          <Truck size={13} /> SEDANG DIKIRIM
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
          <AlertCircle size={13} /> DIBATALKAN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
        <Clock size={13} /> TERJADWAL (BELUM BERANGKAT)
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 overflow-y-auto print:hidden">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 font-mono">
                  {manifest?.manifestNumber || 'Manifest Detail'}
                </h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tanggal: <strong className="text-zinc-700">{manifest?.manifestDate}</strong> • Dicetak: {manifest?.printCount || 1}x
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Split Print Button with Options Dropdown */}
            <div className="relative">
              <div className="inline-flex rounded-xl shadow-xs overflow-hidden border border-indigo-700">
                <button
                  type="button"
                  onClick={() => handlePrint('ALL')}
                  disabled={loading}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="Cetak Semua Dokumen (Detail DO + Sales Data Performance)"
                >
                  <Printer size={14} />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMenuOpen(prev => !prev)}
                  disabled={loading}
                  className="px-2 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold border-l border-indigo-500 cursor-pointer disabled:opacity-50"
                  title="Pilih Dokumen yang Dicetak"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {printMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                    Pilihan Dokumen Cetak
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrint('ALL')}
                    className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-600 font-semibold flex items-center justify-between cursor-pointer"
                  >
                    <span>1 & 2. Cetak Semua (2 Dokumen)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Lengkap</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint('DO_DETAIL')}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 font-medium text-zinc-700 cursor-pointer flex items-center justify-between"
                  >
                    <span>1. Detail Muatan DO (Pabrikan)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint('SALES_PERFORMANCE')}
                    className="w-full text-left px-3.5 py-2 hover:bg-zinc-50 font-medium text-zinc-700 cursor-pointer flex items-center justify-between"
                  >
                    <span>2. Sales Data Performance</span>
                  </button>
                </div>
              )}
            </div>

            {isScheduled && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(manifest);
                }}
                className="px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                title="Edit data armada dan surat jalan"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        {loading ? (
          <div className="py-24 text-center text-zinc-500 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <span className="text-xs font-semibold">Memuat rincian manifest pengiriman...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Quick Summary Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Driver & No. Polisi</span>
                <strong className="text-xs font-black text-zinc-900 block mt-0.5">{manifest?.driverName || '—'}</strong>
                <span className="text-[11px] font-mono text-zinc-600 font-bold uppercase">{manifest?.vehiclePlate || '—'}</span>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Gudang Pengirim</span>
                <strong className="text-xs font-bold text-zinc-900 block mt-0.5">{manifest?.warehouseName || 'Gudang Utama'}</strong>
                <span className="text-[11px] text-zinc-500">Dibuat oleh: {manifest?.createdByName || 'Admin'}</span>
              </div>

              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Setoran Tunai (COD)</span>
                <strong className="text-sm font-black font-mono text-emerald-700 block mt-0.5">
                  {formatRupiah(summary.totalCashAmount || 0)}
                </strong>
                <span className="text-[10px] text-emerald-600 font-semibold">{summary.cashInvoiceCount || 0} Faktur Tunai</span>
              </div>

              <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Total Muatan Mobil</span>
                <strong className="text-sm font-black font-mono text-indigo-900 block mt-0.5">
                  {formatRupiah(summary.grandTotalAmount || 0)}
                </strong>
                <span className="text-[10px] text-indigo-600 font-semibold">{summary.totalInvoices || groups.length} Total Faktur Kirim</span>
              </div>
            </div>

            {/* Status Control Banner */}
            <div className="p-4 bg-zinc-100/80 border border-zinc-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <Truck size={18} className="text-zinc-600" />
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Kendali Status Pengiriman</h4>
                  <p className="text-[11px] text-zinc-600">
                    {isScheduled && 'Armada masih di gudang. Klik "Berangkatkan Truk" untuk mulai pengiriman.'}
                    {isInDelivery && 'Armada sedang dalam perjalanan mengantar barang ke customer.'}
                    {isDelivered && 'Seluruh pengiriman dalam manifest ini telah selesai diantar.'}
                    {isCancelled && 'Manifest ini telah dibatalkan.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {isScheduled && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('IN_DELIVERY')}
                      disabled={updatingStatus}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Play size={13} />
                      <span>Berangkatkan Truk</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('CANCELLED')}
                      disabled={updatingStatus}
                      className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <span>Batalkan</span>
                    </button>
                  </>
                )}

                {isInDelivery && (
                  <button
                    onClick={() => handleUpdateStatus('DELIVERED')}
                    disabled={updatingStatus}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    <span>Konfirmasi Selesai Kirim</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-tabs for Display */}
            <div className="border-b border-zinc-200 flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('STOPS')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'STOPS' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Store size={14} />
                <span>Rincian Titik Pengiriman ({groups.length} Stop)</span>
              </button>
              <button
                onClick={() => setActiveTab('SUPPLIER_GROUPING')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'SUPPLIER_GROUPING' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Layers size={14} />
                <span>Muatan per Supplier ({supplierTableData.length} Pabrikan)</span>
              </button>
              <button
                onClick={() => setActiveTab('SALES_PERFORMANCE')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'SALES_PERFORMANCE' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <DollarSign size={14} />
                <span>Sales Data Performance (Rekap Faktur & Tagihan)</span>
              </button>
            </div>

            {/* Tab 1: Stops per Customer / Delivery */}
            {activeTab === 'STOPS' && (
              <div className="space-y-4">
                {groups.map((grp, idx) => (
                  <div key={idx} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div className="px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <strong className="text-xs font-black text-zinc-900">{grp.customerName}</strong>
                          <span className="text-[11px] text-zinc-500 ml-2 font-mono">{grp.deliveryNumber} (Inv: {grp.invoiceNumber})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono font-bold text-zinc-900">{formatRupiah(grp.invoiceAmount || 0)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          grp.paymentTerm?.includes('CASH') || grp.paymentTerm?.includes('COD') || grp.paymentTerm?.includes('TUNAI')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {grp.paymentTerm || 'CASH'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 text-xs bg-white text-zinc-600">
                      <p className="text-[11px] text-zinc-500 mb-2">
                        📍 {grp.customerDistrict ? `Kec. ${grp.customerDistrict}, ` : ''}{grp.customerAddress} • 📞 {grp.customerPhone || '-'}
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-100 text-left">
                              <th className="py-1 px-2">Barang</th>
                              <th className="py-1 px-2">Supplier</th>
                              <th className="py-1 px-2 text-center">Qty Dikirim</th>
                              <th className="py-1 px-2 text-center">Bonus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {(grp.items || []).map((it, itIdx) => (
                              <tr key={itIdx}>
                                <td className="py-1.5 px-2 font-semibold text-zinc-800">{it.name} <span className="font-mono text-zinc-400">({it.sku})</span></td>
                                <td className="py-1.5 px-2 text-zinc-500">{it.supplierName}</td>
                                <td className="py-1.5 px-2 text-center font-mono font-bold text-zinc-800">{it.qtyFormatted || `${it.qty} ${it.unit}`}</td>
                                <td className="py-1.5 px-2 text-center font-mono font-bold text-emerald-700">{it.bonusFormatted || (it.bonusQty > 0 ? `${it.bonusQty} ${it.bonusUnit || it.unit}` : '-')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 2: Supplier Grouping Table */}
            {activeTab === 'SUPPLIER_GROUPING' && (
              <div className="space-y-4">
                {supplierTableData.map((supp, sIdx) => (
                  <div key={sIdx} className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-zinc-100 px-4 py-2 border-b border-zinc-200 font-bold text-xs text-zinc-800 uppercase tracking-wider">
                      {supp.supplier_name}
                    </div>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-600 border-b border-zinc-200 text-[11px]">
                          <th className="py-2 px-3 w-10 text-center">No</th>
                          <th className="py-2 px-3">Kode</th>
                          <th className="py-2 px-3">Nama Barang</th>
                          <th className="py-2 px-3 text-center">Satuan Besar</th>
                          <th className="py-2 px-3 text-center">Satuan Kecil</th>
                          <th className="py-2 px-3 text-center">Bonus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(supp.items || []).map((it, itIdx) => (
                          <tr key={itIdx} className="hover:bg-zinc-50">
                            <td className="py-2 px-3 text-center font-mono text-zinc-500">{it.no}</td>
                            <td className="py-2 px-3 font-mono font-bold text-zinc-700">{it.kode}</td>
                            <td className="py-2 px-3 font-semibold text-zinc-900">{it.nama_barang}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold">{it.jumlah_barang_satuan_besar || '-'}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold">{it.jumlah_barang_satuan_kecil || '-'}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700">{it.bonus || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: Sales Data Performance (Rekap Faktur & Tagihan) */}
            {activeTab === 'SALES_PERFORMANCE' && (
              <div className="space-y-4">
                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                  <div className="bg-zinc-100 px-4 py-2.5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">
                        SALES DATA PERFORMANCE — PENJUALAN ORDER
                      </h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Nomor DO: <span className="font-mono font-bold text-zinc-800">{manifest?.manifestNumber}</span> • Driver: <strong>{manifest?.driverName || '—'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrint('SALES_PERFORMANCE')}
                      className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 flex items-center space-x-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
                    >
                      <Printer size={13} />
                      <span>Cetak Laporan Ini</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-zinc-50 text-zinc-700 font-bold border-b border-zinc-200 text-[11px] uppercase">
                          <th className="py-2 px-3 w-10 text-center">NO</th>
                          <th className="py-2 px-3 w-16 text-center">TGL</th>
                          <th className="py-2 px-3 w-32">NO. FAKTUR</th>
                          <th className="py-2 px-3 w-32">SALESMAN</th>
                          <th className="py-2 px-3">LANGGANAN</th>
                          <th className="py-2 px-3 text-right w-28">TUNAI</th>
                          <th className="py-2 px-3 text-right w-28">KREDIT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {groups.map((grp, idx) => {
                          const term = (grp.paymentTerm || '').toUpperCase();
                          const isCash = term.includes('CASH') || term.includes('COD') || term.includes('TUNAI') || term === 'LUNAS';
                          const amount = parseFloat(grp.invoiceAmount || 0);
                          const customerCode = grp.customerCode ? `${grp.customerCode} ` : '';
                          const customerLabel = `${customerCode}${grp.customerName || 'Langganan'}`.toUpperCase();
                          const salesmanLabel = grp.salesman && grp.salesman !== '-'
                            ? grp.salesman
                            : (
                              grp.salespersonCode && grp.salespersonName && !grp.salespersonName.includes(grp.salespersonCode)
                                ? `${grp.salespersonCode} ${grp.salespersonName}`
                                : (grp.salespersonName || grp.salespersonCode || grp.salesman || '—')
                            );

                          return (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="py-2 px-3 text-center font-mono text-zinc-500">{idx + 1}</td>
                              <td className="py-2 px-3 text-center font-mono text-zinc-600">
                                {grp.deliveryDate ? grp.deliveryDate.split('-').slice(1).reverse().join('/') : '-'}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-zinc-900">{grp.invoiceNumber || grp.deliveryNumber}</td>
                              <td className="py-2 px-3 font-semibold text-zinc-700 uppercase">{salesmanLabel}</td>
                              <td className="py-2 px-3 font-bold text-zinc-950 uppercase">{customerLabel}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                {isCash ? amount.toLocaleString('en-US') : ''}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                                {!isCash ? amount.toLocaleString('en-US') : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-zinc-100/90 font-black border-t-2 border-zinc-300 text-[11px]">
                          <td colSpan="2" className="py-2.5 px-3 text-left">
                            Jumlah Faktur: <span className="font-black text-zinc-950">{groups.length} Lbr</span>
                          </td>
                          <td colSpan="3" className="py-2.5 px-3 text-right font-black tracking-wider text-zinc-950">
                            TOTAL :
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                            {(summary.totalCashAmount || 0) > 0 ? (summary.totalCashAmount || 0).toLocaleString('en-US') : '0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-800">
                            {(summary.totalCreditAmount || 0) > 0 ? (summary.totalCreditAmount || 0).toLocaleString('en-US') : ''}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        loading={updatingStatus}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default DeliveryManifestDetailModal;

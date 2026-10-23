import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import DeliveryManifestCombinedPrint from '../components/transactions/DeliveryManifestCombinedPrint';
import DeliveryManifestPrintTemplate from '../components/transactions/DeliveryManifestPrintTemplate';
import DeliveryManifestSalesPerformanceTemplate from '../components/transactions/DeliveryManifestSalesPerformanceTemplate';
import DeliveryManifestFormModal from '../components/transactions/DeliveryManifestFormModal';
import DeliveryManifestDetailModal from '../components/transactions/DeliveryManifestDetailModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatRupiah, formatQty } from '../utils/format';
import { 
  Truck, 
  Calendar, 
  Printer, 
  RefreshCw, 
  FileText, 
  Package, 
  Search, 
  Eye, 
  EyeOff,
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Play, 
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

const DeliveryManifest = () => {
  const { tenant } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters & State
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [showCancelled, setShowCancelled] = useState(false);
  
  // Manifests Data
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [manifestToEdit, setManifestToEdit] = useState(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedManifestId, setSelectedManifestId] = useState(null);

  const [printTarget, setPrintTarget] = useState(null);

  // Confirmation Modal state
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    type: 'warning',
    loading: false,
    onConfirm: () => {}
  });

  // Debounced search term for smooth real-time filtering
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch manifests
  const fetchManifests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (showCancelled) params.set('showCancelled', 'true');

      const res = await api.get(`/deliveries/manifests?${params.toString()}`);
      setManifests(res.data.data || []);
      if (res.data.pagination) {
        setPagination({
          totalPages: res.data.pagination.totalPages || 1,
          totalItems: res.data.pagination.totalItems || (res.data.data || []).length
        });
      }
    } catch (err) {
      console.error('Failed to load manifests:', err);
      toast.error(err.response?.data?.message || 'Terjadi kesalahan saat memuat daftar manifest pengiriman.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManifests();
  }, [page, limit, statusFilter, startDate, endDate, debouncedSearch, showCancelled]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchManifests();
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setManifestToEdit(null);
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (manifest) => {
    if (manifest.status === 'IN_DELIVERY' || manifest.status === 'DELIVERED') {
      toast({
        title: 'Tidak Dapat Diedit',
        description: `Manifest tidak dapat diedit karena status sudah ${manifest.status === 'IN_DELIVERY' ? 'SEDANG DIKIRIM' : 'SELESAI'}.`,
        type: 'error'
      });
      return;
    }
    setManifestToEdit(manifest);
    setFormModalOpen(true);
  };

  // Open Detail Modal
  const handleOpenDetail = (id) => {
    setSelectedManifestId(id);
    setDetailModalOpen(true);
  };

  // Direct Print
  const handleDirectPrint = async (manifest, docType = 'ALL') => {
    try {
      const targetManifest = manifest?.manifestData || manifest;
      const targetDocType = manifest?.docType || docType;
      let printData = targetManifest?.snapshot || targetManifest;

      if (targetManifest?.id) {
        const reprintRes = await api.post(`/deliveries/manifests/${targetManifest.id}/reprint`);
        if (reprintRes?.data?.data?.snapshot) {
          printData = reprintRes.data.data.snapshot;
        }
      }
      setPrintTarget({
        data: printData,
        docType: targetDocType
      });
      setTimeout(() => {
        window.print();
      }, 200);
      fetchManifests();
    } catch (e) {
      console.error('Direct print error:', e);
      const targetManifest = manifest?.manifestData || manifest;
      const targetDocType = manifest?.docType || docType;
      setPrintTarget({
        data: targetManifest?.snapshot || targetManifest,
        docType: targetDocType
      });
      setTimeout(() => {
        window.print();
      }, 200);
    }
  };

  // Quick Status Change with ConfirmationModal
  const handleQuickStatusChange = (manifest, newStatus) => {
    const isCancel = newStatus === 'CANCELLED';
    const isDeliver = newStatus === 'DELIVERED';
    
    setConfirmConfig({
      isOpen: true,
      title: isCancel ? 'Batalkan Manifest' : isDeliver ? 'Konfirmasi Selesai Pengiriman' : 'Berangkatkan Armada',
      message: isCancel
        ? `Batalkan Manifest #${manifest.manifestNumber}? Semua Surat Jalan di dalamnya akan dikembalikan ke daftar antrian siap kirim.`
        : isDeliver
        ? `Tandai seluruh pengiriman pada Manifest #${manifest.manifestNumber} SELESAI DITERIMA oleh pelanggan?`
        : `Berangkatkan armada untuk Manifest #${manifest.manifestNumber}? Seluruh Surat Jalan akan ditandai DALAM PENGIRIMAN.`,
      confirmText: isCancel ? 'Ya, Batalkan' : isDeliver ? 'Ya, Selesai' : 'Ya, Berangkatkan',
      cancelText: 'Kembali',
      type: isCancel ? 'danger' : isDeliver ? 'success' : 'warning',
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmConfig(prev => ({ ...prev, loading: true }));
          await api.put(`/deliveries/manifests/${manifest.id}/status`, { status: newStatus });
          toast({
            title: 'Status Diperbarui',
            description: `Manifest #${manifest.manifestNumber} kini berstatus ${newStatus}.`,
            type: 'success'
          });
          setConfirmConfig(prev => ({ ...prev, isOpen: false, loading: false }));
          fetchManifests();
        } catch (err) {
          setConfirmConfig(prev => ({ ...prev, loading: false }));
          toast({
            title: 'Gagal Mengubah Status',
            description: err.response?.data?.message || 'Terjadi kesalahan sistem.',
            type: 'error'
          });
        }
      }
    });
  };

  // Delete / Cancel Manifest with ConfirmationModal
  const handleDeleteManifest = (id, manifestNumber) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Batalkan & Hapus Manifest',
      message: `Apakah Anda yakin ingin membatalkan riwayat Manifest #${manifestNumber}? Semua Surat Jalan terkait akan dikembalikan ke antrian.`,
      confirmText: 'Ya, Batalkan Manifest',
      cancelText: 'Kembali',
      type: 'danger',
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmConfig(prev => ({ ...prev, loading: true }));
          await api.delete(`/deliveries/manifests/${id}`);
          toast({
            title: 'Manifest Dibatalkan',
            description: `Manifest #${manifestNumber} berhasil dibatalkan.`,
            type: 'success'
          });
          setConfirmConfig(prev => ({ ...prev, isOpen: false, loading: false }));
          fetchManifests();
        } catch (err) {
          setConfirmConfig(prev => ({ ...prev, loading: false }));
          toast({
            title: 'Gagal Membatalkan Manifest',
            description: err.response?.data?.message || 'Terjadi kesalahan.',
            type: 'error'
          });
        }
      }
    });
  };

  // Helper status badge
  const renderStatusBadge = (status) => {
    if (status === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} /> SELESAI
        </span>
      );
    }
    if (status === 'IN_DELIVERY') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
          <Truck size={12} /> DIKIRIM
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle size={12} /> BATAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={12} /> TERJADWAL
      </span>
    );
  };

  // Quick statistics
  const stats = useMemo(() => {
    let scheduled = 0;
    let inDelivery = 0;
    let delivered = 0;

    manifests.forEach(m => {
      if (m.status === 'DELIVERED') delivered++;
      else if (m.status === 'IN_DELIVERY') inDelivery++;
      else if (m.status === 'SCHEDULED' || m.status === 'ACTIVE') scheduled++;
    });

    return {
      total: pagination.totalItems || manifests.length,
      scheduled,
      inDelivery,
      delivered
    };
  }, [manifests, pagination.totalItems]);

  return (
    <div className="space-y-6">
      {/* Printable Area Wrapper (Isolated for Print only) */}
      <div id="print-area" className="hidden print:block bg-white text-zinc-950 font-sans text-xs">
        {printTarget && (
          <DeliveryManifestCombinedPrint
            manifestData={printTarget.data || printTarget}
            tenant={tenant}
            docType={printTarget.docType || 'ALL'}
          />
        )}
      </div>

      {/* Screen UI Content (Hidden on Print) */}
      <div className="space-y-6 print:hidden">
        
        {/* Page Header */}
        <PageHeader
          title="Manifest Pengiriman (DO 1 Mobil)"
          subtitle="Kelola pengelompokan Surat Jalan per armada, jadwalkan supir, cetak dokumen manifest, dan lacak status distribusi."
          icon={Truck}
          actions={
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchManifests}
                className="p-2.5 text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl transition-all shadow-2xs cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={handleOpenCreate}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <PlusCircle size={16} />
                <span>Buat Manifest Baru</span>
              </button>
            </div>
          }
        />


      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">Total Manifest</span>
            <div className="p-2 bg-zinc-100 text-zinc-700 rounded-xl">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-zinc-900 font-mono">{stats.total}</span>
            <span className="text-xs text-zinc-400 font-medium">Dokumen</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700">Terjadwal (Gudang)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono">{stats.scheduled}</span>
            <span className="text-xs text-amber-600 font-medium">Siap Muat</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700">Sedang Dikirim</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Truck size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-700 font-mono">{stats.inDelivery}</span>
            <span className="text-xs text-sky-600 font-medium">Di Perjalanan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">Selesai Dikirim</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.delivered}</span>
            <span className="text-xs text-emerald-600 font-medium">Terkirim</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            {[
              { id: 'ALL', label: 'Semua Status' },
              { id: 'SCHEDULED', label: 'Terjadwal' },
              { id: 'IN_DELIVERY', label: 'Sedang Dikirim' },
              { id: 'DELIVERED', label: 'Selesai' },
              { id: 'CANCELLED', label: 'Dibatalkan' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search and Date Range */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            
            {/* Date Range */}
            <div className="flex items-center space-x-1 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                title="Tanggal Mulai"
              />
              <span className="text-zinc-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                title="Tanggal Akhir"
              />
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari No. Manifest / Supir..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
              />
            </form>

            {/* Tampilkan Batal Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowCancelled(prev => !prev);
                setPage(1);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer shadow-2xs ${
                showCancelled
                  ? 'bg-rose-50 text-rose-700 border-rose-200 ring-2 ring-rose-500/20 hover:bg-rose-100'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
              title={showCancelled ? "Sembunyikan manifest dibatalkan" : "Tampilkan manifest dibatalkan"}
            >
              {showCancelled ? <EyeOff size={14} className="text-rose-600" /> : <Eye size={14} className="text-zinc-400" />}
              <span>{showCancelled ? 'Batal Ditampilkan' : 'Tampilkan Batal'}</span>
            </button>

            {/* Reset Filter Button */}
            {(searchTerm || startDate || endDate || statusFilter !== 'ALL' || showCancelled) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStartDate('');
                  setEndDate('');
                  setStatusFilter('ALL');
                  setShowCancelled(false);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-semibold cursor-pointer whitespace-nowrap"
                title="Reset Semua Filter"
              >
                Reset Filter
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-zinc-600 font-bold border-b border-zinc-200 uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">No. Manifest & Tanggal</th>
                <th className="py-3 px-4">Driver & Plat Nomor</th>
                <th className="py-3 px-4">Gudang</th>
                <th className="py-3 px-4 text-center">Jml Faktur & Muatan</th>
                <th className="py-3 px-4 text-right">Nilai Tagihan Mobil</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-zinc-400">
                    <Loader2 size={28} className="animate-spin text-indigo-600 mx-auto mb-2" />
                    <span>Memuat data manifest pengiriman...</span>
                  </td>
                </tr>
              ) : manifests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-zinc-400">
                    <Truck size={36} className="mx-auto mb-2 text-zinc-300" />
                    <p className="font-bold text-zinc-600">Belum ada dokumen Manifest Pengiriman.</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 mb-4">Buat rute pengiriman baru dengan memilih supir dan faktur yang siap diantar.</p>
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <PlusCircle size={15} />
                      <span>Buat Manifest Pengiriman Baru</span>
                    </button>
                  </td>
                </tr>
              ) : (

                manifests.map((row) => {
                  const summary = row.summary || row.snapshot?.summary || {};
                  const doCount = (row.deliveryIds || []).length;
                  const totalQty = summary.totalQty || 0;
                  const totalAmount = summary.grandTotalAmount || 0;
                  const totalCash = summary.totalCashAmount || 0;
                  const totalCredit = summary.totalCreditAmount || 0;

                  const isScheduled = row.status === 'SCHEDULED' || row.status === 'ACTIVE';
                  const isInDelivery = row.status === 'IN_DELIVERY';
                  const isDelivered = row.status === 'DELIVERED';
                  const isCancelled = row.status === 'CANCELLED';

                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                      
                      {/* No. Manifest & Tanggal */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                          <span>{row.manifestNumber}</span>
                          {row.printCount > 1 && (
                            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-500 font-semibold" title={`Dicetak ${row.printCount}x`}>
                              {row.printCount}x
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Calendar size={11} />
                          <span>{row.manifestDate}</span>
                        </div>
                      </td>

                      {/* Driver & Plat Nomor */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{row.driverName || '—'}</div>
                        <div className="text-[11px] font-mono text-zinc-500 font-semibold uppercase">
                          {row.vehiclePlate || '—'}
                        </div>
                      </td>

                      {/* Gudang */}
                      <td className="py-3 px-4 text-zinc-600 font-medium">
                        {row.warehouseName || 'Gudang Utama'}
                      </td>

                      {/* Jumlah Faktur & Muatan */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-zinc-900">{doCount} Faktur</div>
                        <div className="text-[11px] text-zinc-600 font-mono font-bold">
                          {summary.qtyFormatted || row.snapshot?.summary?.qtyFormatted || `${formatQty(totalQty)} Karton`}
                        </div>
                      </td>

                      {/* Nilai Tagihan */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-zinc-900">{formatRupiah(totalAmount)}</div>
                        <div className="text-[10px] text-zinc-500 space-x-1 mt-0.5">
                          {totalCash > 0 && <span className="text-emerald-700 font-semibold">COD: {formatRupiah(totalCash)}</span>}
                          {totalCash > 0 && totalCredit > 0 && <span>•</span>}
                          {totalCredit > 0 && <span className="text-amber-700 font-semibold">Tempo: {formatRupiah(totalCredit)}</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(row.status)}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
                          
                          {/* Detail Button */}
                          <button
                            onClick={() => handleOpenDetail(row.id)}
                            className="p-1 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer border border-zinc-300"
                            title="Lihat Rincian Manifest"
                          >
                            <Eye size={12} />
                            <span>Detail</span>
                          </button>

                          {/* Print Button */}
                          <button
                            onClick={() => handleDirectPrint(row)}
                            className="p-1 px-2 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 text-xs font-bold cursor-pointer"
                            title="Cetak Surat Pengiriman Manifest"
                          >
                            <Printer size={12} />
                          </button>

                          {/* Edit Button (Only when SCHEDULED) */}
                          {isScheduled && (
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="p-1 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 text-xs font-bold cursor-pointer"
                              title="Ubah Data Armada / Faktur"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}

                          {/* Quick Action: Start Delivery */}
                          {isScheduled && (
                            <button
                              onClick={() => handleQuickStatusChange(row, 'IN_DELIVERY')}
                              className="p-1 px-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                              title="Berangkatkan Truk (Mulai Kirim)"
                            >
                              <Play size={11} />
                              <span>Kirim</span>
                            </button>
                          )}

                          {/* Quick Action: Confirm Delivered */}
                          {isInDelivery && (
                            <button
                              onClick={() => handleQuickStatusChange(row, 'DELIVERED')}
                              className="p-1 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                              title="Tandai Selesai Diantar"
                            >
                              <CheckCircle2 size={11} />
                              <span>Selesai</span>
                            </button>
                          )}

                          {/* Cancel / Delete (Only available when SCHEDULED / belum berangkat) */}
                          {isScheduled && (
                            <button
                              onClick={() => handleDeleteManifest(row.id, row.manifestNumber)}
                              className="p-1 px-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 text-xs font-bold cursor-pointer"
                              title="Batalkan Manifest"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Menampilkan {manifests.length} dari {pagination.totalItems} dokumen
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-semibold text-zinc-700">
                Halaman {page} dari {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="p-1.5 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Create / Edit Form Modal */}
      <DeliveryManifestFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setManifestToEdit(null);
        }}
        manifestToEdit={manifestToEdit}
        onSuccess={() => {
          setFormModalOpen(false);
          setManifestToEdit(null);
          fetchManifests();
        }}
      />

      {/* Detail Modal */}
      <DeliveryManifestDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedManifestId(null);
        }}
        manifestId={selectedManifestId}
        onEdit={(manifest) => {
          handleOpenEdit(manifest);
        }}
        onStatusChange={() => {
          fetchManifests();
        }}
        onPrint={(manifestSnapshot) => {
          handleDirectPrint(manifestSnapshot);
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        loading={confirmConfig.loading}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};

export default DeliveryManifest;

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import {
  Plus, Search, Loader2, AlertCircle,
  Phone, Mail, MapPin, Edit2, Trash2, Eye,
  Truck, X, Building2, FileText, CheckCircle,
  CreditCard, ShieldCheck, Map, DollarSign,
  Landmark, UserCheck, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import { formatRupiah } from '../utils/format';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const MODAL_TABS = [
  { id: 'IDENTITY', label: '1. Identitas & Kontak', icon: Building2 },
  { id: 'TERMS', label: '2. Finansial & Tempo (TOP)', icon: CreditCard },
  { id: 'TAX', label: '3. Data Pajak (NPWP/NIK)', icon: ShieldCheck }
];

const PAGE_SIZE = 15;

const emptySupplierForm = {
  code: '',
  legacyCode: '',
  name: '',
  address: '',
  address2: '',
  phone: '',
  phone2: '',
  email: '',
  shippingAddress: '',
  districtName: '',
  topDays: 0,
  creditLimit: 0,
  contactPerson: '',
  contactPersonPhone: '',
  nik: '',
  npwp: '',
  taxName: '',
  taxAddress1: '',
  taxAddress2: '',
  taxBlock: '',
  taxHouseNumber: '',
  taxRt: '',
  taxRw: '',
  taxKelurahan: '',
  taxKecamatan: '',
  taxCity: '',
  taxProvince: '',
  priceTier: 'STANDAR',
  bankName: '',
  bankAccount: '',
  bankHolder: ''
};

const Suppliers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortDir = searchParams.get('sortDir') || 'ASC';

  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('IDENTITY');
  const [editSupplier, setEditSupplier] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptySupplierForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const canRead = hasPermission(user, 'suppliers', 'read');
  const canCreate = hasPermission(user, 'suppliers', 'create');
  const canUpdate = hasPermission(user, 'suppliers', 'update');
  const canDelete = hasPermission(user, 'suppliers', 'delete');

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch, true);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    fetchSuppliers();
  }, [page, limit, search, status, sortBy, sortDir]);

  const updateParam = (key, value, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (resetPage) next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleSort = (sKey, sDir) => {
    const next = new URLSearchParams(searchParams);
    next.set('sortBy', sKey);
    next.set('sortDir', sDir);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        type: 'SUPPLIER',
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortBy,
        sortDir: sortDir
      });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);

      const res = await api.get(`/suppliers?${params.toString()}`);
      setData(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data supplier.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    updateParam('page', newPage.toString());
  };

  const handleOpenAdd = () => {
    setEditSupplier(null);
    setFormData(emptySupplierForm);
    setActiveModalTab('IDENTITY');
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    setEditSupplier(supplier);
    setFormData({
      code: supplier.code || '',
      legacyCode: supplier.legacyCode || '',
      name: supplier.name || '',
      address: supplier.address || '',
      address2: supplier.address2 || '',
      phone: supplier.phone || '',
      phone2: supplier.phone2 || '',
      email: supplier.email || '',
      shippingAddress: supplier.shippingAddress || '',
      districtName: supplier.districtName || '',
      topDays: supplier.topDays || 0,
      creditLimit: supplier.creditLimit || 0,
      contactPerson: supplier.contactPerson || '',
      contactPersonPhone: supplier.contactPersonPhone || '',
      nik: supplier.nik || '',
      npwp: supplier.npwp || '',
      taxName: supplier.taxName || '',
      taxAddress1: supplier.taxAddress1 || '',
      taxAddress2: supplier.taxAddress2 || '',
      taxBlock: supplier.taxBlock || '',
      taxHouseNumber: supplier.taxHouseNumber || '',
      taxRt: supplier.taxRt || '',
      taxRw: supplier.taxRw || '',
      taxKelurahan: supplier.taxKelurahan || '',
      taxKecamatan: supplier.taxKecamatan || '',
      taxCity: supplier.taxCity || '',
      taxProvince: supplier.taxProvince || '',
      priceTier: supplier.priceTier || 'STANDAR',
      bankName: supplier.metadata?.bankName || '',
      bankAccount: supplier.metadata?.bankAccount || '',
      bankHolder: supplier.metadata?.bankHolder || ''
    });
    setActiveModalTab('IDENTITY');
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenDetail = (supplier) => {
    setDetailSupplier(supplier);
    setDetailModalOpen(true);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveLoading(true);
    try {
      const payload = {
        ...formData,
        type: 'SUPPLIER',
        metadata: {
          ...(editSupplier?.metadata || {}),
          bankName: formData.bankName,
          bankAccount: formData.bankAccount,
          bankHolder: formData.bankHolder
        }
      };

      if (editSupplier) {
        await api.put(`/suppliers/${editSupplier.id}`, payload);
        toast.success(`Data Supplier "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post('/suppliers', payload);
        toast.success(`Supplier baru "${formData.name}" berhasil ditambahkan!`);
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan data supplier.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmSave = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: editSupplier ? 'Simpan Perubahan' : 'Tambah Supplier Baru',
      message: `Apakah Anda yakin ingin menyimpan data "${formData.name}"?`,
      type: 'info',
      onConfirm: () => handleSave()
    });
  };

  const handleDelete = async (supplier) => {
    try {
      setSaveLoading(true);
      await api.delete(`/suppliers/${supplier.id}`);
      toast.success(`Data supplier "${supplier.name}" berhasil dihapus.`);
      fetchSuppliers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus supplier.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmDelete = (supplier) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Supplier',
      message: `Apakah Anda yakin ingin menghapus "${supplier.name}"? Supplier yang sudah memiliki riwayat transaksi PO tidak dapat dihapus.`,
      type: 'danger',
      onConfirm: () => handleDelete(supplier)
    });
  };

  const handleExportExcel = async () => {
    if (exportLoading) return;
    try {
      setExportLoading(true);
      toast.info('Mengambil seluruh data pemasok dari server...');

      const res = await api.get('/suppliers?limit=all');
      const allSuppliers = res.data?.data || [];

      if (!allSuppliers || allSuppliers.length === 0) {
        toast.error('Tidak ada data pemasok untuk diunduh.');
        return;
      }

      toast.info(`Menyusun ${allSuppliers.length} data pemasok ke Excel...`);

      const singleRowHeaders = [
        'No', 'Kode Supplier', 'Kode Lama', 'Nama Pemasok', 'Alamat-1', 'Alamat-2', 'Telepon-1', 'Telepon-2',
        'Email', 'Alamat Pengiriman', 'Kecamatan', 'TOP (dlm hari)', 'Plafon Kredit',
        'Contact Person', 'No HP PIC', 'Nomor NIK', 'Nomor NPWP', 'Nama Wajib Pajak',
        'Alamat-1 Pajak', 'Alamat-2 Pajak', 'Kota Pajak', 'Provinsi Pajak', 'Jenis Harga'
      ];

      const rows = allSuppliers.map((s, idx) => [
        String(idx + 1),
        s.code || '',
        s.legacyCode || '',
        s.name || '',
        s.address || '',
        s.address2 || '',
        s.phone || '',
        s.phone2 || '',
        s.email || '',
        s.shippingAddress || '',
        s.districtName || '',
        String(s.topDays || 0),
        String(s.creditLimit || 0),
        s.contactPerson || '',
        s.contactPersonPhone || '',
        s.nik || '',
        s.npwp || '',
        s.taxName || '',
        s.taxAddress1 || '',
        s.taxAddress2 || '',
        s.taxCity || '',
        s.taxProvince || '',
        s.priceTier || 'STANDAR'
      ]);

      const wsData = [singleRowHeaders, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master_Pemasok');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Data_Pemasok_CoreSync_${dateStr}.xlsx`);
      toast.success(`Berhasil mengunduh ${allSuppliers.length} data pemasok ke Excel!`);
    } catch (err) {
      console.error('Export supplier error:', err);
      toast.error('Gagal mengunduh data pemasok: ' + (err.response?.data?.message || err.message || 'Terjadi kesalahan'));
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Kode Supplier',
      sortable: true,
      render: (v, row) => (
        <div>
          <span className="font-mono font-bold text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {row.code || `SUPP-${row.id}`}
          </span>
          {row.legacyCode && (
            <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">
              Lama: {row.legacyCode}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'name',
      label: 'Nama Perusahaan / Supplier',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-bold text-zinc-900 text-sm">{row.name}</p>
          {row.contactPerson && (
            <p className="text-xs text-zinc-500 mt-0.5">
              PIC: <strong className="text-zinc-700 font-medium">{row.contactPerson}</strong>
            </p>
          )}
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Kontak & Email',
      render: (v, row) => (
        <div className="space-y-0.5 text-xs">
          {row.phone && (
            <p className="font-mono text-zinc-800 flex items-center gap-1">
              <Phone size={12} className="text-zinc-400" /> {row.phone}
            </p>
          )}
          {row.contactPersonPhone && (
            <p className="font-mono text-emerald-700 text-[11px]">
              WA: {row.contactPersonPhone}
            </p>
          )}
          {row.email && (
            <p className="text-zinc-400 text-[11px] truncate max-w-[150px]">
              {row.email}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'address',
      label: 'Alamat Kantor / Gudang',
      render: (v, row) => (
        <div className="text-xs text-zinc-700 max-w-[220px]">
          <p className="line-clamp-2">{row.address || '—'}</p>
          {row.districtName && (
            <span className="text-[11px] text-zinc-400 font-medium">Kec. {row.districtName}</span>
          )}
        </div>
      )
    },
    {
      key: 'terms',
      label: 'Termin Pembayaran (TOP)',
      render: (_, row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-zinc-900">
            TOP: <span className="text-theme font-bold">{row.topDays || 0} Hari</span>
          </p>
          {row.npwp ? (
            <p className="text-[10px] text-emerald-700 font-mono">NPWP: {row.npwp}</p>
          ) : (
            <span className="text-[10px] text-zinc-400">Non-PKP / Belum NPWP</span>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Aksi',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => handleOpenDetail(row)}
            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
            title="Lihat Detail Lengkap"
          >
            <Eye size={16} />
          </button>
          {canUpdate && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-zinc-500 hover:text-amber-700 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
              title="Ubah Data"
            >
              <Edit2 size={15} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleConfirmDelete(row)}
              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              title="Hapus Supplier"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Filters & Actions */}
      <PageHeader
        title="Data Pemasok (Supplier Master)"
        subtitle="Kelola master data rekanan distributor, vendor barang & pabrik principal."
        actions={
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Filter Status */}
            <div className="flex items-center space-x-1.5 w-full sm:w-auto">
              <span className="text-xs font-semibold text-zinc-500 hidden xl:inline">Status:</span>
              <select
                value={status}
                onChange={(e) => updateParam('status', e.target.value, true)}
                className="w-full sm:w-auto px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-2xs cursor-pointer"
              >
                <option value="">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Non-Aktif</option>
              </select>
            </div>

            {/* Filter Page Limit */}
            <div className="flex items-center space-x-1.5 w-full sm:w-auto">
              <span className="text-xs font-semibold text-zinc-500 hidden xl:inline">Tampilkan:</span>
              <select
                value={limit}
                onChange={(e) => updateParam('limit', e.target.value, true)}
                className="w-full sm:w-auto px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-2xs cursor-pointer"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kode, nama supplier, PIC..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-2xs font-medium"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); updateParam('search', '', true); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {canRead && (
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                title="Unduh seluruh data pemasok ke file Excel"
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 w-full sm:w-auto"
              >
                {exportLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>Unduh Data Excel</span>
              </button>
            )}

            {canCreate && (
              <button
                onClick={handleOpenAdd}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus size={16} />
                <span>Tambah Pemasok</span>
              </button>
            )}
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        emptyText="Belum ada data pemasok."
        emptyIcon={<Truck size={40} />}
        rowKey="id"
      />

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[94vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-600 text-white rounded-2xl shadow-sm">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {editSupplier ? 'Ubah Data Pemasok' : 'Tambah Pemasok Baru'}
                  </h3>
                  <p className="text-xs text-zinc-500">Lengkapi data profil, kontak, termin pembayaran & bank supplier.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-200/60 cursor-pointer transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center space-x-1.5 px-6 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40 overflow-x-auto shrink-0">
              {MODAL_TABS.map(mt => {
                const Icon = mt.icon;
                const isActive = activeModalTab === mt.id;
                return (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => setActiveModalTab(mt.id)}
                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{mt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmSave} className="p-6 overflow-y-auto flex-1 space-y-5">
              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start space-x-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* TAB 1: IDENTITAS & KONTAK */}
              {activeModalTab === 'IDENTITY' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <Building2 size={14} className="text-amber-600" /> Informasi Perusahaan & Kontak Supplier
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Pemasok</label>
                      <input
                        type="text"
                        placeholder="Otomatis jika kosong"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Lama (Legacy)</label>
                      <input
                        type="text"
                        placeholder="Kode lama jika ada"
                        value={formData.legacyCode}
                        onChange={e => setFormData({ ...formData, legacyCode: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                      Nama Pemasok / Perusahaan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PT Indofood Sukses Makmur / CV Jaya Sentosa"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Contact Person (PIC)</label>
                      <input
                        type="text"
                        placeholder="Nama sales manager / PIC supplier"
                        value={formData.contactPerson}
                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor HP Contact Person</label>
                      <input
                        type="text"
                        placeholder="08123456789 (WhatsApp)"
                        value={formData.contactPersonPhone}
                        onChange={e => setFormData({ ...formData, contactPersonPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Telpon Kantor (1)</label>
                      <input
                        type="text"
                        placeholder="021-1234567"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Telpon Kantor (2)</label>
                      <input
                        type="text"
                        placeholder="Nomor telp tambahan"
                        value={formData.phone2}
                        onChange={e => setFormData({ ...formData, phone2: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Email Perusahaan</label>
                      <input
                        type="email"
                        placeholder="sales@indofood.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat Kantor / Pabrik Utama</label>
                    <textarea
                      rows="2"
                      placeholder="Jl. Industri Raya Blok B No. 10, Kawasan Industri..."
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat Gudang Pengambilan (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Isi jika lokasi muat barang berbeda dengan kantor utama"
                      value={formData.shippingAddress}
                      onChange={e => setFormData({ ...formData, shippingAddress: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: FINANSIAL & BANK */}
              {activeModalTab === 'TERMS' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <CreditCard size={14} className="text-amber-600" /> Ketentuan Pembayaran PO & Rekening Bank
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                        TOP (Terms of Payment Pembelian)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.topDays}
                          onChange={e => setFormData({ ...formData, topDays: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                        />
                        <span className="text-xs font-bold text-zinc-500">Hari</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">0 = Pembayaran Tunai / Cash Before Delivery</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                        Plafon Hutang (Credit Limit)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">Rp</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.creditLimit}
                          onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-amber-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                    <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Landmark size={14} className="text-amber-700" /> Informasi Rekening Bank Pemasok (Untuk Transfer Pembayaran)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Bank</label>
                        <input
                          type="text"
                          placeholder="e.g. BCA / Mandiri / BRI"
                          value={formData.bankName}
                          onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor Rekening</label>
                        <input
                          type="text"
                          placeholder="e.g. 1234567890"
                          value={formData.bankAccount}
                          onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Atas Nama Rekening</label>
                        <input
                          type="text"
                          placeholder="e.g. PT Indofood Sukses Makmur"
                          value={formData.bankHolder}
                          onChange={e => setFormData({ ...formData, bankHolder: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DATA PAJAK */}
              {activeModalTab === 'TAX' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <ShieldCheck size={14} className="text-amber-600" /> Data Faktur Pajak & Legalitas (NPWP)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor NPWP</label>
                      <input
                        type="text"
                        placeholder="00.000.000.0-000.000"
                        value={formData.npwp}
                        onChange={e => setFormData({ ...formData, npwp: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Wajib Pajak</label>
                      <input
                        type="text"
                        placeholder="Nama resmi perusahaan di NPWP"
                        value={formData.taxName}
                        onChange={e => setFormData({ ...formData, taxName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat Wajib Pajak</label>
                    <textarea
                      rows="2"
                      placeholder="Alamat lengkap sesuai surat keterangan terdaftar pajak"
                      value={formData.taxAddress1}
                      onChange={e => setFormData({ ...formData, taxAddress1: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kota / Kabupaten Pajak</label>
                      <input
                        type="text"
                        placeholder="Kota"
                        value={formData.taxCity}
                        onChange={e => setFormData({ ...formData, taxCity: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Provinsi Pajak</label>
                      <input
                        type="text"
                        placeholder="Provinsi"
                        value={formData.taxProvince}
                        onChange={e => setFormData({ ...formData, taxProvince: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-5 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex gap-2">
                  {activeModalTab !== 'IDENTITY' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = MODAL_TABS.findIndex(m => m.id === activeModalTab);
                        if (idx > 0) setActiveModalTab(MODAL_TABS[idx - 1].id);
                      }}
                      className="px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                    >
                      ← Tab Sebelumnya
                    </button>
                  )}
                  {activeModalTab !== 'TAX' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = MODAL_TABS.findIndex(m => m.id === activeModalTab);
                        if (idx < MODAL_TABS.length - 1) setActiveModalTab(MODAL_TABS[idx + 1].id);
                      }}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Tab Selanjutnya →
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer disabled:bg-amber-400 transition-all"
                  >
                    {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editSupplier ? 'Simpan Perubahan' : 'Tambah Pemasok'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail View Modal ─────────────────────────────────────────────────────── */}
      {detailModalOpen && detailSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {detailSupplier.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900">{detailSupplier.name}</h3>
                    <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {detailSupplier.code || `SUPP-${detailSupplier.id}`}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Detail Master Pemasok</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-amber-700 pb-1 border-b">
                  1. Informasi Perusahaan & Kontak
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Contact Person (PIC):</span>
                    <span className="font-bold text-zinc-800">{detailSupplier.contactPerson || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">HP Contact Person:</span>
                    <span className="font-mono font-bold text-emerald-700">{detailSupplier.contactPersonPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Telpon Kantor:</span>
                    <span className="font-mono text-zinc-800">{detailSupplier.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Email:</span>
                    <span className="text-zinc-800">{detailSupplier.email || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-500 block">Alamat Kantor:</span>
                    <span className="text-zinc-800 font-medium">{detailSupplier.address || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-amber-700 pb-1 border-b">
                  2. Finansial & Rekening Bank
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">TOP (Tempo):</span>
                    <span className="font-bold text-amber-700 font-mono">{detailSupplier.topDays || 0} Hari</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Bank Pemasok:</span>
                    <span className="font-bold text-zinc-800">{detailSupplier.metadata?.bankName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">No. Rekening:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailSupplier.metadata?.bankAccount || '—'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-zinc-500 block">Atas Nama Rekening:</span>
                    <span className="font-bold text-zinc-800">{detailSupplier.metadata?.bankHolder || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-amber-700 pb-1 border-b">
                  3. Pajak & Legalitas
                </h4>
                <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Nomor NPWP:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailSupplier.npwp || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Nama Wajib Pajak:</span>
                    <span className="font-bold text-zinc-800">{detailSupplier.taxName || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-500 block">Alamat NPWP:</span>
                    <span className="text-zinc-800">{detailSupplier.taxAddress1 || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        type={confirmConfig.type}
        loading={saveLoading}
      />
    </div>
  );
};

export default Suppliers;

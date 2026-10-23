import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import ConfirmationModal from '../components/ConfirmationModal';
import { Search, Plus, Loader2, AlertCircle, Edit2, Trash2, ToggleLeft, ToggleRight, UserCheck, Phone, Mail, Percent, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';

// --- Helper: debounce ---
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 15;

const Salespersons = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';

  // Local input state for search
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    commissionRate: 0
  });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const canRead = hasPermission(user, 'salespersons', 'read') || hasPermission(user, 'transactions', 'read');
  const canCreate = hasPermission(user, 'salespersons', 'create') || hasPermission(user, 'transactions', 'create');
  const canUpdate = hasPermission(user, 'salespersons', 'update') || hasPermission(user, 'transactions', 'update');
  const canDelete = hasPermission(user, 'salespersons', 'delete') || hasPermission(user, 'transactions', 'delete');

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== search) {
      const next = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        next.set('search', debouncedSearch);
      } else {
        next.delete('search');
      }
      next.set('page', '1');
      setSearchParams(next, { replace: true });
    }
  }, [debouncedSearch]);

  // Sync local search input with URL
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  // Fetch when page or search changes in URL
  useEffect(() => {
    fetchActiveData();
  }, [page, search]);

  const fetchActiveData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        sortBy: 'code',
        sortDir: 'ASC'
      });
      if (search.trim()) queryParams.set('search', search.trim());

      const res = await api.get(`/salespersons?${queryParams.toString()}`);

      if (res.data.data.length === 0 && page > 1) {
        handlePageChange(page - 1);
        return;
      }

      setSalespersons(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data salesperson.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', newPage.toString());
    setSearchParams(next, { replace: true });
  };

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData({ code: '', name: '', phone: '', email: '', commissionRate: 0 });
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (sp) => {
    setEditing(sp);
    setFormData({
      code: sp.code || '',
      name: sp.name,
      phone: sp.phone || '',
      email: sp.email || '',
      commissionRate: sp.commissionRate || 0
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      setSaveError('Nama salesperson wajib diisi.');
      return;
    }

    setSaveError('');
    setSaveLoading(true);

    const payload = {
      code: formData.code.trim() || undefined,
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      commissionRate: parseFloat(formData.commissionRate || 0)
    };

    try {
      if (editing) {
        await api.put(`/salespersons/${editing.id}`, payload);
        toast.success(`Data salesperson "${payload.name}" berhasil diperbarui!`);
      } else {
        await api.post('/salespersons', payload);
        toast.success(`Salesperson "${payload.name}" berhasil ditambahkan!`);
      }
      setModalOpen(false);
      await fetchActiveData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan data salesperson.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleConfirmDelete = (sp) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Salesperson',
      message: `Apakah Anda yakin ingin menghapus salesperson ${sp.name}? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/salespersons/${sp.id}`);
          toast.success(`Salesperson ${sp.name} berhasil dihapus.`);
          await fetchActiveData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus salesperson.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleToggleActive = async (sp) => {
    setConfirmConfig({
      isOpen: true,
      title: sp.isActive ? 'Nonaktifkan Salesperson' : 'Aktifkan Salesperson',
      message: `Apakah Anda yakin ingin mengubah status aktif salesperson ${sp.name}?`,
      type: sp.isActive ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.put(`/salespersons/${sp.id}`, { isActive: !sp.isActive });
          toast.info(`Status salesperson ${sp.name} berhasil diperbarui.`);
          fetchActiveData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal mengubah status.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const activeCount = pagination?.total || salespersons.length;

  const columns = [
    {
      key: 'code',
      label: 'Kode',
      sortable: true,
      render: (v, row) => (
        <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
          {row.code || `SLS-${row.id}`}
        </span>
      )
    },
    { key: 'name', label: 'Nama Salesperson', className: 'font-bold text-zinc-900' },
    {
      key: 'phone',
      label: 'Kontak',
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.phone && (
            <div className="flex items-center space-x-1.5 text-zinc-600">
              <Phone size={12} />
              <span className="text-xs font-mono">{row.phone}</span>
            </div>
          )}
          {row.email && (
            <div className="flex items-center space-x-1.5 text-zinc-500">
              <Mail size={12} />
              <span className="text-xs">{row.email}</span>
            </div>
          )}
          {!row.phone && !row.email && <span className="text-zinc-300 text-xs">—</span>}
        </div>
      )
    },
    {
      key: 'commissionRate',
      label: 'Komisi',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (v) => (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Percent size={10} />
          <span>{parseFloat(v).toFixed(1)}%</span>
        </span>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (isActive, row) => canUpdate ? (
        <button
          onClick={() => handleToggleActive(row)}
          title={isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
          className="cursor-pointer"
        >
          {isActive
            ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"><ToggleRight size={12} /><span>Aktif</span></span>
            : <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200 transition-colors"><ToggleLeft size={12} /><span>Nonaktif</span></span>
          }
        </button>
      ) : (
        isActive
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>
          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">Nonaktif</span>
      )
    },
    ...((canUpdate || canDelete) ? [{
      key: 'id',
      label: 'Tindakan',
      className: 'text-center w-24',
      headerClassName: 'text-center',
      render: (_, row) => (
        <div className="flex items-center justify-center space-x-1">
          {canUpdate && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded transition-all cursor-pointer"
              title="Ubah"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleConfirmDelete(row)}
              className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition-all cursor-pointer"
              title="Hapus"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }] : [])
  ];

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin untuk mengakses data Sales Person.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Salesperson & Tim Penjualan"
        subtitle="Kelola tim sales, komisi, dan riwayat penanganan transaksi Sales Order."
        icon={UserCheck}
        actions={
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-3 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama, hp..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {canCreate && (
              <button
                onClick={handleOpenAdd}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={16} />
                <span>Tambah Salesperson</span>
              </button>
            )}
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <UserCheck size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Total Salesperson</p>
            <p className="text-xl font-bold text-zinc-900">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <ToggleRight size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Aktif</p>
            <p className="text-xl font-bold text-zinc-900">{salespersons.filter(s => s.isActive).length}</p>
          </div>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ToggleLeft size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Nonaktif</p>
            <p className="text-xl font-bold text-zinc-900">{salespersons.filter(s => !s.isActive).length}</p>
          </div>
        </div>
      </div>

      {/* Error Banner */}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Salespersons DataTable */}
      <DataTable
        columns={columns}
        data={salespersons}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        emptyText="Belum ada data salesperson."
        emptyIcon={<UserCheck size={40} />}
        rowKey="id"
      />

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">
              {editing ? 'Ubah Data Salesperson' : 'Tambah Salesperson Baru'}
            </h3>

            {saveError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode</label>
                  <input
                    type="text"
                    placeholder="SLS-0001 (Otomatis)"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all outline-none font-mono"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Lengkap <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Budi Santoso"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">No. HP / WA</label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Komisi (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Email</label>
                <input
                  type="email"
                  placeholder="budi@perusahaan.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-indigo-400"
                >
                  {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        type={confirmConfig.type}
        loading={saveLoading}
      />
    </div>
  );
};

export default Salespersons;

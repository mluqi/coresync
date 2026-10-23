import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import { Search, Plus, Loader2, AlertCircle, Edit2, Trash2, ToggleLeft, ToggleRight, Scale, X } from 'lucide-react';
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

const Units = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';

  // Local input state for search
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const canRead = hasPermission(user, 'units', 'read');
  const canCreate = hasPermission(user, 'units', 'create');
  const canUpdate = hasPermission(user, 'units', 'update');
  const canDelete = hasPermission(user, 'units', 'delete');

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

  // Sync local input with URL
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
        sortBy: 'name',
        sortDir: 'ASC'
      });
      if (search.trim()) queryParams.set('search', search.trim());

      const res = await api.get(`/units?${queryParams.toString()}`);
      setUnits(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data satuan.');
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
    setFormData({ name: '', description: '' });
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (unit) => {
    setEditing(unit);
    setFormData({
      name: unit.name,
      description: unit.description || ''
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveLoading(true);
    try {
      if (editing) {
        await api.put(`/units/${editing.id}`, formData);
        toast.success(`Satuan ${formData.name.toUpperCase()} berhasil diperbarui!`);
      } else {
        await api.post('/units', formData);
        toast.success(`Satuan ${formData.name.toUpperCase()} berhasil ditambahkan!`);
      }
      setModalOpen(false);
      fetchActiveData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan data.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmDelete = (unit) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Satuan',
      message: `Apakah Anda yakin ingin menghapus/menonaktifkan satuan ${unit.name.toUpperCase()}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/units/${unit.id}`);
          toast.success(`Satuan ${unit.name.toUpperCase()} berhasil dihapus.`);
          fetchActiveData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus satuan.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleConfirmSave = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: editing ? 'Konfirmasi Ubah Satuan' : 'Konfirmasi Tambah Satuan',
      message: editing
        ? `Apakah Anda yakin ingin menyimpan perubahan pada satuan ${formData.name.toUpperCase()}?`
        : `Apakah Anda yakin ingin menambahkan satuan ${formData.name.toUpperCase()}?`,
      type: 'info',
      onConfirm: handleSave
    });
  };

  const handleToggleActive = async (unit) => {
    const nextState = !unit.isActive;
    const actionText = nextState ? 'mengaktifkan' : 'menonaktifkan';

    setConfirmConfig({
      isOpen: true,
      title: nextState ? 'Aktifkan Satuan' : 'Nonaktifkan Satuan',
      message: `Apakah Anda yakin ingin ${actionText} satuan ${unit.name.toUpperCase()}?`,
      type: nextState ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.put(`/units/${unit.id}`, { isActive: nextState });
          toast.success(`Satuan ${unit.name.toUpperCase()} berhasil ${nextState ? 'diaktifkan' : 'dinonaktifkan'}.`);
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

  const columns = [
    { key: 'name', label: 'Nama Satuan', className: 'font-bold text-zinc-900 uppercase font-mono' },
    { key: 'description', label: 'Deskripsi', className: 'text-zinc-600', render: (v) => v || '—' },
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
            ? <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"><ToggleRight size={12} /><span>Aktif</span></span>
            : <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200 transition-colors"><ToggleLeft size={12} /><span>Nonaktif</span></span>
          }
        </button>
      ) : (
        isActive
          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>
          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">Nonaktif</span>
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
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded-lg transition-all cursor-pointer"
              title="Ubah Satuan"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleConfirmDelete(row)}
              className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all cursor-pointer"
              title="Hapus Satuan"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Satuan Barang"
        subtitle="Kelola daftar unit satuan barang dasar dan unit konversi produk."
        icon={Scale}
        actions={
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama satuan..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs font-medium"
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
                className="bg-theme bg-theme-hover text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={16} />
                <span>Tambah Satuan</span>
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={units}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        emptyMessage="Belum ada data satuan barang."
      />

      {/* Modal Add/Edit Satuan */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {editing ? 'Ubah Satuan Barang' : 'Tambah Satuan Baru'}
                  </h3>
                  <p className="text-xs text-zinc-500">Isi nama unit satuan barang (e.g. PCS, Karton, Dus).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmSave} className="p-6 space-y-4">
              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Nama Satuan */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Nama Satuan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PCS, Karton, Dus, Botol, Bal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm uppercase font-mono font-bold text-zinc-900 placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Deskripsi Satuan
                </label>
                <textarea
                  rows="3"
                  placeholder="Keterangan singkat satuan barang..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none resize-none font-medium"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end space-x-3">
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer disabled:bg-indigo-400 transition-all"
                >
                  {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editing ? 'Simpan Perubahan' : 'Tambah Satuan'}</span>
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
        type={confirmConfig.type}
        loading={saveLoading}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Units;

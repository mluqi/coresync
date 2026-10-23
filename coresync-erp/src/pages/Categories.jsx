import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import { Search, Plus, Loader2, AlertCircle, Edit2, Trash2, X, Layers, Tag, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';

const Categories = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const canRead = hasPermission(user, 'inventory', 'read');
  const canCreate = hasPermission(user, 'inventory', 'create');
  const canUpdate = hasPermission(user, 'inventory', 'update');
  const canDelete = hasPermission(user, 'inventory', 'delete');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat daftar kategori barang.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      isActive: true
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      code: cat.code || '',
      description: cat.description || '',
      isActive: cat.isActive !== false
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleConfirmDelete = (cat) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Kategori Barang',
      message: `Apakah Anda yakin ingin menghapus kategori "${cat.name}"?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/categories/${cat.id}`);
          toast.success(`Kategori "${cat.name}" berhasil dihapus.`);
          fetchCategories();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus kategori.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
        toast.success(`Kategori "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post('/categories', formData);
        toast.success(`Kategori baru "${formData.name}" berhasil ditambahkan!`);
      }
      setSaveLoading(false);
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan kategori barang.';
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    }
  };

  const filteredCategories = categories.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  const activeCount = categories.filter(c => c.isActive).length;
  const totalProductsCount = categories.reduce((sum, c) => sum + (c.productsCount || 0), 0);

  const columns = [
    {
      key: 'name',
      label: 'Nama Kategori',
      className: 'font-bold text-zinc-900',
      render: (v, row) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
            {row.code ? row.code.slice(0, 3) : v.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-zinc-900 block">{v}</span>
            {row.description && <span className="text-[11px] text-zinc-400 block line-clamp-1">{row.description}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'code',
      label: 'Kode SKU Prefix',
      className: 'font-mono font-bold text-indigo-600',
      render: (v) => v ? <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">{v}</span> : <span className="text-zinc-400 text-xs">—</span>
    },
    {
      key: 'productsCount',
      label: 'Jumlah Barang',
      className: 'text-right font-mono font-bold text-zinc-900',
      headerClassName: 'text-right',
      render: (v) => (
        <span className="px-2.5 py-0.5 rounded-md bg-zinc-100 text-zinc-800 text-xs font-bold font-mono">
          {v || 0} Barang
        </span>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (v) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
          v 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
            : 'bg-zinc-100 text-zinc-500 border-zinc-200'
        }`}>
          {v ? <CheckCircle size={12} /> : <XCircle size={12} />}
          <span>{v ? 'Aktif' : 'Nonaktif'}</span>
        </span>
      )
    },
    ...((canUpdate || canDelete) ? [{
      key: 'id',
      label: 'Tindakan',
      headerClassName: 'text-center w-24',
      className: 'text-center',
      render: (_, row) => (
        <div className="flex items-center justify-center space-x-1">
          {canUpdate && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded-lg transition-all cursor-pointer"
              title="Ubah Kategori"
            >
              <Edit2 size={15} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleConfirmDelete(row)}
              className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all cursor-pointer"
              title="Hapus Kategori"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Kategori Barang"
        subtitle="Kelola kelompok barang, kode acuan SKU acuan, dan klasifikasi produk."
        icon={Layers}
        actions={
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative max-w-xs w-full">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kategori, kode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
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
                <span>Tambah Kategori</span>
              </button>
            )}
          </div>
        }
      />

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500 block">Total Kategori</span>
          <span className="text-2xl font-extrabold text-zinc-900 mt-1 block font-mono">
            {categories.length}
          </span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500 block">Kategori Aktif</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block font-mono">
            {activeCount}
          </span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500 block">Total Barang Terkategori</span>
          <span className="text-2xl font-extrabold text-indigo-600 mt-1 block font-mono">
            {totalProductsCount}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Categories DataTable */}
      <DataTable
        columns={columns}
        data={filteredCategories}
        loading={loading}
        emptyMessage="Belum ada kategori barang terdaftar."
      />

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {editingCategory ? 'Ubah Kategori Barang' : 'Tambah Kategori Baru'}
                  </h3>
                  <p className="text-xs text-zinc-500">Isi nama kategori dan kode acuan SKU acuan.</p>
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

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Nama Kategori */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bumbu, Minuman, Makanan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium"
                />
              </div>

              {/* Kode SKU Acuan */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Kode SKU Acuan (Prefix)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BMB, MNM, MKN"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono uppercase font-bold text-indigo-700 placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                />
                <span className="text-[10px] text-zinc-400 block font-medium">
                  Digunakan oleh SKU Generator (opsional, maks 4 huruf).
                </span>
              </div>

              {/* Deskripsi */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Deskripsi Kategori
                </label>
                <textarea
                  rows="2"
                  placeholder="Catatan tambahan mengenai kelompok barang ini..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none resize-none font-medium"
                />
              </div>

              {/* Status Active Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="categoryIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                />
                <label htmlFor="categoryIsActive" className="text-xs font-bold text-zinc-700 cursor-pointer select-none">
                  Kategori Aktif
                </label>
              </div>

              {/* Footer */}
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
                  <span>{editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
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

export default Categories;

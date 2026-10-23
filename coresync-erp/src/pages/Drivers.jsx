import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Phone,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Car,
  UserCheck,
  FileText
} from 'lucide-react';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const VEHICLE_TYPES = [
  'Truk Box Engkel (CDE)',
  'Truk Box Dobel (CDD)',
  'Pick Up Bak / L300',
  'Granmax Blind Van',
  'Truk Fuso / Wingbox',
  'Sepeda Motor / Kurir Roda 2',
  'Lainnya'
];

const Drivers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';

  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  // Modal Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    licenseNumber: '',
    vehicleNumber: '',
    vehicleType: 'Truk Box Engkel (CDE)',
    isActive: true,
    notes: ''
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {}
  });

  const canRead = hasPermission(user, 'sales', 'read') || hasPermission(user, 'inventory', 'read');
  const canCreate = hasPermission(user, 'sales', 'create') || hasPermission(user, 'inventory', 'create');
  const canUpdate = hasPermission(user, 'sales', 'update') || hasPermission(user, 'inventory', 'update');
  const canDelete = hasPermission(user, 'sales', 'delete') || hasPermission(user, 'inventory', 'delete');

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    fetchDrivers();
  }, [page, search, statusFilter]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== '') params.set('isActive', statusFilter);

      const res = await api.get(`/drivers?${params.toString()}`);
      setDrivers(res.data.data || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data driver.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setSelectedDriverId(null);
    setFormData({
      name: '',
      phone: '',
      licenseNumber: '',
      vehicleNumber: '',
      vehicleType: 'Truk Box Engkel (CDE)',
      isActive: true,
      notes: ''
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (driver) => {
    setModalMode('EDIT');
    setSelectedDriverId(driver.id);
    setFormData({
      name: driver.name || '',
      phone: driver.phone || '',
      licenseNumber: driver.licenseNumber || '',
      vehicleNumber: driver.vehicleNumber || '',
      vehicleType: driver.vehicleType || 'Truk Box Engkel (CDE)',
      isActive: driver.isActive !== undefined ? driver.isActive : true,
      notes: driver.notes || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nama driver wajib diisi.');
      return;
    }

    try {
      setFormLoading(true);
      if (modalMode === 'CREATE') {
        await api.post('/drivers', formData);
        toast.success('Driver berhasil ditambahkan.');
      } else {
        await api.put(`/drivers/${selectedDriverId}`, formData);
        toast.success('Data driver berhasil diperbarui.');
      }
      setModalOpen(false);
      fetchDrivers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan data driver.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = (driver) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Driver',
      message: `Apakah Anda yakin ingin menghapus data driver ${driver.name} (No Pol: ${driver.vehicleNumber || '-'})? Data yang dihapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/drivers/${driver.id}`);
          toast.success('Driver berhasil dihapus.');
          fetchDrivers();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menghapus driver.');
        }
      }
    });
  };

  // KPI calculations
  const totalCount = pagination?.total || drivers.length;
  const activeCount = drivers.filter(d => d.isActive).length;

  const columns = [
    {
      key: 'name',
      label: 'Nama Driver',
      className: 'font-semibold text-zinc-900',
      render: (v, row) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
            {v ? v.charAt(0).toUpperCase() : 'D'}
          </div>
          <div>
            <span className="font-bold text-zinc-900 block">{v}</span>
            {row.notes && <span className="text-[11px] text-zinc-400 line-clamp-1">{row.notes}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Kontak / WhatsApp',
      render: (v) => v ? (
        <span className="inline-flex items-center gap-1 font-mono text-zinc-700 text-xs font-semibold">
          <Phone size={12} className="text-zinc-400" />
          {v}
        </span>
      ) : <span className="text-zinc-400 text-xs">—</span>
    },
    {
      key: 'vehicleNumber',
      label: 'No. Polisi (Plat)',
      render: (v) => v ? (
        <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-amber-400 font-mono font-extrabold text-xs uppercase tracking-wider shadow-2xs border border-zinc-800">
          {v}
        </span>
      ) : <span className="text-zinc-400 text-xs font-mono">—</span>
    },
    {
      key: 'vehicleType',
      label: 'Tipe Armada / Kendaraan',
      render: (v) => v ? (
        <span className="inline-flex items-center gap-1 text-xs text-zinc-700 font-medium">
          <Car size={13} className="text-indigo-600 shrink-0" />
          {v}
        </span>
      ) : <span className="text-zinc-400 text-xs">—</span>
    },
    {
      key: 'licenseNumber',
      label: 'No. SIM',
      render: (v) => v ? (
        <span className="font-mono text-xs text-zinc-600 font-semibold">{v}</span>
      ) : <span className="text-zinc-400 text-xs">—</span>
    },
    {
      key: 'isActive',
      label: 'Status',
      className: 'text-center',
      render: (st) => st ? (
        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          AKTIF
        </span>
      ) : (
        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-zinc-100 text-zinc-500 border border-zinc-200">
          NON-AKTIF
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Aksi',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          {canUpdate && (
            <button
              onClick={() => handleOpenEditModal(row)}
              className="p-1.5 text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              title="Ubah Data Driver"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleDelete(row)}
              className="p-1.5 text-zinc-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Hapus Driver"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin untuk mengakses modul Master Driver.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Master Driver & Armada"
        subtitle="Kelola data supir pengiriman, armada kendaraan, dan nomor polisi untuk operasional logistik."
        icon={Truck}
        actions={
          canCreate && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>+ Tambah Driver</span>
            </button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Driver Terdaftar</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Truck size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2 font-mono">{totalCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Supir logistik & distribusi</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Driver Status Aktif</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2 font-mono">{activeCount}</p>
          <p className="text-xs text-emerald-700/80 mt-1">Siap ditugaskan untuk pengiriman</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
          <button
            onClick={() => updateParam('status', '')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === ''
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80'
            }`}
          >
            Semua Status
          </button>
          <button
            onClick={() => updateParam('status', 'true')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'true'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80'
            }`}
          >
            Aktif
          </button>
          <button
            onClick={() => updateParam('status', 'false')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'false'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80'
            }`}
          >
            Non-Aktif
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama driver, no polisi, no telepon, no SIM..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
          />
          {inputValue && (
            <button
              onClick={() => setInputValue('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={drivers}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => updateParam('page', p.toString())}
        emptyText="Belum ada data driver terdaftar."
        emptyIcon={<Truck size={36} />}
        rowKey="id"
      />

      {/* Form Modal (Create / Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    {modalMode === 'CREATE' ? 'Tambah Driver Baru' : 'Ubah Data Driver'}
                  </h3>
                  <p className="text-xs text-zinc-500">Lengkapi data supir dan informasi armada kendaraan.</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {/* Nama Driver */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Driver <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                />
              </div>

              {/* No. Telepon & No. SIM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    No. SIM (Surat Izin)
                  </label>
                  <input
                    type="text"
                    placeholder="SIM-B1-XXXXX"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-medium"
                  />
                </div>
              </div>

              {/* No. Polisi & Jenis Kendaraan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    No. Polisi (Plat Nomor)
                  </label>
                  <input
                    type="text"
                    placeholder="G 8920 ZA"
                    value={formData.vehicleNumber}
                    onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                    Tipe Kendaraan / Armada
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium bg-white"
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Aktif Switch */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div>
                  <span className="font-bold text-zinc-800 block text-xs">Status Driver Aktif</span>
                  <span className="text-[11px] text-zinc-400">Driver aktif dapat dipilih saat membuat Surat Jalan & Mutasi</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Catatan / Rute Pengiriman
                </label>
                <textarea
                  rows="2"
                  placeholder="Contoh: Rute Pengiriman Area Kota Tegal & Brebes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-medium resize-none"
                ></textarea>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <span>{formLoading ? 'Menyimpan...' : modalMode === 'CREATE' ? 'Simpan Driver' : 'Perbarui Driver'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default Drivers;

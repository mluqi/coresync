import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import SearchSelect from '../components/SearchSelect';
import ConfirmationModal from '../components/ConfirmationModal';
import StockTransferModal from '../components/transactions/StockTransferModal';
import StockTransferDetailModal from '../components/transactions/StockTransferDetailModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import {
  ArrowLeftRight,
  Truck,
  Plus,
  Eye,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  X} from 'lucide-react';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const StockTransfers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const sourceWhFilter = searchParams.get('sourceWh') || '';
  const destWhFilter = searchParams.get('destWh') || '';

  // Local input for debouncing
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {}
  });

  const canRead = hasPermission(user, 'stock_transfers', 'read') || hasPermission(user, 'inventory', 'read');
  const canCreate = hasPermission(user, 'stock_transfers', 'create') || hasPermission(user, 'inventory', 'create');
  const canUpdate = hasPermission(user, 'stock_transfers', 'update') || hasPermission(user, 'inventory', 'update');
  const canDelete = hasPermission(user, 'stock_transfers', 'delete') || hasPermission(user, 'inventory', 'delete');

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
    fetchTransfers();
  }, [page, search, statusFilter, sourceWhFilter, destWhFilter]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (sourceWhFilter) params.set('sourceWarehouseId', sourceWhFilter);
      if (destWhFilter) params.set('destinationWarehouseId', destWhFilter);

      const res = await api.get(`/stock-transfers?${params.toString()}`);
      setTransfers(res.data.data || []);
      setPagination(res.data.pagination || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data mutasi transfer.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        api.get('/warehouses?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/products?limit=10000').catch(() => ({ data: { data: [] } }))
      ]);
      setWarehouses(whRes.data?.data || []);
      setProducts(prodRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load master data for transfers:', err);
    }
  };

  const handleCreateTransfer = async (payload) => {
    await api.post('/stock-transfers', payload);
    toast.success('Dokumen mutasi transfer berhasil dibuat.');
    fetchTransfers();
    fetchMasterData();
  };

  const handleUpdateStatus = async (transferId, status) => {
    await api.put(`/stock-transfers/${transferId}/status`, { status });
    toast.success(`Status mutasi berhasil diubah menjadi ${status}.`);
    fetchTransfers();
    fetchMasterData();
  };

  const handleDeleteTransfer = (transfer) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Dokumen Mutasi Transfer',
      message: `Apakah Anda yakin ingin menghapus mutasi transfer ${transfer.transferNumber}? Data yang dihapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/stock-transfers/${transfer.id}`);
          toast.success('Dokumen mutasi transfer berhasil dihapus.');
          fetchTransfers();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menghapus mutasi transfer.');
        }
      }
    });
  };

  // KPI Calculations
  const totalCount = pagination?.total || transfers.length;
  const inTransitCount = transfers.filter(t => t.status === 'IN_TRANSIT').length;
  const completedCount = transfers.filter(t => t.status === 'COMPLETED').length;

  const warehouseOptions = [
    { value: '', label: 'Semua Gudang' },
    ...warehouses.map(w => ({ value: String(w.id), label: w.name }))
  ];

  const columns = [
    {
      key: 'transferNumber',
      label: 'Nomor Mutasi',
      className: 'font-mono font-bold text-indigo-900',
      render: (v, row) => (
        <div className="flex flex-col items-start gap-1">
          <button
            onClick={() => {
              setSelectedTransfer(row);
              setDetailModalOpen(true);
            }}
            className="font-bold text-indigo-700 hover:underline cursor-pointer text-left"
          >
            {v}
          </button>
          {row.transferType === 'STOCK_TYPE' ? (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Mutasi Tipe Stok
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
              Antar Gudang
            </span>
          )}
        </div>
      )
    },
    {
      key: 'transferDate',
      label: 'Tanggal Mutasi',
      render: (v) => new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    },
    {
      key: 'sourceWarehouse',
      label: 'Gudang Asal',
      render: (_, r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-zinc-800">{r.sourceWarehouse?.name || '-'}</span>
          {r.transferType === 'STOCK_TYPE' && (
            <span className="text-[10px] font-mono text-zinc-500">
              Tipe: {r.sourceStockType === 'BONUS' ? 'Stok Bonus' : 'Stok Reguler'}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'destinationWarehouse',
      label: 'Gudang Tujuan',
      render: (_, r) => (
        <div className="flex flex-col">
          <span className="font-bold text-indigo-700">{r.destinationWarehouse?.name || '-'}</span>
          {r.transferType === 'STOCK_TYPE' && (
            <span className="text-[10px] font-mono text-emerald-700 font-semibold">
              Menjadi: {r.destinationStockType === 'BONUS' ? 'Stok Bonus' : 'Stok Reguler'}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'driver',
      label: 'Driver / No. Polisi',
      render: (_, r) => (
        <div className="text-xs">
          <span className="font-semibold text-zinc-800 block">{r.driverName || '—'}</span>
          {r.vehicleNumber && <span className="font-mono text-[10px] text-zinc-500 font-bold uppercase">{r.vehicleNumber}</span>}
        </div>
      )
    },
    {
      key: 'totalQty',
      label: 'Rincian Barang',
      className: 'text-center font-mono',
      render: (_, r) => {
        const items = r.items || [];
        if (items.length === 0) return <span className="text-zinc-400 text-xs">0 item</span>;
        if (items.length === 1) {
          const it = items[0];
          return (
            <span className="font-semibold text-zinc-800 text-xs">
              1 item <span className="text-zinc-500 font-normal">({Number(it.qty)} {it.unit || 'unit'})</span>
            </span>
          );
        }
        const totalItems = items.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0);
        return (
          <span className="font-semibold text-zinc-800 text-xs">
            {items.length} jenis <span className="text-zinc-500 font-normal">({Number(totalItems.toFixed(2))} total)</span>
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status Mutasi',
      render: (st) => {
        switch (st) {
          case 'DRAFT':
            return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-zinc-100 text-zinc-700 border border-zinc-200">DRAFT</span>;
          case 'IN_TRANSIT':
            return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">IN TRANSIT</span>;
          case 'COMPLETED':
            return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">SELESAI</span>;
          case 'CANCELLED':
            return <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">BATAL</span>;
          default:
            return st;
        }
      }
    },
    {
      key: 'actions',
      label: 'Aksi',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => {
              setSelectedTransfer(row);
              setDetailModalOpen(true);
            }}
            className="p-1 px-2.5 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 rounded-lg border border-zinc-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
            title="Lihat Detail Mutasi"
          >
            <Eye size={13} />
            <span>Detail</span>
          </button>
          {row.status === 'DRAFT' && canDelete && (
            <button
              onClick={() => handleDeleteTransfer(row)}
              className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
              title="Hapus Draft"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )
    }
  ];

  const statusFilters = [
    { label: 'Semua Status', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'In Transit', value: 'IN_TRANSIT' },
    { label: 'Selesai', value: 'COMPLETED' },
    { label: 'Batal', value: 'CANCELLED' }
  ];

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin untuk mengakses modul Mutasi Antar Gudang.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Mutasi / Transfer Antar Gudang"
        subtitle="Kelola perpindahan stok persediaan antar gudang fisik dan cabang toko."
        icon={Truck}
        actions={
          canCreate && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>Buat Mutasi Transfer</span>
            </button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Dokumen Mutasi</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowLeftRight size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2 font-mono">{totalCount}</p>
          <p className="text-xs text-zinc-500 mt-1">Seluruh riwayat perpindahan</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Dalam Pengiriman</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2 font-mono">{inTransitCount}</p>
          <p className="text-xs text-amber-700/80 mt-1">Status: IN_TRANSIT</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Selesai Diterima</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2 font-mono">{completedCount}</p>
          <p className="text-xs text-emerald-700/80 mt-1">Stok berhasil masuk ke tujuan</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-3">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-3">
          {statusFilters.map(sf => {
            const isActive = statusFilter === sf.value;
            return (
              <button
                key={sf.value}
                onClick={() => updateParam('status', sf.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80'
                }`}
              >
                {sf.label}
              </button>
            );
          })}
        </div>

        {/* Filter dropdowns & search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Gudang Asal */}
          <div className="w-full sm:w-48">
            <SearchSelect
              options={warehouseOptions}
              value={sourceWhFilter}
              onChange={(opt) => updateParam('sourceWh', opt ? opt.value : '')}
              placeholder="Gudang Asal: Semua"
              searchPlaceholder="Cari gudang asal..."
            />
          </div>

          {/* Gudang Tujuan */}
          <div className="w-full sm:w-48">
            <SearchSelect
              options={warehouseOptions}
              value={destWhFilter}
              onChange={(opt) => updateParam('destWh', opt ? opt.value : '')}
              placeholder="Gudang Tujuan: Semua"
              searchPlaceholder="Cari gudang tujuan..."
            />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no mutasi, nama driver, no polisi..."
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
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={transfers}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => updateParam('page', p.toString())}
        emptyText="Belum ada data mutasi transfer antar gudang."
        emptyIcon={<ArrowLeftRight size={36} />}
        rowKey="id"
      />

      {/* Modals */}
      <StockTransferModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        warehouses={warehouses}
        products={products}
        onSuccess={handleCreateTransfer}
      />

      <StockTransferDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedTransfer(null);
        }}
        transfer={selectedTransfer}
        onUpdateStatus={handleUpdateStatus}
      />

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

export default StockTransfers;

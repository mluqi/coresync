import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import SearchSelect from '../components/SearchSelect';
import PageHeader from '../components/PageHeader';
import { Search, Loader2, AlertCircle, Calendar, ArrowUpRight, ArrowDownLeft, X, ClipboardList } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permission';
import { formatStockBreakdown, formatStockBreakdownCompact, formatStockLedgerDisplay, sanitizeStockLedgerNotes } from '../utils/format';

// --- Helper: debounce ---
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const StockLedger = () => {
  const { user } = useAuth();
  const canRead = hasPermission(user, 'stock_ledger', 'read');
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const productId = searchParams.get('productId') || '';
  const warehouseId = searchParams.get('warehouseId') || '';

  // Local input for debouncing search
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [ledgers, setLedgers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

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

  // Fetch when page, limit, search query, productId, or warehouseId changes in URL
  useEffect(() => {
    fetchLedgers();
  }, [page, limit, search, productId, warehouseId]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {
    try {
      const pRes = await api.get('/products?limit=100');
      const wRes = await api.get('/warehouses');
      setProducts(pRes.data.data || []);
      setWarehouses(wRes.data.data || []);
    } catch (err) {
      console.error('Failed to load master data for ledger filters', err);
    }
  };

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search.trim()) queryParams.set('search', search.trim());
      if (productId) queryParams.set('productId', productId);
      if (warehouseId) queryParams.set('warehouseId', warehouseId);

      const res = await api.get(`/stock-ledger?${queryParams.toString()}`);
      setLedgers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat kartu stok.');
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1'); // reset page to 1 on filter change
    setSearchParams(next, { replace: true });
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', newPage.toString());
    setSearchParams(next, { replace: true });
  };

  const handleResetFilters = () => {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
    setInputValue('');
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Tanggal & Waktu',
      className: 'text-xs font-medium text-zinc-500 font-mono',
      render: (v) => new Date(v).toLocaleString('id-ID')
    },
    { key: 'warehouse', label: 'Gudang', render: (w) => w?.name || 'Gudang' },
    {
      key: 'product',
      label: 'Produk',
      render: (p) => (
        <div>
          <span className="font-semibold text-zinc-900 block">{p?.name}</span>
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">{p?.sku}</span>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Tipe Mutasi & Stok',
      className: 'text-center',
      headerClassName: 'text-center',
      render: (type, row) => (
        <div className="flex flex-col items-center gap-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
            type === 'IN'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : type === 'RETURN_IN'
              ? 'bg-teal-50 text-teal-700 border-teal-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {type}
          </span>
          {row.stockType === 'BONUS' ? (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              BONUS
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
              REGULER
            </span>
          )}
        </div>
      )
    },
    {
      key: 'qty',
      label: 'Kuantitas Perubahan',
      className: 'text-right font-mono',
      headerClassName: 'text-right',
      render: (qty, row) => {
        const isIncoming = row.type === 'IN' || row.type === 'RETURN_IN' || row.type === 'ADJUSTMENT_IN';
        const display = formatStockLedgerDisplay(qty, row.product, isIncoming);

        return (
          <div className="text-right">
            <span className={`font-bold font-mono text-xs block ${display.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {display.primaryText}
            </span>
            {display.secondaryText && (
              <span className="block text-[11px] font-sans font-medium text-zinc-400">
                {display.secondaryText}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'referenceType',
      label: 'Referensi Dokumen',
      className: 'text-xs font-mono font-semibold text-zinc-500 uppercase',
      render: (_, row) => `${row.referenceType} #${row.referenceId}`
    },
    { key: 'notes', label: 'Catatan', className: 'text-xs text-zinc-500', render: (notes) => sanitizeStockLedgerNotes(notes) }
  ];

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin untuk melihat Kartu Stok (Stock Ledger).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kartu Stok & Mutasi FIFO (Stock Ledger)"
        subtitle="Audit riwayat mutasi stok barang masuk, barang keluar, dan sisa stok FIFO secara detail."
        icon={ClipboardList}
      />

      {/* Search & Filter row */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <Calendar className="text-indigo-600 w-5 h-5 shrink-0" />
          <span className="font-semibold text-zinc-900 text-sm">Filter Kartu Stok Ledger</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Limit Per Page Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-zinc-500 hidden xl:inline">Tampilkan:</span>
            <select
              value={limit}
              onChange={(e) => updateParam('limit', e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none cursor-pointer"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          {/* Search bar inside Ledger Filters */}
          <div className="relative w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Cari referensi...`}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="w-64">
            <SearchSelect
              options={products.map(p => ({
                value: p.id,
                label: p.name,
                sublabel: `SKU: ${p.sku}`
              }))}
              value={productId ? (isNaN(productId) ? productId : parseInt(productId)) : ''}
              onChange={(opt) => updateParam('productId', opt ? opt.value : '')}
              placeholder="— Semua Produk —"
              searchPlaceholder="Cari produk / SKU..."
              clearable={true}
            />
          </div>

          <select
            value={warehouseId}
            onChange={(e) => updateParam('warehouseId', e.target.value)}
            className="px-3.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white outline-none cursor-pointer text-zinc-700 font-medium"
          >
            <option value="">Semua Gudang</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {(productId || warehouseId || search || limit !== 10) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Ledger History DataTable */}
      <DataTable
        columns={columns}
        data={ledgers}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        emptyText="Belum ada riwayat mutasi stok untuk produk/gudang terpilih."
        emptyIcon={<ClipboardList size={40} />}
        rowKey="id"
      />
    </div>
  );
};

export default StockLedger;

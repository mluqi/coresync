import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { useToast } from '../context/ToastContext';
import { 
  ShieldCheck, 
  Activity, 
  LogIn, 
  Search, 
  RefreshCw, 
  Calendar, 
  Filter, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  X,
  FileText,
  Clock,
  Laptop
} from 'lucide-react';

const Logs = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL Query Params
  const activeTab = searchParams.get('tab') || 'activity';
  const search = searchParams.get('search') || '';
  const moduleFilter = searchParams.get('module') || '';
  const statusFilter = searchParams.get('status') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const limit = searchParams.get('limit') || '10';
  const page = parseInt(searchParams.get('page'), 10) || 1;

  // Data States
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Selected Log Detail Modal State
  const [detailModal, setDetailModal] = useState({ isOpen: false, data: null, type: 'activity' });

  // Helper to update URL search parameters
  const updateParam = (key, val) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set(key, val);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  const handleTabChange = (newTab) => {
    const newParams = new URLSearchParams();
    newParams.set('tab', newTab);
    newParams.set('page', '1');
    if (limit !== '10') newParams.set('limit', limit);
    setSearchParams(newParams);
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab, search, moduleFilter, statusFilter, startDate, endDate, limit, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'activity') {
        const params = new URLSearchParams({
          page,
          limit,
          search,
          module: moduleFilter,
          startDate,
          endDate
        });
        const res = await api.get(`/logs/activity?${params.toString()}`);
        setLogs(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } else {
        const params = new URLSearchParams({
          page,
          limit,
          search,
          status: statusFilter,
          startDate,
          endDate
        });
        const res = await api.get(`/logs/access?${params.toString()}`);
        setLogs(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      toast.error(`Gagal memuat data ${activeTab === 'activity' ? 'Log Aktivitas' : 'Log Akses'}.`);
    } finally {
      setLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Activity Log Table Columns
  const activityColumns = [
    {
      key: 'createdAt',
      label: 'Waktu',
      className: 'font-mono text-xs text-zinc-600 shrink-0 whitespace-nowrap',
      render: (v) => formatDate(v)
    },
    {
      key: 'userName',
      label: 'Pengguna',
      className: 'font-medium text-zinc-900',
      render: (v, row) => (
        <div>
          <div className="font-bold text-zinc-900 text-xs">{v || 'System'}</div>
          <div className="text-[10px] font-mono text-zinc-400">{row.userRole || 'SYSTEM'}</div>
        </div>
      )
    },
    {
      key: 'module',
      label: 'Modul',
      className: 'text-xs font-semibold',
      render: (v) => (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
          {v}
        </span>
      )
    },
    {
      key: 'action',
      label: 'Aksi',
      className: 'text-xs font-bold text-zinc-800 font-mono',
      render: (v) => {
        let badgeStyle = 'bg-zinc-100 text-zinc-700 border-zinc-200';
        if (v.includes('CREATE')) badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (v.includes('UPDATE')) badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
        if (v.includes('DELETE') || v.includes('CANCEL')) badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
        if (v.includes('FINALIZE')) badgeStyle = 'bg-violet-50 text-violet-700 border-violet-200';
        return (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
            {v}
          </span>
        );
      }
    },
    {
      key: 'description',
      label: 'Deskripsi Aktivitas',
      className: 'text-xs text-zinc-700 max-w-xs truncate',
      render: (v) => v || '-'
    },
    {
      key: 'ipAddress',
      label: 'IP Address',
      className: 'font-mono text-xs text-zinc-500',
      render: (v) => v || '::1'
    },
    {
      key: 'actions',
      label: 'Detail',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (_, row) => (
        <button
          onClick={() => setDetailModal({ isOpen: true, data: row, type: 'activity' })}
          className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
          title="Lihat Detail Log"
        >
          <Eye size={15} />
        </button>
      )
    }
  ];

  // Access Log Table Columns
  const accessColumns = [
    {
      key: 'createdAt',
      label: 'Waktu Akses',
      className: 'font-mono text-xs text-zinc-600 whitespace-nowrap',
      render: (v) => formatDate(v)
    },
    {
      key: 'email',
      label: 'Alamat Email',
      className: 'font-mono text-xs font-bold text-zinc-900',
      render: (v) => v
    },
    {
      key: 'action',
      label: 'Tipe Akses',
      className: 'text-xs font-bold font-mono',
      render: (v) => (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          v === 'LOGIN_SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          v === 'LOGIN_FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          {v}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      className: 'text-xs font-bold',
      render: (v) => (
        <div className="flex items-center space-x-1.5">
          {v === 'SUCCESS' ? (
            <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={14} />
              <span>BERHASIL</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 text-xs font-bold text-rose-600">
              <XCircle size={14} />
              <span>GAGAL</span>
            </span>
          )}
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Keterangan',
      className: 'text-xs text-zinc-600',
      render: (v) => v || '-'
    },
    {
      key: 'ipAddress',
      label: 'IP Address',
      className: 'font-mono text-xs text-zinc-500',
      render: (v) => v || '::1'
    },
    {
      key: 'actions',
      label: 'Detail',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (_, row) => (
        <button
          onClick={() => setDetailModal({ isOpen: true, data: row, type: 'access' })}
          className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
          title="Lihat Detail Log"
        >
          <Eye size={15} />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Log Aktivitas & Akses"
        subtitle="Audit trail aktivitas pengguna dan riwayat otentikasi sistem ERP"
        icon={ShieldCheck}
        actions={
          <button
            onClick={fetchLogs}
            className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-2xs cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Log</span>
          </button>
        }
      />

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        {/* Tab Pills */}
        <div className="flex items-center space-x-1 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('activity')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-white text-theme shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Activity size={15} />
            <span>Log Aktivitas (Audit Trail)</span>
          </button>
          <button
            onClick={() => handleTabChange('access')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'access'
                ? 'bg-white text-theme shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <LogIn size={15} />
            <span>Log Akses (Keamanan)</span>
          </button>
        </div>

        {/* Filters Wrapper */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => updateParam('search', e.target.value)}
              placeholder={activeTab === 'activity' ? "Cari aktivitas, user, IP..." : "Cari email, IP, alasan..."}
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
            />
          </div>

          {/* Module Filter (for Activity) */}
          {activeTab === 'activity' && (
            <select
              value={moduleFilter}
              onChange={(e) => updateParam('module', e.target.value)}
              className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer shadow-2xs"
            >
              <option value="">Semua Modul</option>
              <option value="PRODUCTS">Master Barang</option>
              <option value="STOCK_OPNAME">Stock Opname</option>
              <option value="CONTACTS">Kontak</option>
              <option value="SETTINGS">Pengaturan</option>
              <option value="TRANSACTIONS">Transaksi</option>
            </select>
          )}

          {/* Status Filter (for Access) */}
          {activeTab === 'access' && (
            <select
              value={statusFilter}
              onChange={(e) => updateParam('status', e.target.value)}
              className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer shadow-2xs"
            >
              <option value="">Semua Status</option>
              <option value="SUCCESS">Berhasil</option>
              <option value="FAILED">Gagal</option>
            </select>
          )}

          {/* Items Limit Dropdown */}
          <select
            value={limit}
            onChange={(e) => updateParam('limit', e.target.value)}
            className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer shadow-2xs"
          >
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      <DataTable
        columns={activeTab === 'activity' ? activityColumns : accessColumns}
        data={logs}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => updateParam('page', p.toString())}
        emptyText={activeTab === 'activity' ? "Belum ada catatan log aktivitas terdaftar." : "Belum ada catatan log akses terdaftar."}
        emptyIcon={activeTab === 'activity' ? <Activity size={40} /> : <LogIn size={40} />}
        rowKey="id"
      />

      {/* Log Detail Modal Popup */}
      {detailModal.isOpen && detailModal.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <FileText size={18} />
                </div>
                <h3 className="text-base font-bold text-zinc-900">
                  {detailModal.type === 'activity' ? 'Detail Log Aktivitas' : 'Detail Log Akses Otentikasi'}
                </h3>
              </div>
              <button
                onClick={() => setDetailModal({ isOpen: false, data: null, type: 'activity' })}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-700">
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Waktu Log</p>
                  <p className="font-mono font-semibold text-zinc-800">{formatDate(detailModal.data.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">IP Address</p>
                  <p className="font-mono font-semibold text-zinc-800">{detailModal.data.ipAddress || '::1'}</p>
                </div>
              </div>

              {detailModal.type === 'activity' ? (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Pengguna & Peran</p>
                    <p className="font-bold text-zinc-900">{detailModal.data.userName || 'System'} ({detailModal.data.userRole || 'SYSTEM'})</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Modul & Aksi</p>
                    <p className="font-mono font-bold text-indigo-600">{detailModal.data.module} - {detailModal.data.action}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Deskripsi</p>
                    <p className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-zinc-800 leading-relaxed font-medium">
                      {detailModal.data.description || '-'}
                    </p>
                  </div>

                  {/* Before vs After Diff Table */}
                  {detailModal.data.metadata?.changes && detailModal.data.metadata.changes.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Rincian Perubahan (Before vs After)</span>
                        </p>
                        <span className="text-[10px] font-bold text-zinc-400 font-mono">
                          {detailModal.data.metadata.changes.length} kolom berubah
                        </span>
                      </div>
                      
                      <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-100/80 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                              <th className="py-2 px-3">Field / Parameter</th>
                              <th className="py-2 px-3 text-rose-700 bg-rose-50/50">Sebelum (Before)</th>
                              <th className="py-2 px-3 text-emerald-700 bg-emerald-50/50">Sesudah (After)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 bg-white">
                            {detailModal.data.metadata.changes.map((c, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/50">
                                <td className="py-2 px-3 font-semibold text-zinc-900 font-mono text-[11px]">
                                  {c.label || c.field}
                                </td>
                                <td className="py-2 px-3 bg-rose-50/20 font-mono text-[11px] text-rose-700 font-semibold">
                                  <span className="line-through opacity-80">{c.beforeFormatted || String(c.before)}</span>
                                </td>
                                <td className="py-2 px-3 bg-emerald-50/20 font-mono text-[11px] text-emerald-700 font-bold">
                                  <span>{c.afterFormatted || String(c.after)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Deleted Snapshot Preview */}
                  {detailModal.data.metadata?.deletedSnapshot && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                        Snapshot Data Yang Dihapus
                      </p>
                      <pre className="bg-zinc-900 text-rose-300 p-3 rounded-xl overflow-x-auto font-mono text-[11px] max-h-48 border border-rose-950">
                        {JSON.stringify(detailModal.data.metadata.deletedSnapshot, null, 2)}
                      </pre>
                    </div>
                  )}

                  {detailModal.data.metadata && !detailModal.data.metadata.changes && !detailModal.data.metadata.deletedSnapshot && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Parameter Metadata (JSON)</p>
                      <pre className="bg-zinc-900 text-emerald-400 p-3 rounded-xl overflow-x-auto font-mono text-[11px] max-h-40">
                        {JSON.stringify(detailModal.data.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Email Pengguna</p>
                    <p className="font-mono font-bold text-zinc-900">{detailModal.data.email}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Status & Event</p>
                    <p className="font-mono font-bold text-indigo-600">{detailModal.data.action} ({detailModal.data.status})</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Catatan / Alasan</p>
                    <p className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-zinc-800">
                      {detailModal.data.reason || '-'}
                    </p>
                  </div>
                </>
              )}

              {detailModal.data.userAgent && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Perangkat / User Agent</p>
                  <p className="text-[11px] font-mono text-zinc-500 break-all bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                    {detailModal.data.userAgent}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logs;

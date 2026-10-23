import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Building2, Users, Package, AlertTriangle, TrendingUp, TrendingDown,
  ShoppingBag, ArrowUpRight, ShieldCheck, Layers, Boxes, DollarSign,
  Calendar, RefreshCw, Loader2, ArrowRightLeft, Sparkles, CheckCircle2,
  ChevronRight, Truck, Clock, FileText, ArrowDownRight, Wallet,
  ClipboardCheck, History, PlusCircle, ExternalLink, ShieldAlert,
  AlertCircle, CreditCard, ChevronDown, ArrowLeftRight
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';

// ─── Formatters ──────────────────────────────────────────────────────────────
const formatRupiah = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rp 0';
  const num = Math.round(Number(val));
  return 'Rp ' + num.toLocaleString('id-ID');
};

const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Number(val).toLocaleString('id-ID');
};

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Overview() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const activeTenantId = localStorage.getItem('activeTenantId');

  // Check if viewing as SuperAdmin (not impersonating any tenant)
  const isSuperAdminHome = user?.role === 'SUPERADMIN' && !activeTenantId;
  const isOwner = user?.role === 'OWNER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isStaff = user?.role === 'STAFF';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isSuperAdminHome) {
        try {
          const res = await api.get('/tenant/superadmin-dashboard');
          setData(res.data.data);
        } catch (adminErr) {
          console.warn('SuperAdmin dashboard fetch failed, falling back to standard summary:', adminErr);
          const res = await api.get('/reports/dashboard-summary');
          setData(res.data.data);
        }
      } else {
        const res = await api.get('/reports/dashboard-summary');
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      setError(err.response?.data?.message || 'Gagal memuat data ringkasan dashboard.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdminHome]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-zinc-500">Memuat data ringkasan dashboard...</p>
      </div>
    );
  }

  // Get user role display title & badge
  const getRoleBadge = () => {
    if (isSuperAdminHome) return { text: 'Platform SuperAdmin', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    if (isOwner) return { text: 'Owner / Direktur', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    if (isAdmin) return { text: 'Manager / Admin Operasional', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    return { text: 'Admin Gudang & Operasional', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="space-y-8 pb-10">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-indigo-950 rounded-xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 opacity-10 pointer-events-none">
          <Building2 size={280} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${roleBadge.bg}`}>
                {roleBadge.text}
              </span>
              {!isSuperAdminHome && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-zinc-200 border border-white/15">
                  {tenant?.companyName || 'CoreSync ERP'}
                </span>
              )}
              {tenant?.taxStatus && !isSuperAdminHome && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {tenant.taxStatus === 'PKP' ? '🟢 Jalur PKP' : '⚪ Jalur Non-PKP'}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Selamat datang, {user?.name}!
            </h1>
            <p className="text-zinc-300 text-sm mt-1 max-w-2xl">
              {isSuperAdminHome && 'Ringkasan ekosistem platform CoreSync, pertumbuhan tenant, dan aktivitas sistem.'}
              {isOwner && 'Ringkasan eksekutif performa omset, laba, posisi likuiditas kas & bank, valuasi stok, serta piutang usaha.'}
              {isAdmin && 'Monitoring harian operasional, antrean pesanan siap kirim, barang masuk, dan performa tim penjualan.'}
              {isStaff && 'Pusat kontrol operasional logistik, antrean pengiriman barang, barang masuk dari supplier, dan kesiapan stok gudang.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadDashboardData}
              className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs font-semibold transition-all backdrop-blur-md cursor-pointer"
            >
              <RefreshCw size={14} />
              Segarkan Data
            </button>
            {isSuperAdminHome && (
              <button
                onClick={() => navigate('/super-admin')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                SuperAdmin Panel
                <ChevronRight size={14} />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate('/transactions/sales')}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <PlusCircle size={14} />
                Buat Pesanan (SO)
              </button>
            )}
            {isStaff && (
              <button
                onClick={() => navigate('/delivery-manifest')}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Truck size={14} />
                Manifest Pengiriman
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadDashboardData} className="underline text-xs font-semibold cursor-pointer">Coba lagi</button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. SUPERADMIN DASHBOARD VIEW                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isSuperAdminHome && data && (
        <SuperAdminDashboardView data={data} navigate={navigate} />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. OWNER EXECUTIVE DASHBOARD VIEW                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isOwner && data && (
        <OwnerExecutiveDashboardView data={data} navigate={navigate} />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ADMIN / MANAGER OPERATIONAL DASHBOARD VIEW                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAdmin && data && (
        <AdminManagerDashboardView data={data} navigate={navigate} />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. STAFF / WAREHOUSE LOGISTICS DASHBOARD VIEW                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isStaff && data && (
        <StaffWarehouseDashboardView data={data} navigate={navigate} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. SUPERADMIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function SuperAdminDashboardView({ data, navigate }) {
  const stats = data.stats || {};
  const tenants = data.tenants || [];
  const activityLogs = data.recentActivities || [];

  return (
    <div className="space-y-8">
      {/* SuperAdmin KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Tenant Perusahaan</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Building2 size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-zinc-900 mt-3">{stats.totalTenants || 0}</p>
          <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 size={13} /> {stats.activeTenants || 0} Tenant Berlangganan Aktif
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Pengguna Akun</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-zinc-900 mt-3">{stats.totalUsers || 0}</p>
          <p className="mt-2 text-xs text-zinc-500">Terdistribusi di seluruh tenant</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status Server & DB</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <ShieldCheck size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-3">Normal / Online</p>
          <p className="mt-2 text-xs text-zinc-500">Latency & sync berjalan lancar</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Aktivitas Hari Ini</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <History size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-zinc-900 mt-3">{activityLogs.length || 0}</p>
          <p className="mt-2 text-xs text-zinc-500">Log operasional tercatat</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-base">Daftar Tenant Terdaftar</h3>
            <p className="text-xs text-zinc-500">Perusahaan yang menggunakan platform CoreSync ERP</p>
          </div>
          <button
            onClick={() => navigate('/super-admin')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            Kelola di SuperAdmin Panel <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 border-y border-zinc-200 font-bold text-zinc-500 uppercase">
              <tr>
                <th className="py-2.5 px-3">Nama Perusahaan</th>
                <th className="py-2.5 px-3">Kode Tenant</th>
                <th className="py-2.5 px-3">Skema Pajak</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-3 font-bold text-zinc-900">{t.companyName}</td>
                  <td className="py-3 px-3 font-mono text-zinc-600">{t.code || `TNT-${t.id}`}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.taxStatus === 'PKP' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-700'
                    }`}>
                      {t.taxStatus || 'NON_PKP'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      AKTIF
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => navigate('/super-admin')}
                      className="text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      Buka Panel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. OWNER EXECUTIVE DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function OwnerExecutiveDashboardView({ data, navigate }) {
  const kpi = data.kpi || {};

  return (
    <div className="space-y-8">
      {/* 6 Executive Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Omset Penjualan */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Omset Penjualan Bulan Ini</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-2xs">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-3 font-mono">{formatRupiah(kpi.salesThisMonth)}</p>
          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1 font-semibold">
            <ArrowUpRight size={14} /> Transaksi Penjualan Terkonfirmasi
          </p>
        </div>

        {/* Pembelian & Pengeluaran Stok */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Pembelian Stok Bulan Ini</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-2xs">
              <ShoppingBag size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-3 font-mono">{formatRupiah(kpi.purchasesThisMonth)}</p>
          <p className="mt-2 text-xs text-zinc-500">Restock persediaan masuk</p>
        </div>

        {/* Kas & Bank */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Posisi Kas & Saldo Bank</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-2xs">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-3 font-mono">{formatRupiah(kpi.totalKasBank)}</p>
          <p className="mt-2 text-xs text-zinc-500">Likuiditas akun kas & perbankan</p>
        </div>

        {/* Valuasi Persediaan */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Valuasi Total Aset Stok</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shadow-2xs">
              <Boxes size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-3 font-mono">{formatRupiah(kpi.totalStockValuation)}</p>
          <p className="mt-2 text-xs text-zinc-500">{kpi.totalProductsCount || 0} item barang di seluruh gudang</p>
        </div>

        {/* Piutang Usaha */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Piutang Pelanggan (Unpaid)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-2xs">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-3 font-mono">{formatRupiah(kpi.totalReceivables)}</p>
          <p className="mt-2 text-xs text-amber-700 font-medium">Tagihan invoice yang belum lunas</p>
        </div>

        {/* Hutang Supplier */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Hutang Dagang Supplier</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-2xs">
              <CreditCard size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-900 mt-3 font-mono">{formatRupiah(kpi.totalPayables)}</p>
          <p className="mt-2 text-xs text-rose-700 font-medium">Kewajiban pembayaran PO supplier</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Tren Penjualan vs Pembelian */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-zinc-900 text-base">Tren Penjualan vs Pembelian</h3>
              <p className="text-xs text-zinc-500">Performa 6 bulan terakhir</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-3 h-3 rounded-full bg-indigo-500" /> Penjualan
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> Pembelian
              </span>
            </div>
          </div>

          {data.monthlyTrend?.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} tickFormatter={(v) => `Rp ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatRupiah(value)} />
                  <Area type="monotone" dataKey="Penjualan" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="Pembelian" stroke="#F59E0B" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPurchases)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-zinc-400">Belum ada data historis</div>
          )}
        </div>

        {/* Top 5 Products Bar Chart */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-zinc-900 text-base">Top Produk Terlaris</h3>
                <p className="text-xs text-zinc-500">Paling banyak dipesan pelanggan</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">Top 5</span>
            </div>

            {data.topProducts?.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topProducts} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                    <Tooltip formatter={(val, name) => name === 'jumlah' ? `${val} item` : formatRupiah(val)} />
                    <Bar dataKey="jumlah" fill="#6366F1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-zinc-400">Belum ada data penjualan</div>
            )}
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="w-full mt-4 py-2 border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-700 flex items-center justify-center gap-1 cursor-pointer"
          >
            Lihat Seluruh Laporan <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Sales Orders Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-base">Transaksi Penjualan Terkini</h3>
            <p className="text-xs text-zinc-500">Aktivitas pesanan pelanggan terbaru</p>
          </div>
          <button
            onClick={() => navigate('/transactions/sales')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            Buka Transaksi Penjualan <ChevronRight size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 border-y border-zinc-200 font-bold text-zinc-500 uppercase">
              <tr>
                <th className="py-2.5 px-3">No. SO</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Pelanggan</th>
                <th className="py-2.5 px-3">Status Kirim</th>
                <th className="py-2.5 px-3 text-right">Total Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {(data.recentSales || []).map(s => (
                <tr key={s.id} className="hover:bg-zinc-50/80">
                  <td className="py-3 px-3 font-bold text-zinc-900">{s.soNumber}</td>
                  <td className="py-3 px-3 text-zinc-600">{s.soDate}</td>
                  <td className="py-3 px-3 font-sans font-medium text-zinc-800">{s.customer?.name || '-'}</td>
                  <td className="py-3 px-3 font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'SHIPPED' ? 'bg-emerald-100 text-emerald-800' :
                      s.status === 'COMPLETED' ? 'bg-indigo-100 text-indigo-800' :
                      s.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-zinc-900">{formatRupiah(s.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN (MANAGER OPERASIONAL) DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function AdminManagerDashboardView({ data, navigate }) {
  const kpi = data.kpi || {};
  const pendingShipments = data.pendingShipments || [];
  const pendingPurchases = data.pendingPurchases || [];
  const lowStockItems = data.lowStockItems || [];

  return (
    <div className="space-y-8">
      {/* Operational Action KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Antrean Pengiriman SO */}
        <div 
          onClick={() => navigate('/transactions/sales')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Antrean Pesanan Keluar</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-900 mt-3 font-mono">{kpi.pendingShipmentCount || 0}</p>
          <p className="mt-2 text-xs text-indigo-700 font-semibold flex items-center gap-1">
            <Clock size={13} /> SO Menunggu Kirim / Manifest
          </p>
        </div>

        {/* Antrean Pembelian Masuk */}
        <div 
          onClick={() => navigate('/transactions/purchases')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-sky-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Barang Masuk Supplier</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-2xs">
              <ShoppingBag size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-sky-900 mt-3 font-mono">{kpi.pendingPurchaseCount || 0}</p>
          <p className="mt-2 text-xs text-sky-700 font-semibold flex items-center gap-1">
            <ArrowDownRight size={13} /> PO Menunggu Penerimaan
          </p>
        </div>

        {/* Stok Rendah / Kritis */}
        <div 
          onClick={() => navigate('/products')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Peringatan Stok Buffer</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
              kpi.lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-zinc-50 text-zinc-400'
            }`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-900 mt-3 font-mono">{kpi.lowStockCount || 0}</p>
          <p className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1">
            {kpi.outOfStockCount > 0 ? `🚨 ${kpi.outOfStockCount} item stok kosong (0)` : 'Barang perlu restock'}
          </p>
        </div>

        {/* Penjualan Bulan Ini */}
        <div 
          onClick={() => navigate('/transactions/sales')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Omset Berjalan Bulan Ini</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-2xs">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-3 font-mono">{formatRupiah(kpi.salesThisMonth)}</p>
          <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight size={14} /> Total penjualan berjalan
          </p>
        </div>
      </div>

      {/* 2 Action Queues: Outbound & Inbound */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Antrean Pesanan Keluar (Outbound SO) */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                <Truck size={15} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Pesanan Menunggu Pengiriman (SO)</h3>
                <p className="text-[11px] text-zinc-500">{pendingShipments.length} pesanan aktif belum dikirim</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/delivery-manifest')}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Buat Manifest
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {pendingShipments.length > 0 ? (
              pendingShipments.map(s => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-zinc-900">{s.soNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-sans font-bold">
                        {s.status}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-0.5">{s.customer?.name || 'Customer Retail'} • {s.soDate}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/transactions/sales-orders/${s.id}`)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    Buka SO
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs">Tidak ada antrean pesanan keluar</div>
            )}
          </div>
        </div>

        {/* Antrean Barang Masuk (Inbound PO) */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                <ShoppingBag size={15} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Penerimaan Barang Masuk (PO)</h3>
                <p className="text-[11px] text-zinc-500">{pendingPurchases.length} PO aktif menunggu kedatangan fisik</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transactions/purchases')}
              className="text-xs font-bold text-sky-600 hover:underline cursor-pointer"
            >
              Lihat PO
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {pendingPurchases.length > 0 ? (
              pendingPurchases.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-zinc-900">{p.poNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 font-sans font-bold">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-0.5">{p.supplier?.name || 'Supplier'} • {p.poDate}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/transactions/purchase-orders/${p.id}`)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    Buka PO
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs">Tidak ada antrean barang masuk</div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Items Alert Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 text-base">Peringatan Stok Menipis & Butuh Restock</h3>
              <p className="text-xs text-zinc-500">Barang dengan sisa stok di bawah batas aman</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
          >
            Lihat Katalog Barang
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 border-y border-zinc-200 font-bold text-zinc-500 uppercase">
              <tr>
                <th className="py-2.5 px-3">Kode SKU</th>
                <th className="py-2.5 px-3">Nama Produk</th>
                <th className="py-2.5 px-3">Supplier Utama</th>
                <th className="py-2.5 px-3 text-center">Stok Reguler</th>
                <th className="py-2.5 px-3 text-center">Stok Bonus</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono">
              {lowStockItems.slice(0, 8).map(item => (
                <tr key={item.id} className="hover:bg-zinc-50/80">
                  <td className="py-2.5 px-3 font-bold text-zinc-900">{item.sku}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-zinc-800">{item.name}</td>
                  <td className="py-2.5 px-3 font-sans text-zinc-600">{item.supplier}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-zinc-900">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                    {item.bonusStock} {item.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.currentStock === 0
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {item.currentStock === 0 ? 'HABIS (0)' : 'MENIPIS'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. STAFF (ADMIN GUDANG & LOGISTIK) DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function StaffWarehouseDashboardView({ data, navigate }) {
  const kpi = data.kpi || {};
  const pendingShipments = data.pendingShipments || [];
  const pendingPurchases = data.pendingPurchases || [];
  const lowStockItems = data.lowStockItems || [];
  const recentDeliveries = data.recentDeliveries || [];

  return (
    <div className="space-y-8">
      {/* 4 Warehouse Physical KPI Cards (Aman dari data profit/HPP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Stok Fisik Reguler */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Fisik Stok Reguler</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Boxes size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-950 mt-3 font-mono">{formatNumber(kpi.totalPhysicalRegularStock)}</p>
          <p className="mt-2 text-xs text-zinc-500 font-semibold">{kpi.totalProductsCount || 0} katalog barang aktif</p>
        </div>

        {/* Total Fisik Stok Bonus */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Fisik Stok Bonus</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Sparkles size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-900 mt-3 font-mono">{formatNumber(kpi.totalPhysicalBonusStock)}</p>
          <p className="mt-2 text-xs text-emerald-700 font-semibold">Tier persediaan bonus/free goods</p>
        </div>

        {/* SO Siap Kirim */}
        <div 
          onClick={() => navigate('/delivery-manifest')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Antrean Siap Kirim (SO)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-2xs">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-900 mt-3 font-mono">{kpi.pendingShipmentCount || 0}</p>
          <p className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1">
            <Clock size={13} /> Perlu dimuat & dibuat Surat Jalan
          </p>
        </div>

        {/* PO Menunggu Penerimaan */}
        <div 
          onClick={() => navigate('/transactions/purchases')}
          className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-sky-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Barang Masuk (PO)</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shadow-2xs">
              <ClipboardCheck size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-sky-900 mt-3 font-mono">{kpi.pendingPurchaseCount || 0}</p>
          <p className="mt-2 text-xs text-sky-700 font-semibold flex items-center gap-1">
            <ArrowDownRight size={13} /> Menunggu verifikasi fisik masuk
          </p>
        </div>
      </div>

      {/* Warehouse Logistics Hub (Grid 2 Kolom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outbound Shipping Queue */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                <Truck size={15} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Pesanan Siap Dikemas & Dikirim (SO)</h3>
                <p className="text-[11px] text-zinc-500">Antrean barang yang harus disiapkan gudang</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/delivery-manifest')}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Manifest Armada
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {pendingShipments.length > 0 ? (
              pendingShipments.map(s => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-zinc-900">{s.soNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-sans font-bold">
                        {s.status}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-0.5">{s.customer?.name || 'Customer'} • {s.customer?.address || 'Alamat belum diatur'}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/transactions/sales-orders/${s.id}`)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    Kirim (SJ)
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs">Tidak ada antrean pesanan keluar</div>
            )}
          </div>
        </div>

        {/* Inbound Receiving Queue */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 font-bold">
                <ClipboardCheck size={15} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Penerimaan Barang Masuk (PO)</h3>
                <p className="text-[11px] text-zinc-500">Cek fisik dan alokasikan ke gudang</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transactions/purchases')}
              className="text-xs font-bold text-sky-600 hover:underline cursor-pointer"
            >
              Semua PO
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {pendingPurchases.length > 0 ? (
              pendingPurchases.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-zinc-900">{p.poNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 font-sans font-bold">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-zinc-600 mt-0.5">{p.supplier?.name || 'Supplier'} • {p.poDate}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/transactions/purchase-orders/${p.id}`)}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold rounded-lg text-[11px] cursor-pointer"
                  >
                    Terima Barang
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-zinc-400 text-xs">Tidak ada antrean barang masuk</div>
            )}
          </div>
        </div>
      </div>

      {/* Warehouse Quick Actions & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Operational Shortcuts */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5">
            <Layers size={15} className="text-indigo-600" /> Navigasi & Pintasan Gudang
          </h3>
          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={() => navigate('/stock-ledger')}
              className="p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-between text-left cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <History size={16} className="text-indigo-600" />
                <div>
                  <p className="font-bold text-zinc-900 text-xs">Kartu Stok Barang</p>
                  <p className="text-[10px] text-zinc-500">Mutasi masuk & keluar real-time</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-zinc-400" />
            </button>

            <button
              onClick={() => navigate('/stock-opname')}
              className="p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-between text-left cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardCheck size={16} className="text-emerald-600" />
                <div>
                  <p className="font-bold text-zinc-900 text-xs">Stock Opname Fisik</p>
                  <p className="text-[10px] text-zinc-500">Penyesuaian stok riil & sistem</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-zinc-400" />
            </button>

            <button
              onClick={() => navigate('/stock-transfers')}
              className="p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-between text-left cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <ArrowLeftRight size={16} className="text-amber-600" />
                <div>
                  <p className="font-bold text-zinc-900 text-xs">Mutasi Antar Gudang</p>
                  <p className="text-[10px] text-zinc-500">Pindahkan stok antar cabang/gudang</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Low Stock Alerts Table (Without Prices) */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600" />
              <h3 className="font-bold text-zinc-900 text-sm">Stok Gudang Menipis / Perlu Diisi</h3>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Katalog
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 border-y border-zinc-200 font-bold text-zinc-500 uppercase">
                <tr>
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">Nama Produk</th>
                  <th className="py-2 px-3 text-center">Fisik Reguler</th>
                  <th className="py-2 px-3 text-center">Fisik Bonus</th>
                  <th className="py-2 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono">
                {lowStockItems.slice(0, 6).map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50/80">
                    <td className="py-2.5 px-3 font-bold text-zinc-900">{item.sku}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-zinc-800">{item.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-zinc-900">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                      {item.bonusStock} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.currentStock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-50 text-amber-800'
                      }`}>
                        {item.currentStock === 0 ? 'HABIS (0)' : 'MENIPIS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

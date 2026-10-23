import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import { useTaxMode } from '../context/TaxModeContext';
import { 
  TrendingUp, 
  Scale, 
  BookOpen, 
  Package, 
  Printer, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  BarChart2,
  Truck,
  DollarSign,
  ShoppingCart,
  Percent,
  FileText,
  UserCheck,
  History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permission';
import SearchSelect from '../components/SearchSelect';
import DeliveryManifestModal from '../components/transactions/DeliveryManifestModal';
import { formatStockLedgerDisplay } from '../utils/format';

const Reports = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Granular Modular Permission Checks for Reports
  const canReadFinance = hasPermission(user, 'reports', 'finance');
  const canReadSales = hasPermission(user, 'reports', 'sales');
  const canReadPurchase = hasPermission(user, 'reports', 'purchase');
  const canReadInventory = hasPermission(user, 'reports', 'inventory');

  // Define All Available Reports dynamically grouped by Module
  const reportCategories = [
    {
      id: 'FINANCE',
      name: 'Laporan Keuangan',
      icon: DollarSign,
      show: canReadFinance,
      reports: [
        { id: 'LABARUGI', name: 'Laba Rugi Operasional', icon: TrendingUp, desc: 'Pendapatan, HPP, & Beban operasional' },
        { id: 'NERACA', name: 'Neraca (Balance Sheet)', icon: Scale, desc: 'Aktiva, Kewajiban, & Ekuitas perusahaan' },
        { id: 'BUKUBESAR', name: 'Buku Besar (General Ledger)', icon: BookOpen, desc: 'Mutasi baris jurnal per akun' },
        { id: 'TAX_REPORT', name: 'Rekap Pajak (PPN)', icon: FileText, desc: 'Rekap PPN Masukan, PPN Keluaran, & Kurang/Lebih Bayar' }
      ]
    },
    {
      id: 'SALES',
      name: 'Laporan Penjualan',
      icon: ShoppingCart,
      show: canReadSales,
      reports: [
        { id: 'SALES_DETAILS', name: 'Rincian Penjualan', icon: ArrowUpRight, desc: 'Daftar SO, customer, item, & pajak' },
        { id: 'SALES_COMMISSION', name: 'Komisi Salesperson', icon: Percent, desc: 'Akumulasi komisi sales atas transaksi selesai' },
        { id: 'DRIVER_INVOICES', name: 'Laporan Invoice per Driver', icon: Truck, desc: 'Rekap surat jalan, nilai invoice, & barang terkirim per supir/armada' }
      ]
    },
    {
      id: 'PURCHASE',
      name: 'Laporan Pembelian',
      icon: ShoppingCart,
      show: canReadPurchase,
      reports: [
        { id: 'PURCHASE_DETAILS', name: 'Rincian Pembelian', icon: ArrowDownLeft, desc: 'Daftar PO, supplier, item, & status' }
      ]
    },
    {
      id: 'INVENTORY',
      name: 'Laporan Persediaan',
      icon: Package,
      show: canReadInventory,
      reports: [
        { id: 'INVENTORY_VALUATION', name: 'Nilai Persediaan (FIFO)', icon: DollarSign, desc: 'Total nilai persediaan barang berdasarkan harga beli' },
        { id: 'STOCK_MOVEMENTS', name: 'Mutasi Kartu Stok', icon: History, desc: 'Log keluar masuk barang secara real-time' }
      ]
    }
  ];

  // Filter out unauthorized categories
  const allowedCategories = reportCategories.filter(c => c.show);

  // Set default selected report from the first available permitted report
  const firstAvailableReport = allowedCategories[0]?.reports[0]?.id || '';

  // Read URL query parameters for navtab and filter state
  const { taxMode, taxStatusQuery } = useTaxMode();
  const selectedReport = searchParams.get('tab') || firstAvailableReport;
  const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
  const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0];
  const selectedAccount = searchParams.get('accountId') || '';
  const selectedProduct = searchParams.get('productId') || '';
  const selectedDriver = searchParams.get('driver') || '';
  const selectedStatus = searchParams.get('status') || '';
  const selectedTaxStatus = searchParams.get('taxStatus') || '';
  const effectiveTaxStatus = selectedTaxStatus || taxStatusQuery || '';

  // Dropdown list states
  const [coa, setCoa] = useState([]);
  const [products, setProducts] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manifestModal, setManifestModal] = useState({ isOpen: false, driverName: '', date: '' });

  // Helper to update search params in URL
  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!next.get('tab')) {
      next.set('tab', selectedReport);
    }
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const handleSelectReport = (reportId) => {
    const next = new URLSearchParams();
    next.set('tab', reportId);
    setSearchParams(next, { replace: true });
  };

  const handleSetQuickDate = (start, end) => {
    const next = new URLSearchParams(searchParams);
    if (!next.get('tab')) next.set('tab', selectedReport);
    next.set('startDate', start);
    next.set('endDate', end);
    setSearchParams(next, { replace: true });
  };

  // Format products list for SearchSelect
  const productOptions = React.useMemo(() => {
    return [
      { value: '', label: 'Semua Barang', sublabel: 'Tampilkan seluruh mutasi barang' },
      ...products.map(p => ({
        value: p.id.toString(),
        label: p.name,
        sublabel: `SKU: ${p.sku} | Satuan: ${p.unit || 'PCS'}`
      }))
    ];
  }, [products]);

  // Load dropdown metadata based on active selections
  useEffect(() => {
    if (canReadFinance && selectedReport === 'BUKUBESAR') {
      api.get('/chart-of-accounts?limit=100').then(res => setCoa(res.data.data || [])).catch(e => console.error(e));
    }
    if (canReadInventory && selectedReport === 'STOCK_MOVEMENTS') {
      api.get('/products?limit=100').then(res => setProducts(res.data.data || [])).catch(e => console.error(e));
    }
    if (selectedReport === 'DRIVER_INVOICES') {
      api.get('/drivers?limit=100').then(res => setDriversList(res.data.data || [])).catch(e => console.error(e));
    }
  }, [selectedReport, canReadFinance, canReadInventory]);

  // Pull report handler
  const fetchReport = async () => {
    if (!selectedReport) return;
    setLoading(true);
    setError('');
    setReportData(null);
    try {
      let res;
      if (selectedReport === 'LABARUGI') {
        res = await api.get(`/reports/income-statement?startDate=${startDate}&endDate=${endDate}`);
      } else if (selectedReport === 'NERACA') {
        res = await api.get(`/reports/balance-sheet?date=${asOfDate}`);
      } else if (selectedReport === 'BUKUBESAR') {
        let url = `/reports/general-ledger?startDate=${startDate}&endDate=${endDate}`;
        if (selectedAccount) url += `&accountId=${selectedAccount}`;
        res = await api.get(url);
      } else if (selectedReport === 'INVENTORY_VALUATION') {
        res = await api.get(`/reports/inventory-valuation`);
      } else if (selectedReport === 'SALES_DETAILS') {
        let url = `/reports/sales-details?startDate=${startDate}&endDate=${endDate}`;
        if (effectiveTaxStatus) url += `&taxStatus=${effectiveTaxStatus}`;
        res = await api.get(url);
      } else if (selectedReport === 'PURCHASE_DETAILS') {
        res = await api.get(`/reports/purchase-details?startDate=${startDate}&endDate=${endDate}`);
      } else if (selectedReport === 'SALES_COMMISSION') {
        res = await api.get(`/reports/sales-commission?startDate=${startDate}&endDate=${endDate}`);
      } else if (selectedReport === 'STOCK_MOVEMENTS') {
        let url = `/reports/stock-movements?startDate=${startDate}&endDate=${endDate}`;
        if (selectedProduct) url += `&productId=${selectedProduct}`;
        res = await api.get(url);
      } else if (selectedReport === 'DRIVER_INVOICES') {
        let url = `/reports/driver-invoices?startDate=${startDate}&endDate=${endDate}`;
        if (selectedDriver) url += `&driverName=${encodeURIComponent(selectedDriver)}`;
        if (selectedStatus) url += `&status=${selectedStatus}`;
        res = await api.get(url);
      } else if (selectedReport === 'TAX_REPORT') {
        res = await api.get(`/reports/tax-report?startDate=${startDate}&endDate=${endDate}`);
      }
      setReportData({ type: selectedReport, data: res.data.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyusun data laporan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, startDate, endDate, asOfDate, selectedAccount, selectedProduct, selectedDriver, selectedStatus, selectedTaxStatus, taxMode]);

  const handlePrint = () => {
    window.print();
  };

  // Safe checks if user has absolutely no read access to any report
  if (allowedCategories.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center shadow-sm">
        <div className="flex flex-col items-center space-y-4 max-w-sm mx-auto">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Akses Ditolak</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Anda tidak memiliki izin (permission) untuk mengakses laporan modul kerja apapun. Silakan hubungi Administrator Anda.
          </p>
        </div>
      </div>
    );
  }

  const activeReportObj = allowedCategories
    .flatMap(c => c.reports)
    .find(r => r.id === selectedReport);

  // --- Rendering helper blocks for each report ---

  const renderIncomeStatement = () => {
    if (!reportData || reportData.type !== 'LABARUGI') return null;
    const { summary, details } = reportData.data;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 font-semibold">Total Pendapatan</p>
            <p className="text-lg font-bold text-indigo-600 font-mono mt-1">
              Rp{parseFloat(summary.totalRevenue || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 font-semibold">Total HPP</p>
            <p className="text-lg font-bold text-zinc-700 font-mono mt-1">
              Rp{parseFloat(summary.totalHpp || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 font-semibold">Laba Kotor</p>
            <p className="text-lg font-bold text-emerald-600 font-mono mt-1">
              Rp{parseFloat(summary.grossProfit || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 font-semibold">Laba Bersih</p>
            <p className="text-lg font-bold text-indigo-700 font-mono mt-1">
              Rp{parseFloat(summary.netProfit || 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
              <tr className="border-b border-zinc-200 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3">Kode Akun</th>
                <th className="px-6 py-3">Nama Akun</th>
                <th className="px-6 py-3 text-right">Debit</th>
                <th className="px-6 py-3 text-right">Kredit</th>
                <th className="px-6 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
              <tr className="bg-zinc-50/50"><td colSpan="5" className="px-6 py-2.5 font-bold text-zinc-900">Pendapatan Operasional</td></tr>
              {details.revenue.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-4 text-center text-zinc-400 text-xs">Tidak ada pendapatan</td></tr>
              ) : details.revenue.map(row => (
                <tr key={row.id}>
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-semibold text-indigo-600">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}

              <tr className="bg-zinc-50/50"><td colSpan="5" className="px-6 py-2.5 font-bold text-zinc-900">Harga Pokok Penjualan (HPP)</td></tr>
              {details.costOfGoodsSold.map(row => (
                <tr key={row.id}>
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-semibold text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}

              <tr className="bg-zinc-50/50"><td colSpan="5" className="px-6 py-2.5 font-bold text-zinc-900">Beban Operasional</td></tr>
              {details.expenses.map(row => (
                <tr key={row.id}>
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-semibold text-rose-600">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!reportData || reportData.type !== 'NERACA') return null;
    const { summary, details } = reportData.data;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
          <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4">
            <p className="text-xs text-indigo-700 font-bold uppercase">Total Aset (Aktiva)</p>
            <p className="text-base font-bold text-indigo-800 font-mono mt-1">
              Rp{parseFloat(summary.totalAssets || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
            <p className="text-xs text-zinc-600 font-bold uppercase">Total Liabilitas</p>
            <p className="text-base font-bold text-zinc-700 font-mono mt-1">
              Rp{parseFloat(summary.totalLiabilities || 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-xs text-emerald-700 font-bold uppercase">Total Ekuitas</p>
            <p className="text-base font-bold text-emerald-800 font-mono mt-1">
              Rp{parseFloat(summary.totalEquity || 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
          {/* Assets */}
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col max-h-[calc(100vh-24rem)]">
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex justify-between items-center shrink-0">
              <span className="font-bold text-zinc-900 text-xs uppercase">Aktiva (Aset)</span>
              <span className="text-xs font-bold text-indigo-600 font-mono">Rp{parseFloat(summary.totalAssets).toLocaleString('id-ID')}</span>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
                  <tr className="text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-semibold">
                    <th className="px-4 py-2">Kode</th>
                    <th className="px-4 py-2">Nama Akun</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                  {details.assets.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-mono text-zinc-400">{row.accountCode}</td>
                      <td className="px-4 py-2 font-bold text-zinc-900">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col max-h-[calc(100vh-24rem)]">
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex justify-between items-center shrink-0">
              <span className="font-bold text-zinc-900 text-xs uppercase">Kewajiban & Modal</span>
              <span className="text-xs font-bold text-emerald-600 font-mono">Rp{parseFloat(summary.totalLiabilitiesAndEquity).toLocaleString('id-ID')}</span>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
                  <tr className="text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-semibold">
                    <th className="px-4 py-2">Kode</th>
                    <th className="px-4 py-2">Nama Akun</th>
                    <th className="px-4 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                  <tr className="bg-zinc-50/40"><td colSpan="3" className="px-4 py-1.5 font-bold text-zinc-900">Kewajiban</td></tr>
                  {details.liabilities.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-mono text-zinc-400">{row.accountCode}</td>
                      <td className="px-4 py-2 text-zinc-900">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/40"><td colSpan="3" className="px-4 py-1.5 font-bold text-zinc-900">Ekuitas</td></tr>
                  {details.equity.map(row => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 font-mono text-zinc-400">{row.accountCode}</td>
                      <td className="px-4 py-2 font-bold text-zinc-900">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-indigo-600 font-bold">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGeneralLedger = () => {
    if (!reportData || reportData.type !== 'BUKUBESAR') return null;
    const { beginningBalance, accountBalancesMap, entries } = reportData.data;

    // Group items by account
    const accountsGroup = {};

    entries.forEach(entry => {
      entry.items.forEach(item => {
        const accId = item.accountId || item.account?.id;
        if (!accId) return;

        if (!accountsGroup[accId]) {
          const accInfo = item.account || (accountBalancesMap && accountBalancesMap[accId]) || {};
          const begBal = (accountBalancesMap && accountBalancesMap[accId]?.beginningBalance) !== undefined
            ? accountBalancesMap[accId].beginningBalance
            : (selectedAccount ? beginningBalance : 0);

          accountsGroup[accId] = {
            id: accId,
            accountCode: accInfo.accountCode || item.account?.accountCode || '—',
            accountName: accInfo.accountName || item.account?.accountName || '—',
            accountType: accInfo.accountType || item.account?.accountType || 'ASSET',
            beginningBalance: parseFloat(begBal) || 0,
            items: [],
            totalDebit: 0,
            totalCredit: 0
          };
        }

        const amt = parseFloat(item.amount) || 0;
        const isDebit = item.type === 'DEBIT';
        if (isDebit) {
          accountsGroup[accId].totalDebit += amt;
        } else {
          accountsGroup[accId].totalCredit += amt;
        }

        const refText = entry.entryNumber || (entry.referenceType ? `${entry.referenceType} #${entry.referenceId}` : '—');

        accountsGroup[accId].items.push({
          date: entry.transactionDate,
          number: refText,
          description: entry.description,
          debit: isDebit ? amt : 0,
          credit: !isDebit ? amt : 0,
          type: item.type,
          amount: amt
        });
      });
    });

    const accountList = Object.values(accountsGroup).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    if (accountList.length === 0) {
      return (
        <div className="border border-zinc-200 rounded-2xl bg-white p-8 text-center text-zinc-400">
          Tidak ada mutasi buku besar pada periode yang dipilih
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {accountList.map(acc => {
          let runningBalance = acc.beginningBalance;
          const isAssetOrExpense = acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE';

          return (
            <div key={acc.id} className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
              {/* Account Header */}
              <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                    {acc.accountCode}
                  </span>
                  <span className="font-bold text-sm text-zinc-900">{acc.accountName}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200/70 text-zinc-600 uppercase tracking-wider">
                    {acc.accountType}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-zinc-500 font-medium">Saldo Awal: </span>
                  <span className="font-mono font-bold text-zinc-900">
                    Rp{acc.beginningBalance.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100/50 text-left font-semibold text-zinc-500 uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-2">Tanggal</th>
                      <th className="px-4 py-2">Referensi</th>
                      <th className="px-4 py-2">Deskripsi Transaksi</th>
                      <th className="px-4 py-2 text-right">Debit</th>
                      <th className="px-4 py-2 text-right">Kredit</th>
                      <th className="px-4 py-2 text-right">Saldo Berjalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                    {acc.items.map((row, idx) => {
                      if (row.debit > 0) {
                        runningBalance += isAssetOrExpense ? row.debit : -row.debit;
                      } else {
                        runningBalance += isAssetOrExpense ? -row.credit : row.credit;
                      }

                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-2 font-mono text-zinc-500 whitespace-nowrap">{new Date(row.date).toLocaleDateString('id-ID')}</td>
                          <td className="px-4 py-2 font-mono font-bold text-indigo-600">{row.number}</td>
                          <td className="px-4 py-2 text-zinc-600">{row.description}</td>
                          <td className="px-4 py-2 text-right font-mono text-emerald-700">
                            {row.debit > 0 ? `Rp${row.debit.toLocaleString('id-ID')}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-rose-700">
                            {row.credit > 0 ? `Rp${row.credit.toLocaleString('id-ID')}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-zinc-900">
                            Rp{runningBalance.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50/70 font-bold text-zinc-900 text-xs">
                      <td colSpan="3" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                        Total & Saldo Akhir:
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700">
                        Rp{acc.totalDebit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-700">
                        Rp{acc.totalCredit.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-indigo-700 font-extrabold">
                        Rp{runningBalance.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInventoryValuation = () => {
    if (!reportData || reportData.type !== 'INVENTORY_VALUATION') return null;
    const { totalValuation, items } = reportData.data || {};
    return (
      <div className="space-y-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex justify-between items-center text-xs">
          <span className="font-semibold text-zinc-700">Total Nilai Persediaan Barang (FIFO):</span>
          <span className="font-bold text-indigo-600 font-mono text-sm">Rp{Number(totalValuation || 0).toLocaleString('id-ID')}</span>
        </div>
        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
              <tr className="border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">Nama Barang</th>
                <th className="px-4 py-2.5">Satuan</th>
                <th className="px-4 py-2.5 text-right">Stok Aktif</th>
                <th className="px-4 py-2.5 text-right">Harga Beli</th>
                <th className="px-4 py-2.5 text-right">Nilai Barang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {(items || []).map(row => (
                <tr key={row.id}>
                  <td className="px-4 py-2 font-mono text-zinc-500">{row.sku}</td>
                  <td className="px-4 py-2 font-bold text-zinc-900">{row.name}</td>
                  <td className="px-4 py-2 uppercase text-zinc-400">{row.unit}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-zinc-800">{Number(row.totalStock || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono">Rp{Number(row.purchasePrice || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600">Rp{Number(row.valuation || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSalesDetails = () => {
    if (!reportData || reportData.type !== 'SALES_DETAILS') return null;
    const data = reportData.data || [];
    
    // Compute aggregations
    const grandTotal = data.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);
    const totalDpp = data.reduce((sum, row) => sum + parseFloat(row.subtotal || 0), 0);
    const totalTax = data.reduce((sum, row) => sum + parseFloat(row.taxAmount || 0), 0);

    const pkpRows = data.filter(row => Boolean((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax));
    const nonPkpRows = data.filter(row => !Boolean((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax));

    const pkpTotal = pkpRows.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);
    const nonPkpTotal = nonPkpRows.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);

    return (
      <div className="space-y-4">
        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block">Total Omset Penjualan</span>
            <span className="font-bold text-indigo-600 font-mono text-base block">Rp{grandTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">{data.length} transaksi penjualan</span>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-semibold text-indigo-800 block">Penjualan PKP (Faktur Pajak)</span>
            <span className="font-bold text-indigo-900 font-mono text-base block">Rp{pkpTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-indigo-600 font-medium">{pkpRows.length} transaksi PKP</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-semibold text-emerald-800 block">Penjualan Non-PKP</span>
            <span className="font-bold text-emerald-900 font-mono text-base block">Rp{nonPkpTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-600 font-medium">{nonPkpRows.length} transaksi Non-PKP</span>
          </div>

          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3.5 space-y-1">
            <span className="text-xs font-semibold text-amber-800 block">Rata-rata Nilai SO</span>
            <span className="font-bold text-amber-900 font-mono text-base block">Rp{(data.length > 0 ? Math.round(grandTotal / data.length) : 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-amber-600 font-medium">DPP: Rp{totalDpp.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
              <tr className="border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">No. SO</th>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5 text-center">Tipe Penjualan</th>
                <th className="px-4 py-2.5">Rincian Barang</th>
                <th className="px-4 py-2.5 text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-zinc-400">Tidak ada data penjualan sesuai filter</td></tr>
              ) : data.map(row => {
                const isPkp = Boolean((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.soNumber}</td>
                    <td className="px-4 py-2">{row.soDate}</td>
                    <td className="px-4 py-2 font-semibold text-zinc-900">{row.customer?.name}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPkp 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}>
                        {isPkp ? 'PKP' : 'Non-PKP'}
                      </span>
                    </td>
                    <td className="px-4 py-2 space-y-0.5">
                      {row.items?.map(it => (
                        <div key={it.id} className="text-zinc-500 font-normal">
                          - {it.product?.name} ({it.qty} {it.product?.unit || 'PCS'}) @ Rp{parseFloat(it.price).toLocaleString('id-ID')}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{parseFloat(row.subtotal).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-500">Rp{parseFloat(row.taxAmount).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600">Rp{parseFloat(row.totalAmount).toLocaleString('id-ID')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPurchaseDetails = () => {
    if (!reportData || reportData.type !== 'PURCHASE_DETAILS') return null;
    const data = reportData.data;
    const grandTotal = data.reduce((sum, row) => sum + parseFloat(row.totalAmount), 0);
    return (
      <div className="space-y-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex justify-between items-center text-xs">
          <span className="font-semibold text-zinc-700">Total Pengeluaran Pembelian:</span>
          <span className="font-bold text-indigo-600 font-mono text-sm">Rp{grandTotal.toLocaleString('id-ID')}</span>
        </div>
        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
              <tr className="border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">No. PO</th>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Supplier</th>
                <th className="px-4 py-2.5">Rincian Barang</th>
                <th className="px-4 py-2.5 text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right">Pajak (PPN)</th>
                <th className="px-4 py-2.5 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-zinc-400">Tidak ada data pembelian</td></tr>
              ) : data.map(row => (
                <tr key={row.id}>
                  <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.poNumber}</td>
                  <td className="px-4 py-2">{row.poDate}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900">{row.supplier?.name}</td>
                  <td className="px-4 py-2 space-y-0.5">
                    {row.items?.map(it => (
                      <div key={it.id} className="text-zinc-500 font-normal">
                        - {it.product?.name} ({it.qty} {it.product?.unit}) @ Rp{parseFloat(it.price).toLocaleString('id-ID')}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{parseFloat(row.subtotal).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-500">Rp{parseFloat(row.taxAmount).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600">Rp{parseFloat(row.totalAmount).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSalesCommission = () => {
    if (!reportData || reportData.type !== 'SALES_COMMISSION') return null;
    const data = reportData.data;
    const grandCommission = data.reduce((sum, row) => sum + row.totalCommission, 0);
    return (
      <div className="space-y-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex justify-between items-center text-xs">
          <span className="font-semibold text-zinc-700">Total Akumulasi Pengeluaran Komisi Sales:</span>
          <span className="font-bold text-indigo-600 font-mono text-sm">Rp{grandCommission.toLocaleString('id-ID')}</span>
        </div>
        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
              <tr className="border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Nama Salesperson</th>
                <th className="px-4 py-2.5 text-center">Rate Komisi (%)</th>
                <th className="px-4 py-2.5 text-center">Jumlah Invoice Selesai</th>
                <th className="px-4 py-2.5 text-right">Total Akumulasi Penjualan</th>
                <th className="px-4 py-2.5 text-right">Estimasi Komisi Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-zinc-400">Tidak ada data sales terdaftar</td></tr>
              ) : data.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 font-bold text-zinc-900">
                    <div className="flex items-center space-x-2">
                      {row.code && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600 font-bold">
                          {row.code}
                        </span>
                      )}
                      <span>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center font-mono">{row.commissionRate}%</td>
                  <td className="px-4 py-2 text-center font-mono font-bold text-zinc-800">{row.ordersCount}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{Number(row.totalSales || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600">Rp{Number(row.totalCommission || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStockMovements = () => {
    if (!reportData || reportData.type !== 'STOCK_MOVEMENTS') return null;
    const data = reportData.data || [];
    return (
      <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-[calc(100vh-23rem)] overflow-y-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-50 shadow-2xs">
            <tr className="border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-2.5">Waktu Pencatatan</th>
              <th className="px-4 py-2.5">Gudang</th>
              <th className="px-4 py-2.5">Nama Barang</th>
              <th className="px-4 py-2.5 text-center">Tipe Transaksi</th>
              <th className="px-4 py-2.5 text-center">Mutasi Qty</th>
              <th className="px-4 py-2.5">Referensi Dokumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
            {data.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-zinc-400">Tidak ada mutasi kartu stok barang</td></tr>
            ) : data.map((row) => {
              const isPlus = row.type.includes('IN') || row.type.includes('RETURN_IN') || row.type.includes('ADJUSTMENT_IN');
              const display = formatStockLedgerDisplay(row.qty, row.product, isPlus);
              return (
                <tr key={row.id}>
                  <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-zinc-800">{row.warehouse?.name || 'Gudang Utama'}</td>
                  <td className="px-4 py-2 font-bold text-zinc-900">
                    <span className="font-mono text-zinc-400 mr-1">[{row.product?.sku}]</span>
                    {row.product?.name}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                      display.isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`font-mono font-bold block ${display.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {display.primaryText}
                    </span>
                    {display.secondaryText && (
                      <span className="text-[10px] text-zinc-400 font-mono block">
                        {display.secondaryText}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-zinc-500">{row.referenceType} (ID: {row.referenceId})</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDriverInvoices = () => {
    if (!reportData || reportData.type !== 'DRIVER_INVOICES') return null;
    const { summary, driverStats, deliveries } = reportData.data || { summary: {}, driverStats: [], deliveries: [] };

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Surat Jalan</span>
            <p className="text-xl font-extrabold text-zinc-900 mt-1 font-mono">{summary.totalDeliveries || 0} Pengiriman</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{summary.totalItemsQty || 0} pcs total barang</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Nilai Tagihan (Invoice)</span>
            <p className="text-xl font-extrabold text-indigo-600 mt-1 font-mono">Rp{Number(summary.totalInvoiceAmount || 0).toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Dari seluruh pengiriman driver</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Tagihan Lunas (Paid)</span>
            <p className="text-xl font-extrabold text-emerald-600 mt-1 font-mono">Rp{Number(summary.totalPaidAmount || 0).toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">Pembayaran terverifikasi</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Belum Lunas / Piutang</span>
            <p className="text-xl font-extrabold text-amber-600 mt-1 font-mono">Rp{Number(summary.totalUnpaidAmount || 0).toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-amber-700/80 mt-0.5">Menunggu pelunasan</p>
          </div>
        </div>

        {/* Tabel 1: Rekapitulasi per Driver */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck size={15} className="text-indigo-600" />
              <span>Rekapitulasi Kinerja per Driver & Armada</span>
            </h3>
            <button
              onClick={() => setManifestModal({ isOpen: true, driverName: selectedDriver || '', date: startDate || '' })}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Truck size={14} />
              <span>Cetak Surat Pengiriman (Manifest 1 Mobil)</span>
            </button>
          </div>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-2.5">Nama Driver</th>
                  <th className="px-4 py-2.5">No. Polisi</th>
                  <th className="px-4 py-2.5 text-center">Total Pengiriman</th>
                  <th className="px-4 py-2.5 text-center">Total Qty (Pcs)</th>
                  <th className="px-4 py-2.5 text-right">Total Tagihan Invoice</th>
                  <th className="px-4 py-2.5 text-right text-emerald-700">Sudah Lunas</th>
                  <th className="px-4 py-2.5 text-right text-amber-700">Belum Lunas</th>
                  <th className="px-4 py-2.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {driverStats.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada data driver pada periode ini</td></tr>
                ) : driverStats.map((ds, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-2.5 font-bold text-zinc-900">{ds.driverName}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-600 font-bold uppercase">{ds.vehicleNumber}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-zinc-800">{ds.deliveriesCount} SJ</td>
                    <td className="px-4 py-2.5 text-center font-mono text-zinc-700">{Number(ds.totalQty || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700">Rp{Number(ds.totalInvoiceAmount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">Rp{Number(ds.paidAmount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-600">Rp{Number(ds.unpaidAmount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => setManifestModal({ isOpen: true, driverName: ds.driverName, date: startDate || '' })}
                        className="p-1 px-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-bold flex items-center space-x-1 mx-auto cursor-pointer"
                        title="Cetak Dokumen Manifest Mobil Driver Ini"
                      >
                        <Printer size={12} />
                        <span>Manifest</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel 2: Rincian Surat Jalan & Invoice per Pengiriman */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
            <Truck size={15} className="text-indigo-600" />
            <span>Rincian Surat Jalan, Invoice, & Barang yang Diantar</span>
          </h3>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-left font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-2.5">No. Surat Jalan & Tanggal</th>
                  <th className="px-4 py-2.5">Driver / No. Polisi</th>
                  <th className="px-4 py-2.5">Customer / Tujuan</th>
                  <th className="px-4 py-2.5">No. Invoice & Status</th>
                  <th className="px-4 py-2.5">Rincian Barang Terkirim</th>
                  <th className="px-4 py-2.5 text-right">Nilai Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {deliveries.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-zinc-400">Tidak ada pengiriman yang ditemukan untuk filter ini</td></tr>
                ) : deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-50/50 align-top">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-zinc-900 block">{d.deliveryNumber}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {new Date(d.deliveryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-zinc-800 block">{d.driverName}</span>
                      {d.vehicleNumber !== '—' && (
                        <span className="font-mono text-[10px] text-zinc-500 uppercase font-bold">{d.vehicleNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-zinc-900 block">{d.contactName}</span>
                      <span className="text-[10px] text-zinc-400 block">{d.orderNumber}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-indigo-700 block">{d.invoiceNumber}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.2 text-[9px] font-extrabold rounded mt-0.5 ${
                        d.invoiceStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {d.invoiceStatus === 'PAID' ? 'LUNAS' : 'BELUM LUNAS'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 space-y-1">
                      {(d.items || []).map((it, itIdx) => (
                        <div key={itIdx} className="text-[11px] text-zinc-600">
                          • <span className="font-medium text-zinc-900">{it.name}</span>{' '}
                          <span className="font-mono font-bold text-zinc-700">({it.qty} {it.unit})</span>
                        </div>
                      ))}
                      {(!d.items || d.items.length === 0) && (
                        <span className="text-[11px] text-zinc-400 italic">Tidak ada rincian item</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                      Rp{Number(d.invoiceAmount || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTaxReport = () => {
    if (!reportData || reportData.type !== 'TAX_REPORT') return null;
    const { summary, outputTax = [], inputTax = [] } = reportData.data || {};

    const netPayable = summary?.netTaxPayable || 0;
    const isKurangBayar = netPayable > 0;

    return (
      <div className="space-y-6">
        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-1">
            <span className="text-xs font-semibold text-indigo-800 block">PPN Keluaran (Penjualan)</span>
            <span className="font-bold text-indigo-900 font-mono text-lg block">Rp{Number(summary?.totalPpnKeluaran || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-indigo-600 font-medium">DPP: Rp{Number(summary?.totalDppSales || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-1">
            <span className="text-xs font-semibold text-emerald-800 block">PPN Masukan (Pembelian)</span>
            <span className="font-bold text-emerald-900 font-mono text-lg block">Rp{Number(summary?.totalPpnMasukan || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-600 font-medium">DPP: Rp{Number(summary?.totalDppPurchases || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className={`border rounded-2xl p-4 space-y-1 ${isKurangBayar ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-teal-50/60 border-teal-200 text-teal-900'}`}>
            <span className="text-xs font-semibold block">{isKurangBayar ? 'Estimasi PPN Kurang Bayar' : 'Estimasi PPN Lebih Bayar'}</span>
            <span className="font-bold font-mono text-lg block">Rp{Math.abs(netPayable).toLocaleString('id-ID')}</span>
            <span className="text-[11px] font-medium block opacity-80">{isKurangBayar ? 'Hutang PPN ke Kas Negara' : 'Kredit Pajak PPN Tersisa'}</span>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-1">
            <span className="text-xs font-semibold text-zinc-600 block">Total Omset Penjualan (Gross)</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block">Rp{Number(summary?.totalGrossSales || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-500 font-medium">{outputTax.length} Transaksi Terhitung</span>
          </div>
        </div>

        {/* Tabel 1: PPN Keluaran (Penjualan) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight size={15} className="text-indigo-600" />
              <span>Rincian PPN Keluaran (Penjualan Pelanggan)</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">{outputTax.length} faktur penjualan</span>
          </div>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-72 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">No. SO</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5 text-center">Tipe</th>
                  <th className="px-4 py-2.5 text-center">Tarif</th>
                  <th className="px-4 py-2.5 text-right">DPP (Dasar Pengenaan)</th>
                  <th className="px-4 py-2.5 text-right font-bold text-indigo-700">PPN Keluaran</th>
                  <th className="px-4 py-2.5 text-right">Total Tagihan (Nett)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {outputTax.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada transaksi penjualan dalam periode ini</td></tr>
                ) : outputTax.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.soNumber}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2 font-semibold text-zinc-900">{row.contactName}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.isPkp 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}>
                        {row.isPkp ? 'PKP' : 'Non-PKP'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center font-mono">{row.taxRate}%</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{Number(row.dpp || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">Rp{Number(row.taxAmount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-900">Rp{Number(row.grossAmount || 0).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel 2: PPN Masukan (Pembelian) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownLeft size={15} className="text-emerald-600" />
              <span>Rincian PPN Masukan (Pembelian Supplier)</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">{inputTax.length} faktur pembelian</span>
          </div>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-sm max-h-72 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">No. PO</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5 text-center">Tipe</th>
                  <th className="px-4 py-2.5 text-center">Tarif</th>
                  <th className="px-4 py-2.5 text-right">DPP (Harga Pokok)</th>
                  <th className="px-4 py-2.5 text-right font-bold text-emerald-700">PPN Masukan</th>
                  <th className="px-4 py-2.5 text-right">Total Pembelian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                {inputTax.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada transaksi pembelian dalam periode ini</td></tr>
                ) : inputTax.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.poNumber}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2 font-semibold text-zinc-900">{row.contactName}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        row.isPkp 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}>
                        {row.isPkp ? 'PKP' : 'Non-PKP'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center font-mono">{row.taxRate}%</td>
                    <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{Number(row.dpp || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">Rp{Number(row.taxAmount || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-900">Rp{Number(row.grossAmount || 0).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Laporan & Analisa Bisnis"
        subtitle="Laporan keuangan Laba Rugi, Penjualan, Pembelian, Hutang-Piutang, dan Valuasi Stok."
        icon={BarChart2}
      />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
      
      {/* LEFT SIDEBAR: Report categories list (Sticky position so it stays pinned in view while scrolling report tables) */}
      <div className="w-full lg:w-72 bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm shrink-0 print:hidden space-y-4 lg:sticky lg:top-36 lg:self-start lg:max-h-[calc(100vh-10.5rem)] lg:overflow-y-auto">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Katalog Laporan ERP</h3>
        <div className="space-y-4">
          {allowedCategories.map(cat => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center space-x-2 text-zinc-800 font-bold text-xs px-2 uppercase tracking-wide">
                  <CatIcon size={14} className="text-indigo-600" />
                  <span>{cat.name}</span>
                </div>
                <div className="space-y-0.5 pl-4 border-l border-zinc-150">
                  {cat.reports.map(rep => {
                    const RepIcon = rep.icon;
                    const isSelected = selectedReport === rep.id;
                    return (
                      <button
                        key={rep.id}
                        onClick={() => handleSelectReport(rep.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-start space-x-2.5 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                        }`}
                      >
                        <RepIcon size={14} className={`shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                        <div className="min-w-0">
                          <p className="font-bold truncate">{rep.name}</p>
                          <p className={`text-[10px] font-normal truncate ${isSelected ? 'text-indigo-100' : 'text-zinc-400'}`}>
                            {rep.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT WORKPLACE: Filter panel, action toolbar & report tables */}
      <div className="flex-1 w-full space-y-6">
        
        {/* Dynamic Print Header (Visible only when printing) */}
        <div className="hidden print:block border-b pb-4 mb-6">
          <h2 className="text-xl font-bold text-zinc-900 uppercase">CoreSync ERP - Accurate Reports Center</h2>
          <p className="text-xs text-zinc-500 font-semibold mt-1">
            Nama Laporan: {activeReportObj ? activeReportObj.name : '—'}
          </p>
          <p className="text-[10px] text-zinc-400 mt-1">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
        </div>

        {/* Toolbar & filters (Sticky position right under PageHeader) */}
        {activeReportObj && (
          <div className="bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-4 print:hidden sticky top-36 z-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950 flex items-center space-x-2">
                  <FileText className="text-indigo-600 w-5 h-5" />
                  <span>{activeReportObj.name}</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">{activeReportObj.desc}</p>
              </div>
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={fetchReport}
                  className="px-3.5 py-2 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Tarik Laporan</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={13} />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>

            {/* Dynamic filter line */}
            <div className="border-t border-zinc-100 pt-3 flex flex-wrap items-center gap-4">
              {/* Date ranges */}
              {selectedReport !== 'INVENTORY_VALUATION' && selectedReport !== 'NERACA' && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">Dari:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => updateParam('startDate', e.target.value)}
                      className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">s/d:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => updateParam('endDate', e.target.value)}
                      className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 ml-1">
                    <button
                      type="button"
                      onClick={() => {
                        const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                        const end = new Date().toISOString().split('T')[0];
                        handleSetQuickDate(start, end);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const start = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
                        const end = new Date().toISOString().split('T')[0];
                        handleSetQuickDate(start, end);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-indigo-200"
                    >
                      Tahun Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSetQuickDate('2000-01-01', '2099-12-31');
                      }}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg transition-colors cursor-pointer border border-emerald-200"
                    >
                      Semua Periode
                    </button>
                  </div>
                </>
              )}

              {/* Tax status filter for Sales Details */}
              {selectedReport === 'SALES_DETAILS' && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500 font-semibold uppercase">Tipe Penjualan:</span>
                  <select
                    value={selectedTaxStatus || taxStatusQuery}
                    onChange={e => updateParam('taxStatus', e.target.value)}
                    className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer font-medium"
                  >
                    <option value="">{taxMode === 'ALL' ? 'Semua Penjualan (PKP & Non-PKP)' : `Default Mode: ${taxMode}`}</option>
                    <option value="PKP">Penjualan PKP (PPN)</option>
                    <option value="NON_PKP">Penjualan Non-PKP</option>
                  </select>
                </div>
              )}

              {/* Balance Sheet date */}
              {selectedReport === 'NERACA' && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500 font-semibold uppercase">Pertanggal:</span>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={e => updateParam('asOfDate', e.target.value)}
                    className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                  />
                </div>
              )}

              {/* COA selector for General Ledger */}
              {selectedReport === 'BUKUBESAR' && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-zinc-500 font-semibold uppercase">Akun:</span>
                  <select
                    value={selectedAccount}
                    onChange={e => updateParam('accountId', e.target.value)}
                    className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                  >
                    <option value="">Semua Akun (Gabungan)</option>
                    {coa.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.accountCode}] {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product selector for Stock Movements using SearchSelect (Select2) */}
              {selectedReport === 'STOCK_MOVEMENTS' && (
                <div className="flex items-center space-x-2 min-w-[280px]">
                  <span className="text-xs text-zinc-500 font-semibold uppercase shrink-0">Pilih Barang:</span>
                  <div className="flex-1">
                    <SearchSelect
                      options={productOptions}
                      value={selectedProduct}
                      onChange={(opt) => updateParam('productId', opt?.value || '')}
                      placeholder="Semua Barang..."
                      searchPlaceholder="Cari nama barang atau SKU..."
                      clearable={true}
                    />
                  </div>
                </div>
              )}

              {/* Driver selector for Driver Invoices */}
              {selectedReport === 'DRIVER_INVOICES' && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">Driver:</span>
                    <select
                      value={selectedDriver}
                      onChange={e => updateParam('driver', e.target.value)}
                      className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    >
                      <option value="">Semua Driver / Armada</option>
                      {driversList.map(drv => (
                        <option key={drv.id} value={drv.name}>
                          {drv.name} ({drv.vehicleNumber || 'No Plat'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">Status Tagihan:</span>
                    <select
                      value={selectedStatus}
                      onChange={e => updateParam('status', e.target.value)}
                      className="px-3 py-2 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    >
                      <option value="">Semua Status</option>
                      <option value="PAID">Lunas</option>
                      <option value="UNPAID">Belum Lunas</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Report Content Output */}
        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm font-semibold text-zinc-600">Menyusun data laporan modular...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm print:hidden">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <div>
            {selectedReport === 'LABARUGI' && renderIncomeStatement()}
            {selectedReport === 'NERACA' && renderBalanceSheet()}
            {selectedReport === 'BUKUBESAR' && renderGeneralLedger()}
            {selectedReport === 'INVENTORY_VALUATION' && renderInventoryValuation()}
            {selectedReport === 'SALES_DETAILS' && renderSalesDetails()}
            {selectedReport === 'PURCHASE_DETAILS' && renderPurchaseDetails()}
            {selectedReport === 'SALES_COMMISSION' && renderSalesCommission()}
            {selectedReport === 'STOCK_MOVEMENTS' && renderStockMovements()}
            {selectedReport === 'DRIVER_INVOICES' && renderDriverInvoices()}
            {selectedReport === 'TAX_REPORT' && renderTaxReport()}
          </div>
        )}

      </div>

    </div>

      {/* Manifest 1 Mobil Modal */}
      <DeliveryManifestModal
        isOpen={manifestModal.isOpen}
        onClose={() => setManifestModal({ isOpen: false, driverName: '', date: '' })}
        initialDriverName={manifestModal.driverName}
        initialDate={manifestModal.date}
      />
    </div>
  );
};

export default Reports;

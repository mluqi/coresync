import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
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
  History,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileSpreadsheet
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

  // Local state for Search filter and UI interaction
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedAccounts, setCollapsedAccounts] = useState({});

  // Dropdown list states
  const [coa, setCoa] = useState([]);
  const [products, setProducts] = useState([]);
  const [driversList, setDriversList] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manifestModal, setManifestModal] = useState({ isOpen: false, driverName: '', date: '' });

  // Date helper
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const quickDatePresets = useMemo(() => {
    const now = new Date();
    const today = formatDateStr(now);

    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);

    const thisMonthStart = formatDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastMonthStart = formatDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const lastMonthEnd = formatDateStr(new Date(now.getFullYear(), now.getMonth(), 0));
    const thisYearStart = formatDateStr(new Date(now.getFullYear(), 0, 1));

    return [
      { label: 'Hari Ini', start: today, end: today },
      { label: '7 Hari', start: formatDateStr(d7), end: today },
      { label: 'Bulan Ini', start: thisMonthStart, end: today },
      { label: 'Bulan Lalu', start: lastMonthStart, end: lastMonthEnd },
      { label: 'Tahun Ini', start: thisYearStart, end: today },
      { label: 'Semua', start: '2000-01-01', end: '2099-12-31' }
    ];
  }, []);

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
    setSearchTerm('');
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
  const productOptions = useMemo(() => {
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
  const fetchReport = useCallback(async () => {
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
  }, [selectedReport, startDate, endDate, asOfDate, selectedAccount, selectedProduct, selectedDriver, selectedStatus, effectiveTaxStatus]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (['COMPLETED', 'DELIVERED', 'PAID', 'RECEIVED'].includes(s)) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (['ORDERED', 'CONFIRMED', 'SHIPPED', 'PROCESSING'].includes(s)) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (['PARTIAL', 'WAITING', 'PENDING'].includes(s)) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (['CANCELLED', 'VOID', 'REJECTED'].includes(s)) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  };

  // --- Real-time Filtered Data Hooks for Search (Must be called unconditionally) ---

  // Sales Details Filter
  const filteredSalesDetails = useMemo(() => {
    if (!reportData || reportData.type !== 'SALES_DETAILS') return [];
    const list = reportData.data || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(row => {
      const soNum = (row.soNumber || '').toLowerCase();
      const cust = (row.customer?.name || '').toLowerCase();
      const status = (row.status || '').toLowerCase();
      const itemsMatch = (row.items || []).some(it => 
        (it.product?.name || '').toLowerCase().includes(term) || 
        (it.product?.sku || '').toLowerCase().includes(term)
      );
      return soNum.includes(term) || cust.includes(term) || status.includes(term) || itemsMatch;
    });
  }, [reportData, searchTerm]);

  // Purchase Details Filter
  const filteredPurchaseDetails = useMemo(() => {
    if (!reportData || reportData.type !== 'PURCHASE_DETAILS') return [];
    const list = reportData.data || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(row => {
      const poNum = (row.poNumber || '').toLowerCase();
      const supp = (row.supplier?.name || '').toLowerCase();
      const status = (row.status || '').toLowerCase();
      const itemsMatch = (row.items || []).some(it => 
        (it.product?.name || '').toLowerCase().includes(term) || 
        (it.product?.sku || '').toLowerCase().includes(term)
      );
      return poNum.includes(term) || supp.includes(term) || status.includes(term) || itemsMatch;
    });
  }, [reportData, searchTerm]);

  // Inventory Valuation Filter
  const filteredInventoryValuation = useMemo(() => {
    if (!reportData || reportData.type !== 'INVENTORY_VALUATION') return [];
    const list = reportData.data?.items || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(row => {
      return (row.sku || '').toLowerCase().includes(term) || 
             (row.name || '').toLowerCase().includes(term) || 
             (row.unit || '').toLowerCase().includes(term);
    });
  }, [reportData, searchTerm]);

  // Stock Movements Filter
  const filteredStockMovements = useMemo(() => {
    if (!reportData || reportData.type !== 'STOCK_MOVEMENTS') return [];
    const list = reportData.data || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(row => {
      const prodName = (row.product?.name || '').toLowerCase();
      const sku = (row.product?.sku || '').toLowerCase();
      const wh = (row.warehouse?.name || '').toLowerCase();
      const type = (row.type || '').toLowerCase();
      const ref = `${row.referenceType || ''} ${row.referenceId || ''}`.toLowerCase();
      return prodName.includes(term) || sku.includes(term) || wh.includes(term) || type.includes(term) || ref.includes(term);
    });
  }, [reportData, searchTerm]);

  // Sales Commission Filter
  const filteredSalesCommission = useMemo(() => {
    if (!reportData || reportData.type !== 'SALES_COMMISSION') return [];
    const list = reportData.data || [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(row => {
      return (row.name || '').toLowerCase().includes(term) || (row.code || '').toLowerCase().includes(term);
    });
  }, [reportData, searchTerm]);

  // Driver Invoices Filter
  const filteredDriverInvoices = useMemo(() => {
    if (!reportData || reportData.type !== 'DRIVER_INVOICES') return { driverStats: [], deliveries: [] };
    const { driverStats = [], deliveries = [] } = reportData.data || {};
    if (!searchTerm.trim()) return { driverStats, deliveries };
    const term = searchTerm.toLowerCase();
    const statsFiltered = driverStats.filter(ds => 
      (ds.driverName || '').toLowerCase().includes(term) || 
      (ds.vehicleNumber || '').toLowerCase().includes(term)
    );
    const delFiltered = deliveries.filter(d => 
      (d.deliveryNumber || '').toLowerCase().includes(term) || 
      (d.driverName || '').toLowerCase().includes(term) || 
      (d.contactName || '').toLowerCase().includes(term) || 
      (d.invoiceNumber || '').toLowerCase().includes(term) ||
      (d.vehicleNumber || '').toLowerCase().includes(term)
    );
    return { driverStats: statsFiltered, deliveries: delFiltered };
  }, [reportData, searchTerm]);

  // Tax Report Filter
  const filteredTaxReport = useMemo(() => {
    if (!reportData || reportData.type !== 'TAX_REPORT') return { outputTax: [], inputTax: [] };
    const { outputTax = [], inputTax = [] } = reportData.data || {};
    if (!searchTerm.trim()) return { outputTax, inputTax };
    const term = searchTerm.toLowerCase();
    const outFiltered = outputTax.filter(r => 
      (r.soNumber || '').toLowerCase().includes(term) || 
      (r.contactName || '').toLowerCase().includes(term)
    );
    const inFiltered = inputTax.filter(r => 
      (r.poNumber || '').toLowerCase().includes(term) || 
      (r.contactName || '').toLowerCase().includes(term)
    );
    return { outputTax: outFiltered, inputTax: inFiltered };
  }, [reportData, searchTerm]);

  // Export to Excel (.xlsx) Handler
  const handleExportExcel = () => {
    if (!reportData || !reportData.data) return;
    try {
      const wb = XLSX.utils.book_new();
      const dateRangeStr = `${startDate}_sd_${endDate}`;
      let filename = `Laporan_${selectedReport}_${formatDateStr(new Date())}.xlsx`;

      if (selectedReport === 'SALES_DETAILS') {
        filename = `Laporan_Rincian_Penjualan_${dateRangeStr}.xlsx`;
        const list = filteredSalesDetails;
        const rows = list.map((row, idx) => ({
          'No': idx + 1,
          'No. SO': row.soNumber,
          'Tanggal': row.soDate,
          'Customer': row.customer?.name || '—',
          'Status': row.status || 'CONFIRMED',
          'Tipe Penjualan': ((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax) ? 'PKP' : 'Non-PKP',
          'Rincian Barang': (row.items || []).map(it => `${it.product?.name || ''} (${it.qty} ${it.product?.unit || 'PCS'}) @ Rp${Number(it.price || 0).toLocaleString('id-ID')}`).join('; '),
          'Subtotal (Rp)': parseFloat(row.subtotal || 0),
          'Pajak PPN (Rp)': parseFloat(row.taxAmount || 0),
          'Grand Total (Rp)': parseFloat(row.totalAmount || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Penjualan');
      } else if (selectedReport === 'PURCHASE_DETAILS') {
        filename = `Laporan_Rincian_Pembelian_${dateRangeStr}.xlsx`;
        const list = filteredPurchaseDetails;
        const rows = list.map((row, idx) => ({
          'No': idx + 1,
          'No. PO': row.poNumber,
          'Tanggal': row.poDate,
          'Supplier': row.supplier?.name || '—',
          'Status': row.status || 'DRAFT',
          'Rincian Barang': (row.items || []).map(it => `${it.product?.name || ''} (${it.qty} ${it.product?.unit || 'PCS'}) @ Rp${Number(it.price || 0).toLocaleString('id-ID')}`).join('; '),
          'Subtotal (Rp)': parseFloat(row.subtotal || 0),
          'Pajak PPN (Rp)': parseFloat(row.taxAmount || 0),
          'Grand Total (Rp)': parseFloat(row.totalAmount || 0)
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Pembelian');
      } else if (selectedReport === 'INVENTORY_VALUATION') {
        filename = `Laporan_Valuasi_Persediaan_${formatDateStr(new Date())}.xlsx`;
        const list = filteredInventoryValuation;
        const rows = list.map((row, idx) => ({
          'No': idx + 1,
          'SKU': row.sku,
          'Nama Barang': row.name,
          'Satuan': row.unit,
          'Stok Aktif': Number(row.totalStock || 0),
          'Harga Beli Pokok (Rp)': Number(row.purchasePrice || 0),
          'Nilai Persediaan FIFO (Rp)': Number(row.valuation || 0),
          'Harga Jual (Rp)': Number(row.sellingPrice || 0),
          'Potensi Nilai Jual (Rp)': Number((row.totalStock || 0) * (row.sellingPrice || 0))
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Valuasi_Stok');
      } else if (selectedReport === 'STOCK_MOVEMENTS') {
        filename = `Laporan_Mutasi_Kartu_Stok_${dateRangeStr}.xlsx`;
        const list = filteredStockMovements;
        const rows = list.map((row, idx) => ({
          'No': idx + 1,
          'Waktu': new Date(row.createdAt).toLocaleString('id-ID'),
          'Gudang': row.warehouse?.name || 'Gudang Utama',
          'SKU': row.product?.sku || '—',
          'Nama Barang': row.product?.name || '—',
          'Tipe Transaksi': row.type,
          'Qty Mutasi': parseFloat(row.qty || 0),
          'Satuan': row.product?.unit || 'PCS',
          'Dokumen Referensi': `${row.referenceType || ''} (ID: ${row.referenceId || ''})`
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Kartu_Stok');
      } else if (selectedReport === 'LABARUGI') {
        filename = `Laporan_Laba_Rugi_${dateRangeStr}.xlsx`;
        const { details } = reportData.data;
        const rows = [
          ...details.revenue.map(r => ({ Kategori: 'Pendapatan Operasional', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Debit (Rp)': r.debit, 'Kredit (Rp)': r.credit, 'Saldo (Rp)': r.balance })),
          ...details.costOfGoodsSold.map(r => ({ Kategori: 'Harga Pokok Penjualan (HPP)', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Debit (Rp)': r.debit, 'Kredit (Rp)': r.credit, 'Saldo (Rp)': r.balance })),
          ...details.expenses.map(r => ({ Kategori: 'Beban Operasional', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Debit (Rp)': r.debit, 'Kredit (Rp)': r.credit, 'Saldo (Rp)': r.balance }))
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Laba_Rugi');
      } else if (selectedReport === 'NERACA') {
        filename = `Laporan_Neraca_${asOfDate}.xlsx`;
        const { details } = reportData.data;
        const rows = [
          ...details.assets.map(r => ({ Kategori: 'Aktiva (Aset)', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Saldo (Rp)': r.balance })),
          ...details.liabilities.map(r => ({ Kategori: 'Kewajiban (Liabilitas)', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Saldo (Rp)': r.balance })),
          ...details.equity.map(r => ({ Kategori: 'Modal (Ekuitas)', 'Kode Akun': r.accountCode, 'Nama Akun': r.accountName, 'Saldo (Rp)': r.balance }))
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Neraca');
      } else if (selectedReport === 'TAX_REPORT') {
        filename = `Laporan_Rekap_Pajak_${dateRangeStr}.xlsx`;
        const { outputTax = [], inputTax = [] } = reportData.data || {};
        const wsOut = XLSX.utils.json_to_sheet(outputTax.map(r => ({
          'No. SO': r.soNumber, 'Tanggal': r.date, 'Customer': r.contactName, 'Tipe': r.isPkp ? 'PKP' : 'Non-PKP', 'Tarif': `${r.taxRate}%`, 'DPP (Rp)': r.dpp, 'PPN Keluaran (Rp)': r.taxAmount, 'Total Tagihan (Rp)': r.grossAmount
        })));
        const wsIn = XLSX.utils.json_to_sheet(inputTax.map(r => ({
          'No. PO': r.poNumber, 'Tanggal': r.date, 'Supplier': r.contactName, 'Tipe': r.isPkp ? 'PKP' : 'Non-PKP', 'Tarif': `${r.taxRate}%`, 'DPP (Rp)': r.dpp, 'PPN Masukan (Rp)': r.taxAmount, 'Total Pembelian (Rp)': r.grossAmount
        })));
        XLSX.utils.book_append_sheet(wb, wsOut, 'PPN_Keluaran');
        XLSX.utils.book_append_sheet(wb, wsIn, 'PPN_Masukan');
      } else if (selectedReport === 'SALES_COMMISSION') {
        filename = `Laporan_Komisi_Sales_${dateRangeStr}.xlsx`;
        const ws = XLSX.utils.json_to_sheet((reportData.data || []).map(r => ({
          'Kode': r.code || '—', 'Nama Sales': r.name, 'Rate Komisi (%)': r.commissionRate, 'Jumlah Invoice': r.ordersCount, 'Total Penjualan (Rp)': r.totalSales, 'Komisi (Rp)': r.totalCommission
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Komisi_Sales');
      } else if (selectedReport === 'DRIVER_INVOICES') {
        filename = `Laporan_Driver_Invoices_${dateRangeStr}.xlsx`;
        const { driverStats = [], deliveries = [] } = reportData.data || {};
        const wsStats = XLSX.utils.json_to_sheet(driverStats.map(ds => ({
          'Driver': ds.driverName, 'No. Polisi': ds.vehicleNumber, 'Total SJ': ds.deliveriesCount, 'Total Qty': ds.totalQty, 'Total Invoice (Rp)': ds.totalInvoiceAmount, 'Lunas (Rp)': ds.paidAmount, 'Belum Lunas (Rp)': ds.unpaidAmount
        })));
        const wsDel = XLSX.utils.json_to_sheet(deliveries.map(d => ({
          'No. SJ': d.deliveryNumber, 'Tanggal': d.deliveryDate, 'Driver': d.driverName, 'No. Polisi': d.vehicleNumber, 'Customer': d.contactName, 'No. Invoice': d.invoiceNumber, 'Status Invoice': d.invoiceStatus, 'Nilai Invoice (Rp)': d.invoiceAmount
        })));
        XLSX.utils.book_append_sheet(wb, wsStats, 'Rekap_Driver');
        XLSX.utils.book_append_sheet(wb, wsDel, 'Rincian_Pengiriman');
      } else if (selectedReport === 'BUKUBESAR') {
        filename = `Laporan_Buku_Besar_${dateRangeStr}.xlsx`;
        const { entries = [] } = reportData.data || {};
        const glRows = [];
        entries.forEach(entry => {
          (entry.items || []).forEach(it => {
            glRows.push({
              'Tanggal': entry.transactionDate,
              'No. Bukti / Ref': entry.entryNumber || entry.referenceId,
              'Kode Akun': it.account?.accountCode || '—',
              'Nama Akun': it.account?.accountName || '—',
              'Deskripsi': entry.description,
              'Tipe': it.type,
              'Debit (Rp)': it.type === 'DEBIT' ? parseFloat(it.amount) : 0,
              'Kredit (Rp)': it.type === 'CREDIT' ? parseFloat(it.amount) : 0,
            });
          });
        });
        const ws = XLSX.utils.json_to_sheet(glRows);
        XLSX.utils.book_append_sheet(wb, ws, 'Buku_Besar');
      }

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert('Gagal mengekspor data ke Excel: ' + (err.message || 'Kesalahan format data'));
    }
  };

  // --- Rendering helper blocks for each report ---

  const renderIncomeStatement = () => {
    if (!reportData || reportData.type !== 'LABARUGI') return null;
    const { summary, details } = reportData.data;
    const totalRev = parseFloat(summary.totalRevenue || 0);
    const grossProf = parseFloat(summary.grossProfit || 0);
    const netProf = parseFloat(summary.netProfit || 0);
    const grossMargin = totalRev > 0 ? (grossProf / totalRev) * 100 : 0;
    const netMargin = totalRev > 0 ? (netProf / totalRev) * 100 : 0;

    const term = searchTerm.toLowerCase().trim();
    const filterAccounts = (list) => {
      if (!term) return list;
      return list.filter(r => (r.accountCode || '').toLowerCase().includes(term) || (r.accountName || '').toLowerCase().includes(term));
    };

    const revList = filterAccounts(details.revenue || []);
    const hppList = filterAccounts(details.costOfGoodsSold || []);
    const expList = filterAccounts(details.expenses || []);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Total Pendapatan</p>
            <p className="text-xl font-bold text-indigo-600 font-mono mt-1">
              Rp{totalRev.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Penjualan & Pendapatan Usaha</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Total HPP</p>
            <p className="text-xl font-bold text-zinc-700 font-mono mt-1">
              Rp{parseFloat(summary.totalHpp || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Beban Pokok Penjualan</p>
          </div>
          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs bg-emerald-50/20">
            <div className="flex justify-between items-center">
              <p className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Laba Kotor</p>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {grossMargin.toFixed(1)}%
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-600 font-mono mt-1">
              Rp{grossProf.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Gross Margin Operasional</p>
          </div>
          <div className={`border rounded-2xl p-4 shadow-2xs ${netProf >= 0 ? 'bg-indigo-50/20 border-indigo-100' : 'bg-rose-50/20 border-rose-200'}`}>
            <div className="flex justify-between items-center">
              <p className={`text-xs font-semibold uppercase tracking-wider ${netProf >= 0 ? 'text-indigo-900' : 'text-rose-900'}`}>Laba Bersih</p>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${netProf >= 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}`}>
                {netMargin.toFixed(1)}%
              </span>
            </div>
            <p className={`text-xl font-bold font-mono mt-1 ${netProf >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
              Rp{netProf.toLocaleString('id-ID')}
            </p>
            <p className={`text-[11px] mt-0.5 ${netProf >= 0 ? 'text-indigo-600/80' : 'text-rose-600/80'}`}>Net Profit Margin Akhir</p>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3">Kode Akun</th>
                <th className="px-6 py-3">Nama Akun</th>
                <th className="px-6 py-3 text-right">Debit</th>
                <th className="px-6 py-3 text-right">Kredit</th>
                <th className="px-6 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
              <tr className="bg-indigo-50/40">
                <td colSpan="5" className="px-6 py-2.5 font-bold text-indigo-950 flex items-center justify-between">
                  <span>1. PENDAPATAN OPERASIONAL</span>
                  <span className="font-mono text-indigo-700">Rp{totalRev.toLocaleString('id-ID')}</span>
                </td>
              </tr>
              {revList.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-3 text-center text-zinc-400 text-xs">Tidak ada akun pendapatan</td></tr>
              ) : revList.map(row => (
                <tr key={row.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900 font-semibold">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-bold text-indigo-600">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}

              <tr className="bg-zinc-100/70">
                <td colSpan="5" className="px-6 py-2.5 font-bold text-zinc-900 flex items-center justify-between">
                  <span>2. HARGA POKOK PENJUALAN (HPP)</span>
                  <span className="font-mono text-zinc-700">Rp{parseFloat(summary.totalHpp || 0).toLocaleString('id-ID')}</span>
                </td>
              </tr>
              {hppList.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-3 text-center text-zinc-400 text-xs">Tidak ada akun HPP</td></tr>
              ) : hppList.map(row => (
                <tr key={row.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900 font-semibold">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-bold text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}

              <tr className="bg-rose-50/40">
                <td colSpan="5" className="px-6 py-2.5 font-bold text-rose-950 flex items-center justify-between">
                  <span>3. BEBAN OPERASIONAL</span>
                  <span className="font-mono text-rose-700">Rp{parseFloat(summary.totalExpenses || 0).toLocaleString('id-ID')}</span>
                </td>
              </tr>
              {expList.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-3 text-center text-zinc-400 text-xs">Tidak ada akun beban operasional</td></tr>
              ) : expList.map(row => (
                <tr key={row.id} className="hover:bg-zinc-50/60">
                  <td className="px-6 py-2.5 font-mono text-zinc-500">{row.accountCode}</td>
                  <td className="px-6 py-2.5 text-zinc-900 font-semibold">{row.accountName}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.debit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono text-xs text-zinc-500">Rp{parseFloat(row.credit).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-2.5 text-right font-mono font-bold text-rose-600">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-xs">
              <tr>
                <td colSpan="4" className="px-6 py-3 text-right uppercase tracking-wider text-zinc-600">
                  Laba Bersih Akhir:
                </td>
                <td className={`px-6 py-3 text-right font-mono text-sm font-extrabold ${netProf >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                  Rp{netProf.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    if (!reportData || reportData.type !== 'NERACA') return null;
    const { summary, details } = reportData.data;
    const isBalanced = Math.abs(parseFloat(summary.totalAssets || 0) - parseFloat(summary.totalLiabilitiesAndEquity || 0)) < 1;

    const term = searchTerm.toLowerCase().trim();
    const filterAccounts = (list) => {
      if (!term) return list;
      return list.filter(r => (r.accountCode || '').toLowerCase().includes(term) || (r.accountName || '').toLowerCase().includes(term));
    };

    const assetList = filterAccounts(details.assets || []);
    const liabList = filterAccounts(details.liabilities || []);
    const eqList = filterAccounts(details.equity || []);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-2xs">
            <p className="text-xs text-indigo-700 font-bold uppercase">Total Aset (Aktiva)</p>
            <p className="text-lg font-bold text-indigo-900 font-mono mt-1">
              Rp{parseFloat(summary.totalAssets || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-indigo-600 mt-0.5">Kekayaan & Piutang</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <p className="text-xs text-zinc-600 font-bold uppercase">Total Liabilitas</p>
            <p className="text-lg font-bold text-zinc-800 font-mono mt-1">
              Rp{parseFloat(summary.totalLiabilities || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Kewajiban & Hutang</p>
          </div>
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs">
            <p className="text-xs text-emerald-700 font-bold uppercase">Total Ekuitas</p>
            <p className="text-lg font-bold text-emerald-900 font-mono mt-1">
              Rp{parseFloat(summary.totalEquity || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Modal & Laba Ditahan</p>
          </div>
          <div className={`border rounded-2xl p-4 shadow-2xs flex flex-col justify-center items-center text-center ${
            isBalanced ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' : 'bg-rose-50/50 border-rose-200 text-rose-800'
          }`}>
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              {isBalanced ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
              {isBalanced ? 'Status: Balanced' : 'Status: Tidak Seimbang'}
            </span>
            <span className="text-[11px] mt-1 font-mono">
              Aktiva = Pasiva (Rp{parseFloat(summary.totalLiabilitiesAndEquity || 0).toLocaleString('id-ID')})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2">
          {/* Assets */}
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs flex flex-col max-h-[calc(100vh-24rem)]">
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
                  {assetList.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-2 font-mono text-zinc-400">{row.accountCode}</td>
                      <td className="px-4 py-2 font-bold text-zinc-900">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  {assetList.length === 0 && (
                    <tr><td colSpan="3" className="px-4 py-4 text-center text-zinc-400">Tidak ada akun aktiva</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs flex flex-col max-h-[calc(100vh-24rem)]">
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
                  <tr className="bg-zinc-50/70"><td colSpan="3" className="px-4 py-1.5 font-bold text-zinc-900">Kewajiban (Liabilitas)</td></tr>
                  {liabList.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50/60">
                      <td className="px-4 py-2 font-mono text-zinc-400">{row.accountCode}</td>
                      <td className="px-4 py-2 text-zinc-900">{row.accountName}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-800">Rp{parseFloat(row.balance).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                  <tr className="bg-zinc-50/70"><td colSpan="3" className="px-4 py-1.5 font-bold text-zinc-900">Ekuitas (Modal)</td></tr>
                  {eqList.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50/60">
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

    let accountList = Object.values(accountsGroup).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      accountList = accountList.filter(acc => {
        const matchAcc = acc.accountCode.toLowerCase().includes(term) || acc.accountName.toLowerCase().includes(term);
        const matchItem = acc.items.some(it => 
          (it.number || '').toLowerCase().includes(term) || 
          (it.description || '').toLowerCase().includes(term)
        );
        return matchAcc || matchItem;
      });
    }

    if (accountList.length === 0) {
      return (
        <div className="border border-zinc-200 rounded-2xl bg-white p-12 text-center text-zinc-400">
          <BookOpen size={36} className="mx-auto mb-3 text-zinc-300" />
          <p className="font-medium text-sm">Tidak ada mutasi buku besar yang sesuai filter/pencarian</p>
        </div>
      );
    }

    const toggleCollapse = (id) => {
      setCollapsedAccounts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleAllCollapse = (collapse) => {
      const next = {};
      accountList.forEach(acc => { next[acc.id] = collapse; });
      setCollapsedAccounts(next);
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-500 font-semibold">{accountList.length} Akun Buku Besar Terdaftar</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => toggleAllCollapse(false)}
              className="px-2.5 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Buka Semua
            </button>
            <button
              onClick={() => toggleAllCollapse(true)}
              className="px-2.5 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {accountList.map(acc => {
            let runningBalance = acc.beginningBalance;
            const isAssetOrExpense = acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE';
            const isCollapsed = collapsedAccounts[acc.id];

            return (
              <div key={acc.id} className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
                {/* Account Header */}
                <div 
                  onClick={() => toggleCollapse(acc.id)}
                  className="bg-zinc-50 hover:bg-zinc-100/70 px-4 py-3 border-b border-zinc-200 flex flex-wrap justify-between items-center gap-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-600" />}
                    <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                      {acc.accountCode}
                    </span>
                    <span className="font-bold text-sm text-zinc-900">{acc.accountName}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200/70 text-zinc-600 uppercase tracking-wider">
                      {acc.accountType}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">({acc.items.length} baris mutasi)</span>
                  </div>
                  <div className="text-xs flex items-center space-x-4">
                    <div>
                      <span className="text-zinc-500 font-medium">Saldo Awal: </span>
                      <span className="font-mono font-bold text-zinc-800">
                        Rp{acc.beginningBalance.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-medium">Mutasi: </span>
                      <span className="font-mono font-bold text-indigo-700">
                        Rp{(acc.totalDebit - acc.totalCredit).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                {!isCollapsed && (
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
                        <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderInventoryValuation = () => {
    if (!reportData || reportData.type !== 'INVENTORY_VALUATION') return null;
    const items = filteredInventoryValuation;
    const totalValuation = items.reduce((sum, r) => sum + (r.valuation || 0), 0);
    const totalStock = items.reduce((sum, r) => sum + (r.totalStock || 0), 0);
    const totalSellingVal = items.reduce((sum, r) => sum + ((r.totalStock || 0) * (r.sellingPrice || 0)), 0);
    const estimatedMargin = totalSellingVal - totalValuation;

    return (
      <div className="space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Nilai Persediaan (FIFO)</span>
            <span className="font-bold text-indigo-600 font-mono text-lg block mt-1">Rp{totalValuation.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Berdasarkan harga pokok beli</span>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Variasi SKU Terdaftar</span>
            <span className="font-bold text-zinc-800 font-mono text-lg block mt-1">{items.length} Barang</span>
            <span className="text-[11px] text-zinc-400 font-medium">Total jenis produk terhitung</span>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Fisik Unit Stok</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block mt-1">{totalStock.toLocaleString('id-ID')} Unit</span>
            <span className="text-[11px] text-zinc-400 font-medium">Akumulasi seluruh gudang</span>
          </div>
          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs bg-emerald-50/20">
            <span className="text-xs font-semibold text-emerald-800 block uppercase tracking-wider">Potensi Omset Penjualan</span>
            <span className="font-bold text-emerald-600 font-mono text-lg block mt-1">Rp{totalSellingVal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-700/80 font-medium">Estimasi potensi laba kotor: Rp{estimatedMargin.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">Nama Barang</th>
                <th className="px-4 py-2.5">Satuan</th>
                <th className="px-4 py-2.5 text-right">Stok Aktif</th>
                <th className="px-4 py-2.5 text-right">Harga Beli Pokok</th>
                <th className="px-4 py-2.5 text-right font-bold text-indigo-700">Nilai Barang (FIFO)</th>
                <th className="px-4 py-2.5 text-right">Harga Jual</th>
                <th className="px-4 py-2.5 text-right">Potensi Nilai Jual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {items.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-zinc-400">Tidak ada barang yang sesuai filter</td></tr>
              ) : items.map(row => (
                <tr key={row.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-2 font-mono text-zinc-500 font-semibold">{row.sku}</td>
                  <td className="px-4 py-2 font-bold text-zinc-900">{row.name}</td>
                  <td className="px-4 py-2 uppercase text-zinc-400 font-mono">{row.unit}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-zinc-800">{Number(row.totalStock || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{Number(row.purchasePrice || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600">Rp{Number(row.valuation || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-600">Rp{Number(row.sellingPrice || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-600">
                    Rp{Number((row.totalStock || 0) * (row.sellingPrice || 0)).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
              <tr>
                <td colSpan="3" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                  Total ({items.length} SKU):
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{totalStock.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono">—</td>
                <td className="px-4 py-2.5 text-right font-mono text-indigo-700 font-extrabold">Rp{totalValuation.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono">—</td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-extrabold">Rp{totalSellingVal.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderSalesDetails = () => {
    if (!reportData || reportData.type !== 'SALES_DETAILS') return null;
    const data = filteredSalesDetails;
    
    // Compute aggregations dynamically based on filtered data
    const grandTotal = data.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);
    const totalDpp = data.reduce((sum, row) => sum + parseFloat(row.subtotal || 0), 0);
    const totalTax = data.reduce((sum, row) => sum + parseFloat(row.taxAmount || 0), 0);

    const pkpRows = data.filter(row => Boolean((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax));
    const nonPkpRows = data.filter(row => !((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax));

    const pkpTotal = pkpRows.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);
    const nonPkpTotal = nonPkpRows.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);

    return (
      <div className="space-y-4">
        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Omset Penjualan</span>
            <span className="font-bold text-indigo-600 font-mono text-lg block">Rp{grandTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">{data.length} transaksi penjualan</span>
          </div>

          <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-indigo-800 block uppercase tracking-wider">Penjualan PKP (PPN)</span>
            <span className="font-bold text-indigo-900 font-mono text-lg block">Rp{pkpTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-indigo-600 font-medium">{pkpRows.length} transaksi PKP</span>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-emerald-800 block uppercase tracking-wider">Penjualan Non-PKP</span>
            <span className="font-bold text-emerald-900 font-mono text-lg block">Rp{nonPkpTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-600 font-medium">{nonPkpRows.length} transaksi Non-PKP</span>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-amber-800 block uppercase tracking-wider">Rata-rata Nilai SO</span>
            <span className="font-bold text-amber-900 font-mono text-lg block">Rp{(data.length > 0 ? Math.round(grandTotal / data.length) : 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-amber-600 font-medium">DPP: Rp{totalDpp.toLocaleString('id-ID')} | PPN: Rp{totalTax.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">No. SO</th>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Tipe</th>
                <th className="px-4 py-2.5">Rincian Barang</th>
                <th className="px-4 py-2.5 text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right">Pajak</th>
                <th className="px-4 py-2.5 text-right font-bold text-indigo-700">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="9" className="px-4 py-8 text-center text-zinc-400">Tidak ada data penjualan sesuai filter</td></tr>
              ) : data.map(row => {
                const isPkp = Boolean((row.taxId && (!row.tax?.name || !row.tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax);
                return (
                  <tr key={row.id} className="hover:bg-zinc-50/60 align-top">
                    <td className="px-4 py-2.5 font-mono font-bold text-zinc-800">{row.soNumber}</td>
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{row.soDate}</td>
                    <td className="px-4 py-2.5 font-semibold text-zinc-900">{row.customer?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(row.status)}`}>
                        {row.status || 'CONFIRMED'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPkp 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}>
                        {isPkp ? 'PKP' : 'Non-PKP'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 space-y-1">
                      {(row.items || []).map(it => (
                        <div key={it.id} className="inline-flex items-center text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200/80 rounded-md px-2 py-0.5 mr-1 mb-1">
                          <span className="font-semibold text-zinc-800">{it.product?.name}</span>
                          <span className="mx-1 text-zinc-400">·</span>
                          <span className="font-mono font-bold text-indigo-700">{Number(it.qty).toLocaleString('id-ID')} {it.product?.unit || 'PCS'}</span>
                          <span className="mx-1 text-zinc-400">@</span>
                          <span className="font-mono text-zinc-500 text-[10px]">Rp{Number(it.price).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-600">Rp{parseFloat(row.subtotal).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-500">Rp{parseFloat(row.taxAmount).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600">Rp{parseFloat(row.totalAmount).toLocaleString('id-ID')}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
              <tr>
                <td colSpan="6" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                  Total ({data.length} SO):
                </td>
                <td className="px-4 py-2.5 text-right font-mono">Rp{totalDpp.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-zinc-600">Rp{totalTax.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-indigo-700 font-extrabold">Rp{grandTotal.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderPurchaseDetails = () => {
    if (!reportData || reportData.type !== 'PURCHASE_DETAILS') return null;
    const data = filteredPurchaseDetails;
    const grandTotal = data.reduce((sum, row) => sum + parseFloat(row.totalAmount || 0), 0);
    const totalDpp = data.reduce((sum, row) => sum + parseFloat(row.subtotal || 0), 0);
    const totalTax = data.reduce((sum, row) => sum + parseFloat(row.taxAmount || 0), 0);
    const avgPo = data.length > 0 ? Math.round(grandTotal / data.length) : 0;

    return (
      <div className="space-y-4">
        {/* KPI Cards for Purchase */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Belanja (Pembelian)</span>
            <span className="font-bold text-indigo-600 font-mono text-lg block">Rp{grandTotal.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">{data.length} transaksi Purchase Order</span>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-zinc-600 block uppercase tracking-wider">Total DPP Pembelian</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block">Rp{totalDpp.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Dasar pengenaan nilai barang</span>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs space-y-1 bg-emerald-50/20">
            <span className="text-xs font-semibold text-emerald-800 block uppercase tracking-wider">Total PPN Masukan</span>
            <span className="font-bold text-emerald-600 font-mono text-lg block">Rp{totalTax.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-700/80 font-medium">Pajak masukan dari supplier</span>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-semibold text-amber-800 block uppercase tracking-wider">Rata-rata Nilai PO</span>
            <span className="font-bold text-amber-900 font-mono text-lg block">Rp{avgPo.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-amber-600 font-medium">Rata-rata nominal per order</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">No. PO</th>
                <th className="px-4 py-2.5">Tanggal</th>
                <th className="px-4 py-2.5">Supplier</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Rincian Barang</th>
                <th className="px-4 py-2.5 text-right">Subtotal</th>
                <th className="px-4 py-2.5 text-right">Pajak (PPN)</th>
                <th className="px-4 py-2.5 text-right font-bold text-indigo-700">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-zinc-400">Tidak ada data pembelian sesuai filter</td></tr>
              ) : data.map(row => (
                <tr key={row.id} className="hover:bg-zinc-50/60 align-top">
                  <td className="px-4 py-2.5 font-mono font-bold text-zinc-800">{row.poNumber}</td>
                  <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{row.poDate}</td>
                  <td className="px-4 py-2.5 font-semibold text-zinc-900">{row.supplier?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(row.status)}`}>
                      {row.status || 'DRAFT'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 space-y-1">
                    {(row.items || []).map(it => (
                      <div key={it.id} className="inline-flex items-center text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200/80 rounded-md px-2 py-0.5 mr-1 mb-1">
                        <span className="font-semibold text-zinc-800">{it.product?.name}</span>
                        <span className="mx-1 text-zinc-400">·</span>
                        <span className="font-mono font-bold text-indigo-700">{Number(it.qty).toLocaleString('id-ID')} {it.product?.unit || 'PCS'}</span>
                        <span className="mx-1 text-zinc-400">@</span>
                        <span className="font-mono text-zinc-500 text-[10px]">Rp{Number(it.price).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-600">Rp{parseFloat(row.subtotal).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-500">Rp{parseFloat(row.taxAmount).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600">Rp{parseFloat(row.totalAmount).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
              <tr>
                <td colSpan="5" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                  Total ({data.length} PO):
                </td>
                <td className="px-4 py-2.5 text-right font-mono">Rp{totalDpp.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-zinc-600">Rp{totalTax.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-indigo-700 font-extrabold">Rp{grandTotal.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderSalesCommission = () => {
    if (!reportData || reportData.type !== 'SALES_COMMISSION') return null;
    const data = filteredSalesCommission;
    const grandCommission = data.reduce((sum, row) => sum + (row.totalCommission || 0), 0);
    const grandSales = data.reduce((sum, row) => sum + (row.totalSales || 0), 0);
    const grandOrders = data.reduce((sum, row) => sum + (row.ordersCount || 0), 0);

    return (
      <div className="space-y-4">
        {/* KPI Cards for Sales Commission */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Akumulasi Komisi</span>
            <span className="font-bold text-indigo-600 font-mono text-lg block mt-1">Rp{grandCommission.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Beban komisi sales terhitung</span>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Omset dari Sales</span>
            <span className="font-bold text-zinc-800 font-mono text-lg block mt-1">Rp{grandSales.toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Dari {grandOrders} invoice penjualan selesai</span>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Jumlah Sales Terdaftar</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block mt-1">{data.length} Orang</span>
            <span className="text-[11px] text-zinc-400 font-medium">Salesperson aktif dalam periode</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Nama Salesperson</th>
                <th className="px-4 py-2.5 text-center">Rate Komisi (%)</th>
                <th className="px-4 py-2.5 text-center">Jumlah Invoice Selesai</th>
                <th className="px-4 py-2.5 text-right">Total Akumulasi Penjualan</th>
                <th className="px-4 py-2.5 text-right font-bold text-indigo-700">Estimasi Komisi Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
              {data.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-zinc-400">Tidak ada data sales terdaftar sesuai filter</td></tr>
              ) : data.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-2.5 font-bold text-zinc-900">
                    <div className="flex items-center space-x-2">
                      {row.code && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-600 font-bold">
                          {row.code}
                        </span>
                      )}
                      <span>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono">{row.commissionRate}%</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-zinc-800">{row.ordersCount}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-600">Rp{Number(row.totalSales || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600">Rp{Number(row.totalCommission || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
              <tr>
                <td colSpan="2" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                  Total:
                </td>
                <td className="px-4 py-2.5 text-center font-mono">{grandOrders}</td>
                <td className="px-4 py-2.5 text-right font-mono">Rp{grandSales.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right font-mono text-indigo-700 font-extrabold">Rp{grandCommission.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderStockMovements = () => {
    if (!reportData || reportData.type !== 'STOCK_MOVEMENTS') return null;
    const data = filteredStockMovements;

    // Compute metrics
    let totalInQty = 0;
    let totalOutQty = 0;
    data.forEach(row => {
      const q = Math.abs(parseFloat(row.qty || 0));
      const isPlus = row.type.includes('IN') || row.type.includes('RETURN_IN') || row.type.includes('ADJUSTMENT_IN');
      if (isPlus) {
        totalInQty += q;
      } else {
        totalOutQty += q;
      }
    });
    const netQty = totalInQty - totalOutQty;

    return (
      <div className="space-y-4">
        {/* KPI Cards for Stock Movements */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500 block uppercase tracking-wider">Total Riwayat Mutasi</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block mt-1">{data.length} Log Transaksi</span>
            <span className="text-[11px] text-zinc-400 font-medium">Aktivitas keluar-masuk stok</span>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs bg-emerald-50/20">
            <span className="text-xs font-semibold text-emerald-800 block uppercase tracking-wider">Total Mutasi Masuk (In)</span>
            <span className="font-bold text-emerald-600 font-mono text-lg block mt-1">+{totalInQty.toLocaleString('id-ID')} Unit</span>
            <span className="text-[11px] text-emerald-700/80 font-medium">Pembelian, Retur, & Penyesuaian</span>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-2xs bg-rose-50/20">
            <span className="text-xs font-semibold text-rose-800 block uppercase tracking-wider">Total Mutasi Keluar (Out)</span>
            <span className="font-bold text-rose-600 font-mono text-lg block mt-1">-{totalOutQty.toLocaleString('id-ID')} Unit</span>
            <span className="text-[11px] text-rose-700/80 font-medium">Penjualan, Surat Jalan, & Retur Beli</span>
          </div>

          <div className={`border rounded-2xl p-4 shadow-2xs ${netQty >= 0 ? 'bg-indigo-50/30 border-indigo-100' : 'bg-amber-50/30 border-amber-200'}`}>
            <span className="text-xs font-semibold text-zinc-700 block uppercase tracking-wider">Mutasi Bersih (Net)</span>
            <span className={`font-bold font-mono text-lg block mt-1 ${netQty >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
              {netQty >= 0 ? '+' : ''}{netQty.toLocaleString('id-ID')} Unit
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">Selisih mutasi fisik periode ini</span>
          </div>
        </div>

        <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
              <tr className="text-left font-semibold text-zinc-500 uppercase tracking-wider">
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
                <tr><td colSpan="6" className="px-4 py-8 text-center text-zinc-400">Tidak ada mutasi kartu stok barang sesuai filter</td></tr>
              ) : data.map((row) => {
                const isPlus = row.type.includes('IN') || row.type.includes('RETURN_IN') || row.type.includes('ADJUSTMENT_IN');
                const display = formatStockLedgerDisplay(row.qty, row.product, isPlus);
                return (
                  <tr key={row.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap font-mono">{new Date(row.createdAt).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-2.5 text-zinc-800 font-medium">{row.warehouse?.name || 'Gudang Utama'}</td>
                    <td className="px-4 py-2.5 font-bold text-zinc-900">
                      <span className="font-mono text-zinc-400 mr-1.5 font-semibold">[{row.product?.sku}]</span>
                      {row.product?.name}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                        display.isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-mono font-bold block ${display.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {display.primaryText}
                      </span>
                      {display.secondaryText && (
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          {display.secondaryText}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500">{row.referenceType} (ID: {row.referenceId})</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
              <tr>
                <td colSpan="4" className="px-4 py-2.5 text-right uppercase tracking-wider text-zinc-500">
                  Total Log Mutasi Terhitung:
                </td>
                <td className="px-4 py-2.5 text-center font-mono text-indigo-700 font-extrabold">
                  {netQty >= 0 ? '+' : ''}{netQty.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2.5 font-mono text-zinc-500">{data.length} Transaksi</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderDriverInvoices = () => {
    if (!reportData || reportData.type !== 'DRIVER_INVOICES') return null;
    const { summary = {} } = reportData.data || {};
    const { driverStats, deliveries } = filteredDriverInvoices;

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
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors"
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
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada data driver pada periode ini sesuai filter</td></tr>
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
                        className="p-1 px-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-bold flex items-center space-x-1 mx-auto cursor-pointer transition-colors"
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
            <span>Rincian Surat Jalan, Invoice, & Barang yang Diantar ({deliveries.length} Transaksi)</span>
          </h3>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-[calc(100vh-22rem)] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 shadow-2xs">
                <tr className="text-left font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-2.5">No. Surat Jalan & Tanggal</th>
                  <th className="px-4 py-2.5">Driver / No. Polisi</th>
                  <th className="px-4 py-2.5">Customer / Tujuan</th>
                  <th className="px-4 py-2.5">No. Invoice & Status</th>
                  <th className="px-4 py-2.5">Rincian Barang Terkirim</th>
                  <th className="px-4 py-2.5 text-right font-bold text-indigo-700">Nilai Invoice</th>
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
                        <div key={itIdx} className="inline-flex items-center text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200/80 rounded-md px-2 py-0.5 mr-1 mb-1">
                          <span className="font-semibold text-zinc-900">{it.name}</span>{' '}
                          <span className="mx-1 text-zinc-400">·</span>
                          <span className="font-mono font-bold text-zinc-800">({it.qty} {it.unit})</span>
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
    const { summary } = reportData.data || {};
    const { outputTax, inputTax } = filteredTaxReport;

    const netPayable = summary?.netTaxPayable || 0;
    const isKurangBayar = netPayable > 0;

    const totalOutDpp = outputTax.reduce((s, r) => s + parseFloat(r.dpp || 0), 0);
    const totalOutTax = outputTax.reduce((s, r) => s + parseFloat(r.taxAmount || 0), 0);
    const totalOutGross = outputTax.reduce((s, r) => s + parseFloat(r.grossAmount || 0), 0);

    const totalInDpp = inputTax.reduce((s, r) => s + parseFloat(r.dpp || 0), 0);
    const totalInTax = inputTax.reduce((s, r) => s + parseFloat(r.taxAmount || 0), 0);
    const totalInGross = inputTax.reduce((s, r) => s + parseFloat(r.grossAmount || 0), 0);

    return (
      <div className="space-y-6">
        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-indigo-800 block uppercase tracking-wider">PPN Keluaran (Penjualan)</span>
            <span className="font-bold text-indigo-900 font-mono text-lg block">Rp{Number(summary?.totalPpnKeluaran || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-indigo-600 font-medium">DPP: Rp{Number(summary?.totalDppSales || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-800 block uppercase tracking-wider">PPN Masukan (Pembelian)</span>
            <span className="font-bold text-emerald-900 font-mono text-lg block">Rp{Number(summary?.totalPpnMasukan || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-emerald-600 font-medium">DPP: Rp{Number(summary?.totalDppPurchases || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className={`border rounded-2xl p-4 space-y-1 shadow-2xs ${isKurangBayar ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-teal-50/70 border-teal-200 text-teal-900'}`}>
            <span className="text-xs font-semibold block uppercase tracking-wider">{isKurangBayar ? 'Estimasi PPN Kurang Bayar' : 'Estimasi PPN Lebih Bayar'}</span>
            <span className="font-bold font-mono text-lg block">Rp{Math.abs(netPayable).toLocaleString('id-ID')}</span>
            <span className="text-[11px] font-medium block opacity-85">{isKurangBayar ? 'Hutang PPN ke Kas Negara' : 'Kredit Pajak PPN Tersisa'}</span>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-600 block uppercase tracking-wider">Total Omset Penjualan (Gross)</span>
            <span className="font-bold text-zinc-900 font-mono text-lg block">Rp{Number(summary?.totalGrossSales || 0).toLocaleString('id-ID')}</span>
            <span className="text-[11px] text-zinc-500 font-medium">{outputTax.length} Faktur Terhitung</span>
          </div>
        </div>

        {/* Tabel 1: PPN Keluaran (Penjualan) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight size={15} className="text-indigo-600" />
              <span>Rincian PPN Keluaran (Penjualan Pelanggan)</span>
            </h3>
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">{outputTax.length} faktur penjualan</span>
          </div>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-80 overflow-y-auto">
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
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada transaksi penjualan dalam periode ini sesuai filter</td></tr>
                ) : outputTax.map(row => (
                  <tr key={row.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.soNumber}</td>
                    <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{row.date}</td>
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
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
                <tr>
                  <td colSpan="5" className="px-4 py-2 text-right uppercase tracking-wider text-zinc-500">Total PPN Keluaran:</td>
                  <td className="px-4 py-2 text-right font-mono">Rp{totalOutDpp.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono text-indigo-700 font-extrabold">Rp{totalOutTax.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono">Rp{totalOutGross.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
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
            <span className="text-[11px] font-mono text-zinc-500 font-semibold">{inputTax.length} faktur pembelian</span>
          </div>
          <div className="border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-2xs max-h-80 overflow-y-auto">
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
                  <tr><td colSpan="8" className="px-4 py-6 text-center text-zinc-400">Tidak ada transaksi pembelian dalam periode ini sesuai filter</td></tr>
                ) : inputTax.map(row => (
                  <tr key={row.id} className="hover:bg-zinc-50/60">
                    <td className="px-4 py-2 font-mono font-bold text-zinc-800">{row.poNumber}</td>
                    <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{row.date}</td>
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
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-xs">
                <tr>
                  <td colSpan="5" className="px-4 py-2 text-right uppercase tracking-wider text-zinc-500">Total PPN Masukan:</td>
                  <td className="px-4 py-2 text-right font-mono">Rp{totalInDpp.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-700 font-extrabold">Rp{totalInTax.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2 text-right font-mono">Rp{totalInGross.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Laporan & Analisa Bisnis"
        subtitle="Laporan keuangan Laba Rugi, Penjualan, Pembelian, Hutang-Piutang, dan Valuasi Stok terintegrasi."
        icon={BarChart2}
      />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
      
      {/* LEFT SIDEBAR: Report categories list */}
      <div className="w-full lg:w-72 bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs shrink-0 print:hidden space-y-4 lg:sticky lg:top-36 lg:self-start lg:max-h-[calc(100vh-10.5rem)] lg:overflow-y-auto">
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
                <div className="space-y-0.5 pl-4 border-l border-zinc-200">
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

        {/* Toolbar & filters */}
        {activeReportObj && (
          <div className="bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl p-4 shadow-2xs space-y-4 print:hidden sticky top-36 z-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950 flex items-center space-x-2">
                  <FileText className="text-indigo-600 w-5 h-5" />
                  <span>{activeReportObj.name}</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">{activeReportObj.desc}</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={fetchReport}
                  className="px-3.5 py-2 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                  title="Perbarui Data Laporan"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Tarik Laporan</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                  title="Unduh Data ke Format Excel (.xlsx)"
                >
                  <FileSpreadsheet size={13} />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-2 text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                  title="Cetak Dokumen atau Simpan PDF"
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
                      className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-zinc-500 font-semibold uppercase">s/d:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => updateParam('endDate', e.target.value)}
                      className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center space-x-1 ml-1 flex-wrap gap-1">
                    {quickDatePresets.map((preset) => {
                      const isActive = startDate === preset.start && endDate === preset.end;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSetQuickDate(preset.start, preset.end)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer border ${
                            isActive 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold' 
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-transparent'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
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
                    className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
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
                    className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
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
                    className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer max-w-[260px]"
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

              {/* Product selector for Stock Movements using SearchSelect */}
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
                      className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
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
                      className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-zinc-50 focus:bg-white cursor-pointer"
                    >
                      <option value="">Semua Status</option>
                      <option value="PAID">Lunas</option>
                      <option value="UNPAID">Belum Lunas</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Quick Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cari transaksi, nomor dokumen, customer, supplier, barang, atau akun..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {searchTerm && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200 font-semibold text-[11px] flex items-center gap-1.5">
                    <span>Filter aktif: "{searchTerm}"</span>
                    <button onClick={() => setSearchTerm('')} className="hover:text-indigo-900 cursor-pointer font-bold">×</button>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Content Output */}
        {loading ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-24 flex flex-col items-center justify-center space-y-3 shadow-2xs">
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

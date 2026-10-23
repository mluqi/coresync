import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import SearchSelect from '../components/SearchSelect';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTaxMode } from '../context/TaxModeContext';
import { hasPermission } from '../utils/permission';
import { generateDocumentNumber } from '../utils/documentNumber';
import getImageUrl from '../utils/imageUrl';
import SalesOrderModal from '../components/transactions/SalesOrderModal';
import PurchaseOrderModal from '../components/transactions/PurchaseOrderModal';
import SalesOrderDetailModal from '../components/transactions/SalesOrderDetailModal';
import PurchaseOrderDetailModal from '../components/transactions/PurchaseOrderDetailModal';
import DeliveryModal from '../components/transactions/DeliveryModal';
import InvoiceModal from '../components/transactions/InvoiceModal';
import ReturnModal from '../components/transactions/ReturnModal';
import ReturnDetailModal from '../components/transactions/ReturnDetailModal';
import PaymentRecordModal from '../components/transactions/PaymentRecordModal';
import InvoicePrintTemplate from '../components/transactions/InvoicePrintTemplate';
import ReturnFormPrintTemplate from '../components/transactions/ReturnFormPrintTemplate';
import { getDocPaymentInfo, formatStockBreakdown, getProductStructure, calculateTieredItemSubtotal } from '../utils/format';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Truck, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ShoppingCart,
  Loader2, 
  AlertCircle, 
  Plus, 
  Printer, 
  Check, 
  Trash2,
  Edit2,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  X,
  Eye,
  EyeOff,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Building,
  DollarSign,
  ShieldCheck,
  ChevronRight,
  Boxes,
  FileCheck, 
  XCircle,
  MoreVertical,
  Paperclip,
  UploadCloud,
  ZoomIn,
  Camera,
  FileSpreadsheet,
  Download,
  Filter,
  RotateCcw
} from 'lucide-react';

// --- Helper: debounce ---
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const formatRupiah = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rp 0';
  const num = Math.round(Number(val));
  return 'Rp ' + num.toLocaleString('id-ID');
};

const Transactions = ({ scope }) => {
  const { user, tenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isPurchase = scope === 'PURCHASE' || location.pathname.includes('/purchases');
  const defaultTab = isPurchase ? 'PO' : 'SO';

  // Read URL params
  const { taxMode, taxStatusQuery, filterProductsByTaxMode } = useTaxMode();
  const rawActiveTab = searchParams.get('tab') || defaultTab;
  const activeTab = (!isPurchase && rawActiveTab === 'INV') ? 'SO' : rawActiveTab;
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const taxStatus = searchParams.get('taxStatus') || '';
  const effectiveTaxStatus = taxStatus || taxStatusQuery || '';
  const orderStatus = searchParams.get('status') || '';
  const paymentStatus = searchParams.get('paymentStatus') || '';
  const salespersonFilter = searchParams.get('salesperson') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const updateFilterParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleDatePresetChange = (preset) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    const now = new Date();
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (!preset) {
      next.delete('startDate');
      next.delete('endDate');
    } else if (preset === 'TODAY') {
      const today = formatDate(now);
      next.set('startDate', today);
      next.set('endDate', today);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatDate(yesterday);
      next.set('startDate', yStr);
      next.set('endDate', yStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      next.set('startDate', formatDate(past));
      next.set('endDate', formatDate(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      next.set('startDate', formatDate(firstDay));
      next.set('endDate', formatDate(lastDay));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      next.set('startDate', formatDate(firstDay));
      next.set('endDate', formatDate(lastDay));
    }
    setSearchParams(next, { replace: true });
  };

  const getDatePreset = () => {
    if (!startDate && !endDate) return '';
    const now = new Date();
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = formatDate(now);
    if (startDate === today && endDate === today) return 'TODAY';

    const yesterdayObj = new Date(now);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterday = formatDate(yesterdayObj);
    if (startDate === yesterday && endDate === yesterday) return 'YESTERDAY';

    const past7Obj = new Date(now);
    past7Obj.setDate(past7Obj.getDate() - 6);
    const past7 = formatDate(past7Obj);
    if (startDate === past7 && endDate === today) return 'LAST_7_DAYS';

    const firstMonthObj = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (startDate === formatDate(firstMonthObj) && endDate === formatDate(lastMonthObj)) return 'THIS_MONTH';

    const firstLastMonthObj = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastLastMonthObj = new Date(now.getFullYear(), now.getMonth(), 0);
    if (startDate === formatDate(firstLastMonthObj) && endDate === formatDate(lastLastMonthObj)) return 'LAST_MONTH';

    return 'CUSTOM';
  };

  const handleClearDateFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('startDate');
    next.delete('endDate');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleResetFilters = () => {
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    setInputValue('');
    setShowCancelled(false);
    setSearchParams(next, { replace: true });
  };

  const hasActiveFilters = Boolean(
    inputValue || search || showCancelled ||
    (activeTab === 'SO' && (orderStatus || paymentStatus || taxStatus || salespersonFilter || startDate || endDate))
  );

  const getModuleForTab = (tab) => {
    switch (tab) {
      case 'SO': return 'sales_orders';
      case 'PO': return 'purchase_orders';
      case 'SJ': return isPurchase ? 'purchase_orders' : 'deliveries';
      case 'INV': return 'invoices';
      case 'RET': return isPurchase ? 'purchase_orders' : 'sales_orders';
      default: return isPurchase ? 'purchase_orders' : 'sales_orders';
    }
  };

  const currentModule = getModuleForTab(activeTab);
  const canRead = hasPermission(user, currentModule, 'read');
  const canCreate = hasPermission(user, currentModule, 'create');
  const canUpdate = hasPermission(user, currentModule, 'update');
  const canDelete = hasPermission(user, currentModule, 'delete');
  const { toast } = useToast();
  
  // Data Lists
  const [salesOrders, setSalesOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseReceipts, setPurchaseReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedSoIds, setSelectedSoIds] = useState(new Set());

  // Master Data
  const [customersList, setCustomersList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [coas, setCoas] = useState([]);
  const [driversList, setDriversList] = useState([]);

  // Form Modal States
  const [soModalOpen, setSoModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [sjModalOpen, setSjModalOpen] = useState(false);
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [retModalOpen, setRetModalOpen] = useState(false);

  // Detail Modal States
  const [detailSoModalOpen, setDetailSoModalOpen] = useState(false);
  const [selectedSoDetail, setSelectedSoDetail] = useState(null);
  const [detailPoModalOpen, setDetailPoModalOpen] = useState(false);
  const [selectedPoDetail, setSelectedPoDetail] = useState(null);
  const [detailReturModalOpen, setDetailReturModalOpen] = useState(false);
  const [selectedReturDetail, setSelectedReturDetail] = useState(null);

  // Payment Recording Modal State
  const [activeSoDropdownId, setActiveSoDropdownId] = useState(null);
  const [soDropdownPos, setSoDropdownPos] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetDoc, setPaymentTargetDoc] = useState(null); // { type: 'SO'|'PO', id, title, total, paid, remaining }
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    accountId: '',
    notes: 'Pelunasan tagihan'
  });

  // Selected Documents for secondary actions
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [soFormMode, setSoFormMode] = useState('CREATE');
  const [editingSoId, setEditingSoId] = useState(null);
  const [poFormMode, setPoFormMode] = useState('CREATE');
  const [editingPoId, setEditingPoId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Form States
  const [soForm, setSoForm] = useState({
    soNumber: '',
    soDate: '',
    contactId: '',
    taxId: '',
    salesperson: '',
    paymentTerm: 'LUNAS', // 'LUNAS' | 'DP' | 'TEMPO'
    dpAmount: 0,
    dueDate: '',
    applyTax: true,
    taxInclusive: true,
    globalDiscountPercent: 0,
    autoSj: false,
    autoInvoice: true,
    fulfillmentType: 'DELIVERY',
    warehouseId: '',
    driverName: '',
    vehiclePlate: '',
    items: [{ productId: '', qty: 1, price: 0, discount: 0, discountPercent: 0 }]
  });

  const [poForm, setPoForm] = useState({
    poNumber: '',
    poDate: '',
    contactId: '',
    warehouseId: '',
    taxId: '',
    paymentTerm: 'LUNAS', // 'LUNAS' | 'DP' | 'TEMPO'
    dpAmount: 0,
    dueDate: '',
    applyTax: true,
    taxInclusive: false,
    globalDiscountPercent: 0,
    globalDiscountAmount: 0,
    autoReceive: false,
    autoInvoice: true,
    requireApproval: true,
    items: [{ productId: '', qty: 1, bonusQty: 0, price: 0, discount: 0, discountPercent: 0, discountType: 'AMOUNT' }]
  });

  const [sjForm, setSjForm] = useState({
    deliveryNumber: '',
    deliveryDate: '',
    driverName: '',
    vehiclePlate: '',
    notes: ''
  });

  const [invForm, setInvForm] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    taxInvoiceNumber: ''
  });

  const [retForm, setRetForm] = useState({
    returnNumber: '',
    returnDate: '',
    warehouseId: '',
    quarantineWarehouseId: '',
    notes: '',
    status: 'FORM_ISSUED',
    items: [{ productId: '', qty: 1, price: 0, condition: 'GOOD', reason: '' }]
  });

  const [printDoc, setPrintDoc] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  // Evidence state
  const [payEvidenceFile, setPayEvidenceFile] = useState(null);
  const [payEvidencePreview, setPayEvidencePreview] = useState('');

  const [sjEvidenceFile, setSjEvidenceFile] = useState(null);
  const [sjEvidencePreview, setSjEvidencePreview] = useState('');

  // Receive PO Modal State
  const [receivePoModalOpen, setReceivePoModalOpen] = useState(false);
  const [selectedPoForReceive, setSelectedPoForReceive] = useState(null);
  const [poReceiveDate, setPoReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [poReceiveNotes, setPoReceiveNotes] = useState('Penerimaan barang PO');
  const [poReceiveEvidenceFile, setPoReceiveEvidenceFile] = useState(null);
  const [poReceiveEvidencePreview, setPoReceiveEvidencePreview] = useState('');

  // Delivery Confirm (DELIVERED) Modal State
  const [deliveryConfirmModalOpen, setDeliveryConfirmModalOpen] = useState(false);
  const [selectedDeliveryForConfirm, setSelectedDeliveryForConfirm] = useState(null);
  const [deliveryConfirmReceivedBy, setDeliveryConfirmReceivedBy] = useState('');
  const [deliveryConfirmNotes, setDeliveryConfirmNotes] = useState('');
  const [deliveryConfirmEvidenceFile, setDeliveryConfirmEvidenceFile] = useState(null);
  const [deliveryConfirmEvidencePreview, setDeliveryConfirmEvidencePreview] = useState('');

  // Lightbox Image Preview Modal
  const [previewImage, setPreviewImage] = useState({ isOpen: false, url: '', title: '' });

  // Export Penjualan Format Distribusi (DMS) States
  const [exportDmsModalOpen, setExportDmsModalOpen] = useState(false);
  const [exportDmsLoading, setExportDmsLoading] = useState(false);
  const [exportDmsFilter, setExportDmsFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    salespersonId: '',
    taxStatus: ''
  });

  const handleExecuteExportDms = async () => {
    try {
      setExportDmsLoading(true);
      toast.info('Menyiapkan dan mengambil data penjualan format distribusi...');
      
      const res = await api.get('/sales-orders/export-distribution', {
        params: {
          startDate: exportDmsFilter.startDate,
          endDate: exportDmsFilter.endDate,
          salespersonId: exportDmsFilter.salespersonId || undefined,
          taxStatus: exportDmsFilter.taxStatus || undefined
        }
      });

      const list = res.data?.data || [];
      if (!list || list.length === 0) {
        toast.warning('Tidak ada data transaksi penjualan pada rentang tanggal dan filter tersebut.');
        return;
      }

      const headers = [
        'Nama Pemasok Utama Barang & Jasa',
        'Kode #',
        'Nama Barang',
        'ID Pelanggan Pelanggan',
        'Nama Pelanggan',
        'Kecamatan',
        'Kelurahan',
        'Nama Kategori Pelanggan',
        'Tanggal',
        'Nomor #',
        'Kts (Unit#1)',
        'Kuantitas',
        'Satuan',
        'Rasio Satuan #2 Barang & Jasa',
        '@Harga',
        'Total Harga',
        'Persentase PPN Barang & Jasa',
        'Tipe Transaksi',
        'ID Karyawan Tenaga Penjual',
        'Nama Tenaga Penjual',
        'Tgl Join (NOO)',
        'Tipe Outlet',
        'RO/NOO',
        'Kategori Sales',
        'CRT FIX',
        'VALUE FIX',
        'Kts (Unit#1).1',
        'Bonus/Pcs',
        'Cek',
        'SALES'
      ];

      const rows = list.map(item => [
        item.pemasok,
        item.kode,
        item.namaBarang,
        item.idPelanggan,
        item.namaPelanggan,
        item.kecamatan,
        item.kelurahan,
        item.kategoriPelanggan,
        item.tanggal,
        item.nomor,
        item.ktsUnit1,
        item.kuantitas,
        item.satuan,
        item.rasioSatuan2,
        item.dppSatuan,
        item.totalDpp,
        item.ppnRate,
        item.tipeTransaksi,
        item.idSales,
        item.namaSales,
        item.tglJoin,
        item.tipeOutlet,
        item.roNoo,
        item.kategoriSales,
        item.crtFix,
        item.valueFix,
        item.ktsUnit1Dup,
        item.bonusPcs,
        item.cek,
        item.salesClosing
      ]);

      const wsData = [
        ['DATA MENTAH PENJUALAN (FORMAT DISTRIBUSI)'],
        ['Keterangan:', `Data Penjualan dari tanggal ${exportDmsFilter.startDate} sampai tanggal ${exportDmsFilter.endDate}`],
        ['Waktu Ekspor:', new Date().toLocaleString('id-ID')],
        [],
        headers,
        ...rows
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      ws['!cols'] = [
        { wch: 32 }, // Pemasok
        { wch: 16 }, // Kode #
        { wch: 36 }, // Nama Barang
        { wch: 18 }, // ID Pelanggan
        { wch: 30 }, // Nama Pelanggan
        { wch: 18 }, // Kecamatan
        { wch: 18 }, // Kelurahan
        { wch: 20 }, // Kategori Pelanggan
        { wch: 22 }, // Tanggal
        { wch: 24 }, // Nomor #
        { wch: 14 }, // Kts (Unit#1)
        { wch: 12 }, // Kuantitas
        { wch: 14 }, // Satuan
        { wch: 24 }, // Rasio Satuan #2
        { wch: 16 }, // @Harga
        { wch: 18 }, // Total Harga
        { wch: 24 }, // Persentase PPN
        { wch: 18 }, // Tipe Transaksi
        { wch: 22 }, // ID Karyawan
        { wch: 22 }, // Nama Sales
        { wch: 16 }, // Tgl Join
        { wch: 16 }, // Tipe Outlet
        { wch: 12 }, // RO/NOO
        { wch: 16 }, // Kategori Sales
        { wch: 12 }, // CRT FIX
        { wch: 18 }, // VALUE FIX
        { wch: 14 }, // Kts (Unit#1).1
        { wch: 12 }, // Bonus/Pcs
        { wch: 10 }, // Cek
        { wch: 22 }  // SALES
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Penjualan_DMS');
      const filename = `Data_Penjualan_Distribusi_${exportDmsFilter.startDate}_sd_${exportDmsFilter.endDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Berhasil mengunduh ${list.length} baris data penjualan format distribusi!`);
      setExportDmsModalOpen(false);
    } catch (err) {
      console.error('Export DMS Error:', err);
      toast.error(err.response?.data?.message || 'Gagal mengekspor data penjualan');
    } finally {
      setExportDmsLoading(false);
    }
  };

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

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    fetchActiveTabData();
  }, [activeTab, page, search, taxStatus, taxMode, orderStatus, paymentStatus, salespersonFilter, startDate, endDate, showCancelled]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchActiveTabData = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      if (activeTab === 'SO') {
        endpoint = `/sales-orders?page=${page}&limit=15&search=${encodeURIComponent(search)}`;
        if (effectiveTaxStatus) endpoint += `&taxStatus=${effectiveTaxStatus}`;
        if (orderStatus) endpoint += `&status=${orderStatus}`;
        if (paymentStatus) endpoint += `&paymentStatus=${paymentStatus}`;
        if (salespersonFilter) endpoint += `&salesperson=${encodeURIComponent(salespersonFilter)}`;
        if (startDate) endpoint += `&startDate=${startDate}`;
        if (endDate) endpoint += `&endDate=${endDate}`;
        if (showCancelled) endpoint += `&showCancelled=true`;
      }
      else if (activeTab === 'PO') {
        endpoint = `/purchase-orders?page=${page}&limit=15&search=${search}`;
        if (showCancelled) endpoint += `&showCancelled=true`;
      }
      else if (activeTab === 'SJ') {
        if (isPurchase) {
          endpoint = `/purchase-orders?hasReceipt=true&page=${page}&limit=15&search=${encodeURIComponent(search)}`;
          if (showCancelled) endpoint += `&showCancelled=true`;
        } else {
          endpoint = `/deliveries?page=${page}&limit=15&search=${encodeURIComponent(search)}`;
        }
      }
      else if (activeTab === 'INV') {
        const invType = isPurchase ? 'PURCHASE' : 'SALES';
        endpoint = `/invoices?page=${page}&limit=15&search=${search}&type=${invType}`;
      }
      else if (activeTab === 'RET') {
        const retType = isPurchase ? 'PURCHASE_RETURN' : 'SALES_RETURN';
        endpoint = `/returns?page=${page}&limit=15&search=${search}&type=${retType}`;
      }

      const res = await api.get(endpoint);
      const listData = res.data.data || [];
      const meta = res.data.pagination;

      if (activeTab === 'SO') setSalesOrders(listData);
      else if (activeTab === 'PO') setPurchaseOrders(listData);
      else if (activeTab === 'SJ') {
        if (isPurchase) {
          setPurchaseReceipts(listData);
        } else {
          setDeliveries(listData);
        }
      }
      else if (activeTab === 'INV') setInvoices(listData);
      else if (activeTab === 'RET') setReturns(listData);

      setPagination(meta || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [custRes, suppRes, prodRes, whRes, taxRes, usersRes, spRes, coaRes, driverRes] = await Promise.all([
        api.get('/customers?limit=10000').catch(() => ({ data: { data: [] } })),
        api.get('/suppliers?limit=1000').catch(() => ({ data: { data: [] } })),
        api.get('/products?limit=10000').catch(() => ({ data: { data: [] } })),
        api.get('/warehouses').catch(() => ({ data: { data: [] } })),
        api.get('/taxes').catch(() => ({ data: { data: [] } })),
        api.get('/users?limit=500').catch(() => ({ data: { data: [] } })),
        api.get('/salespersons?limit=500').catch(() => ({ data: { data: [] } })),
        api.get('/chart-of-accounts').catch(() => ({ data: { data: [] } })),
        api.get('/drivers?isActive=true&limit=500').catch(() => ({ data: { data: [] } }))
      ]);
      
      setCustomersList(custRes.data.data || []);
      setSuppliersList(suppRes.data.data || []);
      setProducts(prodRes.data.data || []);
      setWarehouses(whRes.data.data || []);
      setTaxes(taxRes.data.data || []);
      setStaffUsers(usersRes.data.data || []);
      setSalespersons(spRes.data.data || []);
      setCoas(coaRes.data.data || []);
      setDriversList(driverRes.data.data || []);
    } catch (err) {
      console.error('Failed to load master data for forms', err);
    }
  };

  // Close SO action dropdown when clicking outside, scrolling or resizing
  useEffect(() => {
    const handleClose = (e) => {
      if (!e.target.closest('.so-action-dropdown-btn') && !e.target.closest('.so-fixed-dropdown-menu')) {
        setActiveSoDropdownId(null);
        setSoDropdownPos(null);
      }
    };
    const handleScroll = (e) => {
      if (e.target?.closest && e.target.closest('.so-fixed-dropdown-menu')) return;
      setActiveSoDropdownId(null);
      setSoDropdownPos(null);
    };

    document.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleClose);

    return () => {
      document.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleClose);
    };
  }, []);

  const handleToggleSoDropdown = (e, rowId) => {
    e.stopPropagation();
    if (activeSoDropdownId === rowId) {
      setActiveSoDropdownId(null);
      setSoDropdownPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260;

    setSoDropdownPos({
      top: rect.bottom + 4,
      bottomTop: rect.top - 4,
      right: Math.max(16, window.innerWidth - rect.right),
      openUp
    });
    setActiveSoDropdownId(rowId);
  };

  const handleTabChange = (newTab) => {
    setActiveSoDropdownId(null);
    setSoDropdownPos(null);
    setSelectedSoIds(new Set());
    const next = new URLSearchParams();
    next.set('tab', newTab);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
    setInputValue('');
  };

  const handlePageChange = (newPage) => {
    setActiveSoDropdownId(null);
    setSoDropdownPos(null);
    const next = new URLSearchParams(searchParams);
    next.set('page', newPage.toString());
    setSearchParams(next, { replace: true });
  };

  // SO / PO / Retur Items Handlers
  const addSoItem = () => setSoForm({
    ...soForm,
    items: [...soForm.items, { productId: '', qty: 1, bonusQty: 0, unit: '', conversionRatio: 1, bonusUnit: '', bonusConversionRatio: 1, price: 0, discount: 0, discountPercent: 0, discountType: 'AMOUNT' }]
  });

  const removeSoItem = (idx) => {
    const updated = [...soForm.items];
    updated.splice(idx, 1);
    setSoForm({ ...soForm, items: updated });
  };

  const handleSoItemChange = (idx, field, val) => {
    const updated = [...soForm.items];
    const item = { ...updated[idx] };
    item[field] = val;

    const p = products.find(prod => prod.id === parseInt(item.productId));

    if (field === 'productId') {
      if (p) {
        const defaultUnit = (p.units && p.units.length > 0) ? (p.units.find(u => u.isBaseUnit) || p.units[0]) : null;
        let unitName = defaultUnit ? defaultUnit.unitName : (p.unit || 'pcs');
        if (/^\d+$/.test(String(unitName || '').trim())) {
          unitName = p.unit || 'pcs';
        }
        const price = (defaultUnit && parseFloat(defaultUnit.sellingPrice) > 0)
          ? parseFloat(defaultUnit.sellingPrice)
          : parseFloat(p.sellingPrice || 0);

        item.unit = unitName;
        item.conversionRatio = defaultUnit ? parseFloat(defaultUnit.conversionRatio || 1) : 1;
        item.bonusUnit = unitName;
        item.bonusConversionRatio = item.conversionRatio;
        item.price = price;
        item.discountType = item.discountType || 'AMOUNT';
        const pct = parseFloat(item.discountPercent || 0);
        item.discount = price * (pct / 100);
      }
    } else if (field === 'unit') {
      if (p) {
        const u = p.units?.find(unit => unit.unitName === val || String(unit.id) === String(val));
        if (u) {
          const cleanUName = (/^\d+$/.test(String(u.unitName || '').trim())) ? (p.unit || 'pcs') : u.unitName;
          item.unit = cleanUName;
          item.conversionRatio = parseFloat(u.conversionRatio || 1);
          if (parseFloat(u.sellingPrice) > 0) {
            item.price = parseFloat(u.sellingPrice);
          } else if (p.sellingPrice) {
            item.price = parseFloat(p.sellingPrice) * parseFloat(u.conversionRatio || 1);
          }
        } else {
          item.unit = val;
          item.conversionRatio = 1;
        }
        if (item.discountType === 'PERCENT') {
          const pct = parseFloat(item.discountPercent || 0);
          item.discount = Math.round((parseFloat(item.price) || 0) * (pct / 100));
        } else {
          const price = parseFloat(item.price || 0);
          const disc = parseFloat(item.discount || 0);
          item.discountPercent = price > 0 ? Math.round(((disc / price) * 100) * 100) / 100 : 0;
        }
      }
    } else if (field === 'price') {
      const price = parseFloat(val) || 0;
      if (item.discountType === 'PERCENT') {
        const pct = parseFloat(item.discountPercent || 0);
        item.discount = Math.round(price * (pct / 100));
      } else {
        const disc = parseFloat(item.discount || 0);
        item.discountPercent = price > 0 ? Math.round(((disc / price) * 100) * 100) / 100 : 0;
      }
    } else if (field === 'discount') {
      const disc = parseFloat(val) || 0;
      const price = parseFloat(item.price || 0);
      item.discount = val;
      item.discountPercent = price > 0 ? Math.round(((disc / price) * 100) * 100) / 100 : 0;
    } else if (field === 'discountPercent') {
      const pct = parseFloat(val) || 0;
      const price = parseFloat(item.price || 0);
      item.discountPercent = val;
      item.discount = Math.round(price * (pct / 100));
    } else if (field === 'discountType') {
      item.discountType = val;
      const price = parseFloat(item.price || 0);
      if (val === 'PERCENT') {
        const disc = parseFloat(item.discount || 0);
        item.discountPercent = price > 0 ? Math.round(((disc / price) * 100) * 100) / 100 : 0;
      } else {
        const pct = parseFloat(item.discountPercent || 0);
        item.discount = Math.round(price * (pct / 100));
      }
    } else if (field === 'bonusUnit') {
      if (p) {
        const u = p.units?.find(unit => unit.unitName === val || String(unit.id) === String(val));
        if (u) {
          const cleanUName = (/^\d+$/.test(String(u.unitName || '').trim())) ? (p.unit || 'pcs') : u.unitName;
          item.bonusUnit = cleanUName;
          item.bonusConversionRatio = parseFloat(u.conversionRatio || 1);
        } else {
          item.bonusUnit = val;
          item.bonusConversionRatio = 1;
        }
      }
    }

    updated[idx] = item;
    setSoForm({ ...soForm, items: updated });
  };

  const addPoItem = () => setPoForm({ ...poForm, items: [...poForm.items, { productId: '', qty: 1, bonusQty: 0, price: 0, discount: 0, discountPercent: 0, discountType: 'AMOUNT' }] });
  const removePoItem = (idx) => {
    const updated = [...poForm.items];
    updated.splice(idx, 1);
    setPoForm({ ...poForm, items: updated });
  };
  const handlePoItemChange = (idx, field, val) => {
    const updated = [...poForm.items];
    const item = { ...updated[idx] };
    item[field] = val;

    const selProd = products.find(prod => prod.id === parseInt(item.productId)) || item.product;
    const struct = getProductStructure(selProd);

    if (field === 'productId') {
      if (selProd) {
        item.price = struct.bigPrice || parseFloat(selProd.purchasePrice || 0);
        item.unit = struct.bigUnitName;
        item.smallUnit = struct.smallUnitName;
        item.capacity = struct.capacity;
        item.bigQty = 1;
        item.smallQty = 0;
        item.bigBonusQty = 0;
        item.smallBonusQty = 0;
        item.discountType = item.discountType || 'AMOUNT';
        const pct = parseFloat(item.discountPercent || 0);
        item.discount = item.price * (pct / 100);
      }
    } else if (field === 'price') {
      const price = parseFloat(val) || 0;
      if (item.discountType === 'PERCENT') {
        const pct = parseFloat(item.discountPercent || 0);
        item.discount = price * (pct / 100);
      } else {
        const disc = parseFloat(item.discount || 0);
        item.discountPercent = price > 0 ? (disc / price) * 100 : 0;
      }
    } else if (field === 'discount') {
      const disc = parseFloat(val) || 0;
      const price = parseFloat(item.price || 0);
      item.discount = disc;
      item.discountPercent = price > 0 ? (disc / price) * 100 : 0;
    } else if (field === 'discountPercent') {
      const pct = parseFloat(val) || 0;
      const price = parseFloat(item.price || 0);
      item.discountPercent = pct;
      item.discount = price * (pct / 100);
    } else if (field === 'discountType') {
      item.discountType = val;
    }

    const { totalBaseQty, totalBaseBonusQty, netSubtotal } = calculateTieredItemSubtotal(item, struct);
    item.qty = totalBaseQty;
    item.bonusQty = totalBaseBonusQty;
    item.subtotal = netSubtotal;

    updated[idx] = item;
    setPoForm({ ...poForm, items: updated });
  };

  const addRetItem = () => setRetForm({ ...retForm, items: [...retForm.items, { productId: '', qty: 1, price: 0, condition: 'GOOD', reason: '' }] });
  const removeRetItem = (idx) => {
    const updated = [...retForm.items];
    updated.splice(idx, 1);
    setRetForm({ ...retForm, items: updated });
  };
  const handleRetItemChange = (idx, field, val) => {
    const updated = [...retForm.items];
    updated[idx][field] = val;
    setRetForm({ ...retForm, items: updated });
  };

  // ── Open Detail Navigation Handlers ─────────────────────────────────────
  const handleOpenDetailSo = (soId) => {
    navigate(`/transactions/sales-orders/${soId}`);
  };

  const handleOpenDetailPo = (poId) => {
    navigate(`/transactions/purchase-orders/${poId}`);
  };

  const handleOpenDetailRetur = (retId) => {
    navigate(`/transactions/returns/${retId}`);
  };

  // ── Open Payment Modal Handler ─────────────────────────────────────────────
  const handleOpenPaymentModal = (doc, type) => {
    const { total, paid, remaining } = getDocPaymentInfo(doc);

    setPaymentTargetDoc({
      type, // 'SO' | 'PO'
      id: doc.id,
      docNumber: doc.soNumber || doc.poNumber,
      total,
      paid,
      remaining,
      contactName: doc.customer?.name || doc.supplier?.name || 'Kontak'
    });

    setPaymentForm({
      amount: remaining,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      notes: remaining === total ? 'Pembayaran Lunas' : 'Pelunasan sisa angsuran'
    });
    setPayEvidenceFile(null);
    setPayEvidencePreview('');
    setActionError('');
    setPaymentModalOpen(true);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentTargetDoc) return;
    setActionLoading(true);
    setActionError('');
    try {
      const endpoint = paymentTargetDoc.type === 'SO'
        ? `/sales-orders/${paymentTargetDoc.id}/payment`
        : `/purchase-orders/${paymentTargetDoc.id}/payment`;

      const formData = new FormData();
      formData.append('amount', paymentForm.amount);
      formData.append('paymentDate', paymentForm.paymentDate);
      formData.append('paymentMethod', paymentForm.paymentMethod);
      if (paymentForm.accountId) formData.append('accountId', paymentForm.accountId);
      if (paymentForm.notes) formData.append('notes', paymentForm.notes);
      if (payEvidenceFile) formData.append('evidence', payEvidenceFile);

      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Pembayaran ${paymentTargetDoc.docNumber} berhasil dicatat.`);
      setPaymentModalOpen(false);
      fetchActiveTabData();

      // Refresh detail modal if open
      if (detailSoModalOpen && selectedSoDetail?.id === paymentTargetDoc.id) {
        handleOpenDetailSo(paymentTargetDoc.id);
      }
      if (detailPoModalOpen && selectedPoDetail?.id === paymentTargetDoc.id) {
        handleOpenDetailPo(paymentTargetDoc.id);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Gagal mencatat pembayaran.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Submissions ────────────────────────────────────────────────────────────
  const handleCreateSo = async (isDraft = false) => {
    setActionError('');
    setActionLoading(true);
    try {
      const { salesperson, paymentTerm, dpAmount, dueDate, ...rest } = soForm;
      const selectedSp = salespersons.find(sp => sp.id === parseInt(salesperson));
      const targetWarehouseId = soForm.warehouseId || warehouses[0]?.id;
      const existingSo = soFormMode === 'EDIT' ? salesOrders.find(s => s.id === editingSoId) : null;
      const existingMetadata = existingSo?.metadata || {};
      const isTaxInclusive = soForm.taxInclusive !== undefined ? Boolean(soForm.taxInclusive) : Boolean(soForm.applyTax);
      
      const itemsSum = (soForm.items || []).reduce((sum, it) => {
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.price) || 0;
        const d = parseFloat(it.discount) || 0;
        return sum + (q * Math.max(0, p - d));
      }, 0);
      const discMode = soForm.globalDiscountMode || (parseFloat(soForm.globalDiscountAmount || 0) > 0 && !parseFloat(soForm.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT');
      const discPct = parseFloat(soForm.globalDiscountPercent || 0);
      const discAmt = discMode === 'AMOUNT' ? parseFloat(soForm.globalDiscountAmount || 0) : Math.round(itemsSum * (discPct / 100));

      const cleanItems = (soForm.items || []).map(it => ({
        ...it,
        qty: parseFloat(it.qty) || 0,
        price: parseFloat(it.price) || 0,
        discount: parseFloat(it.discount || 0),
        discountPercent: parseFloat(it.discountPercent || 0),
        discountType: it.discountType || 'AMOUNT'
      }));

      const payload = {
        ...rest,
        items: cleanItems,
        warehouseId: targetWarehouseId,
        autoSj: false,
        autoInvoice: isDraft ? false : (soForm.autoInvoice !== false),
        fulfillmentType: soForm.fulfillmentType || 'DELIVERY',
        paymentTerm: paymentTerm || 'LUNAS',
        dpAmount: paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0,
        dueDate: (paymentTerm === 'TEMPO' || paymentTerm === 'DP') ? dueDate : null,
        driverName: '',
        vehiclePlate: '',
        isDraft,
        applyTax: soForm.applyTax,
        taxInclusive: isTaxInclusive,
        globalDiscountMode: discMode,
        globalDiscountPercent: discPct,
        globalDiscountAmount: discAmt,
        metadata: {
          ...existingMetadata,
          fulfillmentType: soForm.fulfillmentType || 'DELIVERY',
          isPickup: (soForm.fulfillmentType === 'PICKUP'),
          salespersonId: selectedSp?.id || (salesperson ? parseInt(salesperson) : null),
          salesperson: selectedSp?.name || salesperson || null,
          salespersonCode: selectedSp?.code || null,
          salespersonName: selectedSp?.name || (typeof salesperson === 'string' ? salesperson : null),
          globalDiscountMode: discMode,
          globalDiscountPercent: discPct,
          globalDiscountAmount: discAmt,
          applyTax: soForm.applyTax,
          taxInclusive: isTaxInclusive,
          isDraft,
          driverName: soForm.autoSj ? (soForm.driverName || '') : (existingMetadata.driverName || ''),
          vehiclePlate: soForm.autoSj ? (soForm.vehiclePlate || '') : (existingMetadata.vehiclePlate || ''),
          paymentTerm: paymentTerm || 'LUNAS',
          dpAmount: paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0,
          dueDate: (paymentTerm === 'TEMPO' || paymentTerm === 'DP') ? dueDate : null,
          paidAmount: existingMetadata.paidAmount !== undefined ? existingMetadata.paidAmount : (paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0),
          paymentStatus: existingMetadata.paymentStatus || (paymentTerm === 'DP' && parseFloat(dpAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID')
        }
      };

      if (soFormMode === 'CREATE') {
        await api.post('/sales-orders', payload);
        toast.success(isDraft ? `Draft Sales Order ${soForm.soNumber} berhasil disimpan!` : `Sales Order ${soForm.soNumber} berhasil disimpan & dikonfirmasi!`);
      } else {
        await api.put(`/sales-orders/${editingSoId}`, payload);
        toast.success(isDraft ? `Draft Sales Order ${soForm.soNumber} berhasil diperbarui!` : `Sales Order ${soForm.soNumber} berhasil diperbarui & dikonfirmasi!`);
      }
      setSoModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || `Gagal ${soFormMode === 'CREATE' ? 'membuat' : 'mengubah'} Sales Order.`;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreateSo = (e, isDraft = false) => {
    if (e) e.preventDefault();

    // Check bonus stock shortage when confirming SO
    if (!isDraft) {
      const bonusShortages = [];
      soForm.items.forEach(it => {
        const bonusQty = parseInt(it.bonusQty) || 0;
        if (bonusQty > 0) {
          const p = products.find(prod => prod.id === parseInt(it.productId));
          if (p) {
            const selWhId = parseInt(soForm.warehouseId);
            const whStockObj = selWhId && p.warehouseStocks ? p.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
            const bonusStock = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (p.totalBonusStock !== undefined ? parseFloat(p.totalBonusStock) : 0);
            const bonusRatio = parseFloat(it.bonusConversionRatio || 1);
            const reqBonus = bonusQty * bonusRatio;
            if (reqBonus > bonusStock) {
              bonusShortages.push(`${p.name} (Tersedia: ${bonusStock} ${p.unit || 'pcs'}, Diminta: ${reqBonus} ${p.unit || 'pcs'})`);
            }
          }
        }
      });

      if (bonusShortages.length > 0) {
        toast.error(`Stok bonus tidak mencukupi untuk: ${bonusShortages.join(', ')}. Harap sesuaikan kuantitas bonus atau simpan sebagai Draft.`);
        setActionError(`Stok bonus tidak mencukupi untuk:\n• ${bonusShortages.join('\n• ')}\n\nHarap sesuaikan kuantitas bonus atau simpan sebagai Draft terlebih dahulu.`);
        return;
      }
    }

    setConfirmConfig({
      isOpen: true,
      title: isDraft 
        ? (soFormMode === 'CREATE' ? 'Simpan Draft Sales Order' : 'Simpan Tetap Draft Sales Order') 
        : (soFormMode === 'CREATE' ? 'Simpan & Konfirmasi Sales Order' : 'Proses & Konfirmasi Sales Order'),
      message: isDraft 
        ? `Apakah Anda yakin ingin menyimpan Sales Order ${soForm.soNumber} sebagai Draft?`
        : `Apakah Anda yakin ingin memproses dan mengonfirmasi Sales Order ${soForm.soNumber}?`,
      type: isDraft ? 'warning' : 'info',
      onConfirm: () => handleCreateSo(isDraft)
    });
  };

  const handleCreatePo = async (isDraft = false) => {
    setActionError('');
    setActionLoading(true);
    try {
      if (!poForm.contactId) {
        toast.error('Supplier harus dipilih.');
        setActionLoading(false);
        return;
      }
      if (!poForm.items || poForm.items.length === 0) {
        toast.error('Harap tambahkan minimal 1 barang.');
        setActionLoading(false);
        return;
      }
      const invalidItem = poForm.items.find(it => !it.productId);
      if (invalidItem) {
        toast.error('Ada baris barang yang belum memilih produk.');
        setActionLoading(false);
        return;
      }

      const { paymentTerm, dpAmount, dueDate, ...rest } = poForm;
      const targetWarehouseId = poForm.warehouseId || warehouses[0]?.id;
      const requireApproval = poForm.requireApproval !== false;
      const willAutoReceive = isDraft ? false : (poForm.autoReceive === true || !requireApproval);
      const discMode = poForm.globalDiscountMode || (parseFloat(poForm.globalDiscountAmount || 0) > 0 && !parseFloat(poForm.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT');

      const payloadItems = poForm.items.map(it => {
        const pObj = products.find(p => p.id === parseInt(it.productId)) || it.product;
        const struct = getProductStructure(pObj);
        const { totalBaseQty, totalBaseBonusQty, netSubtotal } = calculateTieredItemSubtotal(it, struct);
        const bigQty = parseFloat(it.bigQty !== undefined ? it.bigQty : it.qty) || 0;
        const smallQty = parseFloat(it.smallQty || 0);
        const bigBonusQty = parseFloat(it.bigBonusQty !== undefined ? it.bigBonusQty : it.bonusQty) || 0;
        const smallBonusQty = parseFloat(it.smallBonusQty || 0);

        return {
          productId: parseInt(it.productId),
          qty: totalBaseQty,
          bonusQty: totalBaseBonusQty,
          bigQty,
          smallQty,
          bigBonusQty,
          smallBonusQty,
          bigUnit: struct.bigUnitName,
          smallUnit: struct.smallUnitName,
          capacity: struct.capacity,
          unit: struct.bigUnitName,
          price: parseFloat(it.price || struct.bigPrice || 0),
          discount: parseFloat(it.discount || 0),
          discountPercent: parseFloat(it.discountPercent || 0),
          discountType: it.discountType || 'AMOUNT',
          subtotal: netSubtotal
        };
      });

      const payload = {
        ...rest,
        warehouseId: targetWarehouseId,
        requireApproval,
        autoReceive: willAutoReceive,
        autoInvoice: isDraft ? false : (poForm.autoInvoice !== false),
        globalDiscountMode: discMode,
        globalDiscountPercent: parseFloat(poForm.globalDiscountPercent || 0),
        globalDiscountAmount: parseFloat(poForm.globalDiscountAmount || 0),
        isDraft,
        items: payloadItems,
        metadata: {
          isDraft,
          requireApproval,
          paymentTerm: paymentTerm || 'LUNAS',
          dpAmount: paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0,
          dueDate: (paymentTerm === 'TEMPO' || paymentTerm === 'DP') ? dueDate : null,
          paidAmount: paymentTerm === 'LUNAS' ? 999999999 : (paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0),
          paymentStatus: paymentTerm === 'LUNAS' ? 'PAID' : (paymentTerm === 'DP' && parseFloat(dpAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID'),
          globalDiscountMode: discMode,
          globalDiscountPercent: parseFloat(poForm.globalDiscountPercent || 0),
          globalDiscountAmount: parseFloat(poForm.globalDiscountAmount || 0),
          itemsDetail: payloadItems
        }
      };

      const isStaffUser = user?.role === 'STAFF';
      if (poFormMode === 'CREATE') {
        await api.post('/purchase-orders', payload);
        toast.success(
          isDraft 
            ? `Draft Purchase Order ${poForm.poNumber} berhasil disimpan!` 
            : (!requireApproval
                ? `Purchase Order ${poForm.poNumber} berhasil dibuat & langsung SELESAI (Stok telah masuk)!`
                : (isStaffUser 
                    ? `Purchase Order ${poForm.poNumber} berhasil dibuat & diajukan untuk persetujuan Manager/Owner!` 
                    : `Purchase Order ${poForm.poNumber} berhasil disimpan & disetujui!`))
        );
      } else {
        await api.put(`/purchase-orders/${editingPoId}`, payload);
        toast.success(
          isDraft 
            ? `Draft Purchase Order ${poForm.poNumber} berhasil diperbarui!` 
            : (!requireApproval
                ? `Purchase Order ${poForm.poNumber} berhasil diselesaikan langsung (Stok telah masuk)!`
                : (isStaffUser 
                    ? `Purchase Order ${poForm.poNumber} berhasil diajukan untuk persetujuan Manager/Owner!` 
                    : `Purchase Order ${poForm.poNumber} berhasil diperbarui & diproses!`))
        );
      }
      setPoModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || `Gagal ${poFormMode === 'CREATE' ? 'membuat' : 'mengubah'} Purchase Order.`;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreatePo = (e, isDraft = false) => {
    if (e) e.preventDefault();
    const isStaffUser = user?.role === 'STAFF';
    const requireApproval = poForm.requireApproval !== false;

    let modalTitle = '';
    let modalMessage = '';

    if (isDraft) {
      modalTitle = poFormMode === 'CREATE' ? 'Simpan Draft Purchase Order' : 'Simpan Tetap Draft Purchase Order';
      modalMessage = `Apakah Anda yakin ingin menyimpan Purchase Order ${poForm.poNumber} sebagai Draft?`;
    } else if (!requireApproval) {
      modalTitle = poFormMode === 'CREATE' ? 'Simpan & Selesaikan PO Langsung' : 'Selesaikan Purchase Order Langsung';
      modalMessage = `Purchase Order ${poForm.poNumber} akan langsung berstatus SELESAI (COMPLETED) dan stok barang otomatis masuk ke gudang tanpa proses persetujuan. Lanjutkan?`;
    } else if (isStaffUser) {
      modalTitle = poFormMode === 'CREATE' ? 'Ajukan Persetujuan Purchase Order' : 'Ajukan Perubahan PO';
      modalMessage = `Ajukan Purchase Order ${poForm.poNumber} untuk persetujuan Admin/Manager atau Owner?`;
    } else {
      modalTitle = poFormMode === 'CREATE' ? 'Simpan & Setujui Purchase Order' : 'Proses & Setujui Purchase Order';
      modalMessage = `Apakah Anda yakin ingin memproses dan menyetujui Purchase Order ${poForm.poNumber}?`;
    }

    setConfirmConfig({
      isOpen: true,
      title: modalTitle,
      message: modalMessage,
      type: isDraft ? 'warning' : 'info',
      onConfirm: () => handleCreatePo(isDraft)
    });
  };

  const handleOpenDeliveryConfirmModal = (delivery) => {
    setSelectedDeliveryForConfirm(delivery);
    setDeliveryConfirmReceivedBy(delivery.salesOrder?.customer?.name || delivery.metadata?.receivedBy || '');
    setDeliveryConfirmNotes('Barang telah diterima lengkap dan dalam kondisi baik.');
    setDeliveryConfirmEvidenceFile(null);
    setDeliveryConfirmEvidencePreview('');
    setActionError('');
    setDeliveryConfirmModalOpen(true);
  };

  const handleDeliveryConfirmSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedDeliveryForConfirm) return;
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('status', 'DELIVERED');
      formData.append('receivedBy', deliveryConfirmReceivedBy);
      formData.append('notes', deliveryConfirmNotes);
      if (deliveryConfirmEvidenceFile) formData.append('evidence', deliveryConfirmEvidenceFile);

      await api.put(`/deliveries/${selectedDeliveryForConfirm.id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Surat Jalan #${selectedDeliveryForConfirm.deliveryNumber} berhasil ditandai sebagai DITERIMA!`);
      setDeliveryConfirmModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memperbarui status Surat Jalan.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSjStatus = async (deliveryId, newStatus) => {
    setActionLoading(true);
    try {
      await api.put(`/deliveries/${deliveryId}/status`, { status: newStatus });
      toast.success(newStatus === 'DELIVERED' ? 'Surat Jalan berhasil ditandai sebagai DITERIMA!' : 'Status Surat Jalan berhasil diperbarui.');
      fetchActiveTabData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui status Surat Jalan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditSo = async (so) => {
    try {
      let targetSo = so;
      // If items are missing or not populated in list row, fetch full detail
      if (!targetSo.items || targetSo.items.length === 0) {
        try {
          const res = await api.get(`/sales-orders/${so.id}`);
          if (res.data?.data) {
            targetSo = res.data.data;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch full SO detail, fallback to row data', fetchErr);
        }
      }

      setSoFormMode('EDIT');
      setEditingSoId(targetSo.id);

      // Ensure customer from SO is in customersList so SearchSelect can resolve it
      if (targetSo.customer && !customersList.some(c => c.id === targetSo.customer.id)) {
        setCustomersList(prev => [targetSo.customer, ...prev]);
      }

      // Ensure products from SO items are in products
      if (targetSo.items && Array.isArray(targetSo.items)) {
        const missingProducts = [];
        targetSo.items.forEach(it => {
          if (it.product && !products.some(p => p.id === it.product.id) && !missingProducts.some(p => p.id === it.product.id)) {
            missingProducts.push(it.product);
          }
        });
        if (missingProducts.length > 0) {
          setProducts(prev => [...missingProducts, ...prev]);
        }
      }

      const taxObj = taxes?.find(t => t.id === parseInt(targetSo.taxId)) || targetSo.tax;
      const isPkp = Boolean((targetSo.taxId && taxObj && parseFloat(taxObj.rate || 0) > 0 && !taxObj.name?.toLowerCase().includes('non')) || targetSo.metadata?.applyTax === true);
      const applyTax = targetSo.metadata?.applyTax !== undefined ? Boolean(targetSo.metadata.applyTax) : isPkp;
      const taxInclusive = targetSo.metadata?.taxInclusive !== undefined ? Boolean(targetSo.metadata.taxInclusive) : Boolean(applyTax);

      // Resolve salesperson ID correctly
      let salespersonVal = targetSo.metadata?.salespersonId || targetSo.salespersonId || '';
      if (!salespersonVal && targetSo.metadata?.salesperson) {
        const spMatch = salespersons.find(s => 
          String(s.id) === String(targetSo.metadata.salesperson) || 
          s.name?.toLowerCase() === String(targetSo.metadata.salesperson).toLowerCase() ||
          (s.code && String(targetSo.metadata.salesperson).toLowerCase().includes(s.code.toLowerCase()))
        );
        salespersonVal = spMatch ? spMatch.id : targetSo.metadata.salesperson;
      }
      if (!salespersonVal && targetSo.customer?.salespersonId) {
        salespersonVal = targetSo.customer.salespersonId;
      }

      const resolvedContactId = targetSo.contactId || targetSo.customer?.id || targetSo.customerId || '';

      setSoForm({
        soNumber: targetSo.soNumber,
        soDate: targetSo.soDate,
        contactId: resolvedContactId,
        taxId: targetSo.taxId || '',
        salesperson: salespersonVal,
        paymentTerm: targetSo.metadata?.paymentTerm || 'LUNAS',
        dpAmount: parseFloat(targetSo.metadata?.dpAmount || 0),
        dueDate: targetSo.metadata?.dueDate || '',
        applyTax,
        taxInclusive,
        globalDiscountMode: targetSo.metadata?.globalDiscountMode || (parseFloat(targetSo.metadata?.globalDiscountAmount || 0) > 0 && !parseFloat(targetSo.metadata?.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT'),
        globalDiscountPercent: parseFloat(targetSo.metadata?.globalDiscountPercent || 0),
        globalDiscountAmount: parseFloat(targetSo.metadata?.globalDiscountAmount || 0),
        autoSj: false,
        fulfillmentType: targetSo.metadata?.fulfillmentType || 'DELIVERY',
        warehouseId: targetSo.warehouseId || targetSo.metadata?.warehouseId || warehouses[0]?.id || '',
        items: (targetSo.items || []).map(item => {
          const itemPrice = parseFloat(item.price) || 0;
          const itemDiscount = parseFloat(item.discount) || 0;
          const discountPercent = itemPrice > 0 ? Math.round((itemDiscount / itemPrice) * 100) : 0;
          return {
            productId: item.productId,
            product: item.product,
            qty: parseFloat(item.qty) || 1,
            bonusQty: parseFloat(item.bonusQty) || 0,
            unit: item.unit || item.product?.unit || 'pcs',
            conversionRatio: parseFloat(item.conversionRatio) || 1,
            bonusUnit: item.bonusUnit || item.unit || item.product?.unit || 'pcs',
            bonusConversionRatio: parseFloat(item.bonusConversionRatio) || 1,
            price: itemPrice,
            discount: itemDiscount,
            discountPercent: item.discountPercent !== undefined ? parseFloat(item.discountPercent) : discountPercent,
            discountType: item.discountType || (parseFloat(item.discountPercent || 0) > 0 ? 'PERCENT' : 'AMOUNT')
          };
        })
      });
      setActionError('');
      setSoModalOpen(true);
    } catch (err) {
      console.error('Error opening SO edit modal:', err);
      toast.error('Gagal membuka form edit pesanan: ' + (err.message || 'Terjadi kesalahan'));
    }
  };

  const handleOpenEditPo = (po) => {
    setPoFormMode('EDIT');
    setEditingPoId(po.id);
    const applyTax = po.metadata?.applyTax !== false;
    const taxInclusive = po.metadata?.taxInclusive === true;

    // Check if tax was inclusive and item prices stored in DB were base prices (net of tax)
    const taxObj = taxes.find(t => t.id === parseInt(po.taxId)) || po.tax;
    const taxRate = (applyTax && taxObj) ? parseFloat(taxObj.rate || 0) : 0;
    
    // Check if the sum of (qty * price) is noticeably less than totalAmount (meaning item.price is net of tax)
    const itemsDbSum = (po.items || []).reduce((sum, it) => sum + ((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0)), 0);
    const poTotal = parseFloat(po.totalAmount || 0);
    const isStoredAsNetPrice = taxInclusive && taxRate > 0 && (itemsDbSum < poTotal - 1);

    setPoForm({
      poNumber: po.poNumber,
      poDate: po.poDate,
      contactId: po.contactId,
      warehouseId: po.warehouseId,
      taxId: po.taxId || '',
      paymentTerm: po.metadata?.paymentTerm || 'LUNAS',
      dpAmount: parseFloat(po.metadata?.dpAmount || 0),
      dueDate: po.metadata?.dueDate || '',
      applyTax,
      taxInclusive,
      globalDiscountMode: po.metadata?.globalDiscountMode || (parseFloat(po.metadata?.globalDiscountAmount || 0) > 0 && !parseFloat(po.metadata?.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT'),
      globalDiscountPercent: parseFloat(po.metadata?.globalDiscountPercent || 0),
      globalDiscountAmount: parseFloat(po.metadata?.globalDiscountAmount || 0),
      autoReceive: false,
      requireApproval: po.metadata?.requireApproval !== false,
      items: (po.items || []).map(item => {
        let rawPrice = parseFloat(item.price || 0);
        if (isStoredAsNetPrice) {
          // Reconstruct original gross price before tax deduction
          rawPrice = Math.round(rawPrice * (1 + (taxRate / 100)));
        }
        const metaItem = (po.metadata?.itemsDetail || []).find(it => String(it.productId) === String(item.productId));
        const itemDiscount = parseFloat(item.discount || metaItem?.discount || 0);
        const itemDiscountPercent = parseFloat(metaItem?.discountPercent || 0);
        const pObj = products.find(p => p.id === parseInt(item.productId)) || item.product;
        const struct = getProductStructure(pObj);

        let bigQty = metaItem?.bigQty;
        let smallQty = metaItem?.smallQty;
        if (bigQty === undefined || bigQty === null) {
          if (struct.hasMultiUnit) {
            const rawQ = parseFloat(item.qty || 0);
            if (struct.isBaseSmall) {
              bigQty = Math.floor(rawQ / struct.capacity);
              smallQty = Math.round(rawQ % struct.capacity);
            } else {
              bigQty = Math.floor(rawQ);
              smallQty = Math.round((rawQ - bigQty) * struct.capacity);
            }
          } else {
            bigQty = parseFloat(item.qty || 0);
            smallQty = 0;
          }
        }

        let bigBonusQty = metaItem?.bigBonusQty;
        let smallBonusQty = metaItem?.smallBonusQty;
        if (bigBonusQty === undefined || bigBonusQty === null) {
          if (struct.hasMultiUnit) {
            const rawBQ = parseFloat(item.bonusQty || 0);
            if (struct.isBaseSmall) {
              bigBonusQty = Math.floor(rawBQ / struct.capacity);
              smallBonusQty = Math.round(rawBQ % struct.capacity);
            } else {
              bigBonusQty = Math.floor(rawBQ);
              smallBonusQty = Math.round((rawBQ - bigBonusQty) * struct.capacity);
            }
          } else {
            bigBonusQty = parseFloat(item.bonusQty || 0);
            smallBonusQty = 0;
          }
        }

        return {
          productId: item.productId,
          qty: parseFloat(item.qty) || 1,
          bonusQty: parseFloat(item.bonusQty) || 0,
          bigQty,
          smallQty,
          bigBonusQty,
          smallBonusQty,
          price: Number(rawPrice.toFixed(2)),
          discount: itemDiscount,
          discountPercent: itemDiscountPercent,
          discountType
        };
      })
    });
    setActionError('');
    setPoModalOpen(true);
  };

  const handleDeleteSo = (soId, soNumber) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Sales Order',
      message: `Apakah Anda yakin ingin menghapus Sales Order ${soNumber}? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.delete(`/sales-orders/${soId}`);
          toast.success(`Sales Order ${soNumber} berhasil dihapus.`);
          fetchActiveTabData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus Sales Order.';
          setError(msg);
          toast.error(msg);
        } finally {
          setActionLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeletePo = (poId, poNumber) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Purchase Order',
      message: `Apakah Anda yakin ingin menghapus Purchase Order ${poNumber}? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.delete(`/purchase-orders/${poId}`);
          toast.success(`Purchase Order ${poNumber} berhasil dihapus.`);
          fetchActiveTabData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus Purchase Order.';
          setError(msg);
          toast.error(msg);
        } finally {
          setActionLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleCancelSo = (soId, soNumber) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Batalkan Sales Order',
      message: `Apakah Anda yakin ingin membatalkan Sales Order ${soNumber}? Faktur dan pengiriman terkait akan dibatalkan, serta stok akan dikembalikan.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.put(`/sales-orders/${soId}/cancel`, { reason: 'Dibatalkan dari tabel transaksi' });
          toast.warning(`Sales Order ${soNumber} berhasil dibatalkan.`);
          fetchActiveTabData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal membatalkan Sales Order.';
          setError(msg);
          toast.error(msg);
        } finally {
          setActionLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleCancelPo = (poId, poNumber) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Batalkan Purchase Order',
      message: `Apakah Anda yakin ingin membatalkan Purchase Order ${poNumber}? Tagihan dan penerimaan barang terkait akan dibatalkan.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.put(`/purchase-orders/${poId}/cancel`, { reason: 'Dibatalkan dari tabel transaksi' });
          toast.warning(`Purchase Order ${poNumber} berhasil dibatalkan.`);
          fetchActiveTabData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal membatalkan Purchase Order.';
          setError(msg);
          toast.error(msg);
        } finally {
          setActionLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleReceivePo = (po) => {
    // If po is an object or id
    const poObj = typeof po === 'object' ? po : purchaseOrders.find(p => p.id === po);
    setSelectedPoForReceive(poObj || { id: po, poNumber: `PO-${po}` });
    setPoReceiveDate(new Date().toISOString().split('T')[0]);
    setPoReceiveNotes('Penerimaan stok barang PO sesuai surat jalan supplier');
    setPoReceiveEvidenceFile(null);
    setPoReceiveEvidencePreview('');
    setActionError('');
    setReceivePoModalOpen(true);
  };

  const handleReceivePoSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedPoForReceive) return;
    setActionError('');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('receiveDate', poReceiveDate);
      formData.append('notes', poReceiveNotes);
      if (poReceiveEvidenceFile) formData.append('evidence', poReceiveEvidenceFile);

      await api.post(`/purchase-orders/${selectedPoForReceive.id}/receive`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Penerimaan barang PO #${selectedPoForReceive.poNumber} berhasil diproses!`);
      setReceivePoModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menerima barang PO.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirmModal = ({ title, message, confirmText, confirmColor, onConfirm, type }) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      confirmText,
      confirmColor,
      type: type || (confirmColor === 'red' ? 'danger' : 'info'),
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) await onConfirm();
      }
    });
  };

  const handleApprovePo = (po) => {
    const poObj = typeof po === 'object' ? po : purchaseOrders.find(p => p.id === po);
    if (!poObj) return;

    openConfirmModal({
      title: `Setujui Purchase Order #${poObj.poNumber}`,
      message: `Apakah Anda yakin ingin menyetujui Purchase Order #${poObj.poNumber}? Setelah disetujui, Staff Gudang dapat memproses penerimaan barang fisik.`,
      confirmText: 'Ya, Setujui PO',
      confirmColor: 'green',
      onConfirm: async () => {
        try {
          await api.put(`/purchase-orders/${poObj.id}/approve`);
          toast.success(`Purchase Order #${poObj.poNumber} berhasil disetujui!`);
          fetchActiveTabData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menyetujui Purchase Order.');
        }
      }
    });
  };

  const handleRejectPo = (po) => {
    const poObj = typeof po === 'object' ? po : purchaseOrders.find(p => p.id === po);
    if (!poObj) return;

    const reason = window.prompt(`Alasan penolakan Purchase Order #${poObj.poNumber}:`, 'Data PO perlu direvisi');
    if (reason === null) return;

    openConfirmModal({
      title: `Tolak Purchase Order #${poObj.poNumber}`,
      message: `Tolak Purchase Order #${poObj.poNumber}? Alasan: "${reason}"`,
      confirmText: 'Ya, Tolak PO',
      confirmColor: 'red',
      onConfirm: async () => {
        try {
          await api.put(`/purchase-orders/${poObj.id}/reject`, { reason });
          toast.success(`Purchase Order #${poObj.poNumber} telah ditolak.`);
          fetchActiveTabData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menolak Purchase Order.');
        }
      }
    });
  };

  const handleShipPo = (po) => {
    const poObj = typeof po === 'object' ? po : purchaseOrders.find(p => p.id === po);
    if (!poObj) return;

    openConfirmModal({
      title: `Tandai Pengiriman PO #${poObj.poNumber}`,
      message: `Ubah status Purchase Order #${poObj.poNumber} menjadi 'Sedang Dikirim Supplier'?`,
      confirmText: 'Ya, Tandai Dikirim',
      confirmColor: 'blue',
      onConfirm: async () => {
        try {
          await api.put(`/purchase-orders/${poObj.id}/ship`);
          toast.success(`PO #${poObj.poNumber} ditandai sedang dikirim supplier.`);
          fetchActiveTabData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal mengubah status pengiriman.');
        }
      }
    });
  };

  const handleCompletePo = (po) => {
    const poObj = typeof po === 'object' ? po : purchaseOrders.find(p => p.id === po);
    if (!poObj) return;

    openConfirmModal({
      title: `Selesaikan Purchase Order #${poObj.poNumber}`,
      message: `Apakah Anda yakin ingin menandai Purchase Order #${poObj.poNumber} sebagai 'SELESAI'? Seluruh barang fisik telah diterima dan transaksi tuntas.`,
      confirmText: 'Ya, Selesaikan PO',
      confirmColor: 'indigo',
      onConfirm: async () => {
        try {
          await api.put(`/purchase-orders/${poObj.id}/complete`);
          toast.success(`PO #${poObj.poNumber} berhasil diselesaikan.`);
          fetchActiveTabData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menyelesaikan Purchase Order.');
        }
      }
    });
  };

  const openSjModal = (so) => {
    setSelectedOrder(so);
    setSjForm({
      deliveryNumber: `SJ-${so.soNumber.substring(3)}`,
      deliveryDate: new Date().toISOString().split('T')[0],
      driverName: so.driverName || so.metadata?.driverName || '',
      vehiclePlate: so.vehiclePlate || so.metadata?.vehiclePlate || '',
      notes: ''
    });
    setSjEvidenceFile(null);
    setSjEvidencePreview('');
    setActionError('');
    setSjModalOpen(true);
  };

  const handleCreateSj = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('salesOrderId', selectedOrder.id);
      formData.append('warehouseId', selectedOrder.warehouseId || warehouses[0]?.id);
      formData.append('deliveryNumber', sjForm.deliveryNumber);
      formData.append('deliveryDate', sjForm.deliveryDate);
      formData.append('driverName', sjForm.driverName || '');
      formData.append('vehiclePlate', sjForm.vehiclePlate || '');
      formData.append('notes', sjForm.notes || '');
      formData.append('items', JSON.stringify(selectedOrder.items.map(item => ({
        productId: item.productId,
        qtyShipped: item.qty
      }))));
      if (sjEvidenceFile) formData.append('evidence', sjEvidenceFile);

      await api.post('/deliveries', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Surat Jalan ${sjForm.deliveryNumber} berhasil diterbitkan!`);
      setSjModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memproses Surat Jalan.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreateSj = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: 'Proses Surat Jalan',
      message: `Apakah Anda yakin ingin membuat Surat Jalan ${sjForm.deliveryNumber} untuk pengiriman barang?`,
      type: 'info',
      onConfirm: () => handleCreateSj()
    });
  };

  const openInvModal = (order, type) => {
    setSelectedOrder({ ...order, invoiceType: type });
    const prefix = type === 'SALES' ? 'INV' : 'BILL';
    const num = order.soNumber || order.poNumber;
    setInvForm({
      invoiceNumber: `${prefix}-${num.substring(3)}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      taxInvoiceNumber: ''
    });
    setActionError('');
    setInvModalOpen(true);
  };

  const handleCreateInvoice = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      const payload = {
        type: selectedOrder.invoiceType,
        invoiceNumber: invForm.invoiceNumber,
        invoiceDate: invForm.invoiceDate,
        dueDate: invForm.dueDate,
        taxInvoiceNumber: invForm.taxInvoiceNumber || null
      };
      if (selectedOrder.invoiceType === 'SALES') {
        payload.salesOrderId = selectedOrder.id;
      } else {
        payload.purchaseOrderId = selectedOrder.id;
      }
      await api.post('/invoices', payload);
      toast.success(`Faktur Invoice ${invForm.invoiceNumber} berhasil diterbitkan!`);
      setInvModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menerbitkan faktur.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreateInvoice = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: 'Terbitkan Faktur',
      message: `Apakah Anda yakin ingin memproses/menerbitkan faktur ${invForm.invoiceNumber}?`,
      type: 'info',
      onConfirm: () => handleCreateInvoice()
    });
  };

  const openRetModal = async (invoice) => {
    setSelectedInvoice(invoice);
    setActionError('');

    let sourceItems = [];
    if (invoice.type === 'SALES' && invoice.salesOrder?.items) {
      sourceItems = invoice.salesOrder.items;
    } else if (invoice.type === 'PURCHASE' && invoice.purchaseOrder?.items) {
      sourceItems = invoice.purchaseOrder.items;
    } else if (invoice.salesOrderId) {
      try {
        const res = await api.get(`/sales-orders/${invoice.salesOrderId}`);
        sourceItems = res.data.data?.items || [];
      } catch (e) {
        console.error(e);
      }
    } else if (invoice.purchaseOrderId) {
      try {
        const res = await api.get(`/purchase-orders/${invoice.purchaseOrderId}`);
        sourceItems = res.data.data?.items || [];
      } catch (e) {
        console.error(e);
      }
    }

    const initialItems = sourceItems.map(item => ({
      productId: item.productId,
      qty: item.qty || 1,
      price: parseFloat(item.price || 0),
      originalQty: item.qty || 1,
      productName: item.product?.name || '',
      sku: item.product?.sku || '',
      condition: 'GOOD',
      reason: ''
    }));

    const cleanInvoiceNumber = invoice.invoiceNumber ? invoice.invoiceNumber.replace(/^INV-/, '') : Date.now().toString().slice(6);
    const defaultRegularWh = warehouses.find(w => w.type !== 'QUARANTINE') || warehouses[0];
    const defaultQuarantineWh = warehouses.find(w => w.type === 'QUARANTINE') || '';

    setRetForm({
      returnNumber: `RET-${cleanInvoiceNumber}`,
      returnDate: new Date().toISOString().split('T')[0],
      warehouseId: defaultRegularWh?.id || '',
      quarantineWarehouseId: defaultQuarantineWh?.id || '',
      notes: `Pengajuan retur barang untuk Faktur #${invoice.invoiceNumber}`,
      status: 'FORM_ISSUED',
      items: initialItems.length > 0 ? initialItems : [{ productId: products[0]?.id || '', qty: 1, price: 0, condition: 'GOOD', reason: '' }]
    });

    setRetModalOpen(true);
  };

  const handleOpenReturForSo = async (so) => {
    try {
      let fullSo = so;
      if (!so.items || so.items.length === 0) {
        const res = await api.get(`/sales-orders/${so.id}`);
        fullSo = res.data?.data || so;
      }

      const defaultWh = warehouses.find(w => w.type !== 'QUARANTINE')?.id || warehouses[0]?.id || '';
      const quarantineWh = warehouses.find(w => w.type === 'QUARANTINE')?.id || '';
      const retNum = generateDocumentNumber('RET');

      const items = (fullSo.items || []).map(it => ({
        productId: it.productId,
        productName: it.product?.name || '',
        originalQty: parseFloat(it.qty || 0),
        qty: parseFloat(it.qty || 1),
        price: parseFloat(it.price || 0),
        condition: 'GOOD',
        reason: ''
      }));

      setRetForm({
        salesOrderId: fullSo.id,
        invoiceId: fullSo.invoices?.[0]?.id || null,
        returnNumber: retNum,
        returnDate: new Date().toISOString().split('T')[0],
        warehouseId: defaultWh,
        quarantineWarehouseId: quarantineWh,
        type: 'SALES_RETURN',
        status: 'FORM_ISSUED',
        notes: `Pengajuan retur barang untuk pesanan #${fullSo.soNumber}`,
        items: items.length > 0 ? items : [{ productId: '', qty: 1, price: 0, condition: 'GOOD', reason: '' }]
      });

      setRetModalOpen(true);
    } catch (err) {
      toast.error('Gagal menyiapkan data retur pesanan.');
    }
  };

  const handleCreateReturn = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      const payload = {
        ...retForm,
        type: retForm.type || (selectedInvoice ? (selectedInvoice.type === 'SALES' ? 'SALES_RETURN' : 'PURCHASE_RETURN') : (isPurchase ? 'PURCHASE_RETURN' : 'SALES_RETURN')),
        invoiceId: retForm.invoiceId || selectedInvoice?.id || undefined,
        salesOrderId: retForm.salesOrderId || undefined
      };
      await api.post('/returns', payload);
      toast.success('Retur barang berhasil diajukan & dicatat.');
      setRetForm({ returnNumber: '', returnDate: '', warehouseId: '', notes: '', status: 'FORM_ISSUED', items: [] });
      setRetModalOpen(false);
      fetchActiveTabData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Gagal merekam retur barang.');
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreateReturn = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: 'Catat Retur Barang',
      message: `Apakah Anda yakin ingin mencatat pengembalian (retur) ${retForm.returnNumber}?`,
      type: 'warning',
      onConfirm: () => handleCreateReturn()
    });
  };

  const triggerPrint = (doc, type) => {
    if (!doc || !doc.id) return;
    try {
      sessionStorage.setItem('print_current_doc', JSON.stringify({
        id: doc.id,
        type,
        data: doc,
        tenant
      }));
    } catch (e) {
      console.warn('Gagal menyimpan print_current_doc:', e);
    }

    const printUrl = `/print/invoice/${doc.id}?type=${type}`;
    window.open(printUrl, '_blank');
  };

  const triggerBulkPrint = () => {
    if (selectedSoIds.size === 0) return;
    const selectedIds = Array.from(selectedSoIds);
    const selectedDocs = salesOrders.filter(so => selectedSoIds.has(so.id));

    try {
      sessionStorage.setItem('bulk_print_docs', JSON.stringify({
        ids: selectedIds,
        type: 'SO',
        docs: selectedDocs,
        tenant
      }));
    } catch (e) {
      console.warn('Gagal menyimpan bulk_print_docs:', e);
    }

    const printUrl = `/print/invoice/bulk?ids=${selectedIds.join(',')}&type=SO`;
    window.open(printUrl, '_blank');
  };

  const allTabs = isPurchase ? [
    { id: 'PO', name: 'Purchase Orders', icon: ArrowDownCircle, perm: 'purchase_orders' },
    { id: 'SJ', name: 'Surat Jalan (Penerimaan)', icon: PackageCheck, perm: 'purchase_orders' },
    { id: 'INV', name: 'Tagihan Supplier (Faktur)', icon: FileText, perm: 'invoices' },
    { id: 'RET', name: 'Retur Pembelian', icon: RefreshCw, perm: 'purchase_orders' }
  ] : [
    { id: 'SO', name: 'Sales Orders', icon: ArrowUpCircle, perm: 'sales_orders' },
    { id: 'SJ', name: 'Surat Jalan (Pengiriman)', icon: Truck, perm: 'deliveries' },
    { id: 'RET', name: 'Retur Penjualan', icon: RefreshCw, perm: 'sales_orders' }
  ];

  const tabs = allTabs.filter(tab => {
    if (Array.isArray(tab.perm)) {
      return tab.perm.some(p => hasPermission(user, p, 'read'));
    }
    return hasPermission(user, tab.perm, 'read');
  });

  const customerOptions = customersList.map(c => {
    const addressParts = [c.address, c.address2, c.districtName ? `Kec. ${c.districtName}` : ''].filter(Boolean);
    const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Alamat belum diatur';

    return {
      value: c.id,
      label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
      sublabel: `${addressStr}${c.phone ? ` • ${c.phone}` : ''}`,
      name: c.name,
      code: c.code,
      address: addressStr,
      phone: c.phone
    };
  });

  const supplierOptions = suppliersList.map(s => ({
    value: s.id,
    label: s.name,
    sublabel: s.phone || s.email || 'No contact details'
  }));

  const salespersonOptions = salespersons.filter(sp => sp.isActive).map(sp => ({
    value: sp.id,
    label: sp.name,
    sublabel: sp.commissionRate > 0 ? `Komisi: ${sp.commissionRate}%` : undefined
  }));

  const productOptions = products.map(p => {
    const stock = p.totalStock !== undefined ? p.totalStock : (p.stock || 0);
    const isTaxable = !!(p.taxId && p.tax && parseFloat(p.tax.rate) > 0);
    const taxLabel = isTaxable ? `[PKP: ${p.tax.name}]` : '[Non-PKP]';
    const stockBreakdownText = formatStockBreakdown(stock, p);
    return {
      value: p.id,
      label: p.name,
      sublabel: `Stok: ${stockBreakdownText} | SKU: ${p.sku} | ${taxLabel} | Rp${parseFloat(p.sellingPrice || 0).toLocaleString('id-ID')}`,
      isTaxable,
      taxId: p.taxId,
      taxRate: p.tax ? parseFloat(p.tax.rate) : 0,
      searchTerms: `${p.name} ${p.sku} ${taxLabel} ${stockBreakdownText} ${isTaxable ? 'PKP PPN' : 'Non-PKP Non-PPN Bebas Pajak'}`
    };
  });

  // Helper render payment type badge (Tipe Pembayaran / Term)
  const renderPaymentTypeBadge = (row) => {
    const { term } = getDocPaymentInfo(row);
    const dueDate = row.metadata?.dueDate;

    if (term === 'TEMPO') {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
            <Clock size={11} /> Tempo
          </span>
          {dueDate && (
            <span className="text-[10px] text-zinc-500 font-mono" title={`Jatuh Tempo: ${dueDate}`}>
              {dueDate}
            </span>
          )}
        </div>
      );
    }
    if (term === 'COD') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
          <Truck size={11} /> COD
        </span>
      );
    }
    if (term === 'DP') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <CreditCard size={11} /> DP
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
        Tunai
      </span>
    );
  };

  // Helper render payment status badge (Status Pembayaran: LUNAS, SEBAGIAN, BELUM LUNAS)
  const renderPaymentStatusBadge = (row) => {
    const { paid, isFullyPaid, isPartial } = getDocPaymentInfo(row);

    if (isFullyPaid) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
          <CheckCircle2 size={12} className="text-emerald-600" /> Lunas
        </span>
      );
    }
    if (isPartial) {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <CreditCard size={11} className="text-amber-600" /> Sebagian
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {formatRupiah(paid)}
          </span>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <Clock size={11} className="text-rose-600" /> Belum Lunas
      </span>
    );
  };

  const renderPaymentBadge = renderPaymentStatusBadge;

  // Helper to resolve salesperson name for SO rows
  const getSalespersonName = (row) => {
    if (!row) return '—';
    if (row.metadata?.salespersonName) return row.metadata.salespersonName;
    if (row.metadata?.salesperson && typeof row.metadata.salesperson === 'string' && isNaN(row.metadata.salesperson)) {
      return row.metadata.salesperson;
    }
    const spId = row.metadata?.salespersonId || (row.metadata?.salesperson && !isNaN(row.metadata.salesperson) ? row.metadata.salesperson : null) || row.salespersonId;
    if (spId && salespersons?.length) {
      const found = salespersons.find(sp => String(sp.id) === String(spId));
      if (found) return found.code ? `${found.code} - ${found.name}` : found.name;
    }
    if (row.customer?.salesperson?.name) {
      const sp = row.customer.salesperson;
      return sp.code ? `${sp.code} - ${sp.name}` : sp.name;
    }
    if (row.customer?.salespersonId && salespersons?.length) {
      const found = salespersons.find(sp => String(sp.id) === String(row.customer.salespersonId));
      if (found) return found.code ? `${found.code} - ${found.name}` : found.name;
    }
    return '—';
  };

  // DataTable column definitions based on active tab
  const getColumns = () => {
    if (activeTab === 'SO') {
      const soList = salesOrders || [];
      const isAllCurrentSelected = soList.length > 0 && soList.every(so => selectedSoIds.has(so.id));
      const isSomeCurrentSelected = soList.some(so => selectedSoIds.has(so.id)) && !isAllCurrentSelected;

      return [
        {
          key: 'select',
          label: (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={isAllCurrentSelected}
                ref={el => { if (el) el.indeterminate = isSomeCurrentSelected; }}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSoIds(prev => {
                      const next = new Set(prev);
                      soList.forEach(so => next.add(so.id));
                      return next;
                    });
                  } else {
                    setSelectedSoIds(prev => {
                      const next = new Set(prev);
                      soList.forEach(so => next.delete(so.id));
                      return next;
                    });
                  }
                }}
                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer transition-all"
                title={isAllCurrentSelected ? 'Batalkan pilihan semua' : 'Pilih semua di halaman ini'}
              />
            </div>
          ),
          className: 'w-10 text-center px-2',
          headerClassName: 'w-10 text-center px-2',
          render: (_, row) => (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selectedSoIds.has(row.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedSoIds(prev => {
                    const next = new Set(prev);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.add(row.id);
                    return next;
                  });
                }}
                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer transition-all"
                title={`Pilih ${row.soNumber}`}
              />
            </div>
          )
        },
        {
          key: 'soNumber',
          label: 'Nomor SO',
          render: (val, row) => {
            const isPickup = row.metadata?.fulfillmentType === 'PICKUP' || row.metadata?.isPickup === true;
            return (
              <div className="flex flex-col">
                <span className="font-mono font-semibold text-zinc-900">{val}</span>
                {isPickup && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-amber-200">
                    🏪 Ambil di Toko
                  </span>
                )}
              </div>
            );
          }
        },
        { key: 'soDate', label: 'Tanggal SO' },
        { key: 'customer', label: 'Customer', render: (c) => c?.name || 'Pelanggan' },
        {
          key: 'salesperson',
          label: 'Salesman',
          render: (_, row) => {
            const spName = getSalespersonName(row);
            return (
              <div className="flex items-center space-x-1.5 text-xs text-zinc-800 font-medium">
                <User size={12} className="text-zinc-400 shrink-0" />
                <span className="truncate max-w-[130px]" title={spName}>{spName}</span>
              </div>
            );
          }
        },
        {
          key: 'tax',
          label: 'Tipe Pajak',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (tax, row) => {
            const isPkp = Boolean((row.taxId && (!tax?.name || !tax.name.toLowerCase().includes('non'))) || row.metadata?.applyTax);
            return (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                isPkp 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs' 
                  : 'bg-zinc-100 text-zinc-600 border-zinc-200'
              }`}>
                {isPkp ? 'PKP' : 'Non-PKP'}
              </span>
            );
          }
        },
        { key: 'paymentTerm', label: 'Tipe Bayar', className: 'text-center', headerClassName: 'text-center', render: (_, row) => renderPaymentTypeBadge(row) },
        { key: 'paymentStatus', label: 'Status Bayar', className: 'text-center', headerClassName: 'text-center', render: (_, row) => renderPaymentStatusBadge(row) },
        {
          key: 'totalAmount',
          label: 'Total Amount',
          className: 'font-semibold text-zinc-900 font-mono',
          render: (v) => formatRupiah(v)
        },
        {
          key: 'status',
          label: 'Status Order',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (status, row) => {
            const { isFullyPaid } = getDocPaymentInfo(row);
            const isPickup = row.metadata?.fulfillmentType === 'PICKUP' || row.metadata?.isPickup === true;
            const manifestNum = row.metadata?.manifestNumber;
            const manifestStatus = row.metadata?.manifestStatus;
            const isDelivered = status === 'DELIVERED' || manifestStatus === 'DELIVERED' || isPickup;
            const isDeliveredUnpaid = !isPickup && isDelivered && !isFullyPaid && status !== 'CANCELLED';
            const isWaitingShipment = 
              !isPickup && (
                status === 'WAITING_SHIPMENT' || 
                manifestStatus === 'SCHEDULED' || 
                manifestStatus === 'ACTIVE' || 
                (manifestNum && manifestStatus !== 'IN_DELIVERY' && manifestStatus !== 'DELIVERED' && status !== 'COMPLETED' && status !== 'CANCELLED')
              );

            return (
              <div className="flex flex-col items-center gap-0.5">
                {status === 'COMPLETED' || isPickup ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                    SELESAI
                  </span>
                ) : isDeliveredUnpaid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                    <Truck size={11} className="text-rose-600" /> SUDAH DIKIRIM
                  </span>
                ) : isWaitingShipment ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                    <Clock size={11} className="text-amber-600" /> MENUNGGU DIKIRIM
                  </span>
                ) : status === 'SHIPPED' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    <Truck size={11} className="text-sky-600" /> DIKIRIM
                  </span>
                ) : status === 'APPROVED' || status === 'CONFIRMED' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    DISETUJUI
                  </span>
                ) : status === 'CANCELLED' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    DIBATALKAN
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    DRAFT
                  </span>
                )}
                {isDeliveredUnpaid ? (
                  <span className="text-[10px] font-bold text-rose-600 font-mono tracking-tight" title="Barang telah diterima tetapi pembayaran masih belum lunas / tempo">
                    TEMPO (BELUM LUNAS)
                  </span>
                ) : manifestNum ? (
                  <span className="text-[10px] font-mono text-zinc-500 font-semibold" title={`Tergabung di Manifest: ${manifestNum} (${manifestStatus || 'TERJADWAL'})`}>
                    {manifestNum}
                  </span>
                ) : null}
              </div>
            );
          }
        },

        {
          key: 'actions',
          label: 'Aksi',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => {
            const { isFullyPaid } = getDocPaymentInfo(row);
            const isCancelled = row.status === 'CANCELLED';
            const isCompleted = row.status === 'COMPLETED' || row.status === 'SELESAI';
            const manifestNum = row.metadata?.manifestNumber;
            const manifestStatus = row.metadata?.manifestStatus;
            const isWaitingShipment = 
              row.status === 'WAITING_SHIPMENT' || 
              manifestStatus === 'SCHEDULED' || 
              manifestStatus === 'ACTIVE' || 
              (manifestNum && manifestStatus !== 'IN_DELIVERY' && manifestStatus !== 'DELIVERED' && !isCompleted && !isCancelled);
            const isShipped = (row.status === 'SHIPPED' && !isWaitingShipment) || isCompleted;
            const hasManifest = Boolean(manifestNum);
            const isOpen = activeSoDropdownId === row.id && Boolean(soDropdownPos);

            return (
              <div className="inline-block text-center">
                <button
                  type="button"
                  onClick={(e) => handleToggleSoDropdown(e, row.id)}
                  className={`so-action-dropdown-btn p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                    isOpen 
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs ring-2 ring-zinc-400/20' 
                      : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-300 shadow-2xs'
                  }`}
                  title="Pilihan Aksi"
                >
                  <MoreVertical size={15} />
                </button>

                {isOpen && soDropdownPos && (
                  <div 
                    className="so-fixed-dropdown-menu fixed w-48 bg-white border border-zinc-200/90 rounded-xl shadow-2xl py-1.5 z-[9999] text-left animate-in fade-in zoom-in-95 duration-100"
                    style={{
                      top: soDropdownPos.openUp ? 'auto' : `${soDropdownPos.top}px`,
                      bottom: soDropdownPos.openUp ? `${window.innerHeight - soDropdownPos.bottomTop}px` : 'auto',
                      right: `${soDropdownPos.right}px`
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Detail & Lacak */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSoDropdownId(null);
                        setSoDropdownPos(null);
                        handleOpenDetailSo(row.id);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Eye size={14} className="text-zinc-500" />
                      <span>Detail & Lacak</span>
                    </button>

                    {/* Cetak Faktur Penjualan / Invoice */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSoDropdownId(null);
                        setSoDropdownPos(null);
                        triggerPrint(row, 'SO');
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Printer size={14} className="text-zinc-500" />
                      <span>Cetak Faktur (Invoice)</span>
                    </button>


                    {/* Catat Pembayaran */}
                    {!isCancelled && !isFullyPaid && canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSoDropdownId(null);
                          setSoDropdownPos(null);
                          handleOpenPaymentModal(row, 'SO');
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <CreditCard size={14} className="text-emerald-600" />
                        <span>Catat Bayar</span>
                      </button>
                    )}

                    {/* Ubah / Revisi */}
                    {!isCancelled && canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSoDropdownId(null);
                          setSoDropdownPos(null);
                          handleOpenEditSo(row);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} className="text-amber-600" />
                        <span>{['SHIPPED', 'DELIVERED', 'COMPLETED', 'SELESAI'].includes(row.status) ? 'Revisi Pesanan' : 'Ubah Order'}</span>
                      </button>
                    )}

                    {/* Ajukan Retur Barang (Hanya jika pesanan sudah dikirim/terkirim) */}
                    {!isCancelled && isShipped && canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSoDropdownId(null);
                          setSoDropdownPos(null);
                          handleOpenReturForSo(row);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <RefreshCw size={14} className="text-rose-600" />
                        <span>Ajukan Retur Barang</span>
                      </button>
                    )}

                    {/* Terbitkan Form Retur Kosong */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSoDropdownId(null);
                        setSoDropdownPos(null);
                        setPrintDoc({ type: 'BLANK_RETURN_FORM', data: null });
                        setTimeout(() => {
                          window.print();
                        }, 150);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      title="Cetak Form Barang Balikan & Retur fisik format A4"
                    >
                      <FileText size={14} className="text-zinc-500" />
                      <span>Form Retur Kosongan</span>
                    </button>

                    {((!isCancelled && !isCompleted && canUpdate) || (row.status === 'DRAFT' && canDelete)) && (
                      <div className="my-1 border-t border-zinc-100" />
                    )}

                    {/* Batalkan SO */}
                    {!isCancelled && !isCompleted && canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSoDropdownId(null);
                          setSoDropdownPos(null);
                          handleCancelSo(row.id, row.soNumber);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <XCircle size={14} className="text-rose-500" />
                        <span>Batalkan SO</span>
                      </button>
                    )}

                    {/* Hapus SO */}
                    {row.status === 'DRAFT' && canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSoDropdownId(null);
                          setSoDropdownPos(null);
                          handleDeleteSo(row.id, row.soNumber);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} className="text-rose-500" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }
        }
      ];
    } else if (activeTab === 'PO') {
      return [
        { key: 'poNumber', label: 'Nomor PO', className: 'font-mono font-semibold text-zinc-900' },
        { key: 'poDate', label: 'Tanggal PO' },
        { key: 'supplier', label: 'Supplier', render: (s) => s?.name || 'Supplier' },
        { key: 'warehouse', label: 'Gudang Masuk', render: (w) => w?.name || '—' },
        { key: 'paymentTerm', label: 'Tipe Bayar', className: 'text-center', headerClassName: 'text-center', render: (_, row) => renderPaymentTypeBadge(row) },
        { key: 'paymentStatus', label: 'Status Bayar', className: 'text-center', headerClassName: 'text-center', render: (_, row) => renderPaymentStatusBadge(row) },
        {
          key: 'totalAmount',
          label: 'Total Amount',
          className: 'font-semibold text-zinc-900 font-mono',
          render: (v) => formatRupiah(v)
        },
        {
          key: 'status',
          label: 'Status',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (status) => {
            if (status === 'COMPLETED' || status === 'SELESAI') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                  SELESAI
                </span>
              );
            }
            if (status === 'RECEIVED') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  DITERIMA GUDANG
                </span>
              );
            }
            if (status === 'SHIPPED') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  DIKIRIM SUPPLIER
                </span>
              );
            }
            if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  <Clock size={11} /> MENUNGGU PERSETUJUAN
                </span>
              );
            }
            if (status === 'APPROVED' || status === 'ORDERED' || status === 'CONFIRMED') {
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={11} /> DISETUJUI
                </span>
              );
            }
            if (status === 'REJECTED') {
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <XCircle size={11} /> DITOLAK
                </span>
              );
            }
            if (status === 'CANCELLED') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  DIBATALKAN
                </span>
              );
            }
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                {status || 'DRAFT'}
              </span>
            );
          }
        },
        {
          key: 'actions',
          label: 'Aksi & Manajement',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => {
            const { isFullyPaid } = getDocPaymentInfo(row);
            const isCancelled = row.status === 'CANCELLED';
            const isCompleted = row.status === 'COMPLETED' || row.status === 'SELESAI';
            const isReceived = row.status === 'RECEIVED' || isCompleted;
            const isShipped = row.status === 'SHIPPED' || isReceived;
            const isPendingApproval = row.status === 'PENDING_APPROVAL' || row.status === 'PENDING';
            const isApproved = row.status === 'APPROVED' || row.status === 'ORDERED' || isShipped || isReceived;
            const isApprover = ['ADMIN', 'MANAGER', 'OWNER', 'SUPERADMIN'].includes(user?.role);

            return (
              <div className="flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
                <button
                  onClick={() => handleOpenDetailPo(row.id)}
                  className="p-1 px-2.5 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 rounded-lg border border-zinc-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  title="Detail & Lacak Status"
                >
                  <Eye size={13} />
                  <span>Detail</span>
                </button>

                {/* Tombol Setujui / Tolak untuk Admin/Manager/Owner */}
                {isPendingApproval && isApprover && canUpdate && (
                  <>
                    <button
                      onClick={() => handleApprovePo(row)}
                      className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                      title="Setujui Purchase Order ini"
                    >
                      <CheckCircle2 size={12} />
                      <span>Setujui</span>
                    </button>
                    <button
                      onClick={() => handleRejectPo(row)}
                      className="p-1 px-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      title="Tolak Purchase Order"
                    >
                      <XCircle size={12} />
                      <span>Tolak</span>
                    </button>
                  </>
                )}

                {/* Tombol Kirim Supplier jika sudah disetujui & belum dikirim */}
                {!isShipped && !isCancelled && isApproved && canUpdate && (
                  <button
                    onClick={() => handleShipPo(row)}
                    className="p-1 px-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg border border-sky-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Tandai pesanan sedang dalam proses pengiriman supplier"
                  >
                    <Truck size={12} />
                    <span>Kirim</span>
                  </button>
                )}

                {/* Tombol Konfirmasi Terima Stok oleh Orang Gudang (hanya jika sudah disetujui) */}
                {!isReceived && !isCancelled && isApproved && canUpdate && (
                  <button
                    onClick={() => handleReceivePo(row)}
                    className="p-1 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Konfirmasi barang fisik sampai dan tambahkan stok ke gudang"
                  >
                    <PackageCheck size={12} />
                    <span>Terima Stok</span>
                  </button>
                )}

                {/* Tombol Selesaikan PO jika sudah diterima di gudang & belum selesai */}
                {isReceived && !isCompleted && !isCancelled && canUpdate && (
                  <button
                    onClick={() => handleCompletePo(row)}
                    className="p-1 px-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Tandai seluruh proses Purchase Order telah selesai"
                  >
                    <CheckCircle2 size={12} />
                    <span>Selesaikan</span>
                  </button>
                )}

                {row.metadata?.receiveEvidence && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({
                      isOpen: true,
                      url: getImageUrl(row.metadata.receiveEvidence),
                      title: `Bukti Penerimaan Barang PO #${row.poNumber}`
                    })}
                    className="p-1 px-2 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg border border-amber-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Lihat Bukti Foto Penerimaan Barang"
                  >
                    <Paperclip size={12} />
                    <span>Bukti Foto</span>
                  </button>
                )}

                {(isReceived || row.metadata?.sjmNumber) && (
                  <button
                    onClick={() => triggerPrint(row, 'SJM')}
                    className="p-1 px-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Cetak Surat Jalan Masuk / Bukti Penerimaan Barang"
                  >
                    <Printer size={12} />
                    <span>Cetak SJM</span>
                  </button>
                )}

                {!isCancelled && !isFullyPaid && canUpdate && (
                  <button
                    onClick={() => handleOpenPaymentModal(row, 'PO')}
                    className="p-1 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Bayar Supplier"
                  >
                    <CreditCard size={13} />
                    <span>Bayar</span>
                  </button>
                )}

                {(row.status === 'DRAFT' || row.status === 'ORDERED' || row.status === 'PENDING_APPROVAL' || row.status === 'PENDING' || row.status === 'REJECTED' || (row.status === 'APPROVED' && isApprover)) && canUpdate && (
                  <button
                    onClick={() => handleOpenEditPo(row)}
                    className="p-1 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Ubah Purchase Order"
                  >
                    <Edit2 size={12} />
                  </button>
                )}

                {!isCancelled && !isCompleted && canUpdate && (
                  <button
                    onClick={() => handleCancelPo(row.id, row.poNumber)}
                    className="p-1 px-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Batalkan Purchase Order"
                  >
                    <XCircle size={12} />
                    <span>Batal</span>
                  </button>
                )}

                {(row.status === 'DRAFT' || row.status === 'REJECTED') && canDelete && (
                  <button
                    onClick={() => handleDeletePo(row.id, row.poNumber)}
                    className="p-1 px-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          }
        }
      ];
    } else if (activeTab === 'SJ') {
      if (isPurchase) {
        return [
          {
            key: 'sjmNumber',
            label: 'No. Surat Jalan (SJM)',
            className: 'font-mono font-bold text-blue-700',
            render: (_, row) => {
              const sjm = row.metadata?.sjmNumber || row.metadata?.deliveryNumber || (
                row.poNumber?.startsWith('PO.') ? row.poNumber.replace(/^PO\./, 'SJM.') : (row.poNumber?.startsWith('PO-') ? row.poNumber.replace(/^PO-/, 'SJM-') : `SJM-${row.poNumber}`)
              );
              return <span>{sjm}</span>;
            }
          },
          {
            key: 'receiveDate',
            label: 'Tanggal Penerimaan',
            render: (_, row) => row.metadata?.receiveDate || row.poDate || '—'
          },
          {
            key: 'poNumber',
            label: 'Ref Purchase Order',
            className: 'font-mono font-semibold text-zinc-900',
            render: (poNum, row) => (
              <button
                type="button"
                onClick={() => {
                  setSelectedPoDetail(row);
                  setDetailPoModalOpen(true);
                }}
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-mono font-bold cursor-pointer"
              >
                #{poNum}
              </button>
            )
          },
          {
            key: 'supplier',
            label: 'Supplier / Pemasok',
            render: (supp, row) => row.supplier?.name || supp?.name || '—'
          },
          {
            key: 'warehouse',
            label: 'Gudang Masuk',
            render: (w, row) => row.warehouse?.name || w?.name || '—'
          },
          {
            key: 'receivedBy',
            label: 'Petugas Penerima',
            render: (_, row) => row.metadata?.receivedBy || 'Staff Gudang'
          },
          {
            key: 'status',
            label: 'Status Penerimaan',
            className: 'text-center',
            headerClassName: 'text-center',
            render: () => (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                DITERIMA
              </span>
            )
          },
          {
            key: 'actions',
            label: 'Aksi & Cetak',
            className: 'text-center',
            headerClassName: 'text-center',
            render: (_, row) => {
              const evidenceImg = row.metadata?.receiveEvidence || row.metadata?.evidence;
              return (
                <div className="flex items-center justify-center space-x-1.5">
                  {evidenceImg && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({
                        isOpen: true,
                        url: getImageUrl(evidenceImg),
                        title: `Bukti Foto Penerimaan PO #${row.poNumber}`
                      })}
                      className="p-1 px-2 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg border border-amber-300 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                      title="Lihat Bukti Foto Fisik Barang Masuk"
                    >
                      <Paperclip size={12} />
                      <span>Foto Barang</span>
                    </button>
                  )}
                  <button
                    onClick={() => triggerPrint(row, 'SJM')}
                    className="p-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Cetak Surat Jalan Masuk / Bukti Penerimaan Barang (SJM)"
                  >
                    <Printer size={12} />
                    <span>Cetak SJM</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPoDetail(row);
                      setDetailPoModalOpen(true);
                    }}
                    className="p-1 px-2 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg border border-zinc-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    title="Lihat Detail Purchase Order"
                  >
                    <Eye size={12} />
                    <span>Detail PO</span>
                  </button>
                </div>
              );
            }
          }
        ];
      }

      return [
        { key: 'deliveryNumber', label: 'Nomor Surat Jalan', className: 'font-mono font-semibold text-zinc-900' },
        { key: 'deliveryDate', label: 'Tanggal Pengiriman' },
        { key: 'salesOrder', label: 'Ref Sales Order', render: (so) => so?.soNumber || '—' },
        { key: 'warehouse', label: 'Gudang Pengirim', render: (w) => w?.name || '—' },
        { key: 'driverName', label: 'Kurir / Driver' },
        { key: 'vehiclePlate', label: 'No. Polisi' },
        {
          key: 'status',
          label: 'Status Pengiriman',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (st, row) => {
            const isDelivered = st === 'DELIVERED';
            const isCancelled = st === 'CANCELLED';
            const isShipped = st === 'SHIPPED';
            const manifestNum = row.salesOrder?.metadata?.manifestNumber || row.metadata?.manifestNumber;

            return (
              <div className="flex flex-col items-center gap-0.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isDelivered 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : isCancelled
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : isShipped
                    ? 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isDelivered ? 'DITERIMA' : (isCancelled ? 'DIBATALKAN' : (isShipped ? 'DALAM PERJALANAN' : 'TERJADWAL'))}
                </span>
                {manifestNum && (
                  <span className="text-[10px] font-mono text-zinc-500 font-semibold" title={`Tergabung di Manifest: ${manifestNum}`}>
                    {manifestNum}
                  </span>
                )}
              </div>
            );
          }
        },

        {
          key: 'actions',
          label: 'Aksi & Manajemen',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => {
            const evidenceImg = row.metadata?.deliveredEvidence || row.metadata?.evidence || row.metadata?.dispatchEvidence;

            return (
              <div className="flex items-center justify-center space-x-1.5">
                {evidenceImg && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({
                      isOpen: true,
                      url: getImageUrl(evidenceImg),
                      title: `Bukti Surat Jalan #${row.deliveryNumber}`
                    })}
                    className="p-1 px-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg border border-indigo-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Lihat Bukti Foto Pengiriman / Serah Terima"
                  >
                    <Paperclip size={12} />
                    <span>Bukti Foto</span>
                  </button>
                )}

                {row.status === 'SHIPPED' && canUpdate && (
                  <button
                    onClick={() => handleOpenDeliveryConfirmModal(row)}
                    className="p-1 px-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    title="Konfirmasi Barang Diterima Pelanggan"
                  >
                    <CheckCircle2 size={13} />
                    <span>Tandai Diterima</span>
                  </button>
                )}
                <button
                  onClick={() => triggerPrint(row, 'SJ')}
                  className="p-1 px-2.5 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg border border-zinc-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Printer size={12} />
                  <span>Cetak SJ</span>
                </button>
              </div>
            );
          }
        }
      ];
    } else if (activeTab === 'INV') {
      return [
        { key: 'invoiceNumber', label: 'Nomor Faktur', className: 'font-mono font-semibold text-zinc-900' },
        { key: 'type', label: 'Jenis', render: (t) => t === 'SALES' ? 'Penjualan (Customer)' : 'Pembelian (Supplier)' },
        { key: 'invoiceDate', label: 'Tanggal' },
        { key: 'dueDate', label: 'Jatuh Tempo' },
        {
          key: 'totalAmount',
          label: 'Total Amount',
          className: 'font-semibold text-zinc-900 font-mono',
          render: (v) => formatRupiah(v)
        },
        {
          key: 'status',
          label: 'Status Pembayaran',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (st) => (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              st === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {st}
            </span>
          )
        },
        {
          key: 'actions',
          label: 'Aksi',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => (
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => openRetModal(row)}
                className="p-1 px-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Retur</span>
              </button>
              <button
                onClick={() => triggerPrint(row, 'INV')}
                className="p-1 px-2.5 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded border border-zinc-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Printer size={12} />
                <span>Cetak</span>
              </button>
            </div>
          )
        }
      ];
    } else if (activeTab === 'RET') {
      return [
        { key: 'returnNumber', label: 'Nomor Retur', className: 'font-mono font-semibold text-zinc-900' },
        { key: 'returnDate', label: 'Tanggal Retur' },
        {
          key: 'type',
          label: 'Jenis Retur',
          render: (t) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
              t === 'SALES_RETURN' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {t === 'SALES_RETURN' ? 'Retur Penjualan (Customer)' : 'Retur Pembelian (Supplier)'}
            </span>
          )
        },
        { key: 'invoice', label: 'Ref Faktur', render: (inv) => inv?.invoiceNumber || '—' },
        { key: 'warehouse', label: 'Gudang Stock', render: (w) => w?.name || '—' },
        {
          key: 'status',
          label: 'Status Skema',
          render: (status) => {
            const isCompleted = status === 'COMPLETED';
            return (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isCompleted ? 'Surat Retur Resmi' : 'Form Retur Sales'}
              </span>
            );
          }
        },
        {
          key: 'totalAmount',
          label: 'Total Nilai Retur',
          className: 'font-semibold text-zinc-900 font-mono',
          render: (v) => formatRupiah(v)
        },
        {
          key: 'actions',
          label: 'Aksi',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => (
            <button
              onClick={() => handleOpenDetailRetur(row.id)}
              className="p-1 px-2.5 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 rounded-lg border border-zinc-300 text-xs font-bold flex items-center space-x-1 cursor-pointer mx-auto"
            >
              <Eye size={13} />
              <span>Detail Retur</span>
            </button>
          )
        }
      ];
    }
    return [];
  };

  const getActiveData = () => {
    if (activeTab === 'SO') return salesOrders;
    if (activeTab === 'PO') return purchaseOrders;
    if (activeTab === 'SJ') return isPurchase ? purchaseReceipts : deliveries;
    if (activeTab === 'INV') return invoices;
    if (activeTab === 'RET') return returns;
    return [];
  };

  const getActiveEmptyIcon = () => {
    if (activeTab === 'SO') return <ArrowUpCircle size={36} />;
    if (activeTab === 'PO') return <ArrowDownCircle size={36} />;
    if (activeTab === 'SJ') return isPurchase ? <PackageCheck size={36} /> : <Truck size={36} />;
    if (activeTab === 'INV') return <FileText size={36} />;
    if (activeTab === 'RET') return <RefreshCw size={36} />;
    return <FileText size={36} />;
  };

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin (permission) untuk mengakses modul Transaksi ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dedicated Print Area Wrapper (No shadows, clean layout) */}
      {printDoc && (
        <div id="print-area" className="hidden print:block bg-white text-zinc-950 font-sans text-xs">
          {printDoc.type === 'BLANK_RETURN_FORM' ? (
            <ReturnFormPrintTemplate 
              companyName={tenant?.companyName || 'CoreSync ERP'} 
            />
          ) : printDoc.type === 'RETURN_FORM' ? (
            <ReturnFormPrintTemplate 
              returItems={printDoc.data?.items || []} 
              returDate={printDoc.data?.returnDate || ''} 
              droppingName={printDoc.data?.salesperson || ''} 
              companyName={tenant?.companyName || 'CoreSync ERP'} 
            />
          ) : (
            <InvoicePrintTemplate 
              type={printDoc.type} 
              data={printDoc.data} 
              tenant={tenant} 
            />
          )}
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={isPurchase ? "Transaksi Pembelian (Purchases)" : "Transaksi Penjualan (Sales)"}
        subtitle={
          isPurchase
            ? "Kelola pesanan pembelian supplier (PO), surat jalan penerimaan barang, faktur tagihan, dan retur pembelian."
            : "Kelola pesanan penjualan customer (SO), surat jalan pengiriman, faktur piutang penjualan, dan retur penjualan."
        }
        icon={isPurchase ? Truck : ShoppingCart}
      />

      {/* Sticky Tabs & Search Toolbar */}
      <div className="sticky top-36 z-20 bg-zinc-50/95 backdrop-blur-md -mx-6 md:-mx-8 px-6 md:px-8 py-3 -mt-4 mb-4 space-y-2.5 border-b border-zinc-200/60 transition-all print:hidden">
        {/* Row 1: Tab Navigation (Kiri) & Action Buttons (Kanan) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex border border-zinc-200 bg-white rounded-xl p-1 shadow-2xs space-x-1 shrink-0 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-theme text-white shadow-xs' 
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 shrink-0 overflow-x-auto">
            {(activeTab === 'SO' || activeTab === 'INV') && (
              <button
                type="button"
                onClick={() => {
                  if (startDate || endDate) {
                    setExportDmsFilter(prev => ({
                      ...prev,
                      startDate: startDate || prev.startDate,
                      endDate: endDate || prev.endDate
                    }));
                  }
                  setExportDmsModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-2xs hover:shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                title="Export Data Penjualan Format Distribusi (DMS)"
              >
                <FileSpreadsheet size={14} />
                <span className="hidden sm:inline">Export Penjualan (DMS)</span>
                <span className="sm:hidden">Export DMS</span>
              </button>
            )}

            {activeTab === 'SO' && selectedSoIds.size > 0 && (
              <button
                type="button"
                onClick={triggerBulkPrint}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 animate-in fade-in"
                title="Cetak Faktur Penjualan Sekaligus untuk Semua Pesanan Terpilih"
              >
                <Printer size={14} />
                <span>Cetak {selectedSoIds.size} Faktur Sekaligus</span>
              </button>
            )}

            {canCreate && activeTab === 'SO' && (
              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setSoFormMode('CREATE');
                  const isAutoTax = taxMode === 'NON_PKP' ? false : true;
                  const availableProducts = filterProductsByTaxMode(products);
                  const firstProd = availableProducts[0] || products[0];
                  setSoForm({
                    soNumber: generateDocumentNumber('SO', todayStr, salesOrders),
                    soDate: todayStr,
                    contactId: customersList[0]?.id || '',
                    taxId: taxes[0]?.id || '',
                    salesperson: '',
                    paymentTerm: 'LUNAS',
                    dpAmount: 0,
                    dueDate: '',
                    applyTax: isAutoTax,
                    taxInclusive: isAutoTax !== false,
                    globalDiscountPercent: 0,
                    globalDiscountAmount: 0,
                    autoSj: false,
                    autoInvoice: true,
                    warehouseId: warehouses[0]?.id || '',
                    items: [{
                      productId: firstProd?.id || '',
                      qty: 1,
                      bonusQty: 0,
                      unit: firstProd?.unit || 'pcs',
                      conversionRatio: 1,
                      bonusUnit: firstProd?.unit || 'pcs',
                      bonusConversionRatio: 1,
                      price: firstProd?.sellingPrice || 0,
                      discount: 0,
                      discountPercent: 0,
                      discountType: 'AMOUNT'
                    }]
                  });
                  setActionError('');
                  setSoModalOpen(true);
                }}
                className="bg-theme bg-theme-hover text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Buat Sales Order</span>
              </button>
            )}

            {canCreate && activeTab === 'PO' && (
              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setPoFormMode('CREATE');
                  setPoForm({
                    poNumber: generateDocumentNumber('PO', todayStr, purchaseOrders),
                    poDate: todayStr,
                    contactId: suppliersList[0]?.id || '',
                    warehouseId: warehouses[0]?.id || '',
                    taxId: taxes[0]?.id || '',
                    paymentTerm: 'LUNAS',
                    dpAmount: 0,
                    dueDate: '',
                    applyTax: true,
                    taxInclusive: false,
                    globalDiscountMode: 'PERCENT',
                    globalDiscountPercent: 0,
                    globalDiscountAmount: 0,
                    autoReceive: false,
                    autoInvoice: true,
                    requireApproval: true,
                    items: [{ productId: products[0]?.id || '', qty: 1, bonusQty: 0, price: 0, discount: 0, discountPercent: 0, discountType: 'AMOUNT' }]
                  });
                  setActionError('');
                  setPoModalOpen(true);
                }}
                className="bg-theme bg-theme-hover text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Buat Purchase Order</span>
              </button>
            )}

            {!isPurchase && activeTab === 'SJ' && (
              <button
                onClick={() => navigate('/delivery-manifest')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Truck size={14} />
                <span>Buka Manifest Pengiriman</span>
              </button>
            )}

            {activeTab === 'RET' && (
              <button
                onClick={() => {
                  setPrintDoc({ type: 'BLANK_RETURN_FORM', data: null });
                  setTimeout(() => {
                    window.print();
                  }, 100);
                }}
                className="bg-zinc-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Printer size={14} />
                <span>Cetak Form Balikan & Retur</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Dedicated Filter Toolbar (Lega, Terstruktur, Responsif) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-zinc-200/50">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'SO'
                  ? 'Cari No. SO, customer, kode toko...'
                  : (isPurchase && activeTab === 'SJ')
                  ? 'Cari No. SJM, No. PO, nama supplier...'
                  : activeTab === 'PO'
                  ? 'Cari No. PO, nama supplier...'
                  : `Cari transaksi ${activeTab}...`
              }
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs font-medium"
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(''); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Tanggal (Khusus Sales Order) */}
          {activeTab === 'SO' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Preset Periode */}
              <select
                value={getDatePreset()}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs hover:bg-zinc-50 transition-all"
                title="Pilih Preset Periode Tanggal"
              >
                <option value="">Semua Periode</option>
                <option value="TODAY">Hari Ini</option>
                <option value="YESTERDAY">Kemarin</option>
                <option value="LAST_7_DAYS">7 Hari Terakhir</option>
                <option value="THIS_MONTH">Bulan Ini</option>
                <option value="LAST_MONTH">Bulan Lalu</option>
                {getDatePreset() === 'CUSTOM' && <option value="CUSTOM">Kustom Tanggal</option>}
              </select>

              {/* Input Tanggal Range */}
              <div className="flex items-center space-x-1.5 bg-white border border-zinc-200 rounded-xl px-2.5 py-1 shadow-2xs">
                <Calendar size={13} className="text-zinc-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => updateFilterParam('startDate', e.target.value)}
                  className="text-xs font-semibold text-zinc-700 bg-transparent outline-none cursor-pointer w-[115px]"
                  title="Tanggal Mulai"
                />
                <span className="text-zinc-400 text-xs font-medium">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => updateFilterParam('endDate', e.target.value)}
                  className="text-xs font-semibold text-zinc-700 bg-transparent outline-none cursor-pointer w-[115px]"
                  title="Tanggal Akhir"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={handleClearDateFilter}
                    className="text-zinc-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                    title="Hapus filter tanggal"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Filter Status Pesanan (Khusus Sales Order) */}
          {activeTab === 'SO' && (
            <div className="flex items-center shrink-0">
              <select
                value={orderStatus}
                onChange={(e) => updateFilterParam('status', e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs hover:bg-zinc-50 transition-all"
              >
                <option value="">Semua Status Order</option>
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Disetujui (Approved)</option>
                <option value="WAITING_SHIPMENT">Menunggu Kirim</option>
                <option value="SHIPPED">Terkirim (Shipped)</option>
                <option value="COMPLETED">Selesai (Completed)</option>
              </select>
            </div>
          )}

          {/* Filter Status Pembayaran (Khusus Sales Order) */}
          {activeTab === 'SO' && (
            <div className="flex items-center shrink-0">
              <select
                value={paymentStatus}
                onChange={(e) => updateFilterParam('paymentStatus', e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs hover:bg-zinc-50 transition-all"
              >
                <option value="">Semua Pembayaran</option>
                <option value="PAID">Lunas (Paid)</option>
                <option value="UNPAID">Belum Lunas / Tempo</option>
              </select>
            </div>
          )}

          {/* Filter Tipe Pajak (PKP vs Non-PKP) */}
          {activeTab === 'SO' && (
            <div className="flex items-center shrink-0">
              <select
                value={taxStatus || taxStatusQuery}
                onChange={(e) => updateFilterParam('taxStatus', e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs hover:bg-zinc-50 transition-all"
              >
                <option value="">{taxMode === 'ALL' ? 'Semua Tipe Penjualan' : `Default Mode: ${taxMode}`}</option>
                <option value="PKP">Penjualan PKP (PPN)</option>
                <option value="NON_PKP">Penjualan Non-PKP</option>
              </select>
            </div>
          )}

          {/* Filter Salesman (Khusus Sales Order) */}
          {activeTab === 'SO' && (
            <div className="flex items-center shrink-0">
              <select
                value={salespersonFilter}
                onChange={(e) => updateFilterParam('salesperson', e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs hover:bg-zinc-50 transition-all max-w-[170px]"
              >
                <option value="">Semua Salesman</option>
                {salespersons.filter(sp => sp.isActive).map(sp => (
                  <option key={sp.id} value={sp.name}>
                    {sp.code ? `[${sp.code}] ` : ''}{sp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Pesanan Dibatalkan */}
          {(activeTab === 'SO' || activeTab === 'PO') && (
            <button
              type="button"
              onClick={() => {
                setShowCancelled(prev => !prev);
                const next = new URLSearchParams(searchParams);
                next.set('page', '1');
                setSearchParams(next, { replace: true });
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer shadow-2xs ${
                showCancelled
                  ? 'bg-rose-50 text-rose-700 border-rose-200 ring-2 ring-rose-500/20 hover:bg-rose-100'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
              }`}
              title={showCancelled ? "Sembunyikan pesanan dibatalkan" : "Tampilkan pesanan dibatalkan"}
            >
              {showCancelled ? <EyeOff size={14} className="text-rose-600" /> : <Eye size={14} className="text-zinc-400" />}
              <span>{showCancelled ? 'Batal Ditampilkan' : 'Tampilkan Batal'}</span>
            </button>
          )}

          {/* Tombol Reset Filter */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-all cursor-pointer shrink-0"
              title="Reset semua filter"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm print:hidden">
          {error}
        </div>
      )}

      {/* Main Table Panel */}
      <div className="print:hidden">
        <DataTable
          columns={getColumns()}
          data={getActiveData()}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          emptyText={`Belum ada data ${tabs.find(t => t.id === activeTab)?.name}.`}
          emptyIcon={getActiveEmptyIcon()}
          rowKey="id"
          rowClassName={(row) => {
            if (activeTab !== 'SO') return '';
            const { isFullyPaid } = getDocPaymentInfo(row);
            const isDelivered = row.status === 'DELIVERED' || row.metadata?.manifestStatus === 'DELIVERED';
            const isDeliveredUnpaid = isDelivered && !isFullyPaid && row.status !== 'CANCELLED';
            if (isDeliveredUnpaid) {
              return 'bg-rose-50/80 hover:bg-rose-100/90 text-rose-950 font-medium border-l-4 border-l-rose-500';
            }
            return 'bg-white hover:bg-zinc-50/80';
          }}
        />
      </div>

      {/* SO MODAL */}
      <SalesOrderModal
        isOpen={soModalOpen}
        onClose={() => setSoModalOpen(false)}
        soFormMode={soFormMode}
        soForm={soForm}
        setSoForm={setSoForm}
        salesOrders={salesOrders}
        customers={customersList}
        customerOptions={customerOptions}
        salespersons={salespersons}
        salespersonOptions={salespersonOptions}
        taxes={taxes}
        warehouses={warehouses}
        products={products}
        productOptions={productOptions}
        drivers={driversList}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateSo={handleConfirmCreateSo}
        handleSoItemChange={handleSoItemChange}
        addSoItem={addSoItem}
        removeSoItem={removeSoItem}
        user={user}
        isAlreadyShipped={['SHIPPED', 'DELIVERED', 'COMPLETED', 'SELESAI'].includes(salesOrders.find(s => s.id === editingSoId)?.status)}
      />

      {/* PO MODAL */}
      <PurchaseOrderModal
        isOpen={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        poFormMode={poFormMode}
        poForm={poForm}
        setPoForm={setPoForm}
        purchaseOrders={purchaseOrders}
        suppliers={suppliersList}
        supplierOptions={supplierOptions}
        warehouses={warehouses}
        taxes={taxes}
        products={products}
        productOptions={productOptions}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreatePo={handleConfirmCreatePo}
        handlePoItemChange={handlePoItemChange}
        addPoItem={addPoItem}
        removePoItem={removePoItem}
        user={user}
      />

      {/* SURAT JALAN MODAL */}
      <DeliveryModal
        isOpen={sjModalOpen}
        onClose={() => setSjModalOpen(false)}
        sjForm={sjForm}
        setSjForm={setSjForm}
        drivers={driversList}
        evidenceFile={sjEvidenceFile}
        setEvidenceFile={setSjEvidenceFile}
        evidencePreview={sjEvidencePreview}
        setEvidencePreview={setSjEvidencePreview}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateSj={handleConfirmCreateSj}
      />

      {/* FAKTUR MODAL */}
      <InvoiceModal
        isOpen={invModalOpen}
        onClose={() => setInvModalOpen(false)}
        invForm={invForm}
        setInvForm={setInvForm}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateInvoice={handleConfirmCreateInvoice}
      />

      {/* RETUR MODAL */}
      <ReturnModal
        isOpen={retModalOpen}
        onClose={() => setRetModalOpen(false)}
        retForm={retForm}
        setRetForm={setRetForm}
        warehouses={warehouses}
        productOptions={productOptions}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateReturn={handleConfirmCreateReturn}
        handleRetItemChange={handleRetItemChange}
        addRetItem={addRetItem}
        removeRetItem={removeRetItem}
      />

      {/* DETAIL SO MODAL */}
      <SalesOrderDetailModal
        isOpen={detailSoModalOpen}
        onClose={() => setDetailSoModalOpen(false)}
        selectedSoDetail={selectedSoDetail}
        canUpdate={canUpdate}
        triggerPrint={triggerPrint}
        handleOpenPaymentModal={handleOpenPaymentModal}
        onOpenSjModal={openSjModal}
        onOpenEditSo={handleOpenEditSo}
        onViewEvidence={(url, title) => setPreviewImage({ isOpen: true, url: getImageUrl(url), title })}
        onRefresh={(soId) => {
          handleOpenDetailSo(soId);
          fetchActiveTabData();
        }}
      />

      {/* DETAIL PO MODAL */}
      <PurchaseOrderDetailModal
        isOpen={detailPoModalOpen}
        onClose={() => setDetailPoModalOpen(false)}
        selectedPoDetail={selectedPoDetail}
        canUpdate={canUpdate}
        handleOpenPaymentModal={handleOpenPaymentModal}
        handleApprovePo={handleApprovePo}
        handleRejectPo={handleRejectPo}
        user={user}
        onViewEvidence={(url, title) => setPreviewImage({ isOpen: true, url: getImageUrl(url), title })}
        triggerPrint={triggerPrint}
      />

      {/* DETAIL RETUR MODAL */}
      <ReturnDetailModal
        isOpen={detailReturModalOpen}
        onClose={() => setDetailReturModalOpen(false)}
        selectedReturDetail={selectedReturDetail}
        onPrintForm={(ret) => {
          setPrintDoc({ type: 'RETURN_FORM', data: ret });
          setTimeout(() => {
            window.print();
          }, 150);
        }}
        onPrintBlank={() => {
          setPrintDoc({ type: 'BLANK_RETURN_FORM', data: null });
          setTimeout(() => {
            window.print();
          }, 150);
        }}
      />

      {/* RECORD PAYMENT MODAL */}
      <PaymentRecordModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        paymentTargetDoc={paymentTargetDoc}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        evidenceFile={payEvidenceFile}
        setEvidenceFile={setPayEvidenceFile}
        evidencePreview={payEvidencePreview}
        setEvidencePreview={setPayEvidencePreview}
        actionLoading={actionLoading}
        actionError={actionError}
        handleRecordPaymentSubmit={handleRecordPaymentSubmit}
      />

      {/* RECEIVE PO MODAL WITH EVIDENCE */}
      {receivePoModalOpen && selectedPoForReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative my-8">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Terima Stok Barang PO</h3>
                <p className="text-xs text-zinc-500 font-mono">{selectedPoForReceive.poNumber}</p>
              </div>
              <button 
                onClick={() => setReceivePoModalOpen(false)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleReceivePoSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <PackageCheck size={14} className="text-indigo-600" />
                  Konfirmasi Penerimaan Fisik
                </p>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Stok barang yang terdaftar di PO ini akan langsung masuk ke gudang tujuan secara realtime.
                </p>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Tanggal Penerimaan</label>
                <input
                  type="date"
                  required
                  value={poReceiveDate}
                  onChange={(e) => setPoReceiveDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  placeholder="e.g. Diterima utuh tanpa cacat..."
                  value={poReceiveNotes}
                  onChange={(e) => setPoReceiveNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Upload Foto Barang Masuk / Surat Jalan Supplier */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Foto Fisik Barang / Surat Jalan Supplier</span>
                  <span className="text-[10px] text-zinc-400 font-normal">(Opsional)</span>
                </label>

                {poReceiveEvidencePreview ? (
                  <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img 
                      src={poReceiveEvidencePreview} 
                      alt="Preview Bukti Penerimaan" 
                      className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{poReceiveEvidenceFile?.name || 'Bukti Penerimaan'}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPoReceiveEvidenceFile(null);
                          setPoReceiveEvidencePreview('');
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/20 rounded-xl p-3.5 cursor-pointer transition-all">
                    <Camera className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-700">Pilih Foto Surat Jalan / Barang Masuk</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, JPEG (Maks. 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setPoReceiveEvidenceFile(f);
                          setPoReceiveEvidencePreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setReceivePoModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-indigo-400 shadow-md shadow-indigo-600/20"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Konfirmasi Terima Barang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELIVERY CONFIRMATION (DELIVERED) MODAL */}
      {deliveryConfirmModalOpen && selectedDeliveryForConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative my-8">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Konfirmasi Serah Terima Surat Jalan</h3>
                <p className="text-xs text-zinc-500 font-mono">SJ #{selectedDeliveryForConfirm.deliveryNumber}</p>
              </div>
              <button 
                onClick={() => setDeliveryConfirmModalOpen(false)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleDeliveryConfirmSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Barang Telah Sampai ke Pelanggan
                </p>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Status pengiriman akan berubah menjadi <strong>DELIVERED</strong>. Jika tagihan sudah lunas, status Sales Order otomatis selesai.
                </p>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Nama Penerima / Customer</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bpk. Hendra (Penerima)"
                  value={deliveryConfirmReceivedBy}
                  onChange={(e) => setDeliveryConfirmReceivedBy(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Catatan Penerimaan</label>
                <input
                  type="text"
                  placeholder="e.g. Diterima utuh dan ditandatangani..."
                  value={deliveryConfirmNotes}
                  onChange={(e) => setDeliveryConfirmNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Upload Foto Tanda Tangan / Surat Jalan Fisik */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Foto Tanda Tangan / Surat Jalan Fisik</span>
                  <span className="text-[10px] text-zinc-400 font-normal">(Opsional)</span>
                </label>

                {deliveryConfirmEvidencePreview ? (
                  <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img 
                      src={deliveryConfirmEvidencePreview} 
                      alt="Preview Bukti Serah Terima" 
                      className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{deliveryConfirmEvidenceFile?.name || 'Bukti Serah Terima'}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryConfirmEvidenceFile(null);
                          setDeliveryConfirmEvidencePreview('');
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-emerald-400 bg-zinc-50/50 hover:bg-emerald-50/20 rounded-xl p-3.5 cursor-pointer transition-all">
                    <Camera className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-700">Pilih Foto Tanda Tangan / Bukti Terima</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, JPEG (Maks. 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setDeliveryConfirmEvidenceFile(f);
                          setDeliveryConfirmEvidencePreview(URL.createObjectURL(f));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setDeliveryConfirmModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-emerald-400 shadow-md shadow-emerald-600/20"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Tandai Selesai Diterima</span>
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
        loading={actionLoading}
      />

      {/* Lightbox Modal for Evidence Preview */}
      {previewImage.isOpen && (
        <div 
          onClick={() => setPreviewImage({ isOpen: false, url: '', title: '' })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in cursor-zoom-out print:hidden"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl cursor-default"
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <span className="text-sm font-bold text-zinc-900 flex items-center space-x-2 truncate">
                <Paperclip size={16} className="text-indigo-600" />
                <span className="truncate">{previewImage.title || 'Bukti Transaksi'}</span>
              </span>
              <button
                onClick={() => setPreviewImage({ isOpen: false, url: '', title: '' })}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-zinc-950/5 min-h-[320px] max-h-[75vh] overflow-auto">
              <img 
                src={previewImage.url} 
                alt="Bukti Lampiran" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="p-3 border-t border-zinc-100 bg-white flex justify-between items-center text-xs text-zinc-500">
              <span>Klik luar gambar atau tombol silang untuk menutup.</span>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-bold inline-flex items-center space-x-1"
              >
                <ZoomIn size={14} />
                <span>Buka Ukuran Asli</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT DATA PENJUALAN FORMAT DISTRIBUSI (DMS) MODAL */}
      {exportDmsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full shadow-2xl p-6 relative flex flex-col space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Export Penjualan (DMS)</h3>
                  <p className="text-xs text-zinc-500">Format 29 kolom standar DMS & FMCG Distribusi</p>
                </div>
              </div>
              <button
                onClick={() => setExportDmsModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Rentang Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={exportDmsFilter.startDate}
                    onChange={e => setExportDmsFilter({ ...exportDmsFilter, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={exportDmsFilter.endDate}
                    onChange={e => setExportDmsFilter({ ...exportDmsFilter, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Filter Salesman */}
              <div>
                <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">
                  Filter Tenaga Penjual (Salesman)
                </label>
                <select
                  value={exportDmsFilter.salespersonId}
                  onChange={e => setExportDmsFilter({ ...exportDmsFilter, salespersonId: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Semua Salesman</option>
                  {salespersons.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.code ? `[${sp.code}] ` : ''}{sp.name}</option>
                  ))}
                </select>
              </div>

              {/* Filter Status Pajak */}
              <div>
                <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5">
                  Tipe Penjualan (Pajak)
                </label>
                <select
                  value={exportDmsFilter.taxStatus}
                  onChange={e => setExportDmsFilter({ ...exportDmsFilter, taxStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Semua Transaksi (PKP & Non-PKP)</option>
                  <option value="PKP">Hanya Penjualan PKP (PPN)</option>
                  <option value="NON_PKP">Hanya Penjualan Non-PKP</option>
                </select>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3 text-[11px] text-emerald-800 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Kalkulasi Otomatis Laporan:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-700 pl-1">
                  <li>Deteksi otomatis <strong>RO (Repeat Order)</strong> vs <strong>NOO (New Outlet)</strong></li>
                  <li>Normalisasi otomatis kuantitas <strong>CRT FIX</strong> & DPP Satuan</li>
                  <li>Perhitungan nilai total bruto <strong>VALUE FIX</strong> & status cek audit</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setExportDmsModalOpen(false)}
                disabled={exportDmsLoading}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteExportDms}
                disabled={exportDmsLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {exportDmsLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Mengekspor...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Unduh Excel (.xlsx)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Bottom Bulk Action Bar for Sales Orders */}
      {activeTab === 'SO' && selectedSoIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-zinc-700/80 flex items-center space-x-4 animate-in slide-in-from-bottom-5 duration-200 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center shadow-xs">
              {selectedSoIds.size}
            </span>
            <span className="text-xs font-bold text-zinc-100">
              Sales Order Dipilih
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={triggerBulkPrint}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 cursor-pointer transition-all"
            >
              <Printer size={14} />
              <span>Cetak {selectedSoIds.size} Faktur Massal</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedSoIds(new Set())}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-medium px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;

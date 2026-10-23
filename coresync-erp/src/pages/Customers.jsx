import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import SearchSelect from '../components/SearchSelect';
import {
  Plus, Search, Loader2, AlertCircle,
  Phone, Mail, MapPin, Edit2, Trash2, Eye,
  ShoppingCart, X, Building2, FileText, CheckCircle,
  CreditCard, Calendar, Clock, ShieldCheck, Map, DollarSign,
  UserCheck, Compass, CheckSquare, Square,
  UploadCloud, Download, FileSpreadsheet, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import { formatRupiah } from '../utils/format';

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const MODAL_TABS = [
  { id: 'IDENTITY', label: '1. Identitas & Kontak', icon: Building2 },
  { id: 'TERRITORY', label: '2. Wilayah & Sales', icon: Map },
  { id: 'FINANCE', label: '3. Finansial & Harga', icon: CreditCard },
  { id: 'TAX', label: '4. Pajak & Legalitas', icon: ShieldCheck },
  { id: 'SCHEDULE', label: '5. Jadwal Kunjungan', icon: Calendar }
];

const DAYS_LIST = [
  { key: 'S_SENIN', label: 'Senin (S)' },
  { key: 'S_SELASA', label: 'Selasa (S)' },
  { key: 'R_RABU', label: 'Rabu (R)' },
  { key: 'K_KAMIS', label: 'Kamis (K)' },
  { key: 'J_JUMAT', label: 'Jumat (J)' },
  { key: 'S_SABTU', label: 'Sabtu (S)' }
];

const WEEKS_LIST = [
  { key: 'MG-1', label: 'Minggu 1 (MG-1)' },
  { key: 'MG-2', label: 'Minggu 2 (MG-2)' },
  { key: 'MG-3', label: 'Minggu 3 (MG-3)' },
  { key: 'MG-4', label: 'Minggu 4 (MG-4)' }
];

const PAGE_SIZE = 15;

const emptyCustomerForm = {
  code: '',
  legacyCode: '',
  name: '',
  address: '',
  address2: '',
  phone: '',
  phone2: '',
  regionCode: '',
  regionName: '',
  typeCode: '',
  typeName: '',
  areaCode: '',
  areaName: '',
  districtName: '',
  salespersonCode: '',
  salespersonName: '',
  salespersonId: '',
  topDays: 0,
  creditLimit: 0,
  contactPerson: '',
  contactPersonPhone: '',
  nik: '',
  npwp: '',
  taxName: '',
  taxAddress1: '',
  taxAddress2: '',
  taxBlock: '',
  taxHouseNumber: '',
  taxRt: '',
  taxRw: '',
  taxKelurahan: '',
  taxKecamatan: '',
  taxCity: '',
  taxProvince: '',
  priceTier: 'REGULER',
  visitDays: [],
  visitWeeks: [],
  visitTime: '',
  openOutletDate: ''
};

const Customers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const salespersonId = searchParams.get('salespersonId') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortDir = searchParams.get('sortDir') || 'ASC';

  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [data, setData] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('IDENTITY');
  const [editCustomer, setEditCustomer] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formData, setFormData] = useState(emptyCustomerForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  // ─── Excel Import States ──────────────────────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  const canRead = hasPermission(user, 'customers', 'read');
  const canCreate = hasPermission(user, 'customers', 'create');
  const canUpdate = hasPermission(user, 'customers', 'update');
  const canDelete = hasPermission(user, 'customers', 'delete');

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch, true);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    setInputValue(search);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
    fetchSalespersons();
  }, [page, limit, search, salespersonId, status, sortBy, sortDir]);

  const updateParam = (key, value, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (resetPage) next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleSort = (sKey, sDir) => {
    const next = new URLSearchParams(searchParams);
    next.set('sortBy', sKey);
    next.set('sortDir', sDir);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const fetchSalespersons = async () => {
    try {
      const res = await api.get('/salespersons?limit=100');
      setSalespersons(res.data.data || []);
    } catch (e) {
      // ignore
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        type: 'CUSTOMER',
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortBy,
        sortDir: sortDir
      });
      if (search.trim()) params.set('search', search.trim());
      if (salespersonId) params.set('salespersonId', salespersonId);
      if (status) params.set('status', status);

      const res = await api.get(`/customers?${params.toString()}`);
      setData(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data pelanggan.');
    } finally {
      setLoading(false);
    }
  };

  const [togglingId, setTogglingId] = useState(null);

  const handlePageChange = (newPage) => {
    updateParam('page', newPage.toString());
  };

  const handleToggleStatus = async (customer) => {
    if (!canUpdate) return;
    try {
      setTogglingId(customer.id);
      const nextIsActive = customer.isActive === false ? true : false;
      const res = await api.patch(`/customers/${customer.id}/status`, {
        isActive: nextIsActive
      });
      toast.success(res.data.message || 'Status pelanggan berhasil diubah.');
      setData(prev => prev.map(c => c.id === customer.id ? { ...c, isActive: nextIsActive } : c));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status pelanggan.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenAdd = () => {
    setEditCustomer(null);
    setFormData(emptyCustomerForm);
    setActiveModalTab('IDENTITY');
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditCustomer(customer);
    setFormData({
      code: customer.code || '',
      legacyCode: customer.legacyCode || '',
      name: customer.name || '',
      address: customer.address || '',
      address2: customer.address2 || '',
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      regionCode: customer.regionCode || '',
      regionName: customer.regionName || '',
      typeCode: customer.typeCode || '',
      typeName: customer.typeName || '',
      areaCode: customer.areaCode || '',
      areaName: customer.areaName || '',
      districtName: customer.districtName || '',
      salespersonCode: customer.salespersonCode || '',
      salespersonName: customer.salespersonName || '',
      salespersonId: customer.salespersonId || '',
      topDays: customer.topDays || 0,
      creditLimit: customer.creditLimit || 0,
      contactPerson: customer.contactPerson || '',
      contactPersonPhone: customer.contactPersonPhone || '',
      nik: customer.nik || '',
      npwp: customer.npwp || '',
      taxName: customer.taxName || '',
      taxAddress1: customer.taxAddress1 || '',
      taxAddress2: customer.taxAddress2 || '',
      taxBlock: customer.taxBlock || '',
      taxHouseNumber: customer.taxHouseNumber || '',
      taxRt: customer.taxRt || '',
      taxRw: customer.taxRw || '',
      taxKelurahan: customer.taxKelurahan || '',
      taxKecamatan: customer.taxKecamatan || '',
      taxCity: customer.taxCity || '',
      taxProvince: customer.taxProvince || '',
      priceTier: customer.priceTier || 'REGULER',
      visitDays: customer.visitDays || [],
      visitWeeks: customer.visitWeeks || [],
      visitTime: customer.visitTime || '',
      openOutletDate: customer.openOutletDate || ''
    });
    setActiveModalTab('IDENTITY');
    setSaveError('');
    setModalOpen(true);
  };

  const handleOpenDetail = (customer) => {
    setDetailCustomer(customer);
    setDetailModalOpen(true);
  };

  const toggleDay = (key) => {
    const cur = formData.visitDays || [];
    if (cur.includes(key)) {
      setFormData({ ...formData, visitDays: cur.filter(d => d !== key) });
    } else {
      setFormData({ ...formData, visitDays: [...cur, key] });
    }
  };

  const toggleWeek = (key) => {
    const cur = formData.visitWeeks || [];
    if (cur.includes(key)) {
      setFormData({ ...formData, visitWeeks: cur.filter(w => w !== key) });
    } else {
      setFormData({ ...formData, visitWeeks: [...cur, key] });
    }
  };

  const handleSalespersonSelect = (spId) => {
    if (!spId) {
      setFormData({ ...formData, salespersonId: '', salespersonCode: '', salespersonName: '' });
      return;
    }
    const sp = salespersons.find(s => s.id === parseInt(spId));
    if (sp) {
      setFormData({
        ...formData,
        salespersonId: sp.id,
        salespersonCode: `SP-${String(sp.id).padStart(3, '0')}`,
        salespersonName: sp.name
      });
    }
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveLoading(true);
    try {
      if (editCustomer) {
        await api.put(`/customers/${editCustomer.id}`, formData);
        toast.success(`Data Pelanggan "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post('/customers', formData);
        toast.success(`Pelanggan baru "${formData.name}" berhasil ditambahkan!`);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan data pelanggan.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmSave = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: editCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan Baru',
      message: `Apakah Anda yakin ingin menyimpan data "${formData.name}"?`,
      type: 'info',
      onConfirm: () => handleSave()
    });
  };

  const handleDelete = async (customer) => {
    try {
      setSaveLoading(true);
      await api.delete(`/customers/${customer.id}`);
      toast.success(`Data pelanggan "${customer.name}" berhasil dihapus.`);
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus pelanggan.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmDelete = (customer) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Pelanggan',
      message: `Apakah Anda yakin ingin menghapus "${customer.name}"? Pelanggan yang sudah memiliki riwayat transaksi SO tidak dapat dihapus.`,
      type: 'danger',
      onConfirm: () => handleDelete(customer)
    });
  };

  // ─── Excel Download & Import Helpers ────────────────────────────────────────
  const downloadExcelTemplate = () => {
    const singleRowHeaders = [
      'No', 'Kode', 'Nama Langganan', 'Alamat-1', 'Alamat-2', 'Telpon-1', 'Telpon-2',
      'Kode Wilayah', 'Nama Wilayah', 'Kode Tipe', 'Nama Tipe', 'Kode Area', 'Nama Area',
      'Nama Kecamatan', 'Kode Salesman', 'Nama Salesman', 'TOP (dlm hari)', 'Plafon Kredit',
      'Contact Person', 'Nomor HP', 'Nomor NIK', 'Nomor NPWP', 'Nama Wajib Pajak',
      'Alamat-1 Wajib Pajak', 'Alamat-2 Wajib Pajak', 'No Blok Wajib Pajak',
      'Nomor Rumah Wajib Pajak', 'Nomor RT Wajib Pajak', 'Nomor RW Wajib Pajak', 'Kelurahan Wajib Pajak',
      'Kecamatan Wajib Pajak', 'Kabupaten/Kota Wajib Pajak', 'Propinsi Wajib Pajak',
      'Kode Lama', 'Jenis Harga',
      'S', 'S', 'R', 'K', 'J', 'S',
      'MG-1', 'MG-2', 'MG-3', 'MG-4',
      'Jam Kunjungan', 'Tgl Open New Outlet'
    ];

    const sampleRow1 = [
      '1', '0110001', 'TB. TIA JAYA / SUDI TK.', 'JL. RAYA PAMIJAHAN', '', '021-123456', '',
      '01', 'PRIANGAN', '1001', 'GROSIR', '011001', 'KOTA TINGGI',
      'TEGAL TIMUR', '103', 'DANI', '15', '0',
      'Bpk. Sudi', '081234567890', '3201123456780001', '03.805.029.9-012.000', 'TB. TIA JAYA / SUDI TK.',
      'JL. RAYA PAMIJAHAN', '', 'Blok A',
      '12', '02', '05', 'PAMIJAHAN',
      'PAMIJAHAN', 'KAB. BOGOR', 'JAWA BARAT',
      '0110001', '1',
      'V', '', '', '', 'V', '',
      'V', '', 'V', '',
      '09:30', '25/10/24'
    ];

    const sampleRow2 = [
      '2', '0110002', 'LANGGAR', 'DEPAN AL-FALAH CIKAJANG PLAZA', '', '0262-987654', '',
      '01', 'PRIANGAN', '1001', 'GROSIR', '011001', 'KOTA TINGGI',
      'TEGAL SELATAN', '101', 'ARDI', '15', '0',
      'Ibu Hajjah', '089876543210', '3201123456780002', '03.805.029.9-012.001', 'LANGGAR',
      'DEPAN AL-FALAH CIKAJANG PLAZA', '', '',
      '05', '01', '02', 'CIKAJANG',
      'CIKAJANG', 'KAB. GARUT', 'JAWA BARAT',
      '0110002', '1',
      '', 'V', '', 'V', '', '',
      '', 'V', '', 'V',
      '13:00', '25/10/24'
    ];

    const wsData = [singleRowHeaders, sampleRow1, sampleRow2];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Pelanggan');

    XLSX.writeFile(wb, 'Format_Master_Pelanggan_CoreSync.xlsx');
    toast.success('Template Excel berhasil diunduh!');
  };

  const handleExportExcel = async () => {
    if (exportLoading) return;
    try {
      setExportLoading(true);
      toast.info('Mengambil seluruh data pelanggan dari server...');

      const res = await api.get('/customers?limit=all');
      const allCustomers = res.data?.data || [];

      if (!allCustomers || allCustomers.length === 0) {
        toast.error('Tidak ada data pelanggan untuk diunduh.');
        return;
      }

      toast.info(`Menyusun ${allCustomers.length} data pelanggan ke Excel...`);

      const singleRowHeaders = [
        'No', 'Kode', 'Nama Langganan', 'Alamat-1', 'Alamat-2', 'Telpon-1', 'Telpon-2',
        'Kode Wilayah', 'Nama Wilayah', 'Kode Tipe', 'Nama Tipe', 'Kode Area', 'Nama Area',
        'Nama Kecamatan', 'Kode Salesman', 'Nama Salesman', 'TOP (dlm hari)', 'Plafon Kredit',
        'Contact Person', 'Nomor HP', 'Nomor NIK', 'Nomor NPWP', 'Nama Wajib Pajak',
        'Alamat-1 Wajib Pajak', 'Alamat-2 Wajib Pajak', 'No Blok Wajib Pajak',
        'Nomor Rumah Wajib Pajak', 'Nomor RT Wajib Pajak', 'Nomor RW Wajib Pajak', 'Kelurahan Wajib Pajak',
        'Kecamatan Wajib Pajak', 'Kabupaten/Kota Wajib Pajak', 'Propinsi Wajib Pajak',
        'Kode Lama', 'Jenis Harga',
        'S', 'S', 'R', 'K', 'J', 'S',
        'MG-1', 'MG-2', 'MG-3', 'MG-4',
        'Jam Kunjungan', 'Tgl Open New Outlet'
      ];

      const rows = allCustomers.map((c, idx) => {
        let visitDays = [];
        if (Array.isArray(c.visitDays)) {
          visitDays = c.visitDays;
        } else if (typeof c.visitDays === 'string') {
          try { visitDays = JSON.parse(c.visitDays); } catch (e) { visitDays = []; }
        }

        let visitWeeks = [];
        if (Array.isArray(c.visitWeeks)) {
          visitWeeks = c.visitWeeks;
        } else if (typeof c.visitWeeks === 'string') {
          try { visitWeeks = JSON.parse(c.visitWeeks); } catch (e) { visitWeeks = []; }
        }

        const hasDay = (dayKey) => Array.isArray(visitDays) && visitDays.includes(dayKey) ? 'V' : '';
        const hasWeek = (weekKey) => Array.isArray(visitWeeks) && visitWeeks.includes(weekKey) ? 'V' : '';

        let formattedOpenDate = '';
        if (c.openOutletDate) {
          try {
            const d = new Date(c.openOutletDate);
            if (!isNaN(d.getTime())) {
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = String(d.getFullYear()).slice(-2);
              formattedOpenDate = `${day}/${month}/${year}`;
            }
          } catch (e) {
            formattedOpenDate = c.openOutletDate;
          }
        }

        return [
          String(idx + 1),
          c.code || '',
          c.name || '',
          c.address || '',
          c.address2 || '',
          c.phone || '',
          c.phone2 || '',
          c.regionCode || '',
          c.regionName || '',
          c.typeCode || '',
          c.typeName || '',
          c.areaCode || '',
          c.areaName || '',
          c.districtName || '',
          c.salespersonCode || (c.salesperson ? c.salesperson.code : ''),
          c.salespersonName || (c.salesperson ? c.salesperson.name : ''),
          String(c.topDays || 0),
          String(c.creditLimit || 0),
          c.contactPerson || '',
          c.contactPersonPhone || '',
          c.nik || '',
          c.npwp || '',
          c.taxName || '',
          c.taxAddress1 || '',
          c.taxAddress2 || '',
          c.taxBlock || '',
          c.taxHouseNumber || '',
          c.taxRt || '',
          c.taxRw || '',
          c.taxKelurahan || '',
          c.taxKecamatan || '',
          c.taxCity || '',
          c.taxProvince || '',
          c.legacyCode || '',
          c.priceTier || '1',
          hasDay('S_SENIN'),
          hasDay('S_SELASA'),
          hasDay('R_RABU'),
          hasDay('K_KAMIS'),
          hasDay('J_JUMAT'),
          hasDay('S_SABTU'),
          hasWeek('MG-1'),
          hasWeek('MG-2'),
          hasWeek('MG-3'),
          hasWeek('MG-4'),
          c.visitTime || '',
          formattedOpenDate
        ];
      });

      const wsData = [singleRowHeaders, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master_Pelanggan');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Data_Pelanggan_CoreSync_${dateStr}.xlsx`);
      toast.success(`Berhasil mengunduh ${allCustomers.length} data pelanggan ke Excel!`);
    } catch (err) {
      console.error('Export customer error:', err);
      toast.error('Gagal mengunduh data pelanggan: ' + (err.response?.data?.message || err.message || 'Terjadi kesalahan'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!rows || rows.length < 2) {
          setImportError('File Excel tidak memiliki baris data.');
          setImportPreview([]);
          return;
        }

        // Preview up to 10 rows
        setImportPreview(rows.slice(0, 12));
      } catch (err) {
        setImportError('Gagal membaca file Excel: ' + err.message);
        setImportPreview([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (!importFile) {
      setImportError('Pilih file Excel terlebih dahulu.');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportStats(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', importFile);

      const res = await api.post('/customers/import', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setImportStats(res.data.stats);
      toast.success(res.data.message || 'Data pelanggan berhasil diimpor!');
      fetchCustomers();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal memproses impor Excel.';
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImportLoading(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Kode',
      sortable: true,
      render: (v, row) => (
        <div>
          <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            {row.code || `C-TGL-${String(row.id).padStart(6, '0')}`}
          </span>
          {row.legacyCode && (
            <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">
              Lama: {row.legacyCode}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'name',
      label: 'Nama Pelanggan & PIC',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-bold text-zinc-900 text-sm">{row.name}</p>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
            {row.contactPerson && (
              <span className="font-medium text-zinc-700">PIC: {row.contactPerson}</span>
            )}
            {row.typeName && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-100">
                {row.typeName}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'phone',
      label: 'Kontak (HP/Telp)',
      render: (v, row) => (
        <div className="space-y-0.5 text-xs">
          {row.phone && (
            <p className="font-mono text-zinc-800 flex items-center gap-1">
              <Phone size={12} className="text-zinc-400" /> {row.phone}
            </p>
          )}
          {row.contactPersonPhone && (
            <p className="font-mono text-emerald-700 text-[11px]">
              WA: {row.contactPersonPhone}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'territory',
      label: 'Wilayah & Salesman',
      render: (_, row) => (
        <div className="text-xs space-y-0.5">
          {(row.areaName || row.regionName) ? (
            <p className="font-semibold text-zinc-800">
              {row.areaName || row.regionName} {row.districtName ? `(${row.districtName})` : ''}
            </p>
          ) : (
            <span className="text-zinc-400 italic">—</span>
          )}
          {row.salespersonName && (
            <p className="text-[11px] text-indigo-600 font-medium">
              Sales: {row.salespersonName}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'terms',
      label: 'Finansial & Plafon',
      render: (_, row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-zinc-900">
            TOP: <span className="text-theme font-bold">{row.topDays || 0} Hari</span>
          </p>
          <p className="text-[11px] text-zinc-500 font-mono">
            Plafon: {formatRupiah(row.creditLimit || 0)}
          </p>
        </div>
      )
    },
    {
      key: 'isActive',
      label: 'Status',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (v, row) => {
        const active = v !== false;
        return (
          <button
            type="button"
            disabled={!canUpdate || togglingId === row.id}
            onClick={() => handleToggleStatus(row)}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
              active
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
            } ${canUpdate ? 'cursor-pointer' : 'cursor-default'} ${togglingId === row.id ? 'opacity-50 cursor-wait' : ''}`}
            title={canUpdate ? `Klik untuk mengubah status menjadi ${active ? 'Non-Aktif' : 'Aktif'}` : undefined}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            <span>{active ? 'Aktif' : 'Non-Aktif'}</span>
          </button>
        );
      }
    },
    {
      key: 'actions',
      label: 'Aksi',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            onClick={() => handleOpenDetail(row)}
            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
            title="Lihat Detail Lengkap (39 Kolom)"
          >
            <Eye size={16} />
          </button>
          {canUpdate && (
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
              title="Ubah Data"
            >
              <Edit2 size={15} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => handleConfirmDelete(row)}
              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
              title="Hapus Pelanggan"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header (Title, Subtitle, and Primary Actions) */}
      <PageHeader
        title="Data Pelanggan (Customer Master)"
        subtitle="Kelola master data lengkap outlet & pelanggan distributor (39 Field)."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canRead && (
              <button
                onClick={handleExportExcel}
                disabled={exportLoading}
                title="Unduh seluruh data pelanggan ke file Excel"
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                {exportLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>Unduh Data Excel</span>
              </button>
            )}

            {canCreate && (
              <>
                <button
                  onClick={() => {
                    setImportFile(null);
                    setImportPreview([]);
                    setImportError('');
                    setImportStats(null);
                    setImportModalOpen(true);
                  }}
                  title="Import Data Pelanggan dari Excel"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <UploadCloud size={15} />
                  <span>Import Excel</span>
                </button>

                <button
                  onClick={handleOpenAdd}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>Tambah Pelanggan</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Filter & Search Toolbar (Sticky directly below PageHeader) */}
      <div className="sticky top-36 z-20 bg-zinc-50/95 backdrop-blur-md -mx-6 md:-mx-8 px-6 md:px-8 py-2.5 -mt-4 mb-4 border-b border-zinc-200/60 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Salesman */}
          <div className="w-full sm:w-56">
            <SearchSelect
              options={[
                { value: '', label: 'Semua Salesman' },
                ...salespersons.map(s => ({ value: String(s.id), label: s.name, sublabel: s.code || '' }))
              ]}
              value={salespersonId}
              onChange={(opt) => updateParam('salespersonId', opt ? opt.value : '', true)}
              placeholder="Pilih Salesman"
              searchPlaceholder="Cari salesman..."
            />
          </div>

          {/* Filter Status */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-zinc-500">Status:</span>
            <select
              value={status}
              onChange={(e) => updateParam('status', e.target.value, true)}
              className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs cursor-pointer"
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Non-Aktif</option>
            </select>
          </div>

          {/* Filter Page Limit */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-semibold text-zinc-500">Tampilkan:</span>
            <select
              value={limit}
              onChange={(e) => updateParam('limit', e.target.value, true)}
              className="px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs cursor-pointer"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari kode, nama, PIC, area..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs font-medium"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(''); updateParam('search', '', true); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        emptyText="Belum ada data pelanggan."
        emptyIcon={<ShoppingCart size={40} />}
        rowKey="id"
      />

      {/* ── Add / Edit Modal with Comprehensive Tabs (39 Columns) ─────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-5xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[94vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {editCustomer ? 'Ubah Data Pelanggan' : 'Tambah Pelanggan Baru'}
                  </h3>
                  <p className="text-xs text-zinc-500">Form Master Data Pelanggan Lengkap (39 Kolom)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-200/60 cursor-pointer transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center space-x-1.5 px-6 pt-3 pb-2 border-b border-zinc-100 bg-zinc-50/40 overflow-x-auto shrink-0">
              {MODAL_TABS.map(mt => {
                const Icon = mt.icon;
                const isActive = activeModalTab === mt.id;
                return (
                  <button
                    key={mt.id}
                    type="button"
                    onClick={() => setActiveModalTab(mt.id)}
                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{mt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmSave} className="p-6 overflow-y-auto flex-1 space-y-5">
              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start space-x-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* TAB 1: IDENTITAS & KONTAK */}
              {activeModalTab === 'IDENTITY' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <Building2 size={14} className="text-indigo-600" /> Informasi Identitas & Alamat Toko
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Pelanggan</label>
                      <input
                        type="text"
                        placeholder="Otomatis jika kosong"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Lama (Legacy)</label>
                      <input
                        type="text"
                        placeholder="Kode lama jika ada"
                        value={formData.legacyCode}
                        onChange={e => setFormData({ ...formData, legacyCode: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kecamatan Toko</label>
                      <input
                        type="text"
                        placeholder="e.g. Sukolilo / Wonokromo"
                        value={formData.districtName}
                        onChange={e => setFormData({ ...formData, districtName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                      Nama Langganan / Toko <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Toko Sumber Rezeki / UD Maju Jaya"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Contact Person (PIC)</label>
                      <input
                        type="text"
                        placeholder="Nama pemilik / penanggung jawab"
                        value={formData.contactPerson}
                        onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor HP Contact Person</label>
                      <input
                        type="text"
                        placeholder="08123456789 (WhatsApp)"
                        value={formData.contactPersonPhone}
                        onChange={e => setFormData({ ...formData, contactPersonPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Telpon-1 (Utama)</label>
                      <input
                        type="text"
                        placeholder="031-1234567"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Telpon-2 (Cadangan)</label>
                      <input
                        type="text"
                        placeholder="Nomor telp tambahan"
                        value={formData.phone2}
                        onChange={e => setFormData({ ...formData, phone2: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat-1 (Utama)</label>
                      <textarea
                        rows="2"
                        placeholder="Jl. Raya Utama No. 123"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat-2 (Patokan / Tambahan)</label>
                      <textarea
                        rows="2"
                        placeholder="Dekat Pasar / Seberang Masjid"
                        value={formData.address2}
                        onChange={e => setFormData({ ...formData, address2: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: WILAYAH & SALES */}
              {activeModalTab === 'TERRITORY' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <Map size={14} className="text-indigo-600" /> Segmentasi, Wilayah & Salesman Penanggung Jawab
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Wilayah</label>
                      <input
                        type="text"
                        placeholder="e.g. WIL-01 / JATIM"
                        value={formData.regionCode}
                        onChange={e => setFormData({ ...formData, regionCode: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Wilayah</label>
                      <input
                        type="text"
                        placeholder="e.g. Jawa Timur / Surabaya Raya"
                        value={formData.regionName}
                        onChange={e => setFormData({ ...formData, regionName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Area</label>
                      <input
                        type="text"
                        placeholder="e.g. AR-02 / SBY-TIMUR"
                        value={formData.areaCode}
                        onChange={e => setFormData({ ...formData, areaCode: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Area</label>
                      <input
                        type="text"
                        placeholder="e.g. Surabaya Timur"
                        value={formData.areaName}
                        onChange={e => setFormData({ ...formData, areaName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Tipe Outlet</label>
                      <input
                        type="text"
                        placeholder="e.g. GT, MT, WS, R1, R2"
                        value={formData.typeCode}
                        onChange={e => setFormData({ ...formData, typeCode: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Tipe Outlet</label>
                      <input
                        type="text"
                        placeholder="e.g. Toko Grosir / Toko Kelontong Retail"
                        value={formData.typeName}
                        onChange={e => setFormData({ ...formData, typeName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-3">
                    <h5 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={14} className="text-indigo-600" /> Salesman Penanggung Jawab
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Pilih dari Master</label>
                        <select
                          value={formData.salespersonId}
                          onChange={e => handleSalespersonSelect(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs cursor-pointer font-medium"
                        >
                          <option value="">-- Pilih Salesman --</option>
                          {salespersons.map(sp => (
                            <option key={sp.id} value={sp.id}>{sp.name} ({sp.phone || 'No Telp'})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kode Salesman</label>
                        <input
                          type="text"
                          placeholder="e.g. SP-001"
                          value={formData.salespersonCode}
                          onChange={e => setFormData({ ...formData, salespersonCode: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Salesman</label>
                        <input
                          type="text"
                          placeholder="Nama lengkap sales"
                          value={formData.salespersonName}
                          onChange={e => setFormData({ ...formData, salespersonName: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FINANSIAL & HARGA */}
              {activeModalTab === 'FINANCE' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <CreditCard size={14} className="text-indigo-600" /> Ketentuan Finansial, Tempo & Plafon Kredit
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Jenis / Tingkat Harga</label>
                      <select
                        value={formData.priceTier}
                        onChange={e => setFormData({ ...formData, priceTier: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 cursor-pointer"
                      >
                        <option value="REGULER">Harga Reguler / Standar</option>
                        <option value="GROSIR">Harga Grosir (Wholesale)</option>
                        <option value="RETAIL">Harga Retail / Toko Kecil</option>
                        <option value="DISTRIBUTOR">Harga Distributor</option>
                        <option value="VIP">Harga Khusus / VIP</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                        TOP (Terms of Payment)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.topDays}
                          onChange={e => setFormData({ ...formData, topDays: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                        />
                        <span className="text-xs font-bold text-zinc-500">Hari</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">0 = Lunas Kontan / Cash on Delivery</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                        Plafon Kredit (Credit Limit)
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="50000"
                          placeholder="0"
                          value={formData.creditLimit}
                          onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-theme"
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">Batas total piutang maksimal yang diizinkan</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PAJAK & LEGALITAS */}
              {activeModalTab === 'TAX' && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <ShieldCheck size={14} className="text-indigo-600" /> Data Wajib Pajak & Legalitas (Faktur Pajak)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor NIK / KTP</label>
                      <input
                        type="text"
                        maxLength="30"
                        placeholder="16 digit NIK pemilik"
                        value={formData.nik}
                        onChange={e => setFormData({ ...formData, nik: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor NPWP</label>
                      <input
                        type="text"
                        placeholder="00.000.000.0-000.000"
                        value={formData.npwp}
                        onChange={e => setFormData({ ...formData, npwp: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Wajib Pajak</label>
                      <input
                        type="text"
                        placeholder="Nama sesuai kartu NPWP"
                        value={formData.taxName}
                        onChange={e => setFormData({ ...formData, taxName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat-1 Wajib Pajak</label>
                      <textarea
                        rows="2"
                        placeholder="Alamat domisili NPWP (Baris 1)"
                        value={formData.taxAddress1}
                        onChange={e => setFormData({ ...formData, taxAddress1: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat-2 Wajib Pajak</label>
                      <textarea
                        rows="2"
                        placeholder="Alamat domisili NPWP (Baris 2)"
                        value={formData.taxAddress2}
                        onChange={e => setFormData({ ...formData, taxAddress2: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">No. Blok</label>
                      <input
                        type="text"
                        placeholder="Blok A"
                        value={formData.taxBlock}
                        onChange={e => setFormData({ ...formData, taxBlock: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor Rumah</label>
                      <input
                        type="text"
                        placeholder="No. 12"
                        value={formData.taxHouseNumber}
                        onChange={e => setFormData({ ...formData, taxHouseNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">RT</label>
                      <input
                        type="text"
                        placeholder="001"
                        value={formData.taxRt}
                        onChange={e => setFormData({ ...formData, taxRt: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">RW</label>
                      <input
                        type="text"
                        placeholder="002"
                        value={formData.taxRw}
                        onChange={e => setFormData({ ...formData, taxRw: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kelurahan W.Pajak</label>
                      <input
                        type="text"
                        placeholder="Kelurahan"
                        value={formData.taxKelurahan}
                        onChange={e => setFormData({ ...formData, taxKelurahan: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kecamatan W.Pajak</label>
                      <input
                        type="text"
                        placeholder="Kecamatan"
                        value={formData.taxKecamatan}
                        onChange={e => setFormData({ ...formData, taxKecamatan: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kab/Kota W.Pajak</label>
                      <input
                        type="text"
                        placeholder="Kota / Kabupaten"
                        value={formData.taxCity}
                        onChange={e => setFormData({ ...formData, taxCity: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Provinsi W.Pajak</label>
                      <input
                        type="text"
                        placeholder="Provinsi"
                        value={formData.taxProvince}
                        onChange={e => setFormData({ ...formData, taxProvince: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: JADWAL KUNJUNGAN (CALL PLAN) */}
              {activeModalTab === 'SCHEDULE' && (
                <div className="space-y-5 animate-fadeIn">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b">
                    <Calendar size={14} className="text-indigo-600" /> Rute, Hari & Siklus Kunjungan Salesman (Call Plan)
                  </h4>

                  {/* Hari Kunjungan */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                      Hari Kunjungan Rutin
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {DAYS_LIST.map(d => {
                        const isChecked = (formData.visitDays || []).includes(d.key);
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() => toggleDay(d.key)}
                            className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 font-medium'
                            }`}
                          >
                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-zinc-400" />}
                            <span className="text-xs">{d.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Siklus Minggu Kunjungan */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                      Siklus Minggu Kunjungan
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {WEEKS_LIST.map(w => {
                        const isChecked = (formData.visitWeeks || []).includes(w.key);
                        return (
                          <button
                            key={w.key}
                            type="button"
                            onClick={() => toggleWeek(w.key)}
                            className={`p-3 rounded-2xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-bold'
                                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 font-medium'
                            }`}
                          >
                            {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-zinc-400" />}
                            <span className="text-xs">{w.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jam Kunjungan & Tgl Open Outlet */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block flex items-center gap-1">
                        <Clock size={13} className="text-zinc-400" /> Jam Kunjungan (Jam:Menit)
                      </label>
                      <input
                        type="time"
                        value={formData.visitTime}
                        onChange={e => setFormData({ ...formData, visitTime: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block flex items-center gap-1">
                        <Calendar size={13} className="text-zinc-400" /> Tanggal Buka Outlet Baru (NOO)
                      </label>
                      <input
                        type="date"
                        value={formData.openOutletDate}
                        onChange={e => setFormData({ ...formData, openOutletDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-5 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex gap-2">
                  {activeModalTab !== 'IDENTITY' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = MODAL_TABS.findIndex(m => m.id === activeModalTab);
                        if (idx > 0) setActiveModalTab(MODAL_TABS[idx - 1].id);
                      }}
                      className="px-3.5 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                    >
                      ← Tab Sebelumnya
                    </button>
                  )}
                  {activeModalTab !== 'SCHEDULE' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = MODAL_TABS.findIndex(m => m.id === activeModalTab);
                        if (idx < MODAL_TABS.length - 1) setActiveModalTab(MODAL_TABS[idx + 1].id);
                      }}
                      className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Tab Selanjutnya →
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2.5">
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
                    <span>{editCustomer ? 'Simpan Perubahan' : 'Tambah Pelanggan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail View Modal (39 Columns Read-Only Viewer) ────────────────────────── */}
      {detailModalOpen && detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {detailCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900">{detailCustomer.name}</h3>
                    <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {detailCustomer.code || `C-TGL-${String(detailCustomer.id).padStart(6, '0')}`}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Detail Master Pelanggan Lengkap (39 Kolom)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Section 1 */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-indigo-700 pb-1 border-b">
                  1. Identitas & Kontak Toko
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Kode Lama:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailCustomer.legacyCode || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Contact Person (PIC):</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.contactPerson || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">HP Contact Person:</span>
                    <span className="font-mono font-bold text-emerald-700">{detailCustomer.contactPersonPhone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Telpon 1:</span>
                    <span className="font-mono text-zinc-800">{detailCustomer.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Telpon 2:</span>
                    <span className="font-mono text-zinc-800">{detailCustomer.phone2 || '—'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-zinc-500 block">Alamat Toko:</span>
                    <span className="text-zinc-800 font-medium">{detailCustomer.address || '—'} {detailCustomer.address2 ? `(${detailCustomer.address2})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Kecamatan Toko:</span>
                    <span className="text-zinc-800 font-bold">{detailCustomer.districtName || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-indigo-700 pb-1 border-b">
                  2. Wilayah, Area & Salesman
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Wilayah:</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.regionName || '—'} ({detailCustomer.regionCode || '—'})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Area:</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.areaName || '—'} ({detailCustomer.areaCode || '—'})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Tipe Toko:</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.typeName || '—'} ({detailCustomer.typeCode || '—'})</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-zinc-500 block">Salesman Penanggung Jawab:</span>
                    <span className="font-bold text-indigo-700">{detailCustomer.salespersonName || '—'} ({detailCustomer.salespersonCode || '—'})</span>
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-indigo-700 pb-1 border-b">
                  3. Finansial, TOP & Plafon
                </h4>
                <div className="grid grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Tingkat Harga:</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.priceTier || 'REGULER'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">TOP (Tempo):</span>
                    <span className="font-bold text-indigo-600 font-mono">{detailCustomer.topDays || 0} Hari</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Plafon Kredit:</span>
                    <span className="font-bold text-theme font-mono">{formatRupiah(detailCustomer.creditLimit || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Section 4 */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-indigo-700 pb-1 border-b">
                  4. Pajak & Legalitas (NPWP/NIK)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Nomor NIK / KTP:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailCustomer.nik || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Nomor NPWP:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailCustomer.npwp || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Nama Wajib Pajak:</span>
                    <span className="font-bold text-zinc-800">{detailCustomer.taxName || '—'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-zinc-500 block">Alamat NPWP:</span>
                    <span className="text-zinc-800">
                      {[detailCustomer.taxAddress1, detailCustomer.taxAddress2, detailCustomer.taxBlock ? `Blok ${detailCustomer.taxBlock}` : null, detailCustomer.taxHouseNumber ? `No. ${detailCustomer.taxHouseNumber}` : null, detailCustomer.taxRt ? `RT ${detailCustomer.taxRt}` : null, detailCustomer.taxRw ? `RW ${detailCustomer.taxRw}` : null, detailCustomer.taxKelurahan, detailCustomer.taxKecamatan, detailCustomer.taxCity, detailCustomer.taxProvince].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5 */}
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider text-indigo-700 pb-1 border-b">
                  5. Jadwal Kunjungan (Call Plan)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80">
                  <div>
                    <span className="text-zinc-500 block">Hari Kunjungan:</span>
                    <span className="font-bold text-zinc-800">
                      {(detailCustomer.visitDays && detailCustomer.visitDays.length > 0) ? detailCustomer.visitDays.join(', ') : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Siklus Minggu:</span>
                    <span className="font-bold text-zinc-800">
                      {(detailCustomer.visitWeeks && detailCustomer.visitWeeks.length > 0) ? detailCustomer.visitWeeks.join(', ') : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Jam Kunjungan:</span>
                    <span className="font-mono font-bold text-zinc-800">{detailCustomer.visitTime || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Tgl Open Outlet (NOO):</span>
                    <span className="font-mono text-zinc-800">{detailCustomer.openOutletDate || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        type={confirmConfig.type}
        loading={saveLoading}
      />

      {/* ── Excel Import Modal ───────────────────────────────────────────────────── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 animate-fadeIn overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Import Master Pelanggan dari Excel
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Unggah file Excel / CSV sesuai format 39 kolom untuk migrasi data massal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-2 rounded-full hover:bg-zinc-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Step 1: Upload Box */}
              <div className="border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-zinc-50/50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="excelFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-zinc-800 block">
                      {importFile ? importFile.name : 'Klik untuk pilih file Excel (.xlsx / .xls / .csv)'}
                    </span>
                    <span className="text-xs text-zinc-400 mt-1 block">
                      Mendukung format tabel 39 kolom (Kode, Nama, Wilayah, Salesman, Pajak, Kunjungan)
                    </span>
                  </div>
                </label>
              </div>

              {/* Action helper bar */}
              <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <span className="text-zinc-600">
                  Belum punya formatnya? Unduh file contoh yang sudah disiapkan:
                </span>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download size={13} />
                  Unduh Template Contoh
                </button>
              </div>

              {/* Error box */}
              {importError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Stats / Result box */}
              {importStats && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle size={18} className="text-emerald-600" />
                    Migrasi Berhasil Diproses!
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block">Total Baris</span>
                      <span className="text-base font-bold text-zinc-800">{importStats.totalProcessed}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block text-emerald-600 font-semibold">Pelanggan Baru</span>
                      <span className="text-base font-bold text-emerald-700">+{importStats.created}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block text-indigo-600 font-semibold">Diperbarui</span>
                      <span className="text-base font-bold text-indigo-700">{importStats.updated}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview table */}
              {importPreview.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-700 mb-2 flex items-center justify-between">
                    <span>Pratinjau Data Excel ({importPreview.length - 2} baris terdeteksi):</span>
                    <span className="text-[11px] text-zinc-400 font-normal">Menampilkan maks. 10 baris pertama</span>
                  </h4>
                  <div className="border border-zinc-200 rounded-xl overflow-x-auto max-h-60">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <tbody className="divide-y divide-zinc-100">
                        {importPreview.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-indigo-50/80 font-bold text-indigo-900 sticky top-0'
                                : rIdx === 1
                                ? 'bg-indigo-50/40 font-semibold text-indigo-800'
                                : 'hover:bg-zinc-50 text-zinc-700'
                            }
                          >
                            <td className="p-2 border-r border-zinc-200 font-mono text-zinc-400 bg-zinc-50/60 text-center w-8">
                              {rIdx + 1}
                            </td>
                            {row.slice(0, 15).map((cell, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-zinc-100 whitespace-nowrap truncate max-w-[150px]">
                                {String(cell || '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-200 transition-all cursor-pointer"
              >
                Batal / Tutup
              </button>

              <button
                type="button"
                disabled={!importFile || importLoading}
                onClick={handleExecuteImport}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center space-x-2 cursor-pointer ${
                  !importFile || importLoading
                    ? 'bg-zinc-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {importLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memproses Migrasi...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>Proses Impor ke Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;

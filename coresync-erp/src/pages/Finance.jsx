import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import DataTable from '../components/DataTable';
import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import { formatRupiah } from '../utils/format';
import { getImageUrl } from '../utils/imageUrl';
import { 
  Landmark, 
  Calendar, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  FileText, 
  Plus, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign,
  Search,
  X,
  UploadCloud,
  Paperclip,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Camera
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

const PAGE_SIZE = 10;

const Finance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canRead = hasPermission(user, 'finance', 'read');
  const canCreate = hasPermission(user, 'finance', 'create');
  const canUpdate = hasPermission(user, 'finance', 'update');
  const canDelete = hasPermission(user, 'finance', 'delete');

  // Read URL search params
  const activeTab = searchParams.get('tab') || 'COA'; // COA, PAY, JRN
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';

  // Local input for debouncing search
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [coa, setCoa] = useState([]);
  const [allCoa, setAllCoa] = useState([]);
  const [journals, setJournals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [report, setReport] = useState(null);
  
  // Date range picker for Income Statement
  const defaultStartDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState(null);

  // Modal State for COA (Create / Edit)
  const [coaModalOpen, setCoaModalOpen] = useState(false);
  const [coaForm, setCoaForm] = useState({
    id: null,
    accountCode: '',
    accountName: '',
    accountType: 'ASSET',
    isActive: true
  });
  const [coaSaveLoading, setCoaSaveLoading] = useState(false);
  const [coaError, setCoaError] = useState('');

  // Modal State for recording Payment
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    invoiceId: '',
    paymentNumber: '',
    paymentDate: '',
    paymentType: 'RECEIPT', // RECEIPT or DISBURSEMENT
    paymentMethod: 'CASH',
    amount: '',
    accountId: '',
    notes: ''
  });
  const [payEvidenceFile, setPayEvidenceFile] = useState(null);
  const [payEvidencePreview, setPayEvidencePreview] = useState('');
  const [paySaveLoading, setPaySaveLoading] = useState(false);
  const [payError, setPayError] = useState('');

  // Modal State for Manual Journal
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    description: '',
    items: [
      { accountId: '', type: 'DEBIT', amount: '' },
      { accountId: '', type: 'CREDIT', amount: '' }
    ]
  });
  const [journalEvidenceFile, setJournalEvidenceFile] = useState(null);
  const [journalEvidencePreview, setJournalEvidencePreview] = useState('');
  const [journalSaveLoading, setJournalSaveLoading] = useState(false);
  const [journalError, setJournalError] = useState('');

  // Lightbox Image Preview Modal
  const [previewImage, setPreviewImage] = useState({
    isOpen: false,
    url: '',
    title: ''
  });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

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

  // Sync local input with URL
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  // Fetch when activeTab, page, or search query changes in URL
  useEffect(() => {
    fetchActiveData();
  }, [activeTab, page, search]);

  useEffect(() => {
    fetchReport();
    fetchUnpaidInvoices();
    fetchAllCoa();
  }, []);

  const fetchAllCoa = async () => {
    try {
      const res = await api.get('/chart-of-accounts?limit=200');
      setAllCoa(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString()
      });
      if (search.trim()) queryParams.set('search', search.trim());

      if (activeTab === 'COA') {
        queryParams.set('sortBy', 'accountCode');
        queryParams.set('sortDir', 'ASC');
        const res = await api.get(`/chart-of-accounts?${queryParams.toString()}`);
        setCoa(res.data.data);
        setPagination(res.data.pagination);
      } else if (activeTab === 'PAY') {
        const res = await api.get(`/payments?${queryParams.toString()}`);
        setPayments(res.data.data);
        setPagination(res.data.pagination);
      } else if (activeTab === 'JRN') {
        const res = await api.get(`/journal-entries?${queryParams.toString()}`);
        setJournals(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data keuangan.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidInvoices = async () => {
    try {
      const res = await api.get('/invoices?limit=100');
      setInvoices(res.data.data || []);
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  };

  const fetchReport = async () => {
    try {
      setReportLoading(true);
      const res = await api.get(`/reports/income-statement?startDate=${startDate}&endDate=${endDate}`);
      setReport(res.data.data);
      setReportLoading(false);
    } catch (err) {
      console.error('Failed to load income statement', err);
      setReportLoading(false);
    }
  };

  const handleTabChange = (newTab) => {
    const next = new URLSearchParams();
    next.set('tab', newTab);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
    setInputValue('');
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', newPage.toString());
    setSearchParams(next, { replace: true });
  };

  // --- COA Modal Handlers ---
  const handleOpenCreateCoa = () => {
    setCoaForm({
      id: null,
      accountCode: '',
      accountName: '',
      accountType: 'ASSET',
      isActive: true
    });
    setCoaError('');
    setCoaModalOpen(true);
  };

  const handleOpenEditCoa = (acc) => {
    setCoaForm({
      id: acc.id,
      accountCode: acc.accountCode,
      accountName: acc.accountName,
      accountType: acc.accountType,
      isActive: acc.isActive !== false
    });
    setCoaError('');
    setCoaModalOpen(true);
  };

  const handleSaveCoa = async (e) => {
    e.preventDefault();
    if (!coaForm.accountCode.trim() || !coaForm.accountName.trim()) {
      setCoaError('Kode akun dan nama akun wajib diisi.');
      return;
    }

    setCoaSaveLoading(true);
    setCoaError('');

    try {
      if (coaForm.id) {
        await api.put(`/chart-of-accounts/${coaForm.id}`, coaForm);
        toast.success('Akun COA berhasil diperbarui');
      } else {
        await api.post('/chart-of-accounts', coaForm);
        toast.success('Akun COA baru berhasil ditambahkan');
      }
      setCoaModalOpen(false);
      fetchActiveData();
      fetchAllCoa();
    } catch (err) {
      setCoaError(err.response?.data?.message || 'Gagal menyimpan akun COA');
    } finally {
      setCoaSaveLoading(false);
    }
  };

  const handleDeleteCoa = (acc) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Akun COA',
      message: `Apakah Anda yakin ingin menghapus akun [${acc.accountCode}] ${acc.accountName}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/chart-of-accounts/${acc.id}`);
          toast.success('Akun COA berhasil dihapus');
          setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info' });
          fetchActiveData();
          fetchAllCoa();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menghapus akun COA');
        }
      }
    });
  };

  // --- Payment Modal Handlers ---
  const handleOpenPay = async () => {
    setError('');
    let activeCoa = allCoa.length > 0 ? allCoa : coa;
    if (activeCoa.length === 0) {
      try {
        const res = await api.get('/chart-of-accounts?limit=100');
        activeCoa = res.data.data || [];
        setAllCoa(activeCoa);
      } catch (err) {
        console.error(err);
      }
    }
    const kasBankAccounts = activeCoa.filter(acc => acc.accountCode === '10001' || acc.accountCode === '10002');
    setPayForm({
      invoiceId: '',
      paymentNumber: `PAY-${Date.now().toString().substring(6)}`,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentType: 'RECEIPT',
      paymentMethod: 'CASH',
      amount: '',
      accountId: kasBankAccounts[0]?.id || '',
      notes: ''
    });
    setPayEvidenceFile(null);
    setPayEvidencePreview('');
    setPayError('');
    setPayModalOpen(true);
  };

  const handlePayTypeChange = (type) => {
    setPayForm({
      ...payForm,
      paymentType: type,
      invoiceId: ''
    });
  };

  const handleInvoiceChange = (invId) => {
    const inv = invoices.find(i => i.id === parseInt(invId));
    setPayForm({
      ...payForm,
      invoiceId: invId,
      amount: inv ? parseFloat(inv.amountDue) : ''
    });
  };

  const handlePayEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPayEvidenceFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPayEvidencePreview(objectUrl);
  };

  const handleRemovePayEvidence = () => {
    setPayEvidenceFile(null);
    setPayEvidencePreview('');
  };

  const handleSavePayment = async () => {
    setPayError('');
    setPaySaveLoading(true);

    try {
      const formData = new FormData();
      formData.append('paymentNumber', payForm.paymentNumber);
      formData.append('paymentDate', payForm.paymentDate);
      formData.append('paymentType', payForm.paymentType);
      formData.append('paymentMethod', payForm.paymentMethod);
      formData.append('amount', payForm.amount);
      formData.append('accountId', payForm.accountId);
      if (payForm.invoiceId) formData.append('invoiceId', payForm.invoiceId);
      if (payForm.notes) formData.append('notes', payForm.notes);
      if (payEvidenceFile) formData.append('evidence', payEvidenceFile);

      await api.post('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(`Pembayaran ${payForm.paymentNumber} berhasil dicatat!`);
      setPaySaveLoading(false);
      setPayModalOpen(false);
      fetchActiveData();
      fetchReport();
      fetchUnpaidInvoices();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal merekam pembayaran.';
      setPayError(msg);
      toast.error(msg);
      setPaySaveLoading(false);
    } finally {
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmSavePayment = (e) => {
    e.preventDefault();
    const typeLabel = payForm.paymentType === 'RECEIPT' ? 'Penerimaan Kas' : 'Pengeluaran Kas';
    setConfirmConfig({
      isOpen: true,
      title: `Simpan ${typeLabel}`,
      message: `Apakah Anda yakin ingin mencatat transaksi nomor ${payForm.paymentNumber} senilai Rp${parseFloat(payForm.amount || 0).toLocaleString('id-ID')}?`,
      type: 'info',
      onConfirm: () => handleSavePayment()
    });
  };

  // --- Manual Journal Modal Handlers ---
  const handleOpenManualJournal = async () => {
    setJournalError('');
    let activeCoa = allCoa.length > 0 ? allCoa : coa;
    if (activeCoa.length === 0) {
      try {
        const res = await api.get('/chart-of-accounts?limit=200');
        activeCoa = res.data.data || [];
        setAllCoa(activeCoa);
      } catch (err) {
        console.error(err);
      }
    }
    setJournalForm({
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      items: [
        { accountId: activeCoa[0]?.id || '', type: 'DEBIT', amount: '' },
        { accountId: activeCoa[1]?.id || '', type: 'CREDIT', amount: '' }
      ]
    });
    setJournalEvidenceFile(null);
    setJournalEvidencePreview('');
    setJournalModalOpen(true);
  };

  const handleAddJournalLine = () => {
    setJournalForm(prev => ({
      ...prev,
      items: [...prev.items, { accountId: allCoa[0]?.id || '', type: 'DEBIT', amount: '' }]
    }));
  };

  const handleRemoveJournalLine = (index) => {
    if (journalForm.items.length <= 2) {
      toast.error('Jurnal umum minimal harus memiliki 2 baris akun (Debit & Kredit).');
      return;
    }
    setJournalForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleJournalLineChange = (index, field, value) => {
    setJournalForm(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const handleJournalEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJournalEvidenceFile(file);
    const objectUrl = URL.createObjectURL(file);
    setJournalEvidencePreview(objectUrl);
  };

  const handleRemoveJournalEvidence = () => {
    setJournalEvidenceFile(null);
    setJournalEvidencePreview('');
  };

  // Calculate live journal totals
  const totalDebit = journalForm.items
    .filter(it => it.type === 'DEBIT')
    .reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  const totalCredit = journalForm.items
    .filter(it => it.type === 'CREDIT')
    .reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSaveManualJournal = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      setJournalError(`Jurnal belum seimbang! Total Debit (Rp ${totalDebit.toLocaleString('id-ID')}) tidak sama dengan Total Kredit (Rp ${totalCredit.toLocaleString('id-ID')}).`);
      return;
    }

    setJournalError('');
    setJournalSaveLoading(true);

    try {
      const formData = new FormData();
      formData.append('transactionDate', journalForm.transactionDate);
      formData.append('description', journalForm.description);
      formData.append('items', JSON.stringify(journalForm.items));
      if (journalEvidenceFile) formData.append('evidence', journalEvidenceFile);

      await api.post('/journal-entries', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Jurnal manual berhasil disimpan!');
      setJournalSaveLoading(false);
      setJournalModalOpen(false);
      fetchActiveData();
      fetchReport();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan jurnal manual.';
      setJournalError(msg);
      toast.error(msg);
      setJournalSaveLoading(false);
    }
  };

  const kasBankAccounts = (allCoa.length > 0 ? allCoa : coa).filter(acc => acc.accountCode === '10001' || acc.accountCode === '10002');
  const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID');

  // DataTable column definitions based on active tab
  const getColumns = () => {
    if (activeTab === 'COA') {
      const cols = [
        { key: 'accountCode', label: 'Kode Akun', className: 'font-mono font-bold text-zinc-500' },
        { key: 'accountName', label: 'Nama Akun', className: 'font-semibold text-zinc-900' },
        {
          key: 'accountType',
          label: 'Tipe Akun',
          render: (type) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
              type === 'ASSET' 
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : type === 'LIABILITY'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : type === 'EQUITY'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : type === 'REVENUE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {type}
            </span>
          )
        },
        {
          key: 'status',
          label: 'Status',
          render: (_, row) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
              row.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              {row.isActive !== false ? 'Aktif' : 'Nonaktif'}
            </span>
          )
        }
      ];

      if (canUpdate || canDelete) {
        cols.push({
          key: 'actions',
          label: 'Aksi',
          className: 'text-right',
          headerClassName: 'text-right',
          render: (_, row) => (
            <div className="flex items-center justify-end space-x-1">
              {canUpdate && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleOpenEditCoa(row); }}
                  className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Akun"
                >
                  <Edit2 size={14} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCoa(row); }}
                  className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Akun"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        });
      }

      return cols;
    } else if (activeTab === 'PAY') {
      return [
        { key: 'paymentNumber', label: 'Nomor Bukti', className: 'font-mono font-semibold text-zinc-900' },
        { key: 'paymentDate', label: 'Tanggal' },
        {
          key: 'paymentType',
          label: 'Tipe Kas',
          className: 'font-semibold',
          render: (type) => (
            <span className={`inline-flex items-center space-x-1 ${type === 'RECEIPT' ? 'text-indigo-600' : 'text-rose-600'}`}>
              {type === 'RECEIPT' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
              <span>{type === 'RECEIPT' ? 'Kas Masuk' : 'Kas Keluar'}</span>
            </span>
          )
        },
        { key: 'account', label: 'Kas/Bank Acuan', render: (acc) => acc?.accountName || '—' },
        { key: 'notes', label: 'Catatan', className: 'text-zinc-500', render: (notes) => notes || '—' },
        {
          key: 'evidence',
          label: 'Bukti / Nota',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => {
            const evidencePath = row.metadata?.evidence;
            if (!evidencePath) return <span className="text-zinc-300 text-xs font-mono">—</span>;
            return (
              <button
                type="button"
                onClick={() => setPreviewImage({
                  isOpen: true,
                  url: getImageUrl(evidencePath),
                  title: `Bukti Transaksi #${row.paymentNumber}`
                })}
                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
                title="Klik untuk melihat bukti transfer / nota"
              >
                <Paperclip size={12} />
                <span>Lihat Bukti</span>
              </button>
            );
          }
        },
        {
          key: 'amount',
          label: 'Jumlah',
          className: 'text-right font-bold font-mono',
          headerClassName: 'text-right',
          render: (amount, row) => (
            <span className={row.paymentType === 'RECEIPT' ? 'text-indigo-600' : 'text-rose-600'}>
              {row.paymentType === 'RECEIPT' ? '+' : '-'}Rp{parseFloat(amount).toLocaleString('id-ID')}
            </span>
          )
        }
      ];
    } else if (activeTab === 'JRN') {
      return [
        { key: 'id', label: 'ID Jurnal', className: 'font-mono font-bold text-zinc-500', render: (id) => `#JRN-${id}` },
        { key: 'transactionDate', label: 'Tanggal', className: 'font-mono text-xs' },
        { 
          key: 'referenceType', 
          label: 'Tipe Ref', 
          render: (type) => (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              type === 'MANUAL' 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}>
              {type || 'AUTO'}
            </span>
          ) 
        },
        { key: 'description', label: 'Keterangan', className: 'text-zinc-700 font-medium' },
        {
          key: 'items',
          label: 'Jurnal Item (Debet / Kredit)',
          className: 'w-[360px]',
          render: (items) => (
            <div className="space-y-1.5 font-mono text-xs">
              {items?.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-zinc-50 p-1.5 rounded-lg border border-zinc-200">
                  <span className="text-zinc-700 font-semibold truncate max-w-[180px]" title={item.account?.accountName}>
                    {item.account?.accountName}
                  </span>
                  <div className="space-x-1.5 shrink-0">
                    {item.type === 'DEBIT' && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        D: Rp{parseFloat(item.amount).toLocaleString('id-ID')}
                      </span>
                    )}
                    {item.type === 'CREDIT' && (
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        K: Rp{parseFloat(item.amount).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        },
        {
          key: 'evidence',
          label: 'Lampiran Nota',
          className: 'text-center',
          headerClassName: 'text-center',
          render: (_, row) => {
            const evidencePath = row.metadata?.evidence;
            if (!evidencePath) return <span className="text-zinc-300 text-xs font-mono">—</span>;
            return (
              <button
                type="button"
                onClick={() => setPreviewImage({
                  isOpen: true,
                  url: getImageUrl(evidencePath),
                  title: `Lampiran Bukti Jurnal #${row.id} (${row.description})`
                })}
                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer"
                title="Lihat foto nota / kuitansi jurnal"
              >
                <Paperclip size={12} />
                <span>Lihat Nota</span>
              </button>
            );
          }
        }
      ];
    }
    return [];
  };

  const getActiveData = () => {
    if (activeTab === 'COA') return coa;
    if (activeTab === 'PAY') return payments;
    if (activeTab === 'JRN') return journals;
    return [];
  };

  const getActiveEmptyIcon = () => {
    if (activeTab === 'COA') return <Landmark size={40} />;
    if (activeTab === 'PAY') return <DollarSign size={40} />;
    return <FileText size={40} />;
  };

  const tabLabels = {
    COA: 'Bagan Akun (COA)',
    PAY: 'Riwayat Arus Kas',
    JRN: 'Jurnal Entries'
  };

  if (!canRead) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-16 text-center shadow-sm">
        <div className="flex flex-col items-center space-y-4 max-w-sm mx-auto">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900">Akses Ditolak</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Anda tidak memiliki izin (permission) untuk mengakses modul Finansial & Keuangan. Silakan hubungi Administrator Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Keuangan & Akuntansi"
        subtitle="Kelola Chart of Accounts (COA), jurnal kas/bank, lampiran bukti nota, dan analisa laporan laba rugi."
        icon={Landmark}
        actions={
          canCreate && (
            <div className="flex items-center space-x-2">
              {activeTab === 'COA' ? (
                <button
                  onClick={handleOpenCreateCoa}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>Tambah Akun (COA)</span>
                </button>
              ) : activeTab === 'JRN' ? (
                <button
                  onClick={handleOpenManualJournal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>Buat Jurnal Manual</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenPay}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>Catat Transaksi Kas/Bank</span>
                </button>
              )}
            </div>
          )
        }
      />

      {/* Top action bar: date range picker for Income Statement */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <Calendar className="text-indigo-600 w-5 h-5 shrink-0" />
          <div className="flex items-center space-x-2 shrink-0">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-semibold focus:bg-white outline-none"
            />
            <span className="text-zinc-400 text-xs">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-semibold focus:bg-white outline-none"
            />
            <button
              onClick={fetchReport}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 shadow-md"
            >
              <RefreshCw size={12} />
              <span>Tarik Laporan</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Layout Split: Left (Data Table) & Right (Income Statement Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Tabs & Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <div className="flex space-x-2">
              <button
                onClick={() => handleTabChange('COA')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'COA'
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Landmark size={14} />
                <span>Bagan Akun (COA)</span>
              </button>

              <button
                onClick={() => handleTabChange('PAY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'PAY'
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <DollarSign size={14} />
                <span>Riwayat Arus Kas</span>
              </button>

              <button
                onClick={() => handleTabChange('JRN')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'JRN'
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <FileText size={14} />
                <span>Jurnal Entries</span>
              </button>
            </div>

            {/* Quick Action Button within Tab Bar */}
            {canCreate && (
              <div className="hidden sm:block">
                {activeTab === 'JRN' && (
                  <button
                    onClick={handleOpenManualJournal}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Jurnal Manual</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Cari data ${tabLabels[activeTab]}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-xs"
            />
            {inputValue && (
              <button onClick={() => setInputValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X size={14} />
              </button>
            )}
          </div>

          <DataTable
            columns={getColumns()}
            data={getActiveData()}
            loading={loading}
            pagination={pagination}
            onPageChange={handlePageChange}
            emptyText={`Belum ada data ${tabLabels[activeTab]}.`}
            emptyIcon={getActiveEmptyIcon()}
            rowKey="id"
          />
        </div>

        {/* Right 1 Column: Income Statement (Laba/Rugi) */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-fit">
          <div className="h-14 px-6 border-b border-zinc-200 flex items-center bg-zinc-50">
            <span className="font-semibold text-zinc-900 text-sm flex items-center space-x-2">
              <FileText size={16} className="text-indigo-600" />
              <span>Laporan Laba/Rugi (Income Statement)</span>
            </span>
          </div>

          <div className="p-6 space-y-4">
            {reportLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Kalkulasi laporan...</span>
              </div>
            ) : report ? (
              <div className="space-y-3.5">
                {/* Revenue */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
                  <span className="font-medium text-zinc-600 text-sm">Total Pendapatan (Penjualan)</span>
                  <span className="font-bold text-zinc-900 font-mono text-sm">
                    Rp{parseFloat(report.summary?.totalRevenue || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* COGS/HPP */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
                  <span className="font-medium text-zinc-600 text-sm">Harga Pokok Penjualan (HPP FIFO)</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">
                    -Rp{parseFloat(report.summary?.totalHpp || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Gross Profit */}
                <div className="flex items-center justify-between py-2 bg-zinc-50 px-3 rounded-lg border border-zinc-200">
                  <span className="font-bold text-zinc-950 text-sm">Laba Kotor (Gross Profit)</span>
                  <span className="font-extrabold text-zinc-950 font-mono text-sm">
                    Rp{parseFloat(report.summary?.grossProfit || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Expenses */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-150 pt-1">
                  <span className="font-medium text-zinc-600 text-sm">Beban Operasional Kantor</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">
                    -Rp{parseFloat(report.summary?.totalExpenses || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Net Profit */}
                <div className="flex items-center justify-between py-3 bg-indigo-50 border border-indigo-150 px-4 rounded-xl shadow-sm">
                  <span className="font-bold text-indigo-950 text-sm">Laba Bersih (Net Profit)</span>
                  <span className="font-extrabold text-indigo-600 font-mono text-base">
                    Rp{parseFloat(report.summary?.netProfit || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-zinc-400 text-sm">
                Tarik Laporan untuk memuat data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pay Modal (Pencatatan Pembayaran & Bukti Transfer) */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden my-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Catat Arus Kas / Pembayaran</h3>

            {payError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{payError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSavePayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handlePayTypeChange('RECEIPT')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    payForm.paymentType === 'RECEIPT'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                      : 'border-zinc-200 text-zinc-500 bg-zinc-50 hover:bg-zinc-100'
                  }`}
                >
                  <ArrowUpRight size={14} />
                  <span>Kas Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePayTypeChange('DISBURSEMENT')}
                  className={`py-2 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                    payForm.paymentType === 'DISBURSEMENT'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                      : 'border-zinc-200 text-zinc-500 bg-zinc-50 hover:bg-zinc-100'
                  }`}
                >
                  <ArrowDownLeft size={14} />
                  <span>Kas Keluar</span>
                </button>
              </div>

              {/* Select Invoice (Optional for pelunasan) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Pelunasan Faktur (Optional)</label>
                <select
                  value={payForm.invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                >
                  <option value="">Pembayaran Manual (Tanpa Faktur)</option>
                  {unpaidInvoices
                    .filter(inv => 
                      payForm.paymentType === 'RECEIPT' ? inv.type === 'SALES' : inv.type === 'PURCHASE'
                    )
                    .map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} (Sisa: Rp{parseFloat(inv.amountDue).toLocaleString('id-ID')})
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Select Kas/Bank Account */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Akun Kas / Bank Asal</label>
                <select
                  value={payForm.accountId}
                  onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                  required
                >
                  <option value="">Pilih Akun Kas/Bank</option>
                  {(allCoa.length > 0 ? allCoa : coa).filter(acc => acc.accountCode === '10001' || acc.accountCode === '10002').map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.accountCode})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">No. Bukti</label>
                  <input
                    type="text"
                    required
                    value={payForm.paymentNumber}
                    onChange={(e) => setPayForm({ ...payForm, paymentNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={payForm.paymentDate}
                    onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Metode</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                  >
                    <option value="CASH">Kas Tunai</option>
                    <option value="BANK_TRANSFER">Transfer Bank</option>
                    <option value="E_WALLET">E-Wallet</option>
                    <option value="OTHERS">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Jumlah (Rp)</label>
                    {payForm.amount > 0 && (
                      <span className="text-xs font-mono font-bold text-indigo-600">{formatRupiah(payForm.amount)}</span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Catatan / Keterangan</label>
                <textarea
                  placeholder="e.g. Pembayaran tagihan listrik kantor bulan Juli..."
                  rows={2}
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white outline-none resize-none"
                />
              </div>

              {/* Upload Bukti Transfer / Nota (Opsional) */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Bukti Transfer / Nota Fisik</span>
                  <span className="text-[10px] text-zinc-400 font-normal normal-case">(Opsional)</span>
                </label>
                
                {payEvidencePreview ? (
                  <div className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img 
                      src={payEvidencePreview} 
                      alt="Preview Bukti" 
                      className="w-16 h-16 object-cover rounded-lg border border-zinc-200 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{payEvidenceFile?.name || 'Bukti Transaksi'}</p>
                      <p className="text-[10px] text-zinc-400">{(payEvidenceFile?.size ? (payEvidenceFile.size / 1024).toFixed(1) + ' KB' : 'File Terpilih')}</p>
                      <button
                        type="button"
                        onClick={handleRemovePayEvidence}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/30 rounded-xl p-4 cursor-pointer transition-all">
                    <UploadCloud className="w-6 h-6 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-700">Pilih Foto Bukti Transfer / Nota</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, JPEG (Maks. 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePayEvidenceChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={paySaveLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-indigo-400"
                >
                  {paySaveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>Simpan Transaksi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Journal Modal */}
      {journalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative overflow-hidden my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Buat Jurnal Umum Manual</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Catat jurnal penyesuaian, biaya operasional, atau penyetoran modal.</p>
              </div>
              <button onClick={() => setJournalModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {journalError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{journalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveManualJournal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Tanggal Jurnal</label>
                  <input
                    type="date"
                    required
                    value={journalForm.transactionDate}
                    onChange={(e) => setJournalForm({ ...journalForm, transactionDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Keterangan Jurnal</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pembayaran beban sewa ruko & biaya operasional"
                    value={journalForm.description}
                    onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Journal Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">Baris Akun Jurnal (Debet / Kredit)</label>
                  <button
                    type="button"
                    onClick={handleAddJournalLine}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Tambah Baris Akun</span>
                  </button>
                </div>

                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase">
                      <tr>
                        <th className="px-3.5 py-2">Akun COA</th>
                        <th className="px-2 py-2 text-center w-28">Posisi</th>
                        <th className="px-3.5 py-2 text-right w-36">Jumlah (Rp)</th>
                        <th className="px-2 py-2 text-center w-10">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {journalForm.items.map((line, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-2.5 py-2">
                            <select
                              value={line.accountId}
                              onChange={(e) => handleJournalLineChange(idx, 'accountId', e.target.value)}
                              className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold focus:bg-white outline-none cursor-pointer"
                              required
                            >
                              <option value="">Pilih Akun...</option>
                              {allCoa.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.accountCode} - {a.accountName} ({a.accountType})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <select
                              value={line.type}
                              onChange={(e) => handleJournalLineChange(idx, 'type', e.target.value)}
                              className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer text-center ${
                                line.type === 'DEBIT' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <option value="DEBIT">DEBET (D)</option>
                              <option value="CREDIT">KREDIT (K)</option>
                            </select>
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <input
                              type="number"
                              required
                              placeholder="0"
                              min="1"
                              value={line.amount}
                              onChange={(e) => handleJournalLineChange(idx, 'amount', e.target.value)}
                              className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold text-right focus:bg-white outline-none"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveJournalLine(idx)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                              title="Hapus baris akun ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Double-Entry Balance Validator Status Bar */}
                <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono ${
                  isBalanced 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    {isBalanced ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span className="font-bold">Jurnal Seimbang (Balanced)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <span className="font-bold">
                          Selisih: Rp {Math.abs(totalDebit - totalCredit).toLocaleString('id-ID')}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>Total Debet: <strong>Rp {totalDebit.toLocaleString('id-ID')}</strong></span>
                    <span>Total Kredit: <strong>Rp {totalCredit.toLocaleString('id-ID')}</strong></span>
                  </div>
                </div>
              </div>

              {/* Upload Foto Nota / Struk Bukti Jurnal Manual */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Lampiran Foto Nota / Kuitansi Fisik</span>
                  <span className="text-[10px] text-zinc-400 font-normal normal-case">(Opsional)</span>
                </label>
                
                {journalEvidencePreview ? (
                  <div className="relative rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img 
                      src={journalEvidencePreview} 
                      alt="Preview Nota Jurnal" 
                      className="w-16 h-16 object-cover rounded-lg border border-zinc-200 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">{journalEvidenceFile?.name || 'Bukti Nota'}</p>
                      <p className="text-[10px] text-zinc-400">{(journalEvidenceFile?.size ? (journalEvidenceFile.size / 1024).toFixed(1) + ' KB' : 'File Terpilih')}</p>
                      <button
                        type="button"
                        onClick={handleRemoveJournalEvidence}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Lampiran</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/30 rounded-xl p-4 cursor-pointer transition-all">
                    <Camera className="w-6 h-6 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-700">Lampirkan Foto Nota / Kuitansi Jurnal</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, JPEG (Maks. 5MB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleJournalEvidenceChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setJournalModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={journalSaveLoading || !isBalanced}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-zinc-300 disabled:cursor-not-allowed"
                >
                  {journalSaveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>Simpan Jurnal Umum</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Evidence Preview */}
      {previewImage.isOpen && (
        <div 
          onClick={() => setPreviewImage({ isOpen: false, url: '', title: '' })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in cursor-zoom-out"
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

      {/* COA Create/Edit Modal */}
      {coaModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <div className="flex items-center space-x-2">
                <Landmark className="text-indigo-600" size={18} />
                <h3 className="font-bold text-sm text-zinc-900">
                  {coaForm.id ? 'Edit Akun COA' : 'Tambah Akun COA Baru'}
                </h3>
              </div>
              <button 
                onClick={() => setCoaModalOpen(false)} 
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCoa} className="p-6 space-y-4">
              {coaError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center space-x-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-500" />
                  <span>{coaError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Kode Akun <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 10003 atau 60002"
                  value={coaForm.accountCode}
                  onChange={(e) => setCoaForm({ ...coaForm, accountCode: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Format standar: 1xxxx (Aset), 2xxxx (Kewajiban), 3xxxx (Ekuitas), 4xxxx (Pendapatan), 5xxxx/6xxxx (Beban).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Nama Akun <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bank BCA Operasional / Beban Listrik"
                  value={coaForm.accountName}
                  onChange={(e) => setCoaForm({ ...coaForm, accountName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Tipe / Kategori Akun <span className="text-rose-500">*</span>
                </label>
                <select
                  value={coaForm.accountType}
                  onChange={(e) => setCoaForm({ ...coaForm, accountType: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="ASSET">ASSET (Kas, Bank, Piutang, Persediaan)</option>
                  <option value="LIABILITY">LIABILITY (Hutang Dagang, Utang Pajak PPN)</option>
                  <option value="EQUITY">EQUITY (Modal Pemilik, Laba Ditahan)</option>
                  <option value="REVENUE">REVENUE (Pendapatan Penjualan, Pendapatan Lain)</option>
                  <option value="EXPENSE">EXPENSE (HPP, Beban Operasional, Gaji, dll)</option>
                </select>
              </div>

              {coaForm.id && (
                <div className="pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coaForm.isActive}
                      onChange={(e) => setCoaForm({ ...coaForm, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span className="text-xs font-semibold text-zinc-800">Akun Aktif</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 ml-6">
                    Nonaktifkan jika akun tidak lagi digunakan untuk transaksi baru.
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCoaModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={coaSaveLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  {coaSaveLoading && <Loader2 size={14} className="animate-spin" />}
                  <span>{coaForm.id ? 'Simpan Perubahan' : 'Tambah Akun'}</span>
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
        loading={paySaveLoading}
      />
    </div>
  );
};

export default Finance;

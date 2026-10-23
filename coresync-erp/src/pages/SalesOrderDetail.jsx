import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import SearchSelect from '../components/SearchSelect';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import PaymentRecordModal from '../components/transactions/PaymentRecordModal';
import { 
  ArrowLeft, 
  Printer, 
  CreditCard, 
  Truck, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileCheck, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  Building, 
  XCircle, 
  UploadCloud, 
  Paperclip, 
  Trash2, 
  ZoomIn, 
  Eye, 
  Edit2, 
  Sparkles, 
  ArrowRight,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  Plus,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { formatRupiah, getDocPaymentInfo, formatQty } from '../utils/format';
import { generateDocumentNumber } from '../utils/documentNumber';
import EditPaymentTermsModal from '../components/transactions/EditPaymentTermsModal';
import { getImageUrl } from '../utils/imageUrl';
import DeliveryModal from '../components/transactions/DeliveryModal';
import ConfirmationModal from '../components/ConfirmationModal';
import InvoicePrintTemplate from '../components/transactions/InvoicePrintTemplate';
import SalesOrderModal from '../components/transactions/SalesOrderModal';
import ReturnModal from '../components/transactions/ReturnModal';
import ReturnFormPrintTemplate from '../components/transactions/ReturnFormPrintTemplate';

const SalesOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const canUpdate = hasPermission(user, 'sales_orders', 'update');
  const canDelete = hasPermission(user, 'sales_orders', 'delete');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [so, setSo] = useState(null);

  // Master Data Options for In-page Edit SO
  const [customersList, setCustomersList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [taxesList, setTaxesList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  const [salespersonsList, setSalespersonsList] = useState([]);
  const [masterDataLoaded, setMasterDataLoaded] = useState(false);

  // Edit SO Modal State
  const [editSoModalOpen, setEditSoModalOpen] = useState(false);
  const [editSoForm, setEditSoForm] = useState({
    soNumber: '',
    soDate: '',
    contactId: '',
    taxId: '',
    salesperson: '',
    paymentTerm: 'LUNAS',
    dpAmount: 0,
    dueDate: '',
    applyTax: false,
    taxInclusive: true,
    globalDiscountPercent: 0,
    globalDiscountAmount: 0,
    autoSj: false,
    fulfillmentType: 'DELIVERY',
    warehouseId: '',
    items: []
  });

  // Modals state
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetDoc, setPaymentTargetDoc] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    notes: ''
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState('');
  const [previewImage, setPreviewImage] = useState({ isOpen: false, url: '', title: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Delivery Modal State
  const [sjModalOpen, setSjModalOpen] = useState(false);
  const [sjForm, setSjForm] = useState({
    deliveryNumber: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    driverName: '',
    vehiclePlate: '',
    notes: ''
  });
  const [sjEvidenceFile, setSjEvidenceFile] = useState(null);
  const [sjEvidencePreview, setSjEvidencePreview] = useState('');

  // Print Mode & Return Document States
  const [printMode, setPrintMode] = useState('SO'); // 'SO' | 'RETURN'
  const [activePrintRetur, setActivePrintRetur] = useState(null);

  // Return Modal & Action States
  const [retModalOpen, setRetModalOpen] = useState(false);
  const [retForm, setRetForm] = useState({
    returnNumber: '',
    returnDate: new Date().toISOString().split('T')[0],
    warehouseId: '',
    quarantineWarehouseId: '',
    status: 'FORM_ISSUED',
    notes: '',
    items: []
  });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary',
    onConfirm: () => {}
  });

  // Header Dropdown Menu State
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSoDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/sales-orders/${id}`);
      setSo(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat detail Sales Order.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [custRes, prodRes, taxRes, whRes, spRes] = await Promise.all([
        api.get('/customers?limit=5000').catch(() => ({ data: { data: [] } })),
        api.get('/products?limit=2000').catch(() => ({ data: { data: [] } })),
        api.get('/taxes?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/warehouses?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/salespersons?limit=200').catch(() => ({ data: { data: [] } }))
      ]);
      const fetchedCusts = custRes.data?.data || [];
      const fetchedProds = prodRes.data?.data || [];

      if (so?.customer && !fetchedCusts.some(c => c.id === so.customer.id)) {
        fetchedCusts.unshift(so.customer);
      }
      if (so?.items && Array.isArray(so.items)) {
        so.items.forEach(it => {
          if (it.product && !fetchedProds.some(p => p.id === it.product.id)) {
            fetchedProds.unshift(it.product);
          }
        });
      }

      setCustomersList(fetchedCusts);
      setProductsList(fetchedProds);
      setTaxesList(taxRes.data?.data || []);
      setWarehousesList(whRes.data?.data || []);
      setSalespersonsList(spRes.data?.data || []);
      setMasterDataLoaded(true);
    } catch (err) {
      console.error('Failed to load master data for editing', err);
    }
  };

  useEffect(() => {
    fetchSoDetail();
    fetchMasterData();
  }, [id]);

  // Prepare select options for edit modal
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
      phone: c.phone,
      raw: c
    };
  });

  const salespersonOptions = salespersonsList.filter(sp => sp.isActive !== false).map(sp => ({
    value: sp.id,
    label: sp.name,
    sublabel: sp.commissionRate > 0 ? `Komisi: ${sp.commissionRate}%` : undefined
  }));

  const productOptions = productsList.map(p => {
    const stock = p.totalStock !== undefined ? p.totalStock : (p.stock || 0);
    const isTaxable = !!(p.taxId && p.tax && parseFloat(p.tax.rate) > 0);
    const taxLabel = isTaxable ? `[PKP: ${p.tax.name}]` : '[Non-PKP]';
    return {
      value: p.id,
      label: p.name,
      sublabel: `Stok: ${stock} ${p.unit || 'PCS'} | SKU: ${p.sku} | ${taxLabel} | Rp${parseFloat(p.sellingPrice || 0).toLocaleString('id-ID')}`,
      isTaxable,
      taxId: p.taxId,
      taxRate: p.tax ? parseFloat(p.tax.rate) : 0,
      searchTerms: `${p.name} ${p.sku} ${taxLabel} ${isTaxable ? 'PKP PPN' : 'Non-PKP Non-PPN Bebas Pajak'}`
    };
  });

  // Handle Open Edit SO directly in Detail Page
  const handleOpenEditSo = async () => {
    if (!so) return;
    if (!masterDataLoaded) {
      await fetchMasterData();
    }

    // Ensure customer from SO is in customersList
    if (so.customer && !customersList.some(c => c.id === so.customer.id)) {
      setCustomersList(prev => [so.customer, ...prev]);
    }

    // Ensure products from SO items are in productsList
    if (so.items && Array.isArray(so.items)) {
      const missingProducts = [];
      so.items.forEach(it => {
        if (it.product && !productsList.some(p => p.id === it.product.id) && !missingProducts.some(p => p.id === it.product.id)) {
          missingProducts.push(it.product);
        }
      });
      if (missingProducts.length > 0) {
        setProductsList(prev => [...missingProducts, ...prev]);
      }
    }

    const taxObj = taxesList?.find(t => t.id === parseInt(so.taxId)) || so.tax;
    const isPkp = Boolean((so.taxId && taxObj && parseFloat(taxObj.rate || 0) > 0 && !taxObj.name?.toLowerCase().includes('non')) || so.metadata?.applyTax === true);
    const applyTax = so.metadata?.applyTax !== undefined ? Boolean(so.metadata.applyTax) : isPkp;
    const taxInclusive = so.metadata?.taxInclusive !== undefined ? Boolean(so.metadata.taxInclusive) : Boolean(applyTax);

    // Resolve salesperson ID correctly
    let salespersonVal = so.metadata?.salespersonId || so.salespersonId || '';
    if (!salespersonVal && so.metadata?.salesperson) {
      const spMatch = salespersonsList.find(s => 
        String(s.id) === String(so.metadata.salesperson) || 
        s.name?.toLowerCase() === String(so.metadata.salesperson).toLowerCase() ||
        (s.code && String(so.metadata.salesperson).toLowerCase().includes(s.code.toLowerCase()))
      );
      salespersonVal = spMatch ? spMatch.id : so.metadata.salesperson;
    }
    if (!salespersonVal && so.customer?.salespersonId) {
      salespersonVal = so.customer.salespersonId;
    }

    const resolvedContactId = so.contactId || so.customer?.id || so.customerId || '';

    setEditSoForm({
      soNumber: so.soNumber,
      soDate: so.soDate,
      contactId: resolvedContactId,
      taxId: so.taxId || '',
      salesperson: salespersonVal,
      paymentTerm: so.metadata?.paymentTerm || 'LUNAS',
      dpAmount: parseFloat(so.metadata?.dpAmount || 0),
      dueDate: so.metadata?.dueDate || '',
      applyTax,
      taxInclusive,
      globalDiscountMode: so.metadata?.globalDiscountMode || (parseFloat(so.metadata?.globalDiscountAmount || 0) > 0 && !parseFloat(so.metadata?.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT'),
      globalDiscountPercent: parseFloat(so.metadata?.globalDiscountPercent || 0),
      globalDiscountAmount: parseFloat(so.metadata?.globalDiscountAmount || 0),
      autoSj: false,
      fulfillmentType: so.metadata?.fulfillmentType || 'DELIVERY',
      warehouseId: so.warehouseId || so.metadata?.warehouseId || warehousesList[0]?.id || '',
      items: (so.items || []).map(item => {
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
    setEditSoModalOpen(true);
  };

  const handleEditSoItemChange = (idx, field, val) => {
    setEditSoForm(prev => {
      const items = [...prev.items];
      const item = { ...items[idx] };
      item[field] = val;

      const prod = productsList.find(p => p.id === parseInt(item.productId)) || item.product;

      if (field === 'productId') {
        if (prod) {
          const defaultUnit = (prod.units && prod.units.length > 0) ? (prod.units.find(u => u.isBaseUnit) || prod.units[0]) : null;
          let unitName = defaultUnit ? defaultUnit.unitName : (prod.unit || 'pcs');
          if (/^\d+$/.test(String(unitName || '').trim())) {
            unitName = prod.unit || 'pcs';
          }
          const price = (defaultUnit && parseFloat(defaultUnit.sellingPrice) > 0)
            ? parseFloat(defaultUnit.sellingPrice)
            : parseFloat(prod.sellingPrice || 0);

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
        if (prod) {
          const u = prod.units?.find(unit => unit.unitName === val || String(unit.id) === String(val));
          if (u) {
            const cleanUName = (/^\d+$/.test(String(u.unitName || '').trim())) ? (prod.unit || 'pcs') : u.unitName;
            item.unit = cleanUName;
            item.conversionRatio = parseFloat(u.conversionRatio || 1);
            if (parseFloat(u.sellingPrice) > 0) {
              item.price = parseFloat(u.sellingPrice);
            } else if (prod.sellingPrice) {
              item.price = parseFloat(prod.sellingPrice) * parseFloat(u.conversionRatio || 1);
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
        if (prod) {
          const u = prod.units?.find(unit => unit.unitName === val || String(unit.id) === String(val));
          if (u) {
            const cleanUName = (/^\d+$/.test(String(u.unitName || '').trim())) ? (prod.unit || 'pcs') : u.unitName;
            item.bonusUnit = cleanUName;
            item.bonusConversionRatio = parseFloat(u.conversionRatio || 1);
          } else {
            item.bonusUnit = val;
            item.bonusConversionRatio = 1;
          }
        }
      }

      items[idx] = item;
      return { ...prev, items };
    });
  };

  const addEditSoItem = () => {
    setEditSoForm(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', qty: 1, bonusQty: 0, price: 0, discount: 0, discountPercent: 0, unit: 'pcs' }]
    }));
  };

  const removeEditSoItem = (idx) => {
    setEditSoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleConfirmEditSo = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Check bonus stock shortages
    const bonusShortages = [];
    editSoForm.items.forEach(it => {
      const bonusQty = parseInt(it.bonusQty) || 0;
      if (bonusQty > 0) {
        const p = productsList.find(prod => prod.id === parseInt(it.productId));
        if (p) {
          const selWhId = parseInt(editSoForm.warehouseId || so.warehouseId);
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
      toast.error(`Stok bonus tidak mencukupi untuk: ${bonusShortages.join(', ')}. Harap sesuaikan kuantitas bonus.`);
      setActionError(`Stok bonus tidak mencukupi untuk:\n• ${bonusShortages.join('\n• ')}\n\nHarap sesuaikan kuantitas bonus terlebih dahulu.`);
      return;
    }

    try {
      const itemsSum = (editSoForm.items || []).reduce((sum, it) => {
        const q = parseFloat(it.qty) || 0;
        const p = parseFloat(it.price) || 0;
        const d = parseFloat(it.discount) || 0;
        return sum + (q * Math.max(0, p - d));
      }, 0);
      const discMode = editSoForm.globalDiscountMode || (parseFloat(editSoForm.globalDiscountAmount || 0) > 0 && !parseFloat(editSoForm.globalDiscountPercent || 0) ? 'AMOUNT' : 'PERCENT');
      const discPct = parseFloat(editSoForm.globalDiscountPercent || 0);
      const discAmt = discMode === 'AMOUNT' ? parseFloat(editSoForm.globalDiscountAmount || 0) : Math.round(itemsSum * (discPct / 100));

      const payload = {
        soNumber: editSoForm.soNumber,
        soDate: editSoForm.soDate,
        contactId: editSoForm.contactId,
        taxId: editSoForm.applyTax ? editSoForm.taxId : null,
        applyTax: editSoForm.applyTax,
        taxInclusive: editSoForm.taxInclusive !== undefined ? Boolean(editSoForm.taxInclusive) : Boolean(editSoForm.applyTax),
        globalDiscountMode: discMode,
        globalDiscountPercent: discPct,
        globalDiscountAmount: discAmt,
        fulfillmentType: editSoForm.fulfillmentType || 'DELIVERY',
        paymentTerm: editSoForm.paymentTerm,
        dpAmount: editSoForm.dpAmount,
        dueDate: editSoForm.dueDate,
        metadata: (() => {
          const spId = editSoForm.salesperson ? parseInt(editSoForm.salesperson) : null;
          const selectedSp = salespersonsList.find(s => s.id === spId);
          const isTaxInc = editSoForm.taxInclusive !== undefined ? Boolean(editSoForm.taxInclusive) : Boolean(editSoForm.applyTax);
          return {
            ...(so.metadata || {}),
            salespersonId: selectedSp?.id || spId,
            salesperson: selectedSp?.name || editSoForm.salesperson || null,
            salespersonCode: selectedSp?.code || null,
            salespersonName: selectedSp?.name || (typeof editSoForm.salesperson === 'string' ? editSoForm.salesperson : null),
            fulfillmentType: editSoForm.fulfillmentType || 'DELIVERY',
            isPickup: editSoForm.fulfillmentType === 'PICKUP',
            paymentTerm: editSoForm.paymentTerm,
            dpAmount: editSoForm.dpAmount,
            dueDate: editSoForm.dueDate,
            applyTax: editSoForm.applyTax,
            taxInclusive: isTaxInc,
            globalDiscountMode: discMode,
            globalDiscountPercent: discPct,
            globalDiscountAmount: discAmt
          };
        })(),
        items: editSoForm.items.map(item => ({
          productId: parseInt(item.productId),
          qty: parseFloat(item.qty) || 1,
          bonusQty: parseFloat(item.bonusQty) || 0,
          price: parseFloat(item.price) || 0,
          discount: parseFloat(item.discount) || 0,
          discountPercent: parseFloat(item.discountPercent || 0),
          unit: item.unit,
          conversionRatio: parseFloat(item.conversionRatio || 1),
          bonusUnit: item.bonusUnit || item.unit || 'pcs',
          bonusConversionRatio: parseFloat(item.bonusConversionRatio || 1)
        }))
      };

      await api.put(`/sales-orders/${id}`, payload);
      toast.success('Data Sales Order berhasil diperbarui!');
      setEditSoModalOpen(false);
      fetchSoDetail();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengubah Sales Order.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (!so) return;
    const { total, paid, remaining } = getDocPaymentInfo(so);

    setPaymentTargetDoc({
      type: 'SO',
      id: so.id,
      docNumber: so.soNumber,
      total,
      paid,
      remaining,
      contactName: so.customer?.name || 'Pelanggan'
    });

    setPaymentForm({
      amount: remaining,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      notes: remaining === total ? 'Pembayaran Lunas' : 'Pelunasan sisa tagihan'
    });
    setEvidenceFile(null);
    setEvidencePreview('');
    setActionError('');
    setPaymentModalOpen(true);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('amount', paymentForm.amount);
      formData.append('paymentDate', paymentForm.paymentDate);
      formData.append('paymentMethod', paymentForm.paymentMethod || 'CASH');
      if (paymentForm.notes) formData.append('notes', paymentForm.notes);
      if (evidenceFile) formData.append('evidence', evidenceFile);

      await api.post(`/sales-orders/${id}/payment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Pembayaran berhasil dicatat!');
      setPaymentModalOpen(false);
      fetchSoDetail();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mencatat pembayaran.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openSjModal = () => {
    if (!so) return;
    setSjForm({
      deliveryNumber: `SJ-${so.soNumber.substring(3)}`,
      deliveryDate: new Date().toISOString().split('T')[0],
      driverName: '',
      vehiclePlate: '',
      notes: ''
    });
    setSjEvidenceFile(null);
    setSjEvidencePreview('');
    setActionError('');
    setSjModalOpen(true);
  };

  const handleCreateSj = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('salesOrderId', so.id);
      formData.append('warehouseId', so.warehouseId || warehousesList[0]?.id || 1);
      formData.append('deliveryNumber', sjForm.deliveryNumber);
      formData.append('deliveryDate', sjForm.deliveryDate);
      if (sjForm.driverName) formData.append('driverName', sjForm.driverName);
      if (sjForm.vehiclePlate) formData.append('vehiclePlate', sjForm.vehiclePlate);
      if (sjForm.notes) formData.append('notes', sjForm.notes);
      formData.append('items', JSON.stringify(so.items.map(item => ({
        productId: item.productId,
        qtyShipped: (parseInt(item.qty) || 0) + (parseInt(item.bonusQty) || 0)
      }))));
      if (sjEvidenceFile) formData.append('evidence', sjEvidenceFile);

      await api.post('/deliveries', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Surat Jalan berhasil diterbitkan dan stok telah dialokasikan!');
      setSjModalOpen(false);
      fetchSoDetail();
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
      title: 'Proses Surat Jalan Pengiriman',
      message: `Konfirmasi pembuatan Surat Jalan #${sjForm.deliveryNumber} untuk pesanan #${so.soNumber}? Stok barang akan langsung dipotong dari gudang.`,
      type: 'primary',
      onConfirm: handleCreateSj
    });
  };

  const handleOpenRetModal = () => {
    if (!so) return;
    const defaultWh = warehousesList.find(w => w.type !== 'QUARANTINE')?.id || warehousesList[0]?.id || '';
    const quarantineWh = warehousesList.find(w => w.type === 'QUARANTINE')?.id || '';
    const retNum = generateDocumentNumber('RET');

    const mappedItems = (so.items || []).map(it => ({
      productId: it.productId,
      productName: it.product?.name || '',
      originalQty: parseFloat(it.qty || 0),
      qty: parseFloat(it.qty || 1),
      price: parseFloat(it.price || 0),
      condition: 'GOOD',
      reason: ''
    }));

    setRetForm({
      salesOrderId: so.id,
      invoiceId: so.invoices?.[0]?.id || null,
      returnNumber: retNum,
      returnDate: new Date().toISOString().split('T')[0],
      warehouseId: defaultWh,
      quarantineWarehouseId: quarantineWh,
      type: 'SALES_RETURN',
      status: 'FORM_ISSUED',
      notes: `Pengajuan retur barang untuk pesanan #${so.soNumber}`,
      items: mappedItems.length > 0 ? mappedItems : [{ productId: '', qty: 1, price: 0, condition: 'GOOD', reason: '' }]
    });

    setRetModalOpen(true);
  };

  const handleRetItemChange = (idx, field, val) => {
    const updated = [...retForm.items];
    updated[idx][field] = val;
    if (field === 'productId') {
      const soItem = (so?.items || []).find(it => it.productId === parseInt(val));
      if (soItem) {
        updated[idx].price = parseFloat(soItem.price || 0);
        updated[idx].originalQty = parseFloat(soItem.qty || 0);
      } else {
        const prod = productsList.find(p => p.id === parseInt(val));
        if (prod) updated[idx].price = parseFloat(prod.sellingPrice || 0);
      }
    }
    setRetForm({ ...retForm, items: updated });
  };

  const addRetItem = () => setRetForm({ ...retForm, items: [...retForm.items, { productId: '', qty: 1, price: 0, condition: 'GOOD', reason: '' }] });
  const removeRetItem = (idx) => {
    const updated = [...retForm.items];
    updated.splice(idx, 1);
    setRetForm({ ...retForm, items: updated });
  };

  const handleCreateReturn = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      await api.post('/returns', {
        salesOrderId: so.id,
        invoiceId: so.invoices?.[0]?.id || undefined,
        type: 'SALES_RETURN',
        ...retForm
      });
      toast.success('Pengajuan retur barang berhasil dibuat.');
      setRetModalOpen(false);
      fetchSoDetail();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengajukan retur barang.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmCreateReturn = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: 'Konfirmasi Pengajuan Retur',
      message: `Apakah Anda yakin ingin memproses retur barang #${retForm.returnNumber}? Subtotal dan kuantitas barang pada Sales Order akan otomatis terkurang.`,
      type: 'warning',
      onConfirm: handleCreateReturn
    });
  };

  const handlePrint = () => {
    try {
      sessionStorage.setItem('print_current_doc', JSON.stringify(so));
      sessionStorage.setItem('print_current_type', 'SO');
    } catch (e) {
      console.warn('Could not cache doc to sessionStorage', e);
    }
    window.open(`/print/invoice/${id}?type=SO`, '_blank');
  };

  const handlePrintReturn = (ret) => {
    setPrintMode('RETURN');
    setActivePrintRetur(ret);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode('SO');
      }, 1000);
    }, 200);
  };

  const handlePrintBlankReturn = () => {
    setPrintMode('RETURN');
    setActivePrintRetur({
      returnNumber: 'BLANK-FORM',
      returnDate: new Date().toISOString().split('T')[0],
      items: [] // Blank rows with lines for manual handwritten field entry
    });
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintMode('SO');
      }, 1000);
    }, 200);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-theme" />
        <p className="text-zinc-500 font-medium text-sm">Memuat detail Sales Order...</p>
      </div>
    );
  }

  if (error || !so) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Gagal Memuat SO</h3>
          <p className="text-sm text-zinc-500 mt-1">{error || 'Sales Order tidak ditemukan.'}</p>
        </div>
        <button
          onClick={() => navigate('/transactions?tab=SO')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
        >
          Kembali ke Daftar Transaksi
        </button>
      </div>
    );
  }

  const { total, paid, remaining, status: paymentStatus, term, isFullyPaid, isPartial } = getDocPaymentInfo(so);
  const paymentsList = so.metadata?.payments || [];
  const isPickup = so.metadata?.fulfillmentType === 'PICKUP' || so.metadata?.isPickup === true;
  const manifestNum = so.metadata?.manifestNumber;
  const manifestStatus = so.metadata?.manifestStatus;
  const isDelivered = so.status === 'DELIVERED' || manifestStatus === 'DELIVERED' || isPickup;
  const isDeliveredUnpaid = !isPickup && isDelivered && !isFullyPaid && so.status !== 'CANCELLED';
  const isCompleted = so.status === 'COMPLETED' || so.status === 'SELESAI' || isPickup || (isDelivered && isFullyPaid);
  const isManifestScheduled = !isPickup && (manifestStatus === 'SCHEDULED' || manifestStatus === 'ACTIVE' || (!manifestStatus && Boolean(manifestNum)));
  const isWaitingShipment = !isPickup && (so.status === 'WAITING_SHIPMENT' || (isManifestScheduled && !isCompleted && so.status !== 'CANCELLED' && !isDelivered));
  const isShipped = (so.status === 'SHIPPED' && !isWaitingShipment) || isDelivered || isCompleted || isPickup;
  const isPreShipment = (!isPickup && ['DRAFT', 'CONFIRMED', 'APPROVED', 'PENDING'].includes(so.status)) || isWaitingShipment;
  const isFullyCompleted = isCompleted || (isShipped && remaining <= 0);

  const handleCancelSo = async () => {
    const reason = window.prompt(`Alasan pembatalan Sales Order #${so.soNumber}:`, 'Dibatalkan oleh pengguna');
    if (reason === null) return;

    try {
      setActionLoading(true);
      await api.put(`/sales-orders/${id}/cancel`, { reason });
      toast.success(`Sales Order #${so.soNumber} berhasil dibatalkan.`);
      fetchSoDetail();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membatalkan Sales Order.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Printable Area Wrapper */}
      <div id="print-area" className="hidden print:block p-4 sm:p-8 bg-white text-zinc-950 font-sans text-xs">
        {printMode === 'RETURN' && activePrintRetur ? (
          <ReturnFormPrintTemplate
            returItems={(activePrintRetur.items || []).filter(it => it.condition === 'DAMAGED')}
            balikanItems={(activePrintRetur.items || []).filter(it => it.condition !== 'DAMAGED')}
            returDate={activePrintRetur.returnDate}
            balikanDate={activePrintRetur.returnDate}
            companyName={user?.tenant?.name || 'CV JATIMAS'}
          />
        ) : (
          <InvoicePrintTemplate type="SO" data={so} />
        )}
      </div>

      {/* Screen Header & Navigation */}
      <PageHeader
        title={`SO #${so.soNumber}`}
        subtitle={`Pelanggan: ${so.customer?.name || '-'} | Tanggal Order: ${so.soDate}`}
        backUrl="/transactions?tab=SO"
        backText="Kembali ke Transactions"
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Metode Pemenuhan Badge */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isPickup 
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              <span>{isPickup ? '🏪 Ambil di Toko' : '🚚 Kirim Armada'}</span>
            </span>

            {/* Status Order Badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
              isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs' :
              isDeliveredUnpaid ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs' :
              isWaitingShipment ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs' :
              isShipped ? 'bg-sky-50 text-sky-700 border border-sky-200' :
              so.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {isCompleted ? 'SELESAI' : isDeliveredUnpaid ? (isPickup ? 'SUDAH DIAMBIL (TEMPO)' : 'SUDAH DIKIRIM (TEMPO)') : isWaitingShipment ? 'MENUNGGU DIKIRIM' : isShipped ? (isPickup ? 'SUDAH DIAMBIL' : 'DIKIRIM') : so.status === 'APPROVED' ? 'DISETUJUI' : so.status}
            </span>

            {/* Tipe Pembayaran Badge */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              term === 'TEMPO' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
              term === 'COD' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
              term === 'DP' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}>
              {term === 'TEMPO' ? (
                <>
                  <Clock size={11} />
                  <span>TEMPO {so.metadata?.dueDate ? `(${so.metadata.dueDate})` : ''}</span>
                </>
              ) : term === 'COD' ? (
                <>
                  <Truck size={11} />
                  <span>COD</span>
                </>
              ) : term === 'DP' ? (
                <>
                  <CreditCard size={11} />
                  <span>DP</span>
                </>
              ) : (
                <span>TUNAI</span>
              )}
            </span>

            {/* Status Pembayaran Badge */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isFullyPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs' :
              isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {isFullyPaid ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>LUNAS</span>
                </>
              ) : isPartial ? (
                <>
                  <CreditCard size={11} className="text-amber-600" />
                  <span>SEBAGIAN ({formatRupiah(paid)})</span>
                </>
              ) : (
                <>
                  <Clock size={11} className="text-rose-600" />
                  <span>BELUM LUNAS</span>
                </>
              )}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 print:hidden relative">
            {/* Primary Action: Kirim Barang jika belum dikirim */}
            {!isShipped && !isWaitingShipment && !manifestNum && !isPickup && so.status !== 'CANCELLED' && canUpdate && (
              <button
                type="button"
                onClick={() => navigate('/delivery-manifest')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
                title="Jadwalkan pengiriman melalui Manifest Pengiriman"
              >
                <Truck size={14} />
                <span>Atur di Manifest</span>
              </button>
            )}

            {/* Primary Action: Catat Bayar jika sudah dikirim dan masih ada sisa */}
            {isShipped && remaining > 0 && so.status !== 'CANCELLED' && canUpdate && (
              <button
                type="button"
                onClick={handleOpenPaymentModal}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all shrink-0"
              >
                <CreditCard size={14} />
                <span>Catat Bayar ({formatRupiah(remaining)})</span>
              </button>
            )}

            {/* Tombol Cetak Faktur Penjualan */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
              title="Cetak Faktur Penjualan (SO)"
            >
              <Printer size={14} className="text-zinc-500" />
              <span>Cetak Faktur</span>
            </button>

            {/* Dropdown Menu Aksi Lainnya */}
            <div className="relative" ref={headerMenuRef}>
              <button
                type="button"
                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                className={`px-3 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  headerMenuOpen 
                    ? 'bg-zinc-900 text-white border-zinc-900 ring-2 ring-zinc-400/20' 
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
                }`}
                title="Pilihan Aksi Lainnya"
              >
                <MoreVertical size={14} />
                <span className="hidden sm:inline">Aksi</span>
                <ChevronDown size={12} className={headerMenuOpen ? "text-zinc-300" : "text-zinc-400"} />
              </button>

              {headerMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-zinc-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  {/* Ubah / Revisi Pesanan */}
                  {so.status !== 'CANCELLED' && canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleOpenEditSo();
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <Edit2 size={13} className={!isPreShipment ? "text-amber-600" : "text-indigo-600"} />
                      <span>{!isPreShipment ? 'Revisi Pesanan Terkirim' : 'Ubah Pesanan'}</span>
                    </button>
                  )}

                  {/* Ajukan Retur Barang (Hanya jika barang sudah dikirim) */}
                  {isShipped && so.status !== 'CANCELLED' && canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleOpenRetModal();
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <RefreshCw size={13} className="text-rose-600" />
                      <span>Ajukan Retur Barang</span>
                    </button>
                  )}

                  {/* Terbitkan Form Retur Kosongan */}
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      handlePrintBlankReturn();
                    }}
                    className="w-full px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                    title="Cetak formulir fisik retur & balikan kosong untuk diisi tulisan tangan oleh dropping/supir"
                  >
                    <FileText size={13} className="text-indigo-600" />
                    <span>Terbitkan Form Retur Kosongan</span>
                  </button>

                  {/* Ubah Syarat Bayar */}
                  {remaining > 0 && so.status !== 'CANCELLED' && canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setTermsModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <Clock size={13} className="text-amber-600" />
                      <span>Ubah Syarat Bayar (Tempo)</span>
                    </button>
                  )}

                  {/* Catat Pembayaran (bila belum tampil di primary) */}
                  {remaining > 0 && !isShipped && so.status !== 'CANCELLED' && canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleOpenPaymentModal();
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                    >
                      <CreditCard size={13} className="text-emerald-600" />
                      <span>Catat Pembayaran ({formatRupiah(remaining)})</span>
                    </button>
                  )}

                  {/* Batalkan SO */}
                  {so.status !== 'CANCELLED' && !isFullyCompleted && canUpdate && (
                    <>
                      <div className="my-1 border-t border-zinc-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          handleCancelSo();
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors text-left"
                      >
                        <XCircle size={13} className="text-rose-500" />
                        <span>Batalkan Sales Order</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Step-by-Step Interactive Workflow Hub */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-5 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-500" />
              <span>Alur Operasional Pesanan (Step-by-Step)</span>
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Panduan langkah proses dari pesanan diterima hingga barang sampai dan pembayaran lunas</p>
          </div>
          {so.status !== 'CANCELLED' && canUpdate && (
            <button
              onClick={handleOpenEditSo}
              className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-bold transition-all cursor-pointer self-start sm:self-auto ${
                !isPreShipment 
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200' 
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
              }`}
            >
              <Edit2 size={12} />
              <span>{!isPreShipment ? 'Revisi Rincian SO' : 'Ubah Rincian SO Ini'}</span>
            </button>
          )}
        </div>

        {/* 4 Core Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Step 1: Pesanan */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            isPreShipment
              ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-zinc-50 border-zinc-200'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Langkah 1
              </span>
              <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={12} /> Selesai
              </span>
            </div>
            <h4 className="font-bold text-zinc-900 text-xs">Pesanan Dibuat</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">{so.soNumber}</p>
            <div className="mt-2.5 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">{so.items?.length || 0} macam barang</span>
              {so.status !== 'CANCELLED' && canUpdate && (
                <button
                  onClick={handleOpenEditSo}
                  className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <Edit2 size={11} /> {!isPreShipment ? 'Revisi' : 'Ubah'}
                </button>
              )}
            </div>
          </div>

          {/* Step 2: Pengiriman Barang */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            isWaitingShipment
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20'
              : !isShipped && so.status !== 'CANCELLED'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20'
              : isShipped
              ? 'bg-zinc-50 border-zinc-200'
              : 'bg-zinc-50 border-zinc-200 opacity-60'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                Langkah 2
              </span>
              {isWaitingShipment ? (
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <Clock size={12} /> Menunggu Dikirim
                </span>
              ) : isShipped ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Terkirim
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <Clock size={12} /> Menunggu
                </span>
              )}
            </div>
            <h4 className="font-bold text-zinc-900 text-xs">Pengiriman (Surat Jalan)</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isWaitingShipment
                ? `Surat jalan terjadwal di Manifest ${manifestNum || ''} (Menunggu Keberangkatan Armada)`
                : isShipped
                ? 'Surat jalan telah diterbitkan & dikirim'
                : 'Siapkan barang di gudang'}
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[11px]">
              {isWaitingShipment ? (
                <span className="text-amber-800 font-medium text-[11px] flex items-center gap-1">
                  <Truck size={12} className="text-amber-600" /> Terjadwal: <span className="font-mono font-bold">{manifestNum}</span>
                </span>
              ) : !isShipped && canUpdate && so.status !== 'CANCELLED' && !manifestNum ? (
                <button
                  onClick={() => navigate('/delivery-manifest')}
                  className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] shadow-2xs cursor-pointer"
                >
                  <Truck size={12} /> Buka Manifest Pengiriman
                </button>
              ) : (
                <span className="text-zinc-500 font-mono text-[10px]">
                  {isShipped ? 'Stok Gudang Terpotong' : 'Belum Dijadwalkan'}
                </span>
              )}
            </div>
          </div>

          {/* Step 3: Faktur Tagihan */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            paymentStatus !== 'PAID' && isShipped
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-zinc-50 border-zinc-200'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                Langkah 3
              </span>
              <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={12} /> Terbit
              </span>
            </div>
            <h4 className="font-bold text-zinc-900 text-xs">Faktur Penjualan (INV)</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {term === 'TEMPO' ? `Tempo: Jatuh tempo ${so.metadata?.dueDate || '-'}` : 'Pembayaran ' + term}
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Total Tagihan:</span>
              <strong className="font-mono text-zinc-900">{formatRupiah(total)}</strong>
            </div>
          </div>

          {/* Step 4: Pembayaran / Pelunasan */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            paymentStatus === 'PAID'
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/20'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                Langkah 4
              </span>
              {paymentStatus === 'PAID' ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Lunas 100%
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <Clock size={12} /> Sisa {formatRupiah(remaining)}
                </span>
              )}
            </div>
            <h4 className="font-bold text-zinc-900 text-xs">Pelunasan Tagihan</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Sudah dibayar: <strong className="text-emerald-700 font-mono">{formatRupiah(paid)}</strong>
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-200/70 flex items-center justify-between text-[11px]">
              {remaining > 0 && canUpdate && so.status !== 'CANCELLED' ? (
                <button
                  onClick={handleOpenPaymentModal}
                  className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 text-[11px] shadow-2xs cursor-pointer"
                >
                  <CreditCard size={12} /> Catat Pelunasan
                </button>
              ) : (
                <span className="text-emerald-700 font-bold text-[10px]">Tidak Ada Tunggakan</span>
              )}
            </div>
          </div>
        </div>

        {/* Actionable Next Step Guidance Banner */}
        {so.status !== 'CANCELLED' && (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isFullyCompleted
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : !isShipped
              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {isFullyCompleted ? (
                  <CheckCircle2 size={20} className="text-emerald-600" />
                ) : !isShipped ? (
                  <Truck size={20} className="text-indigo-600" />
                ) : (
                  <CreditCard size={20} className="text-amber-600" />
                )}
              </div>
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-sm">
                  {isFullyCompleted
                    ? 'Semua Tahap Telah Tuntas!'
                    : !isShipped
                    ? 'Langkah Selanjutnya: Terbitkan Surat Jalan untuk Pengiriman Barang'
                    : `Langkah Selanjutnya: Menunggu Pelunasan Sisa Tagihan (${formatRupiah(remaining)})`}
                </p>
                <p className="text-zinc-600 text-xs leading-relaxed">
                  {isFullyCompleted
                    ? 'Barang telah dikirim dan seluruh tagihan telah lunas. Anda dapat mencetak invoice atau faktur pengiriman sewaktu-waktu.'
                    : !isShipped
                    ? 'Pesanan sudah tercatat. Jika ada revisi barang/toko, Anda dapat klik "Ubah Pesanan". Untuk pengiriman barang, silakan jadwalkan di halaman Manifest Pengiriman.'
                    : `Barang telah dijadwalkan / dalam perjalanan. Tagihan jatuh tempo pada ${so.metadata?.dueDate || '-'}. Klik "Catat Pembayaran" jika pembayaran sudah diterima.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {!isShipped && canUpdate && (
                <>
                  <button
                    onClick={handleOpenEditSo}
                    className="px-3 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit2 size={13} />
                    <span>Ubah Pesanan</span>
                  </button>
                  <button
                    onClick={() => navigate('/delivery-manifest')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Truck size={14} />
                    <span>Jadwalkan di Manifest</span>
                  </button>
                </>
              )}

              {isShipped && remaining > 0 && canUpdate && (
                <button
                  onClick={handleOpenPaymentModal}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <CreditCard size={14} />
                  <span>Bayar Sekarang</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Left Column (2 Cols): Metadata Cards & Product Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Info */}
            <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-indigo-600" /> Pelanggan / Toko
                </h4>
                {so.status !== 'CANCELLED' && canUpdate && (
                  <button
                    onClick={handleOpenEditSo}
                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={11} /> {!isPreShipment ? 'Revisi' : 'Ubah'}
                  </button>
                )}
              </div>
              <div>
                <p className="text-base font-bold text-zinc-900">{so.customer?.name || 'Pelanggan General'}</p>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <Phone size={12} /> {so.customer?.phone || 'Tidak ada nomor telepon'}
                </p>
                <p className="text-xs text-zinc-500 mt-1 flex items-start gap-1">
                  <MapPin size={12} className="shrink-0 mt-0.5" /> {so.customer?.address || 'Tidak ada alamat'}
                </p>
              </div>
            </div>

            {/* Sales & Payment Info */}
            <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck size={15} className="text-indigo-600" /> Ketentuan & Tanggal SO
                </h4>
                {so.status !== 'CANCELLED' && canUpdate && (
                  <button
                    onClick={handleOpenEditSo}
                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={11} /> {!isPreShipment ? 'Revisi' : 'Ubah'}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tanggal SO:</span>
                  <span className="font-mono font-bold text-zinc-900">{so.soDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sales Person:</span>
                  <span className="font-bold text-indigo-700">{so.metadata?.salesperson || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ketentuan Bayar:</span>
                  <span className="font-bold text-zinc-900">{so.metadata?.paymentTerm || 'LUNAS'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tanggal Jatuh Tempo:</span>
                  <span className="font-mono font-bold text-rose-600">{so.metadata?.dueDate || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">Rincian Barang Dipesan</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">Daftar item barang beserta harga satuan, satuan unit, dan diskon</p>
              </div>
              {so.status !== 'CANCELLED' && canUpdate && (
                <button
                  onClick={handleOpenEditSo}
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    !isPreShipment 
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' 
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  }`}
                >
                  <Edit2 size={13} />
                  <span>{!isPreShipment ? 'Revisi Barang Pesanan' : 'Ubah Barang / Pesanan'}</span>
                </button>
              )}
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600">
                  <tr>
                    <th className="p-3">SKU & Barang</th>
                    <th className="p-3 text-right">Kuantitas</th>
                    <th className="p-3 text-right">Harga Satuan</th>
                    <th className="p-3 text-right">Diskon Item</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {so.items?.map(item => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="p-3">
                        <p className="font-bold text-zinc-900">{item.product?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-zinc-400 font-mono">{item.product?.sku}</span>
                          {item.product?.totalStock !== undefined && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                              Stok Saat Ini: {item.product.totalStock} {item.product.unit || 'pcs'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className="font-bold">{formatQty(item.qty)} {item.unit || item.product?.unit || 'pcs'}</span>
                        {parseFloat(item.bonusQty || 0) > 0 && (
                          <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                            +{formatQty(item.bonusQty)} {item.bonusUnit || item.unit || item.product?.unit || 'pcs'} Bonus
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">{formatRupiah(item.price)}</td>
                      <td className="p-3 text-right font-mono text-rose-600">-{formatRupiah(item.discount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-zinc-900">{formatRupiah(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Retur Penjualan */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">
                      Retur Penjualan & Barang Balikan
                    </h4>
                    {((so.invoices || []).flatMap(inv => inv.returns || [])).length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        {((so.invoices || []).flatMap(inv => inv.returns || [])).length} Retur
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Pencatatan barang cacat/rusak, pengurangan subtotal pesanan, dan penerbitan Form Retur
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tombol Terbitkan Form Retur Kosongan */}
                <button
                  type="button"
                  onClick={handlePrintBlankReturn}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  title="Cetak Form Barang Balikan & Retur fisik kosong A4 untuk tulisan tangan supir/dropping"
                >
                  <FileText size={13} className="text-zinc-500" />
                  <span>Form Retur Kosongan</span>
                </button>

                {isShipped && so.status !== 'CANCELLED' && canUpdate && (
                  <button
                    type="button"
                    onClick={handleOpenRetModal}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Plus size={13} />
                    <span>Ajukan Retur Barang</span>
                  </button>
                )}
              </div>
            </div>

            {((so.invoices || []).flatMap(inv => inv.returns || [])).length > 0 ? (
              <div className="space-y-3">
                {((so.invoices || []).flatMap(inv => inv.returns || [])).map((ret, rIdx) => {
                  const isCompleted = ret.status === 'COMPLETED';
                  const returnItems = ret.items || [];
                  return (
                    <div key={ret.id || rIdx} className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-200/80">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900 text-xs">
                            #{ret.returnNumber}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Calendar size={12} /> {ret.returnDate}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {isCompleted ? 'STOK MASUK (SELESAI)' : 'FORM DITERBITKAN'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 font-medium">Potongan Nilai:</span>
                          <span className="font-mono font-bold text-rose-600 text-xs">
                            -{formatRupiah(ret.totalAmount)}
                          </span>

                          {/* Tombol Cetak Form Retur */}
                          <button
                            type="button"
                            onClick={() => handlePrintReturn(ret)}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                            title="Cetak Form Barang Balikan & Retur format A4"
                          >
                            <Printer size={12} className="text-zinc-500" />
                            <span>Cetak Form Retur</span>
                          </button>

                          {/* Link ke Detail Retur */}
                          {ret.id && (
                            <Link
                              to={`/transactions/returns/${ret.id}`}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors"
                              title="Buka halaman dokumen retur lengkap"
                            >
                              <ExternalLink size={12} />
                              <span>Detail Retur</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Rincian Item Diretur */}
                      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-600 text-[11px]">
                            <tr>
                              <th className="py-2 px-3">Barang</th>
                              <th className="py-2 px-3 text-center">Kondisi</th>
                              <th className="py-2 px-3 text-right">Qty Diretur</th>
                              <th className="py-2 px-3 text-right">Harga</th>
                              <th className="py-2 px-3 text-right">Subtotal Potongan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {returnItems.map((rItem, iIdx) => (
                              <tr key={rItem.id || iIdx} className="hover:bg-zinc-50/50">
                                <td className="py-2 px-3">
                                  <span className="font-bold text-zinc-900">{rItem.product?.name || 'Produk'}</span>
                                  <div className="text-[10px] text-zinc-400 font-mono">
                                    {rItem.product?.sku} {rItem.reason ? `• Ket: ${rItem.reason}` : ''}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    rItem.condition === 'DAMAGED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}>
                                    {rItem.condition === 'DAMAGED' ? 'RUSAK / CACAT' : 'LAYAK JUAL'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900">
                                  {formatQty(rItem.qty)} {rItem.product?.unit || 'pcs'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-zinc-600">
                                  {formatRupiah(rItem.price)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                  -{formatRupiah(rItem.subtotal || (rItem.qty * rItem.price))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-zinc-50 space-y-2">
                <RefreshCw size={24} className="mx-auto text-zinc-300" />
                <p>
                  {isShipped
                    ? 'Belum ada catatan retur untuk pesanan ini. Jika ada barang rusak atau dikembalikan pelanggan, ajukan retur barang.'
                    : 'Retur hanya dapat diajukan setelah pesanan dikirimkan (status SHIPPED / DELIVERED).'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePrintBlankReturn}
                    className="px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    title="Cetak format form retur kosong A4 untuk dibawa supir/dropping"
                  >
                    <FileText size={12} className="text-zinc-500" /> Form Retur Kosongan
                  </button>

                  {isShipped && so.status !== 'CANCELLED' && canUpdate && (
                    <button
                      type="button"
                      onClick={handleOpenRetModal}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={12} /> Ajukan Retur Barang Sekarang
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment History Log */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">Riwayat Catatan Pembayaran</h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">Daftar setoran DP, angsuran, atau pelunasan dari customer</p>
              </div>
              <span className="text-xs font-bold text-zinc-400">{paymentsList.length} Pembayaran</span>
            </div>

            <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-2 text-xs">
              {paymentsList.length > 0 ? (
                paymentsList.map((p, idx) => (
                  <div key={idx} className="bg-white p-3 border border-zinc-200 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-bold text-zinc-900 text-sm">{formatRupiah(p.amount)}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{p.date} • {p.method} • {p.notes || '-'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {p.evidence && (
                        <button
                          type="button"
                          onClick={() => setPreviewImage({
                            isOpen: true,
                            url: getImageUrl(p.evidence),
                            title: `Bukti Pembayaran SO (${formatRupiah(p.amount)} - ${p.date})`
                          })}
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center space-x-1 cursor-pointer"
                          title="Lihat Bukti Transfer"
                        >
                          <Paperclip size={12} />
                          <span>Bukti Foto</span>
                        </button>
                      )}
                      <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                        Terverifikasi
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-zinc-400 space-y-2">
                  <CreditCard size={24} className="mx-auto text-zinc-300" />
                  <p>Belum ada riwayat pembayaran yang dicatat untuk pesanan ini.</p>
                  {remaining > 0 && canUpdate && so.status !== 'CANCELLED' && (
                    <button
                      onClick={handleOpenPaymentModal}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <CreditCard size={12} /> Catat Pembayaran Sekarang
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Finance Summary Card */}
        <div className="space-y-6">
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 text-xs sticky top-6">
            <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider border-b pb-2">Ringkasan Tagihan SO</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal Barang:</span>
                <span className="font-mono font-bold">{formatRupiah(so.subtotal)}</span>
              </div>

              {so.metadata?.globalDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Diskon Total:</span>
                  <span className="font-mono font-bold">-{formatRupiah(so.metadata.globalDiscountAmount)}</span>
                </div>
              )}

              {parseFloat(so.taxAmount) > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Pajak (PPN):</span>
                  <span className="font-mono font-bold">+{formatRupiah(so.taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-900 font-extrabold border-t pt-3 text-sm">
                <span>Total SO:</span>
                <span className="font-mono text-indigo-700">{formatRupiah(total)}</span>
              </div>

              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Telah Dibayar:</span>
                <span className="font-mono">{formatRupiah(paid)}</span>
              </div>

              <div className="flex justify-between text-rose-600 font-extrabold border-t pt-3 text-sm">
                <span>Sisa Tagihan (Belum Bayar):</span>
                <span className="font-mono">{formatRupiah(remaining)}</span>
              </div>
            </div>

            {remaining > 0 && canUpdate && so.status !== 'CANCELLED' && (
              <button
                onClick={handleOpenPaymentModal}
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all"
              >
                <CreditCard size={15} />
                <span>Catat Pembayaran Sisa</span>
              </button>
            )}

            {so.status !== 'CANCELLED' && canUpdate && (
              <button
                onClick={handleOpenEditSo}
                className="w-full py-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Edit2 size={13} className={!isPreShipment ? "text-amber-600" : "text-indigo-600"} />
                <span>{!isPreShipment ? 'Revisi Pesanan Terkirim' : 'Ubah Pesanan Ini'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <PaymentRecordModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        paymentTargetDoc={paymentTargetDoc}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        evidenceFile={evidenceFile}
        setEvidenceFile={setEvidenceFile}
        evidencePreview={evidencePreview}
        setEvidencePreview={setEvidencePreview}
        actionLoading={actionLoading}
        actionError={actionError}
        handleRecordPaymentSubmit={handleRecordPaymentSubmit}
      />

      {/* Lightbox / Image Preview Modal */}
      {previewImage.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <h4 className="font-bold text-sm text-zinc-900">{previewImage.title || 'Bukti Dokumen'}</h4>
              <button
                type="button"
                onClick={() => setPreviewImage({ isOpen: false, url: '', title: '' })}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 cursor-pointer"
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

      {/* Delivery Order Modal */}
      <DeliveryModal
        isOpen={sjModalOpen}
        onClose={() => setSjModalOpen(false)}
        sjForm={sjForm}
        setSjForm={setSjForm}
        evidenceFile={sjEvidenceFile}
        setEvidenceFile={setSjEvidenceFile}
        evidencePreview={sjEvidencePreview}
        setEvidencePreview={setSjEvidencePreview}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateSj={handleConfirmCreateSj}
      />

      {/* Direct In-page Edit Sales Order Modal */}
      <SalesOrderModal
        isOpen={editSoModalOpen}
        onClose={() => setEditSoModalOpen(false)}
        soFormMode="EDIT"
        soForm={editSoForm}
        setSoForm={setEditSoForm}
        editingSoId={so?.id}
        salesOrders={so ? [so] : []}
        customers={customersList}
        customerOptions={customerOptions}
        salespersons={salespersonsList}
        salespersonOptions={salespersonOptions}
        taxes={taxesList}
        warehouses={warehousesList}
        products={productsList}
        productOptions={productOptions}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateSo={handleConfirmEditSo}
        handleSoItemChange={handleEditSoItemChange}
        addSoItem={addEditSoItem}
        removeSoItem={removeEditSoItem}
        user={user}
        isAlreadyShipped={!isPreShipment}
      />

      {/* Return Modal */}
      <ReturnModal
        isOpen={retModalOpen}
        onClose={() => setRetModalOpen(false)}
        retForm={retForm}
        setRetForm={setRetForm}
        warehouses={warehousesList}
        productOptions={productOptions}
        actionLoading={actionLoading}
        actionError={actionError}
        handleConfirmCreateReturn={handleConfirmCreateReturn}
        handleRetItemChange={handleRetItemChange}
        addRetItem={addRetItem}
        removeRetItem={removeRetItem}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Edit Payment Terms Modal */}
      <EditPaymentTermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        so={so}
        onSuccess={() => fetchSoDetail()}
      />
    </div>
  );
};

export default SalesOrderDetail;

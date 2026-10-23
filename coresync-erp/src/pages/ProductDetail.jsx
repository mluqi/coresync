import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import ConfirmationModal from '../components/ConfirmationModal';
import Loading from '../components/Loading';
import SearchSelect from '../components/SearchSelect';
import {
  ArrowLeft,
  Package,
  Edit2,
  Trash2,
  Layers,
  Warehouse,
  History,
  DollarSign,
  Tag,
  Percent,
  TrendingUp,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Calendar,
  Eye,
  FileText,
  Plus,
  X,
  Upload,
  Save,
  ShieldCheck,
  Clock,
  Truck,
  Building2,
  Phone,
  Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import { formatRupiah, formatStockBreakdown, formatStockBreakdownCompact, formatStockLedgerDisplay } from '../utils/format';
import getImageUrl from '../utils/imageUrl';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState(null);
  const [stockLedgers, setStockLedgers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('units'); // 'units' | 'suppliers' | 'warehouses' | 'history' | 'audit'

  // Master Data Options for Edit Modal
  const [categoriesList, setCategoriesList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [taxesList, setTaxesList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    unit: 'PCS',
    sellingPrice: 0,
    purchasePrice: 0,
    taxId: '',
    categoryId: '',
    category: '',
    supplierId: '',
    supplier: '',
    minStock: 10
  });
  const [productUnits, setProductUnits] = useState([]);
  const [productSuppliers, setProductSuppliers] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const [actionLoading, setActionLoading] = useState(false);

  const canUpdate = hasPermission(user, 'products', 'update');
  const canDelete = hasPermission(user, 'products', 'delete');
  const canViewCost = hasPermission(user, 'products', 'view_cost');

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'history' && product) {
      fetchStockHistory();
    }
    if (activeTab === 'audit' && product) {
      fetchAuditLogs();
    }
  }, [activeTab, product]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/products/${id}`);
      setProduct(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat detail barang.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockHistory = async () => {
    try {
      setLedgerLoading(true);
      const res = await api.get(`/stock-ledger?productId=${id}&limit=25`);
      setStockLedgers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load stock history', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await api.get(`/logs/activity?targetCode=${product?.sku || ''}&module=PRODUCTS&limit=20`);
      setAuditLogs(res.data.data || []);
    } catch (err) {
      console.error('Failed to load audit history', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchDropdownOptions = async () => {
    try {
      const [catRes, taxRes, unitRes, suppRes] = await Promise.all([
        api.get('/categories?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/taxes?limit=50').catch(() => ({ data: { data: [] } })),
        api.get('/units?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/suppliers?limit=100').catch(() => ({ data: { data: [] } }))
      ]);

      setCategoriesList(catRes.data?.data || []);
      setTaxesList(taxRes.data?.data || []);
      setUnitsList(unitRes.data?.data || []);
      setSuppliersList(suppRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load options for product edit modal', err);
    }
  };

  // Helper: Chained Multi-Unit calculation & price suggestions
  const getChainedUnitInfo = (index, currentUnits, baseUnit, baseBuyPrice, baseSellPrice) => {
    const parentUnitName = index === 0 
      ? (baseUnit || 'Satuan Dasar')
      : (currentUnits[index - 1]?.unitName || `Satuan Tingkat ${index + 1}`);

    let totalFactor = 1;
    for (let i = 0; i <= index; i++) {
      const qty = parseFloat(currentUnits[i]?.qtyFactor) || 1;
      totalFactor *= qty;
    }

    const parentBuyPrice = index === 0
      ? (parseFloat(baseBuyPrice) || 0)
      : (parseFloat(currentUnits[index - 1]?.purchasePrice) || 0);

    const parentSellPrice = index === 0
      ? (parseFloat(baseSellPrice) || 0)
      : (parseFloat(currentUnits[index - 1]?.sellingPrice) || 0);

    const currentQty = parseFloat(currentUnits[index]?.qtyFactor) || 1;
    const suggestedBuy = currentQty > 0 ? Math.round(parentBuyPrice / currentQty) : 0;
    const suggestedSell = currentQty > 0 ? Math.round(parentSellPrice / currentQty) : 0;

    return {
      parentUnitName,
      totalFactor: Math.round(totalFactor * 10000) / 10000,
      suggestedBuy,
      suggestedSell
    };
  };

  const handleOpenEditModal = async () => {
    if (!product) return;
    await fetchDropdownOptions();

    const baseUnitName = product.unit || 'PCS';
    
    // Sort alternate units by items per base ascending (e.g. 20 Renceng, then 200 Pcs)
    const sortedAlternateUnits = (product.units || [])
      .filter(u => !u.isBaseUnit && parseFloat(u.conversionRatio) !== 1.0)
      .map(u => {
        const rawRatio = parseFloat(u.conversionRatio) || 1.0;
        const totalItemsPerBase = rawRatio < 1.0 
          ? Math.round(1 / rawRatio) 
          : rawRatio;
        return {
          ...u,
          totalItemsPerBase
        };
      })
      .sort((a, b) => a.totalItemsPerBase - b.totalItemsPerBase);

    let prevTotal = 1;
    const alternateUnits = sortedAlternateUnits.map(u => {
      const stepQty = u.totalItemsPerBase > 0 && prevTotal > 0
        ? Math.round((u.totalItemsPerBase / prevTotal) * 10000) / 10000
        : 1;
      prevTotal = u.totalItemsPerBase;
      return {
        ...u,
        relationType: 'ECERAN',
        qtyFactor: String(stepQty),
        purchasePrice: u.purchasePrice || '',
        sellingPrice: u.sellingPrice || ''
      };
    });

    const primarySuppId = product.supplierId || product.supplier?.id || product.metadata?.supplierId;
    const altSuppliers = (product.productSuppliers || [])
      .filter(ps => !ps.isPrimary && String(ps.supplierId) !== String(primarySuppId))
      .map(ps => ({
        supplierId: ps.supplierId,
        purchasePrice: ps.purchasePrice || '',
        minOrderQty: String(ps.minOrderQty || 1),
        notes: ps.notes || ''
      }));
    setProductSuppliers(altSuppliers);

    setFormData({
      sku: product.sku || '',
      name: product.name || '',
      unit: baseUnitName,
      sellingPrice: product.sellingPrice || 0,
      purchasePrice: product.purchasePrice || 0,
      taxId: product.taxId || '',
      categoryId: product.categoryId || product.category?.id || '',
      category: product.category?.name || product.metadata?.category || '',
      supplierId: product.supplierId || product.supplier?.id || product.metadata?.supplierId || '',
      supplier: product.supplier?.name || product.metadata?.supplier || '',
      minStock: product.minStock !== undefined ? product.minStock : 10
    });

    setProductUnits(alternateUnits);
    setImageFile(null);
    setImagePreview(product.image || product.metadata?.image || '');
    setSaveError('');
    setEditModalOpen(true);
  };

  const handleAddSupplier = () => {
    const availableSupp = suppliersList.find(s => 
      String(s.id) !== String(formData.supplierId) && 
      !productSuppliers.some(ps => String(ps.supplierId) === String(s.id))
    ) || suppliersList[0];
    
    setProductSuppliers(prev => [
      ...prev,
      {
        supplierId: availableSupp?.id || '',
        purchasePrice: '',
        minOrderQty: '1',
        notes: ''
      }
    ]);
  };

  const handleUpdateSupplier = (index, field, value) => {
    setProductSuppliers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveSupplier = (index) => {
    setProductSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error('Hanya format JPG, JPEG, dan PNG yang diizinkan!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handleAddAlternateUnit = () => {
    const nextIndex = productUnits.length;
    const defaultUnitName = nextIndex === 0 ? 'renceng' : nextIndex === 1 ? 'pcs' : (unitsList[0]?.name || 'pcs');

    setProductUnits(prev => [
      ...prev,
      {
        unitName: defaultUnitName,
        relationType: 'ECERAN',
        qtyFactor: nextIndex === 0 ? '20' : '10',
        purchasePrice: '',
        sellingPrice: '',
        isBaseUnit: false
      }
    ]);
  };

  const handleUpdateAlternateUnit = (index, field, value) => {
    setProductUnits(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveAlternateUnit = (index) => {
    setProductUnits(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmSave = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: 'Ubah Data Barang',
      message: `Apakah Anda yakin ingin menyimpan perubahan data barang "${formData.name}"?`,
      type: 'info',
      onConfirm: () => handleSaveProduct()
    });
  };

  const handleSaveProduct = async () => {
    setSaveError('');
    setSaveLoading(true);

    let cumulativeFactor = 1;
    const alternatePayload = productUnits.map(u => {
      const stepQty = parseFloat(u.qtyFactor) || 1.0;
      cumulativeFactor *= stepQty;
      const ratio = 1 / cumulativeFactor;
      return {
        unitName: u.unitName,
        conversionRatio: ratio,
        isBaseUnit: false,
        purchasePrice: parseFloat(u.purchasePrice) || 0,
        sellingPrice: parseFloat(u.sellingPrice) || 0
      };
    });

    const allUnitsPayload = [
      {
        unitName: formData.unit,
        conversionRatio: 1.0,
        isBaseUnit: true,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0
      },
      ...alternatePayload
    ];

    const allSuppliersPayload = [
      {
        supplierId: formData.supplierId,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        isPrimary: true
      },
      ...productSuppliers
        .filter(ps => ps.supplierId && String(ps.supplierId) !== String(formData.supplierId))
        .map(ps => ({
          supplierId: ps.supplierId,
          purchasePrice: ps.purchasePrice !== '' ? parseFloat(ps.purchasePrice) : (parseFloat(formData.purchasePrice) || 0),
          minOrderQty: parseFloat(ps.minOrderQty) || 1,
          isPrimary: false,
          notes: ps.notes || null
        }))
    ];

    const dataPayload = new FormData();
    dataPayload.append('sku', formData.sku);
    dataPayload.append('name', formData.name);
    dataPayload.append('unit', formData.unit);
    dataPayload.append('sellingPrice', formData.sellingPrice);
    dataPayload.append('purchasePrice', formData.purchasePrice || 0);
    dataPayload.append('minStock', formData.minStock !== undefined ? formData.minStock : 10);
    if (formData.categoryId) dataPayload.append('categoryId', formData.categoryId);
    if (formData.supplierId) dataPayload.append('supplierId', formData.supplierId);
    if (formData.taxId) dataPayload.append('taxId', formData.taxId);
    dataPayload.append('metadata', JSON.stringify({
      category: formData.category,
      supplier: formData.supplier,
      supplierId: formData.supplierId
    }));
    dataPayload.append('units', JSON.stringify(allUnitsPayload));
    dataPayload.append('suppliers', JSON.stringify(allSuppliersPayload));

    if (imageFile) {
      dataPayload.append('image', imageFile);
    } else if (imagePreview === '') {
      dataPayload.append('image', '');
    }

    try {
      await api.put(`/products/${product.id}`, dataPayload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Data barang "${formData.name}" berhasil diperbarui!`);
      setEditModalOpen(false);
      setConfirmConfig(prev => ({ ...prev, isOpen: false }));
      await fetchProductDetails();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan perubahan barang.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = () => {
    if (!product) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Barang',
      message: `Apakah Anda yakin ingin menghapus barang "${product.name}"? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.delete(`/products/${product.id}`);
          toast.success(`Barang "${product.name}" berhasil dihapus.`);
          navigate('/products');
        } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal menghapus barang.');
        } finally {
          setActionLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return <Loading text="Memuat detail barang..." size="lg" className="min-h-[60vh]" />;
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/products')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-theme hover:underline transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Master Barang</span>
        </button>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start space-x-3 text-rose-700">
          <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm">Gagal Menampilkan Barang</h3>
            <p className="text-xs mt-1">{error || 'Data barang tidak ditemukan atau telah dihapus.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const pBeli = parseFloat(product.purchasePrice || 0);
  const pJual = parseFloat(product.sellingPrice || 0);
  const marginBase = pJual - pBeli;
  const marginPercent = pBeli > 0 ? ((marginBase / pBeli) * 100).toFixed(1) : 0;
  const totalStock = product.totalStock || 0;
  const totalInventoryValuation = totalStock * pBeli;

  const rawImgUrl = product.image || product.metadata?.image;
  const fullImgUrl = rawImgUrl ? getImageUrl(rawImgUrl) : null;

  const categoryOptions = categoriesList.map(c => ({
    value: c.id,
    label: `${c.name} (${c.code || 'CAT'})`,
    sublabel: `Kode: ${c.code || '-'}`
  }));

  const supplierOptions = suppliersList.map(s => ({
    value: s.id,
    label: s.name,
    sublabel: s.code ? `Kode: ${s.code}` : ''
  }));

  const unitOptions = unitsList.map(u => ({
    value: u.name,
    label: `${u.name} - ${u.symbol || u.name}`,
    sublabel: u.description || 'Satuan Produk'
  }));

  const taxOptions = taxesList.map(t => ({
    value: t.id,
    label: `${t.name} (${t.rate}%)`,
    sublabel: `Tarif: ${t.rate}%`
  }));

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <button
          type="button"
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/products')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-zinc-600 hover:text-theme transition-colors group cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-white border border-zinc-200 group-hover:border-theme-light group-hover:bg-theme-light transition-all">
            <ArrowLeft size={16} className="text-zinc-500 group-hover:text-theme" />
          </div>
          <span>Kembali ke Daftar Master Barang</span>
        </button>

        <div className="flex items-center space-x-2.5">
          {canUpdate && (
            <button
              onClick={handleOpenEditModal}
              className="px-3.5 py-2 text-xs bg-theme bg-theme-hover text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Edit2 size={14} />
              <span>Ubah Barang</span>
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="px-3.5 py-2 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 size={14} />
              <span>Hapus</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Executive Banner Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Image Thumbnail */}
          <div className="w-36 h-36 rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 shadow-sm relative group mx-auto md:mx-0">
            {fullImgUrl ? (
              <img 
                src={fullImgUrl} 
                alt={product.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div className={`w-full h-full flex flex-col items-center justify-center text-zinc-300 ${fullImgUrl ? 'hidden' : 'flex'}`}>
              <Package size={40} />
              <span className="text-[10px] font-semibold text-zinc-400 mt-2">Belum ada foto</span>
            </div>
          </div>

          {/* Product Meta */}
          <div className="flex-1 space-y-4 w-full">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-zinc-100 text-zinc-800 border border-zinc-200 font-mono text-xs font-bold uppercase">
                  {product.sku}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-theme-light text-theme border border-theme-light text-xs font-bold">
                  {product.category?.name || product.metadata?.category || product.metadata?.kategori || 'Umum'}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                  {product.supplier?.name || product.metadata?.supplier || 'SUPPLIER UMUM'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  product.tax?.rate > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}>
                  {product.tax?.name || 'Bebas Pajak'}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-950 mt-2">{product.name}</h1>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                <span>Satuan Utama (Base): <strong className="text-zinc-800 font-mono uppercase">{product.unit || 'PCS'}</strong></span>
                <span>•</span>
                <span>Dibuat pada: {new Date(product.createdAt).toLocaleDateString('id-ID')}</span>
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className={`grid grid-cols-2 ${canViewCost ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3 pt-2`}>
              {canViewCost && (
                <div className="p-3 bg-zinc-50/80 border border-zinc-200 rounded-xl">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Harga Beli Dasar (HPP)</span>
                  <span className="text-sm font-bold text-zinc-900 font-mono mt-0.5 block">{formatRupiah(pBeli)}</span>
                </div>
              )}

              <div className="p-3 bg-zinc-50/80 border border-zinc-200 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Harga Jual Dasar</span>
                <span className="text-sm font-bold text-theme font-mono mt-0.5 block">{formatRupiah(pJual)}</span>
              </div>

              {canViewCost && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Profit Margin Base</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-sm font-bold text-emerald-800 font-mono">+Rp {marginBase.toLocaleString('id-ID')}</span>
                    {pBeli > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                        {marginPercent}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className={`p-3 rounded-xl border ${
                totalStock <= (product.minStock || 10) 
                  ? 'bg-amber-50/80 border-amber-300' 
                  : 'bg-theme-light border-theme-light'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-theme uppercase tracking-wider block">Total Stok Fisik</span>
                  {totalStock <= (product.minStock || 10) && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-200 text-amber-900 uppercase">
                      Menipis (Min: {product.minStock || 10})
                    </span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-zinc-900 font-mono mt-0.5 block">
                  {formatStockBreakdownCompact(totalStock, product)}
                </span>
                {product.units && product.units.some(u => !u.isBaseUnit) && (
                  <span className="text-[10px] text-indigo-700 font-medium block truncate mt-0.5 font-mono">
                    {formatStockBreakdown(totalStock, product)}
                  </span>
                )}
                {canViewCost && (
                  <span className="text-[10px] text-zinc-500 font-medium block truncate mt-0.5">
                    Nilai Stok: Rp {totalInventoryValuation.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector Header */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex border-b border-zinc-200 pb-px gap-6 print:hidden">
          <button
            onClick={() => setActiveTab('units')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'units'
                ? 'border-theme text-theme'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Layers size={15} />
            <span>Multi Satuan & Pricing Tiers</span>
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'suppliers'
                ? 'border-theme text-theme'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Truck size={15} />
            <span>Rekanan Supplier ({product.productSuppliers && product.productSuppliers.length > 0 ? product.productSuppliers.length : (product.supplier ? 1 : 0)})</span>
          </button>

          <button
            onClick={() => setActiveTab('warehouses')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'warehouses'
                ? 'border-theme text-theme'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Warehouse size={15} />
            <span>Stok per Gudang ({product.warehouseStocks ? product.warehouseStocks.length : 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'history'
                ? 'border-theme text-theme'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <History size={15} />
            <span>Riwayat Mutasi Stok</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <ShieldCheck size={15} />
            <span>Audit Trail & Riwayat Edit</span>
          </button>
        </div>

        {/* Tab 1: Multi-Satuan & Pricing Tiers */}
        {activeTab === 'units' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Skema Multi-Satuan & Harga Khusus
              </h3>
              <span className="text-[11px] text-zinc-400">Total {product.units ? product.units.length : 1} Satuan Terdaftar</span>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-bold">
                    <th className="px-4 py-3">Nama Satuan</th>
                    <th className="px-4 py-3">Tipe Satuan</th>
                    <th className="px-4 py-3">Rasio Konversi</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Harga Beli</th>}
                    <th className="px-4 py-3 text-right">Harga Jual</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Profit Margin per Satuan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                  {(product.units && product.units.length > 0 ? product.units : [{
                    unitName: product.unit || 'pcs',
                    conversionRatio: 1.0,
                    isBaseUnit: true,
                    purchasePrice: product.purchasePrice,
                    sellingPrice: product.sellingPrice
                  }]).map((u, idx) => {
                    const r = parseFloat(u.conversionRatio);
                    const pBeliUnit = parseFloat(u.purchasePrice || 0);
                    const pJualUnit = parseFloat(u.sellingPrice || 0);
                    const margin = pJualUnit - pBeliUnit;
                    const marginPct = pBeliUnit > 0 ? ((margin / pBeliUnit) * 100).toFixed(1) : 0;
                    const isBase = u.isBaseUnit || r === 1.0;
                    const desc = isBase 
                      ? '1.0 (Satuan Utama)' 
                      : (r < 1 ? `1 ${product.unit} = ${Math.round(1/r)} ${u.unitName}` : `1 ${u.unitName} = ${r} ${product.unit}`);

                    return (
                      <tr key={idx} className={isBase ? 'bg-theme-light/40' : 'hover:bg-zinc-50/50'}>
                        <td className="px-4 py-3 font-bold uppercase text-zinc-950 flex items-center space-x-2">
                          <span>{u.unitName}</span>
                          {isBase && <CheckCircle2 size={13} className="text-theme" />}
                        </td>
                        <td className="px-4 py-3">
                          {isBase ? (
                            <span className="px-2 py-0.5 rounded bg-theme-light text-theme text-[10px] font-bold">Base Unit</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[10px] font-bold">Satuan Turunan</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-600">{desc}</td>
                        {canViewCost && <td className="px-4 py-3 text-right font-mono">{formatRupiah(pBeliUnit)}</td>}
                        <td className="px-4 py-3 text-right font-mono font-bold text-theme">{formatRupiah(pJualUnit)}</td>
                        {canViewCost && (
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            +Rp {margin.toLocaleString('id-ID')}
                            {pBeliUnit > 0 && <span className="text-[10px] font-normal text-emerald-700 ml-1.5">({marginPct}%)</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Rekanan Supplier (Multi-Supplier) */}
        {activeTab === 'suppliers' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Daftar Rekanan Pemasok / Supplier
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Daftar supplier yang menyediakan barang ini beserta harga beli dan kontaknya.
                </p>
              </div>
              {canUpdate && (
                <button
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-theme hover:underline bg-theme-light rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 size={13} />
                  <span>Kelola Rekanan Supplier</span>
                </button>
              )}
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-bold">
                    <th className="px-4 py-3">Nama Supplier</th>
                    <th className="px-4 py-3">Peran / Status</th>
                    {canViewCost && <th className="px-4 py-3 text-right">Harga Beli Acuan</th>}
                    <th className="px-4 py-3 text-right">Min. Order (MOQ)</th>
                    <th className="px-4 py-3">Kontak & Telepon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                  {product.productSuppliers && product.productSuppliers.length > 0 ? (
                    product.productSuppliers.map((ps, idx) => {
                      const supp = ps.supplier || {};
                      const isMain = ps.isPrimary || String(ps.supplierId) === String(product.supplierId);
                      const pPrice = parseFloat(ps.purchasePrice) > 0 ? parseFloat(ps.purchasePrice) : pBeli;
                      return (
                        <tr key={idx} className={`hover:bg-zinc-50/50 ${isMain ? 'bg-emerald-50/20' : ''}`}>
                          <td className="px-4 py-3 font-bold text-zinc-900 flex items-center space-x-2">
                            <Building2 size={14} className={isMain ? 'text-emerald-600' : 'text-zinc-500'} />
                            <div>
                              <span>{supp.name || product.supplier?.name || 'SUPPLIER UMUM'}</span>
                              {supp.code && (
                                <span className="block text-[10px] font-mono text-zinc-400 font-normal">{supp.code}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isMain ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                ★ Supplier Utama
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                Supplier Cadangan
                              </span>
                            )}
                          </td>
                          {canViewCost && (
                            <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                              {formatRupiah(pPrice)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono text-zinc-600">
                            {ps.minOrderQty ? `${ps.minOrderQty} ${product.unit}` : `1 ${product.unit}`}
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {supp.phone ? (
                              <div className="flex items-center gap-1 text-zinc-700 font-mono">
                                <Phone size={11} className="text-zinc-400" />
                                <span>{supp.phone}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">-</span>
                            )}
                            {supp.contactPerson && (
                              <span className="text-[10px] text-zinc-400 block font-sans">PIC: {supp.contactPerson}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="hover:bg-zinc-50/50 bg-emerald-50/20">
                      <td className="px-4 py-3 font-bold text-zinc-900 flex items-center space-x-2">
                        <Building2 size={14} className="text-emerald-600" />
                        <div>
                          <span>{product.supplier?.name || product.metadata?.supplier || 'SUPPLIER UMUM'}</span>
                          {product.supplier?.code && (
                            <span className="block text-[10px] font-mono text-zinc-400 font-normal">{product.supplier.code}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                          ★ Supplier Utama
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {formatRupiah(pBeli)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600">
                        1 {product.unit}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {product.supplier?.phone ? (
                          <div className="flex items-center gap-1 text-zinc-700 font-mono">
                            <Phone size={11} className="text-zinc-400" />
                            <span>{product.supplier.phone}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Rincian Stok per Gudang */}
        {activeTab === 'warehouses' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Lokasi & Stok Fisik per Gudang
              </h3>
              <span className="text-[11px] text-zinc-400">Total Stok: {formatStockBreakdown(totalStock, product)}</span>
            </div>

            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-bold">
                    <th className="px-4 py-3">Nama Gudang</th>
                    <th className="px-4 py-3 text-right">Rincian Stok Fisik</th>
                    <th className="px-4 py-3 text-right">Estimasi Nilai Stok (HPP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                  {product.warehouseStocks && product.warehouseStocks.length > 0 ? (
                    product.warehouseStocks.map((ws, idx) => {
                      const whName = ws.warehouse?.name || `Gudang #${ws.warehouseId}`;
                      const val = ws.stock * pBeli;
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-bold text-zinc-900 flex items-center space-x-2">
                            <Warehouse size={14} className="text-theme" />
                            <span>{whName}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-950">
                            <div>{formatStockBreakdownCompact(ws.stock, product)}</div>
                            <div className="text-[10px] text-zinc-500 font-normal">{formatStockBreakdown(ws.stock, product)}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-theme">{formatRupiah(val)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-6 text-center text-zinc-400">Belum ada catatan stok di gudang manapun.</td>
                    </tr>
                  )}
                </tbody>
                {product.warehouseStocks && product.warehouseStocks.length > 0 && (
                  <tfoot>
                    <tr className="bg-zinc-50 border-t border-zinc-200 font-bold text-zinc-900">
                      <td className="px-4 py-3 uppercase">Total Persediaan</td>
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-700">
                        <div>{formatStockBreakdownCompact(totalStock, product)}</div>
                        <div className="text-[10px] text-zinc-600 font-normal">{formatStockBreakdown(totalStock, product)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-theme">{formatRupiah(totalInventoryValuation)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Riwayat Mutasi Stok */}
        {activeTab === 'history' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Log Mutasi Stok Terakhir
              </h3>
              <span className="text-[11px] text-zinc-400">Menampilkan 25 mutasi terbaru</span>
            </div>

            {ledgerLoading ? (
              <div className="p-8 text-center text-zinc-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-theme" />
                <p className="text-xs font-semibold">Memuat riwayat mutasi...</p>
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-left border-b border-zinc-200 uppercase tracking-wider text-zinc-500 font-bold">
                      <th className="px-4 py-3">Tanggal & Waktu</th>
                      <th className="px-4 py-3">No. Referensi / Catatan</th>
                      <th className="px-4 py-3">Gudang</th>
                      <th className="px-4 py-3 text-right">Qty Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">
                    {stockLedgers.length > 0 ? (
                      stockLedgers.map((item, idx) => {
                        const rawAmount = item.qty !== undefined ? item.qty : (item.quantity || 0);
                        const isIncoming = item.type === 'IN' || item.type === 'RETURN_IN' || item.type === 'ADJUSTMENT_IN' || (item.quantity !== undefined && item.quantity > 0);
                        const refText = item.referenceType ? `${item.referenceType} #${item.referenceId}` : (item.referenceNumber || '—');
                        const display = formatStockLedgerDisplay(rawAmount, product, isIncoming);

                        return (
                          <tr key={idx} className="hover:bg-zinc-50/50">
                            <td className="px-4 py-3 font-mono text-zinc-600">
                              {new Date(item.createdAt).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-zinc-900 block">{refText}</span>
                              {item.notes && <span className="text-[11px] text-zinc-500">{item.notes}</span>}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 font-medium">
                              {item.warehouse?.name || `Gudang #${item.warehouseId}`}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-mono font-bold block ${display.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {display.primaryText}
                              </span>
                              {display.secondaryText && (
                                <span className="text-[11px] text-zinc-400 font-mono block">
                                  {display.secondaryText}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-6 text-center text-zinc-400">Belum ada riwayat mutasi stok untuk barang ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Audit Trail / Riwayat Perubahan */}
        {activeTab === 'audit' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-indigo-600" />
                <span>Linimasa Audit Trail & Perubahan Harga</span>
              </h3>
              <span className="text-[11px] text-zinc-400">Total {auditLogs.length} Catatan Aktivitas</span>
            </div>

            {auditLoading ? (
              <div className="py-12 text-center text-zinc-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-semibold">Memuat riwayat perubahan data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <div key={log.id} className="border border-zinc-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            log.action === 'UPDATE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-xs font-bold text-zinc-900">
                            {log.userName || 'System'} <span className="text-[10px] text-zinc-400 font-normal">({log.userRole || 'SYSTEM'})</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-zinc-500 font-mono">
                          <Clock size={12} />
                          <span>{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-700 font-medium leading-relaxed">
                        {log.description}
                      </p>

                      {/* Diff Table if changes exist */}
                      {log.metadata?.changes && log.metadata.changes.length > 0 && (
                        <div className="border border-zinc-200/80 rounded-lg overflow-hidden bg-zinc-50/50">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-zinc-100/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                <th className="py-1.5 px-3">Kolom</th>
                                <th className="py-1.5 px-3 text-rose-700">Sebelum</th>
                                <th className="py-1.5 px-3 text-emerald-700">Sesudah</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                              {log.metadata.changes.map((chg, cIdx) => (
                                <tr key={cIdx}>
                                  <td className="py-1.5 px-3 font-semibold text-zinc-800 text-[11px]">{chg.label || chg.field}</td>
                                  <td className="py-1.5 px-3 text-rose-600 font-mono text-[11px] line-through opacity-80">{chg.beforeFormatted || String(chg.before)}</td>
                                  <td className="py-1.5 px-3 text-emerald-600 font-mono text-[11px] font-bold">{chg.afterFormatted || String(chg.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                    Belum ada riwayat perubahan yang tercatat untuk produk ini.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-theme-light text-theme rounded-xl border border-theme-light">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Ubah Master Barang</h3>
                  <p className="text-xs text-zinc-500">Perbarui data barang, skema harga beli/jual, satuan, dan foto produk.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {saveError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start space-x-2.5 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              <form id="productEditForm" onSubmit={handleConfirmSave} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left & Middle: Product Info & Pricing (2 cols) */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Section 1: General Info */}
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag size={13} className="text-theme" />
                        <span>Informasi Umum Barang</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* SKU */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            SKU / Kode Barang
                          </label>
                          <input
                            type="text"
                            value={formData.sku}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold text-theme outline-none opacity-80"
                          />
                        </div>

                        {/* Nama Barang */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Nama Barang <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Antaka Bumbu Balado 100g"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 focus:border-theme outline-none font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Kategori */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Kategori</label>
                          <SearchSelect
                            options={categoryOptions}
                            value={formData.categoryId}
                            onChange={(opt) => {
                              const selCat = categoriesList.find(c => String(c.id) === String(opt ? opt.value : ''));
                              setFormData({
                                ...formData,
                                categoryId: opt ? opt.value : '',
                                category: selCat ? (selCat.code || selCat.name) : ''
                              });
                            }}
                            placeholder="Pilih Kategori..."
                            searchPlaceholder="Cari kategori..."
                          />
                        </div>

                        {/* Supplier */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Pemasok / Supplier</label>
                          <SearchSelect
                            options={supplierOptions}
                            value={formData.supplierId}
                            onChange={(opt) => {
                              const selSupp = suppliersList.find(s => String(s.id) === String(opt ? opt.value : ''));
                              setFormData({
                                ...formData,
                                supplierId: opt ? opt.value : '',
                                supplier: selSupp ? selSupp.name : ''
                              });
                            }}
                            placeholder="Pilih Supplier..."
                            searchPlaceholder="Cari supplier..."
                          />
                        </div>

                        {/* Satuan Utama (Base Unit) */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Satuan Utama (Base Unit) <span className="text-rose-500">*</span>
                          </label>
                          <SearchSelect
                            options={unitOptions}
                            value={formData.unit}
                            onChange={(opt) => setFormData({ ...formData, unit: opt ? opt.value : '' })}
                            placeholder="Pilih Satuan Utama..."
                            searchPlaceholder="Cari satuan..."
                          />
                        </div>
                      </div>

                      {/* Multi-Supplier: Rekanan Supplier Alternatif (Opsional) */}
                      <div className="pt-2 border-t border-zinc-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                              Supplier Alternatif / Cadangan
                            </span>
                            {productSuppliers.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-theme-light text-theme border border-theme-light">
                                {productSuppliers.length} Rekanan
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSupplier}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-theme hover:underline bg-theme-light rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>+ Tambah Supplier Alternatif</span>
                          </button>
                        </div>

                        {productSuppliers.length > 0 ? (
                          <div className="space-y-2 bg-zinc-50/70 p-3 rounded-xl border border-zinc-200">
                            {productSuppliers.map((ps, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs">
                                <div className="flex-1 min-w-[200px] w-full">
                                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">
                                    Supplier Alternatif #{idx + 1}
                                  </label>
                                  <SearchSelect
                                    options={supplierOptions.filter(opt => String(opt.value) !== String(formData.supplierId))}
                                    value={ps.supplierId}
                                    onChange={(opt) => handleUpdateSupplier(idx, 'supplierId', opt ? opt.value : '')}
                                    placeholder="Pilih Supplier Cadangan..."
                                    searchPlaceholder="Cari supplier..."
                                  />
                                </div>
                                {canViewCost && (
                                  <div className="w-full sm:w-44">
                                    <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">
                                      Harga Beli Khusus (Rp)
                                    </label>
                                    <input
                                      type="number"
                                      placeholder={formData.purchasePrice ? `Acuan: ${formData.purchasePrice}` : '0'}
                                      value={ps.purchasePrice}
                                      onChange={(e) => handleUpdateSupplier(idx, 'purchasePrice', e.target.value)}
                                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-800 outline-none focus:bg-white focus:ring-1 focus:ring-zinc-400"
                                    />
                                  </div>
                                )}
                                <div className="self-end sm:self-center pt-2 sm:pt-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSupplier(idx)}
                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus supplier alternatif ini"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-400 italic">
                            (Opsional) Jika barang ini bisa dipasok oleh supplier lain selain Supplier Utama di atas, klik <strong>+ Tambah Supplier Alternatif</strong>.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Pricing & Tax */}
                    <div className="space-y-3.5 border-t border-zinc-100 pt-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign size={13} className="text-theme" />
                        <span>{canViewCost ? 'Harga Beli, Harga Jual & Pajak' : 'Harga Jual & Pajak'}</span>
                      </h4>

                      <div className={`grid grid-cols-1 ${canViewCost ? 'sm:grid-cols-2' : ''} gap-4`}>
                        {canViewCost && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Harga Beli Dasar (Rp)</label>
                              {formData.purchasePrice > 0 && (
                                <span className="text-xs font-mono font-bold text-theme">{formatRupiah(formData.purchasePrice)}</span>
                              )}
                            </div>
                            <input
                              type="number"
                              required
                              placeholder="0"
                              value={formData.purchasePrice}
                              onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 focus:border-theme outline-none"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Harga Jual Dasar (Rp)</label>
                            {formData.sellingPrice > 0 && (
                              <span className="text-xs font-mono font-bold text-theme">{formatRupiah(formData.sellingPrice)}</span>
                            )}
                          </div>
                          <input
                            type="number"
                            required
                            placeholder="0"
                            value={formData.sellingPrice}
                            onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-200 focus:border-theme outline-none text-theme"
                          />
                        </div>
                      </div>

                      {/* Margin Calculation Preview */}
                      {canViewCost && formData.sellingPrice > 0 && formData.purchasePrice > 0 && (
                        <div className="p-3 bg-theme-light/40 border border-theme-light rounded-xl flex items-center justify-between text-xs">
                          <span className="font-semibold text-zinc-900">Estimasi Profit Margin Base:</span>
                          <div className="flex items-center space-x-3 font-mono font-bold">
                            <span className="text-emerald-600">
                              +Rp {(parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)).toLocaleString('id-ID')}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                              {(((parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)) / parseFloat(formData.purchasePrice)) * 100).toFixed(1)}% Margin
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Default Pajak PPN</label>
                          <SearchSelect
                            options={taxOptions}
                            value={formData.taxId}
                            onChange={(opt) => setFormData({ ...formData, taxId: opt ? opt.value : '' })}
                            placeholder="Bebas Pajak (Non-PPN)"
                            searchPlaceholder="Cari pajak..."
                            clearable={true}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Batas Stok Minimum (Reorder Point)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="10"
                            value={formData.minStock}
                            onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-zinc-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Product Image Upload */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon size={13} className="text-theme" />
                      <span>Foto Produk</span>
                    </h4>

                    <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 flex flex-col items-center justify-center space-y-4">
                      {imagePreview ? (
                        <div className="relative w-44 h-44 rounded-2xl border border-zinc-200 overflow-hidden group bg-white shadow-sm shrink-0">
                          <img 
                            src={getImageUrl(imagePreview)} 
                            alt="Preview" 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full opacity-90 hover:opacity-100 cursor-pointer shadow-md transition-all"
                            title="Hapus Foto Produk"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-44 h-44 rounded-2xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 bg-white shrink-0">
                          <ImageIcon size={36} className="text-zinc-300" />
                          <span className="text-xs font-semibold text-zinc-400 mt-2">Belum ada foto</span>
                        </div>
                      )}

                      <div className="w-full text-center space-y-2">
                        <input
                          type="file"
                          id="productDetailImageInput"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="productDetailImageInput"
                          className="inline-flex items-center justify-center space-x-2 w-full py-2.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          <Upload size={14} className="text-theme" />
                          <span>{imagePreview ? 'Ganti Foto Produk' : 'Pilih Foto (JPG/PNG)'}</span>
                        </label>
                        <p className="text-[11px] text-zinc-400 leading-normal">
                          Maks 5MB (.jpg, .jpeg, .png). Otomatis dikompresi dengan Sharp.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Multi-Satuan Bertingkat (Chained Units) */}
                <div className="border-t border-zinc-200 pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-theme" />
                        <span>Multi-Satuan Bertingkat & Skema Harga Eceran/Grosir</span>
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Konversi berantai: isi per tingkat di atasnya (contoh: 1 {formData.unit || 'Karton'} = 20 Renceng, 1 Renceng = 10 Pcs).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAlternateUnit}
                      className="px-3 py-2 bg-theme-light hover:bg-theme-light/80 text-theme border border-theme-light rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      <Plus size={14} />
                      <span>+ Tambah Satuan Turunan</span>
                    </button>
                  </div>

                  {productUnits.length === 0 ? (
                    <div className="p-5 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl text-center text-xs text-zinc-400 space-y-1">
                      <p className="font-semibold text-zinc-600">Hanya menggunakan 1 Satuan Dasar ({formData.unit || 'karton'}).</p>
                      <p>Klik tombol <b>"+ Tambah Satuan Turunan"</b> di atas jika produk ini memiliki kemasan bertingkat seperti Renceng, Pack, atau Pcs.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {productUnits.map((uRow, idx) => {
                        const info = getChainedUnitInfo(
                          idx,
                          productUnits,
                          formData.unit,
                          formData.purchasePrice,
                          formData.sellingPrice
                        );

                        const itemBuy = parseFloat(uRow.purchasePrice) || 0;
                        const itemSell = parseFloat(uRow.sellingPrice) || 0;
                        const itemProfit = itemSell - itemBuy;
                        const itemMargin = itemBuy > 0 ? ((itemProfit / itemBuy) * 100).toFixed(1) : 0;

                        return (
                          <div
                            key={idx}
                            className="p-4 bg-gradient-to-br from-zinc-50 to-theme-light/20 border border-zinc-200 rounded-2xl space-y-3 relative shadow-2xs transition-all"
                          >
                            {/* Card Header with Level Badge & Delete */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-2.5">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-theme text-white flex items-center justify-center text-[10px] font-bold">
                                  {idx + 2}
                                </span>
                                <span className="text-xs font-bold text-zinc-900">
                                  Tingkat {idx + 2} (Turunan dari: <span className="underline uppercase">{info.parentUnitName}</span>)
                                </span>
                                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-theme shadow-3xs">
                                  Total: 1 {formData.unit || 'Dasar'} = {info.totalFactor} {uRow.unitName || 'Satuan'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveAlternateUnit(idx)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                                title="Hapus Satuan Ini"
                              >
                                <Trash2 size={13} />
                                <span>Hapus</span>
                              </button>
                            </div>

                            {/* Inputs Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {/* 1. Nama Satuan */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                                  Nama Satuan Turunan
                                </label>
                                <SearchSelect
                                  options={unitOptions}
                                  value={uRow.unitName}
                                  onChange={(opt) => handleUpdateAlternateUnit(idx, 'unitName', opt ? opt.value : '')}
                                  placeholder="Pilih satuan..."
                                  searchPlaceholder="Cari satuan..."
                                />
                              </div>

                              {/* 2. Isi per Parent Unit */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-700 uppercase block truncate">
                                  1 {info.parentUnitName} Berisi Berapa {uRow.unitName || 'Unit'}?
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    required
                                    min="0.0001"
                                    step="any"
                                    placeholder="e.g. 20"
                                    value={uRow.qtyFactor}
                                    onChange={(e) => handleUpdateAlternateUnit(idx, 'qtyFactor', e.target.value)}
                                    className="w-full pl-3 pr-14 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-800 outline-none focus:border-theme focus:ring-2 focus:ring-zinc-200 h-[38px]"
                                  />
                                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-zinc-400 uppercase pointer-events-none">
                                    {uRow.unitName || 'unit'}
                                  </span>
                                </div>
                              </div>

                              {/* 3. Harga Beli Satuan */}
                              {canViewCost && (
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                                      Harga Beli / HPP (Rp)
                                    </label>
                                    {info.suggestedBuy > 0 && !uRow.purchasePrice && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAlternateUnit(idx, 'purchasePrice', String(info.suggestedBuy))}
                                        className="text-[9px] text-theme hover:underline font-bold"
                                      >
                                        Isi Rp {info.suggestedBuy.toLocaleString('id-ID')}
                                      </button>
                                    )}
                                  </div>
                                  <input
                                    type="number"
                                    placeholder={info.suggestedBuy > 0 ? `Saran: ${info.suggestedBuy}` : '0'}
                                    value={uRow.purchasePrice}
                                    onChange={(e) => handleUpdateAlternateUnit(idx, 'purchasePrice', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-theme h-[38px]"
                                  />
                                </div>
                              )}

                              {/* 4. Harga Jual Satuan */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                                    Harga Jual (Rp)
                                  </label>
                                  {info.suggestedSell > 0 && !uRow.sellingPrice && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAlternateUnit(idx, 'sellingPrice', String(info.suggestedSell))}
                                      className="text-[9px] text-emerald-600 hover:underline font-bold"
                                    >
                                      Isi Rp {info.suggestedSell.toLocaleString('id-ID')}
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  required
                                  placeholder={info.suggestedSell > 0 ? `Saran: ${info.suggestedSell}` : '0'}
                                  value={uRow.sellingPrice}
                                  onChange={(e) => handleUpdateAlternateUnit(idx, 'sellingPrice', e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-theme outline-none focus:border-theme h-[38px]"
                                />
                              </div>
                            </div>

                            {/* Profit Margin Info Strip */}
                            {itemSell > 0 && (
                              <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-zinc-500 font-medium border-t border-zinc-150">
                                <span>
                                  Harga Jual: <b className="font-mono text-theme">Rp {itemSell.toLocaleString('id-ID')}</b> / {uRow.unitName || 'unit'}
                                </span>
                                {itemBuy > 0 && (
                                  <div className="flex items-center space-x-2 font-mono">
                                    <span className="text-emerald-600 font-bold">
                                      Margin: +Rp {itemProfit.toLocaleString('id-ID')} ({itemMargin}%)
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="submit"
                form="productEditForm"
                disabled={saveLoading}
                className="px-5 py-2.5 bg-theme bg-theme-hover text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {saveLoading && <Loader2 size={14} className="animate-spin" />}
                <Save size={14} />
                <span>{saveLoading ? 'Menyimpan...' : 'Simpan Perubahan Barang'}</span>
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
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        type={confirmConfig.type}
        loading={actionLoading || saveLoading}
      />
    </div>
  );
};

export default ProductDetail;

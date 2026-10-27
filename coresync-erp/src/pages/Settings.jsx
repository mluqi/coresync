import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { 
  Building, 
  Landmark, 
  Users, 
  Plus, 
  Loader2, 
  AlertCircle, 
  Check, 
  Trash2, 
  UserX,
  Settings as SettingsIcon,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Edit2,
  Palette,
  Sparkles
} from 'lucide-react';

import ConfirmationModal from '../components/ConfirmationModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useTaxMode } from '../context/TaxModeContext';
import { hasPermission } from '../utils/permission';

const Settings = () => {
  const { user: currentUser, tenant: currentTenant, setTenant } = useAuth();
  const { toast } = useToast();
  const { taxMode, setTaxMode, isTaxAccessLocked, userTaxAccess } = useTaxMode();
  
  const [warehouses, setWarehouses] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [users, setUsers] = useState([]);
  const [tenantProfile, setTenantProfile] = useState({
    companyName: '',
    taxStatus: 'NON_PKP',
    defaultTaxId: '',
    soDiscountsString: '0, 5, 10, 15, 20',
    modules: {}
  });

  const isOwnerOrSuper = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPERADMIN';
  const isOwnerAdmin = isOwnerOrSuper || currentUser?.role === 'ADMIN';

  const canAccessTab = (tabKey) => {
    if (isOwnerOrSuper) return true;
    const lowerKey = tabKey.toLowerCase();
    
    // Tab Warna Tema Aplikasi ('thm') selalu terbuka untuk semua pengguna (preferensi tampilan lokal)
    if (lowerKey === 'thm') return true;

    const userTabs = currentUser?.metadata?.settingsTabs;
    if (userTabs && typeof userTabs === 'object' && userTabs[lowerKey] !== undefined) {
      return !!userTabs[lowerKey];
    }
    // Default fallback if settingsTabs not configured yet on existing user
    if (currentUser?.role === 'ADMIN') {
      if (lowerKey === 'sys') return false; // Profil perusahaan khusus Owner
      return true;
    }
    return false;
  };

  const settingsTabList = [
    { key: 'WH', label: 'Kelola Gudang', icon: Building },
    { key: 'TX', label: 'Master Pajak', icon: Landmark },
    { key: 'MOD', label: 'Mode Operasional', icon: Sparkles },
    { key: 'USR', label: 'Manajemen User', icon: Users },
    { key: 'SYS', label: 'Profil & Modul ERP', icon: SettingsIcon },
    { key: 'THM', label: 'Warna Tema Aplikasi', icon: Palette }
  ];

  const allowedTabs = settingsTabList.filter(tab => canAccessTab(tab.key));

  const [activeSubTab, setActiveSubTab] = useState(() => (canAccessTab('WH') ? 'WH' : (allowedTabs[0]?.key || 'THM')));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Warehouse Modal Form
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [whFormMode, setWhFormMode] = useState('CREATE'); // 'CREATE', 'EDIT'
  const [editingWhId, setEditingWhId] = useState(null);
  const [whForm, setWhForm] = useState({ name: '', address: '', isActive: true, type: 'REGULAR' });
  
  // Tax Modal Form
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxFormMode, setTaxFormMode] = useState('CREATE'); // 'CREATE', 'EDIT'
  const [editingTaxId, setEditingTaxId] = useState(null);
  const [taxForm, setTaxForm] = useState({ name: '', rate: '', isActive: true });

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  // User Modal Form
  const defaultSettingsTabs = {
    wh: false,
    tx: false,
    mod: false,
    usr: false,
    sys: false,
    thm: false
  };

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState('CREATE'); // CREATE, EDIT
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
    warehouseId: '',
    taxAccess: 'ALL', // 'ALL', 'PKP', 'NON_PKP'
    settingsTabs: { ...defaultSettingsTabs },
    permissions: {
      sales: true,
      purchase: true,
      inventory: true,
      finance: true
    }
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  const { appTheme, changeTheme, themePresets } = useTheme();

  const handleSelectTheme = (theme) => {
    changeTheme(theme.id);
    toast.success(`Warna tema aplikasi diubah ke "${theme.name}".`);
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const promises = [];

      if (canAccessTab('WH')) {
        promises.push(
          api.get('/warehouses')
            .then(res => setWarehouses(res.data.data || []))
            .catch(err => console.warn('Gudang fetch error:', err))
        );
      }

      if (canAccessTab('TX')) {
        promises.push(
          api.get('/taxes')
            .then(res => setTaxes(res.data.data || []))
            .catch(err => console.warn('Pajak fetch error:', err))
        );
      }

      if (canAccessTab('USR')) {
        promises.push(
          api.get('/users')
            .then(res => setUsers(res.data.data || []))
            .catch(err => console.warn('Users fetch error:', err))
        );
      }

      if (canAccessTab('SYS')) {
        promises.push(
          api.get('/tenant/settings')
            .then(res => {
              const tp = res.data.data;
              if (tp) {
                const discountList = tp.settings?.salesOrderDiscounts || [0, 5, 10, 15, 20, 25];
                setTenantProfile({
                  companyName: tp.companyName || '',
                  taxStatus: tp.taxStatus || 'NON_PKP',
                  defaultTaxId: tp.defaultTaxId || '',
                  soDiscountsString: discountList.join(', '),
                  modules: tp.modules || {}
                });
              }
            })
            .catch(err => console.warn('Tenant settings fetch error:', err))
        );
      }

      await Promise.all(promises);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat data master.');
      setLoading(false);
    }
  };

  const handleOpenWh = () => {
    setWhFormMode('CREATE');
    setEditingWhId(null);
    setWhForm({ name: '', address: '', isActive: true, type: 'REGULAR' });
    setSaveError('');
    setWhModalOpen(true);
  };

  const handleOpenEditWh = (wh) => {
    setWhFormMode('EDIT');
    setEditingWhId(wh.id);
    setWhForm({ name: wh.name, address: wh.address || '', isActive: wh.isActive !== false, type: wh.type || 'REGULAR' });
    setSaveError('');
    setWhModalOpen(true);
  };

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);
    try {
      if (whFormMode === 'CREATE') {
        await api.post('/warehouses', whForm);
        toast.success(`Gudang "${whForm.name}" berhasil ditambahkan!`);
      } else {
        await api.put(`/warehouses/${editingWhId}`, whForm);
        toast.success(`Gudang "${whForm.name}" berhasil diperbarui!`);
      }
      setSaveLoading(false);
      setWhModalOpen(false);
      fetchSettingsData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan gudang.';
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    }
  };

  const handleDeleteWarehouse = (wh) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Gudang',
      message: `Apakah Anda yakin ingin menghapus gudang "${wh.name}"? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/warehouses/${wh.id}`);
          toast.success(`Gudang "${wh.name}" berhasil dihapus.`);
          fetchSettingsData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus gudang.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleOpenTax = () => {
    setTaxFormMode('CREATE');
    setEditingTaxId(null);
    setTaxForm({ name: '', rate: '', isActive: true });
    setSaveError('');
    setTaxModalOpen(true);
  };

  const handleOpenEditTax = (tax) => {
    setTaxFormMode('EDIT');
    setEditingTaxId(tax.id);
    setTaxForm({ name: tax.name, rate: tax.rate, isActive: tax.isActive !== false });
    setSaveError('');
    setTaxModalOpen(true);
  };

  const handleSaveTax = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);
    try {
      const payload = {
        name: taxForm.name,
        rate: parseFloat(taxForm.rate),
        isActive: taxForm.isActive
      };
      if (taxFormMode === 'CREATE') {
        await api.post('/taxes', payload);
        toast.success(`Tarif pajak "${taxForm.name}" (${taxForm.rate}%) berhasil ditambahkan!`);
      } else {
        await api.put(`/taxes/${editingTaxId}`, payload);
        toast.success(`Tarif pajak "${taxForm.name}" (${taxForm.rate}%) berhasil diperbarui!`);
      }
      setSaveLoading(false);
      setTaxModalOpen(false);
      fetchSettingsData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan pajak.';
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    }
  };

  const handleDeleteTax = (tax) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus Master Pajak',
      message: `Apakah Anda yakin ingin menghapus tarif pajak "${tax.name}"? Data yang terhapus tidak dapat dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/taxes/${tax.id}`);
          toast.success(`Pajak "${tax.name}" berhasil dihapus.`);
          fetchSettingsData();
        } catch (err) {
          const msg = err.response?.data?.message || 'Gagal menghapus pajak.';
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const parseGranularPermissions = (metadataPermissions) => {
    const base = {
      customers: { read: true, create: true, update: true, delete: false },
      suppliers: { read: true, create: true, update: true, delete: false },
      salespersons: { read: true, create: true, update: true, delete: false },
      sales_orders: { read: true, create: true, update: true, delete: false },
      purchase_orders: { read: true, create: true, update: true, delete: false },
      deliveries: { read: true, create: true, update: true, delete: false },
      invoices: { read: true, create: true, update: true, delete: false },
      products: { read: true, create: true, update: true, delete: false, view_cost: false },
      categories: { read: true, create: true, update: true, delete: false },
      units: { read: true, create: true, update: true, delete: false },
      stock_opname: { read: true, create: true, update: true, delete: false },
      stock_transfers: { read: true, create: true, update: true, delete: false },
      stock_ledger: { read: true },
      finance: { read: true, create: true, update: true, delete: false },
      reports: { read: true, sales: true, purchase: true, inventory: true, finance: true }
    };

    if (!metadataPermissions) return base;

    const result = { ...base };
    for (const mod of Object.keys(base)) {
      if (metadataPermissions[mod] && typeof metadataPermissions[mod] === 'object') {
        result[mod] = { ...base[mod], ...metadataPermissions[mod] };
      } else {
        // Legacy fallback mapping
        let legacyFlag = true;
        if (mod === 'customers' || mod === 'suppliers' || mod === 'salespersons') {
          if (metadataPermissions.contacts && typeof metadataPermissions.contacts === 'object') {
            result[mod] = { ...metadataPermissions.contacts };
            continue;
          }
        }
        if (mod === 'sales_orders' || mod === 'deliveries' || mod === 'invoices' || mod === 'purchase_orders') {
          if (metadataPermissions.transactions && typeof metadataPermissions.transactions === 'object') {
            result[mod] = { ...metadataPermissions.transactions };
            continue;
          }
          if (mod === 'purchase_orders') legacyFlag = metadataPermissions.purchase !== false;
          else legacyFlag = metadataPermissions.sales !== false;
        }
        if (mod === 'products' || mod === 'categories' || mod === 'units' || mod === 'stock_opname' || mod === 'stock_transfers' || mod === 'stock_ledger') {
          if (metadataPermissions.products && typeof metadataPermissions.products === 'object') {
            result[mod] = { ...metadataPermissions.products };
            continue;
          }
          legacyFlag = metadataPermissions.inventory !== false;
        }
        if (mod === 'finance') {
          legacyFlag = metadataPermissions.finance !== false;
        }

        if (mod === 'reports') {
          result[mod] = {
            read: true,
            sales: metadataPermissions.sales !== false,
            purchase: metadataPermissions.purchase !== false,
            inventory: metadataPermissions.inventory !== false,
            finance: metadataPermissions.finance !== false
          };
        } else if (mod === 'stock_ledger') {
          result[mod] = { read: legacyFlag };
        } else {
          result[mod] = {
            read: legacyFlag,
            create: legacyFlag,
            update: legacyFlag,
            delete: false
          };
        }
      }
    }
    return result;
  };

  const applyPreset = (presetType) => {
    let p = parseGranularPermissions(null);
    if (presetType === 'SALES') {
      p.customers = { read: true, create: true, update: true, delete: false };
      p.suppliers = { read: false, create: false, update: false, delete: false };
      p.salespersons = { read: true, create: false, update: false, delete: false };
      p.sales_orders = { read: true, create: true, update: true, delete: false };
      p.purchase_orders = { read: false, create: false, update: false, delete: false };
      p.deliveries = { read: true, create: true, update: false, delete: false };
      p.invoices = { read: true, create: false, update: false, delete: false };
      p.products = { read: true, create: false, update: false, delete: false, view_cost: false };
      p.categories = { read: true, create: false, update: false, delete: false };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = { read: false, create: false, update: false, delete: false };
      p.stock_transfers = { read: false, create: false, update: false, delete: false };
      p.stock_ledger = { read: false };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = { read: true, sales: true, purchase: false, inventory: false, finance: false };
    } else if (presetType === 'PURCHASING') {
      p.customers = { read: false, create: false, update: false, delete: false };
      p.suppliers = { read: true, create: true, update: true, delete: false };
      p.salespersons = { read: false, create: false, update: false, delete: false };
      p.sales_orders = { read: false, create: false, update: false, delete: false };
      p.purchase_orders = { read: true, create: true, update: true, delete: false };
      p.deliveries = { read: false, create: false, update: false, delete: false };
      p.invoices = { read: true, create: false, update: false, delete: false };
      p.products = { read: true, create: false, update: false, delete: false, view_cost: true };
      p.categories = { read: true, create: false, update: false, delete: false };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = { read: false, create: false, update: false, delete: false };
      p.stock_transfers = { read: false, create: false, update: false, delete: false };
      p.stock_ledger = { read: false };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = { read: true, sales: false, purchase: true, inventory: false, finance: false };
    } else if (presetType === 'GUDANG') {
      p.customers = { read: false, create: false, update: false, delete: false };
      p.suppliers = { read: false, create: false, update: false, delete: false };
      p.salespersons = { read: false, create: false, update: false, delete: false };
      p.sales_orders = { read: true, create: false, update: false, delete: false };
      p.purchase_orders = { read: true, create: false, update: false, delete: false };
      p.deliveries = { read: true, create: true, update: true, delete: false };
      p.invoices = { read: false, create: false, update: false, delete: false };
      p.products = { read: true, create: true, update: true, delete: false, view_cost: false };
      p.categories = { read: true, create: true, update: true, delete: false };
      p.units = { read: true, create: true, update: true, delete: false };
      p.stock_opname = { read: true, create: true, update: true, delete: false };
      p.stock_transfers = { read: true, create: true, update: true, delete: false };
      p.stock_ledger = { read: true };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = { read: true, sales: false, purchase: false, inventory: true, finance: false };
    } else if (presetType === 'FINANCE') {
      p.customers = { read: true, create: false, update: false, delete: false };
      p.suppliers = { read: true, create: false, update: false, delete: false };
      p.salespersons = { read: true, create: false, update: false, delete: false };
      p.sales_orders = { read: true, create: false, update: false, delete: false };
      p.purchase_orders = { read: true, create: false, update: false, delete: false };
      p.deliveries = { read: true, create: false, update: false, delete: false };
      p.invoices = { read: true, create: true, update: true, delete: false };
      p.products = { read: true, create: false, update: false, delete: false, view_cost: true };
      p.categories = { read: true, create: false, update: false, delete: false };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = { read: false, create: false, update: false, delete: false };
      p.stock_transfers = { read: true, create: false, update: false, delete: false };
      p.stock_ledger = { read: true };
      p.finance = { read: true, create: true, update: true, delete: true };
      p.reports = { read: true, sales: true, purchase: true, inventory: true, finance: true };
    } else if (presetType === 'ADMIN') {
      for (const k of Object.keys(p)) {
        if (typeof p[k] === 'object') {
          for (const a of Object.keys(p[k])) {
            p[k][a] = true;
          }
        }
      }
      setUserForm(prev => ({
        ...prev,
        permissions: p,
        settingsTabs: { wh: true, tx: true, mod: true, usr: true, sys: false, thm: true }
      }));
      return;
    } else if (presetType === 'CLEAR') {
      for (const k of Object.keys(p)) {
        if (typeof p[k] === 'object') {
          for (const a of Object.keys(p[k])) {
            p[k][a] = false;
          }
        }
      }
      setUserForm(prev => ({
        ...prev,
        permissions: p,
        settingsTabs: { wh: false, tx: false, mod: false, usr: false, sys: false, thm: false }
      }));
      return;
    }
    setUserForm(prev => ({ ...prev, permissions: p }));
  };

  const handleOpenUser = () => {
    setUserFormMode('CREATE');
    setEditingUserId(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'STAFF',
      warehouseId: warehouses[0]?.id || '',
      taxAccess: 'ALL',
      settingsTabs: { ...defaultSettingsTabs },
      permissions: parseGranularPermissions(null)
    });
    setSaveError('');
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (userObj) => {
    setUserFormMode('EDIT');
    setEditingUserId(userObj.id);
    
    const savedPermissions = parseGranularPermissions(userObj.metadata?.permissions);
    const savedTaxAccess = userObj.metadata?.taxAccess || 'ALL';
    const savedSettingsTabs = userObj.metadata?.settingsTabs || {
      wh: userObj.role === 'ADMIN' || userObj.role === 'OWNER',
      tx: userObj.role === 'ADMIN' || userObj.role === 'OWNER',
      mod: userObj.role === 'ADMIN' || userObj.role === 'OWNER',
      usr: userObj.role === 'ADMIN' || userObj.role === 'OWNER',
      sys: userObj.role === 'OWNER',
      thm: true
    };

    setUserForm({
      name: userObj.name,
      email: userObj.email,
      password: '', // blank by default on edit
      role: userObj.role,
      warehouseId: userObj.warehouseId || warehouses[0]?.id || '',
      taxAccess: savedTaxAccess,
      settingsTabs: savedSettingsTabs,
      permissions: savedPermissions
    });
    setSaveError('');
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);

    const isFullAccess = userForm.role === 'OWNER' || userForm.role === 'SUPERADMIN';
    const finalPermissions = isFullAccess 
      ? {
          customers: { read: true, create: true, update: true, delete: true },
          suppliers: { read: true, create: true, update: true, delete: true },
          salespersons: { read: true, create: true, update: true, delete: true },
          sales_orders: { read: true, create: true, update: true, delete: true },
          purchase_orders: { read: true, create: true, update: true, delete: true },
          deliveries: { read: true, create: true, update: true, delete: true },
          invoices: { read: true, create: true, update: true, delete: true },
          products: { read: true, create: true, update: true, delete: true, view_cost: true },
          categories: { read: true, create: true, update: true, delete: true },
          units: { read: true, create: true, update: true, delete: true },
          stock_opname: { read: true, create: true, update: true, delete: true },
          stock_transfers: { read: true, create: true, update: true, delete: true },
          stock_ledger: { read: true },
          finance: { read: true, create: true, update: true, delete: true },
          reports: { read: true, sales: true, purchase: true, inventory: true, finance: true }
        }
      : userForm.permissions;

    const finalSettingsTabs = isFullAccess
      ? { wh: true, tx: true, mod: true, usr: true, sys: true, thm: true }
      : (userForm.settingsTabs || defaultSettingsTabs);

    try {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        warehouseId: userForm.role === 'STAFF' ? (parseInt(userForm.warehouseId) || null) : null,
        metadata: {
          permissions: finalPermissions,
          taxAccess: userForm.taxAccess || 'ALL',
          settingsTabs: finalSettingsTabs
        }
      };

      if (userFormMode === 'CREATE') {
        payload.password = userForm.password;
        await api.post('/users', payload);
        toast.success(`Pengguna ${userForm.name} berhasil ditambahkan!`);
      } else {
        if (userForm.password) {
          payload.password = userForm.password;
        }
        await api.put(`/users/${editingUserId}`, payload);
        toast.success(`Data pengguna ${userForm.name} berhasil diperbarui!`);
      }
      setSaveLoading(false);
      setUserModalOpen(false);
      fetchSettingsData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan user.';
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus user ini?')) return;
    setError('');
    try {
      await api.delete(`/users/${userId}`);
      toast.success('Pengguna berhasil dihapus.');
      fetchSettingsData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menghapus user.';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSaveTenantProfile = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);
    try {
      const parsedArray = tenantProfile.soDiscountsString
        .split(',')
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n));

      const res = await api.put('/tenant/settings', {
        companyName: tenantProfile.companyName,
        taxStatus: tenantProfile.taxStatus,
        defaultTaxId: tenantProfile.defaultTaxId ? parseInt(tenantProfile.defaultTaxId) : null,
        settings: {
          ...currentTenant?.settings,
          salesOrderDiscounts: parsedArray,
          taxMode: taxMode
        }
      });
      
      const updatedTenant = {
        ...currentTenant,
        companyName: res.data.data.companyName,
        taxStatus: res.data.data.taxStatus,
        defaultTaxId: res.data.data.defaultTaxId,
        settings: res.data.data.settings
      };
      localStorage.setItem('tenant', JSON.stringify(updatedTenant));
      setTenant(updatedTenant);
      
      setSaveLoading(false);
      fetchSettingsData();
      toast.success('Pengaturan profil perusahaan berhasil disimpan!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan profil perusahaan.';
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    }
  };

  const handleToggleModule = async (moduleName, currentStatus) => {
    setSaveError('');
    try {
      const newStatus = !currentStatus;
      await api.post(`/tenant/modules/${moduleName}/toggle`, { isEnabled: newStatus });
      
      const updatedModules = { ...tenantProfile.modules, [moduleName]: newStatus };
      setTenantProfile({ ...tenantProfile, modules: updatedModules });

      const updatedTenant = {
        ...currentTenant,
        modules: updatedModules
      };
      localStorage.setItem('tenant', JSON.stringify(updatedTenant));
      setTenant(updatedTenant);
      toast.info(`Modul ${moduleName} berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengaktifkan/menonaktifkan modul.';
      setError(msg);
      toast.error(msg);
    }
  };

  const handlePermissionCheckbox = (module, action) => {
    setUserForm({
      ...userForm,
      permissions: {
        ...userForm.permissions,
        [module]: {
          ...userForm.permissions[module],
          [action]: !userForm.permissions[module][action]
        }
      }
    });
  };

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some(t => t.key === activeSubTab)) {
      setActiveSubTab(allowedTabs[0].key);
    }
  }, [allowedTabs, activeSubTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Sistem & Master Data"
        subtitle="Kelola master lokasi gudang, skema pajak PPN, profil perusahaan, dan pengguna sistem."
        icon={SettingsIcon}
      />
      {/* Settings Sub Tabs (Hanya Menampilkan Tab yang Diizinkan) */}
      {allowedTabs.length > 0 && (
        <div className="flex border-b border-zinc-200 bg-white rounded-xl p-1.5 shadow-sm space-x-1 shrink-0 overflow-x-auto">
          {allowedTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSubTab(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'bg-theme text-white shadow-md' 
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 flex flex-col items-center justify-center text-zinc-400 space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm">Memuat data master...</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Warehouse tab */}
          {activeSubTab === 'WH' && (
            <div>
              <div className="h-14 px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                <span className="font-semibold text-zinc-900 text-sm">Daftar Gudang / Cabang Aktif</span>
                <button
                  onClick={handleOpenWh}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Gudang Baru</span>
                </button>
              </div>

              {warehouses.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">Belum ada data gudang.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Nama Gudang</th>
                        <th className="px-6 py-4">Tipe / Fungsi</th>
                        <th className="px-6 py-4">Alamat</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center w-28">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm text-zinc-700">
                      {warehouses.map(wh => (
                        <tr key={wh.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-zinc-900">{wh.name}</td>
                          <td className="px-6 py-4">
                            {wh.type === 'QUARANTINE' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Gudang Retur (Rusak/Karantina)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                Gudang Biasa / Utama
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">{wh.address || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              wh.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                            }`}>
                              {wh.isActive !== false ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleOpenEditWh(wh)}
                                className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded transition-all cursor-pointer"
                                title="Ubah Gudang"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteWarehouse(wh)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition-all cursor-pointer"
                                title="Hapus Gudang"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'TX' && (
            <div>
              <div className="h-14 px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                <span className="font-semibold text-zinc-900 text-sm">Tarif Pajak Penjualan/Pembelian</span>
                <button
                  onClick={handleOpenTax}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Pajak Baru</span>
                </button>
              </div>

              {taxes.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">Belum ada data pajak.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Nama Pajak</th>
                        <th className="px-6 py-4">Tarif</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center w-28">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm text-zinc-700">
                      {taxes.map(tax => (
                        <tr key={tax.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-zinc-900">{tax.name}</td>
                          <td className="px-6 py-4 font-mono font-semibold">{tax.rate}%</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                              tax.isActive !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                            }`}>
                              {tax.isActive !== false ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleOpenEditTax(tax)}
                                className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded transition-all cursor-pointer"
                                title="Ubah Pajak"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteTax(tax)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition-all cursor-pointer"
                                title="Hapus Pajak"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'USR' && isOwnerAdmin && (
            <div>
              <div className="h-14 px-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                <span className="font-semibold text-zinc-900 text-sm">Daftar Akun Pengguna (Users)</span>
                <button
                  onClick={handleOpenUser}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Tambah User</span>
                </button>
              </div>

              {users.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">Belum ada data user.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-5 py-4">Nama Lengkap</th>
                        <th className="px-5 py-4">Email</th>
                        <th className="px-3 py-4">Role</th>
                        <th className="px-3 py-4">Lingkup Pajak</th>
                        <th className="px-3 py-4">Akses Pengaturan</th>
                        <th className="px-4 py-4">Akses Modul</th>
                        <th className="px-4 py-4">Gudang Tugas</th>
                        <th className="px-4 py-4 text-center">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm text-zinc-700">
                      {users.filter(u => u.role !== 'SUPERADMIN').map(u => {
                        return (
                          <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-5 py-4 font-bold text-zinc-900">{u.name}</td>
                            <td className="px-5 py-4 font-mono text-xs text-zinc-500">{u.email}</td>
                            <td className="px-3 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide uppercase border ${
                                u.role === 'SUPERADMIN'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : u.role === 'OWNER' 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                  : u.role === 'ADMIN'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              {u.metadata?.taxAccess === 'PKP' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-300">
                                  PKP
                                </span>
                              ) : u.metadata?.taxAccess === 'NON_PKP' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-300">
                                  NON PKP
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  SEMUA
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap">
                              {u.role === 'OWNER' || u.role === 'SUPERADMIN' ? (
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                  Semua Tab
                                </span>
                              ) : (
                                (() => {
                                  const tabs = u.metadata?.settingsTabs;
                                  const count = tabs ? Object.values(tabs).filter(Boolean).length : (u.role === 'ADMIN' ? 5 : 0);
                                  return count > 0 ? (
                                    <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                                      {count} Tab Aktif
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-zinc-400 italic">
                                      Tidak Ada
                                    </span>
                                  );
                                })()
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {u.role === 'OWNER' || u.role === 'SUPERADMIN' ? (
                                <span className="text-xs text-zinc-400 italic font-semibold">Full Access</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                  {hasPermission(u, 'transactions', 'read') && (
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Transaksi</span>
                                  )}
                                  {hasPermission(u, 'products', 'read') && (
                                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Barang & Stok</span>
                                  )}
                                  {hasPermission(u, 'contacts', 'read') && (
                                    <span className="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Kontak</span>
                                  )}
                                  {hasPermission(u, 'finance', 'read') && (
                                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Keuangan</span>
                                  )}
                                  {hasPermission(u, 'units', 'read') && (
                                    <span className="bg-zinc-100 text-zinc-700 border border-zinc-250 px-1.5 py-0.5 rounded text-[10px] font-bold">Satuan</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 font-semibold text-zinc-900">{u.warehouse?.name || 'Seluruh Gudang'}</td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded transition-all cursor-pointer"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  disabled={u.id === currentUser.id}
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded transition-all cursor-pointer disabled:opacity-40"
                                >
                                  <UserX size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'SYS' && isOwnerAdmin && (
            <div className="p-6 space-y-8">
              {/* Company Profile Edit */}
              <form onSubmit={handleSaveTenantProfile} className="space-y-4 max-w-xl">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Profil Perusahaan Tenant</h4>
                
                {saveError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle size={14} />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 block">Nama Perusahaan (White-Label)</label>
                  <input
                    type="text"
                    required
                    value={tenantProfile.companyName}
                    onChange={(e) => setTenantProfile({ ...tenantProfile, companyName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 block">Status PKP</label>
                    <select
                      value={tenantProfile.taxStatus}
                      onChange={(e) => setTenantProfile({ ...tenantProfile, taxStatus: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                    >
                      <option value="PKP">PKP (Perusahaan Kena Pajak)</option>
                      <option value="NON_PKP">NON PKP (Bebas Pajak)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 block">Default Pajak PPN</label>
                    <select
                      value={tenantProfile.defaultTaxId}
                      onChange={(e) => setTenantProfile({ ...tenantProfile, defaultTaxId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                    >
                      <option value="">Tanpa Pajak</option>
                      {taxes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 block">Pilihan Diskon Penjualan (%)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 0, 5, 10, 15, 20"
                    value={tenantProfile.soDiscountsString}
                    onChange={(e) => setTenantProfile({ ...tenantProfile, soDiscountsString: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                  <p className="text-[10px] text-zinc-400">Masukkan nilai persentase dipisahkan tanda koma (contoh: 0, 5, 10, 15, 20).</p>
                </div>

                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-indigo-400"
                >
                  {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan Profil</span>
                </button>
              </form>

              {/* Read-only ERP Modules Display */}
              <div className="border-t border-zinc-200 pt-6 space-y-4 max-w-xl">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Status Modul Fitur ERP</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Modul ERP ini dikelola dan diaktifkan oleh SuperAdmin Platform berdasarkan paket langganan tenant.</p>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldCheck size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-bold">Pengaturan Terpusat SuperAdmin</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Aktivasi dan konfigurasi lisensi modul ERP hanya dapat diubah oleh SuperAdmin di Halaman Management SuperAdmin.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'SALES', name: 'Modul Penjualan (Sales)' },
                    { key: 'PURCHASE', name: 'Modul Pembelian (Purchasing)' },
                    { key: 'INVENTORY', name: 'Modul FIFO Inventory' },
                    { key: 'FINANCE', name: 'Modul Finance & Akuntansi' }
                  ].map(mod => {
                    const isEnabled = tenantProfile.modules[mod.key] !== false;
                    return (
                      <div key={mod.key} className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <span className="font-semibold text-zinc-800 text-xs">{mod.name}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          isEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                        }`}>
                          {isEnabled ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Operational Tax Mode Tab */}
          {activeSubTab === 'MOD' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-zinc-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 flex items-center space-x-2">
                      <Sparkles className="text-amber-500" size={20} />
                      <span>Mode Operasional Sistem (Lensa Data Global)</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Pilih mode operasional aktif untuk memfilter seluruh katalog barang, transaksi penjualan/pembelian, dan laporan secara otomatis.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500">Status Saat Ini:</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                      taxMode === 'PKP'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                        : taxMode === 'NON_PKP'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                    }`}>
                      {taxMode === 'PKP' ? '🟢 Mode PKP (PPN)' : taxMode === 'NON_PKP' ? '⚪ Mode Non-PKP' : '🌐 Semua Data (Default)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notice Banner if Locked by Admin */}
              {isTaxAccessLocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center space-x-3 text-amber-800 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    <strong>Pemberitahuan:</strong> Mode operasional akun Anda saat ini dikunci ke <strong>{userTaxAccess === 'PKP' ? 'Khusus PKP' : 'Khusus Non-PKP'}</strong> oleh konfigurasi hak akses Administrator.
                  </span>
                </div>
              )}

              {/* Mode Selection Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. ALL DATA */}
                <div
                  onClick={() => {
                    setTaxMode('ALL');
                    toast.success('Mode operasional diubah ke "Semua Data". Seluruh barang dan transaksi ditampilkan.');
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                    taxMode === 'ALL'
                      ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Mode Default
                      </span>
                      {taxMode === 'ALL' && (
                        <span className="p-1 rounded-full bg-indigo-600 text-white shrink-0 shadow-2xs">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900">Semua Data (Gabungan)</h4>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        Menampilkan seluruh katalog produk dan transaksi tanpa filter pajak (seperti sistem awal). Pilihan PPN dapat diatur bebas per faktur.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200/80 text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>Cakupan Data:</span>
                    <strong className="text-zinc-800">PKP & Non-PKP</strong>
                  </div>
                </div>

                {/* 2. PKP MODE */}
                <div
                  onClick={() => {
                    setTaxMode('PKP');
                    toast.success('Mode operasional diubah ke "Mode PKP". Hanya menampilkan barang dan transaksi ber-PPN.');
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                    taxMode === 'PKP'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Kena Pajak
                      </span>
                      {taxMode === 'PKP' && (
                        <span className="p-1 rounded-full bg-emerald-600 text-white shrink-0 shadow-2xs">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900">Mode PKP (PPN)</h4>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        Khusus untuk transaksi resmi berfaktur pajak PPN. Katalog barang dan form transaksi otomatis difokuskan ke barang-barang PKP.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200/80 text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>Cakupan Data:</span>
                    <strong className="text-emerald-700">Khusus Faktur PPN</strong>
                  </div>
                </div>

                {/* 3. NON-PKP MODE */}
                <div
                  onClick={() => {
                    setTaxMode('NON_PKP');
                    toast.success('Mode operasional diubah ke "Mode Non-PKP". Hanya menampilkan barang dan transaksi bebas PPN.');
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                    taxMode === 'NON_PKP'
                      ? 'border-amber-600 bg-amber-50/50 shadow-md ring-2 ring-amber-500/20'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Bebas Pajak
                      </span>
                      {taxMode === 'NON_PKP' && (
                        <span className="p-1 rounded-full bg-amber-600 text-white shrink-0 shadow-2xs">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900">Mode Non-PKP</h4>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                        Khusus melayani toko tradisional, kelontong, dan pasar basah. Form pesanan baru otomatis bebas PPN dan produk non-PKP.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-200/80 text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>Cakupan Data:</span>
                    <strong className="text-amber-800">Pasar Tradisional / Bebas Pajak</strong>
                  </div>
                </div>
              </div>

              {/* Informational Guidance Alert */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600 space-y-1">
                <p className="font-bold text-zinc-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Bagaimana Mode Ini Bekerja?</span>
                </p>
                <p className="leading-relaxed">
                  Ketika Anda mengganti mode operasional di atas, CoreSync ERP secara otomatis menyesuaikan tampilan daftar barang di <strong>Master Barang</strong>, daftar transaksi penjualan di <strong>Sales Order</strong>, dan perhitungan omset di <strong>Laporan Keuangan</strong> sesuai dengan mode yang Anda pilih, tanpa mengubah ataupun menghapus riwayat data transaksi Anda.
                </p>
              </div>
            </div>
          )}

          {/* App Theme Color Customization Tab */}
          {activeSubTab === 'THM' && (
            <div className="p-6 space-y-6">
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-base font-bold text-zinc-900 flex items-center space-x-2">
                  <Palette className="text-indigo-600" size={20} />
                  <span>Kustomisasi Warna Tema Aplikasi</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Pilih skema warna aksen yang akan diterapkan pada antarmuka ERP perangkat ini. Preferensi disimpan di localStorage browser.</p>
              </div>

              {/* Theme Preset Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {themePresets.map((t) => {
                  const isSelected = appTheme === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTheme(t)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                        isSelected 
                          ? `${t.border} bg-zinc-50/80 shadow-md ring-2 ${t.ring}` 
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${t.gradient} shadow-sm shrink-0 flex items-center justify-center text-white font-bold`}>
                            {t.id.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-zinc-900">{t.name}</h4>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{t.desc}</p>
                          </div>
                        </div>

                        {isSelected && (
                          <span className={`p-1 rounded-full text-white ${t.bg} shrink-0`}>
                            <Check size={12} />
                          </span>
                        )}
                      </div>

                      {/* Swatch Preview Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>Aksen Utama</span>
                          <span className="font-bold">{t.hex}</span>
                        </div>
                        <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${t.gradient}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WH Modal */}
      {whModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">
              {whFormMode === 'CREATE' ? 'Tambah Gudang Baru' : 'Edit Detail Gudang'}
            </h3>
            {saveError && <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">{saveError}</div>}
            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Gudang</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gudang Utama Jakarta"
                  value={whForm.name}
                  onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat Lengkap</label>
                <textarea
                  required
                  placeholder="Alamat gudang..."
                  rows={3}
                  value={whForm.address}
                  onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Fungsi & Tipe Gudang</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWhForm({ ...whForm, type: 'REGULAR' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      whForm.type !== 'QUARANTINE'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Gudang Biasa / Utama
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                      Stok siap jual, pengiriman Sales Order, & penerimaan PO.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWhForm({ ...whForm, type: 'QUARANTINE' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      whForm.type === 'QUARANTINE'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Gudang Retur (Rusak)
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-snug">
                      Khusus retur rusak/karantina. Tidak bisa dijual, siap dimusnahkan.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Status Operasional</label>
                <select
                  value={whForm.isActive ? 'true' : 'false'}
                  onChange={(e) => setWhForm({ ...whForm, isActive: e.target.value === 'true' })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button type="button" onClick={() => setWhModalOpen(false)} className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer">Batal</button>
                <button type="submit" disabled={saveLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
                  <span>{whFormMode === 'CREATE' ? 'Simpan Gudang' : 'Update Gudang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Modal */}
      {taxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">
              {taxFormMode === 'CREATE' ? 'Tambah Pajak Baru' : 'Edit Master Pajak'}
            </h3>
            {saveError && <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">{saveError}</div>}
            <form onSubmit={handleSaveTax} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Pajak</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PPN 11%"
                  value={taxForm.name}
                  onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Tarif Pajak (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="11"
                  value={taxForm.rate}
                  onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-mono font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Status Tarif</label>
                <select
                  value={taxForm.isActive ? 'true' : 'false'}
                  onChange={(e) => setTaxForm({ ...taxForm, isActive: e.target.value === 'true' })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button type="button" onClick={() => setTaxModalOpen(false)} className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer">Batal</button>
                <button type="submit" disabled={saveLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
                  <span>{taxFormMode === 'CREATE' ? 'Simpan Pajak' : 'Update Pajak'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative overflow-hidden max-h-[90vh] flex flex-col">
            <h3 className="text-lg font-bold text-zinc-900 mb-2">
              {userFormMode === 'CREATE' ? 'Tambah Akun Pengguna Baru' : 'Edit Pengaturan Pengguna'}
            </h3>
            
            {saveError && <div className="mb-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">{saveError}</div>}
            
            <form onSubmit={handleSaveUser} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Alamat Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@perusahaan.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                  Kata Sandi (Password) {userFormMode === 'EDIT' && '(Kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  required={userFormMode === 'CREATE'}
                  placeholder="Minimal 6 karakter"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Role Akses</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>
                {userForm.role === 'STAFF' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Gudang Tugas</label>
                    <select
                      value={userForm.warehouseId}
                      onChange={(e) => setUserForm({ ...userForm, warehouseId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* 1. Lingkup Akses Transaksi Pajak (PKP / NON PKP / SEMUA) */}
              <div className="border-t border-zinc-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                    Lingkup Akses Transaksi Pajak
                  </label>
                  <span className="text-[10px] text-zinc-400 font-medium">Filter data operasional</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, taxAccess: 'ALL' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      userForm.taxAccess === 'ALL'
                        ? 'bg-zinc-800 text-white border-zinc-800 shadow-xs'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    <p className="text-xs font-black leading-none">SEMUA</p>
                    <p className={`text-[10px] mt-1 leading-tight ${userForm.taxAccess === 'ALL' ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      Bebas PKP & Non
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, taxAccess: 'PKP' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      userForm.taxAccess === 'PKP'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                    }`}
                  >
                    <p className="text-xs font-black leading-none">KHUSUS PKP</p>
                    <p className={`text-[10px] mt-1 leading-tight ${userForm.taxAccess === 'PKP' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                      Hanya data PPN
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserForm({ ...userForm, taxAccess: 'NON_PKP' })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      userForm.taxAccess === 'NON_PKP'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/60'
                    }`}
                  >
                    <p className="text-xs font-black leading-none">NON PKP</p>
                    <p className={`text-[10px] mt-1 leading-tight ${userForm.taxAccess === 'NON_PKP' ? 'text-amber-100' : 'text-amber-700'}`}>
                      Hanya non-PPN
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Hak Akses Tab Menu Pengaturan (Settings Permissions) */}
              {userForm.role !== 'OWNER' && userForm.role !== 'SUPERADMIN' && (
                <div className="border-t border-zinc-200 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                        Hak Akses Tab Pengaturan
                      </label>
                      <p className="text-[10px] text-zinc-400">Pilih tab apa saja yang boleh dibuka oleh user di halaman Pengaturan</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setUserForm(prev => ({
                          ...prev,
                          settingsTabs: { wh: true, tx: true, mod: true, usr: true, sys: false, thm: true }
                        }))}
                        className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setUserForm(prev => ({
                          ...prev,
                          settingsTabs: { wh: false, tx: false, mod: false, usr: false, sys: false, thm: false }
                        }))}
                        className="text-[10px] text-zinc-400 font-bold hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-2.5">
                    {[
                      { key: 'wh', label: 'Kelola Gudang', icon: Building },
                      { key: 'tx', label: 'Master Pajak', icon: Landmark },
                      { key: 'mod', label: 'Mode Operasional', icon: Sparkles },
                      { key: 'usr', label: 'Manajemen User', icon: Users },
                      { key: 'sys', label: 'Profil & Modul ERP', icon: SettingsIcon },
                      { key: 'thm', label: 'Warna Tema', icon: Palette }
                    ].map(tabItem => {
                      const Icon = tabItem.icon;
                      const isChecked = !!userForm.settingsTabs?.[tabItem.key];
                      return (
                        <label
                          key={tabItem.key}
                          className={`flex items-center space-x-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-white border-indigo-300 text-indigo-900 shadow-2xs'
                              : 'border-zinc-200/80 text-zinc-500 hover:bg-white/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUserForm(prev => ({
                                ...prev,
                                settingsTabs: {
                                  ...prev.settingsTabs,
                                  [tabItem.key]: checked
                                }
                              }));
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <Icon size={14} className={isChecked ? 'text-indigo-600' : 'text-zinc-400'} />
                          <span className="truncate">{tabItem.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Granular Module Level Permissions checklist */}
              {userForm.role !== 'OWNER' && userForm.role !== 'SUPERADMIN' && (
                <div className="border-t border-zinc-200 pt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                      Hak Akses Granular Modul
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase">Template Preset:</span>
                      <button
                        type="button"
                        onClick={() => applyPreset('SALES')}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('PURCHASING')}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Purchasing
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('GUDANG')}
                        className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Gudang
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('FINANCE')}
                        className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Finance
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('ADMIN')}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Full Akses
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('CLEAR')}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-72 border border-zinc-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase z-10">
                        <tr>
                          <th className="px-3.5 py-2">Modul ERP</th>
                          <th className="px-2.5 py-2 text-center w-16">Lihat</th>
                          <th className="px-2.5 py-2 text-center w-16">Tambah</th>
                          <th className="px-2.5 py-2 text-center w-16">Ubah</th>
                          <th className="px-2.5 py-2 text-center w-16">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                        {[
                          { group: '1. Master Kontak', key: 'customers', name: 'Pelanggan (Customer)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '1. Master Kontak', key: 'suppliers', name: 'Pemasok (Supplier)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '1. Master Kontak', key: 'salespersons', name: 'Sales Person', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '2. Transaksi Operasional', key: 'sales_orders', name: 'Sales Order (SO)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '2. Transaksi Operasional', key: 'purchase_orders', name: 'Purchase Order (PO)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '2. Transaksi Operasional', key: 'deliveries', name: 'Surat Jalan (SJ)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '2. Transaksi Operasional', key: 'invoices', name: 'Faktur (Invoice/Bills)', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'products', name: 'Master Katalog Barang', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'categories', name: 'Kategori Barang', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'units', name: 'Satuan Barang', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'stock_opname', name: 'Stock Opname', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'stock_transfers', name: 'Mutasi Stok Antar Gudang', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '3. Master Barang & Inventori', key: 'stock_ledger', name: 'Kartu Stok (Ledger)', actions: ['read'] },
                          { group: '4. Keuangan & Akuntansi', key: 'finance', name: 'Kas, Bank & Jurnal', actions: ['read', 'create', 'update', 'delete'] },
                          { group: '5. Laporan ERP', key: 'reports', name: 'Laporan (Sales, PO, Stok, Fin)', isReport: true, actions: ['sales', 'purchase', 'inventory', 'finance'] }
                        ].map((m, idx, arr) => {
                          const isFirstInGroup = idx === 0 || arr[idx - 1].group !== m.group;
                          return (
                            <React.Fragment key={m.key}>
                              {isFirstInGroup && (
                                <tr className="bg-zinc-100/70 border-y border-zinc-200">
                                  <td colSpan="5" className="px-3.5 py-1 text-[11px] font-bold text-zinc-700 uppercase tracking-wider">
                                    {m.group}
                                  </td>
                                </tr>
                              )}
                              <tr className="hover:bg-zinc-50/60 transition-colors">
                                <td className="px-3.5 py-1.5 text-zinc-900 font-semibold">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                    <span>{m.name}</span>
                                  </div>
                                  {m.key === 'products' && (
                                    <label className="mt-1 flex items-center space-x-1.5 text-[10px] text-amber-750 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer w-fit hover:bg-amber-100/60 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={!!userForm.permissions.products?.view_cost}
                                        onChange={() => handlePermissionCheckbox('products', 'view_cost')}
                                        className="w-3 h-3 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-amber-900">Lihat Harga Beli & HPP</span>
                                    </label>
                                  )}
                                </td>

                                {m.isReport ? (
                                  <td colSpan="4" className="px-2.5 py-1.5 text-center">
                                    <div className="flex items-center justify-center space-x-3 text-[11px]">
                                      {['sales', 'purchase', 'inventory', 'finance'].map(repKey => {
                                        const isChecked = !!(userForm.permissions.reports && userForm.permissions.reports[repKey]);
                                        const repLabels = { sales: 'Penjualan', purchase: 'Pembelian', inventory: 'Stok', finance: 'Keuangan' };
                                        return (
                                          <label key={repKey} className="inline-flex items-center space-x-1 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handlePermissionCheckbox('reports', repKey)}
                                              className="w-3.5 h-3.5 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="text-zinc-600 font-semibold">{repLabels[repKey]}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </td>
                                ) : (
                                  ['read', 'create', 'update', 'delete'].map(action => {
                                    const isSupported = m.actions.includes(action);
                                    const isChecked = isSupported && !!(userForm.permissions[m.key] && userForm.permissions[m.key][action]);
                                    return (
                                      <td key={action} className="px-2.5 py-1.5 text-center">
                                        {isSupported ? (
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handlePermissionCheckbox(m.key, action)}
                                            className="w-3.5 h-3.5 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                                          />
                                        ) : (
                                          <span className="text-zinc-300 font-mono text-[10px]">—</span>
                                        )}
                                      </td>
                                    );
                                  })
                                )}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
                <button type="button" onClick={() => setUserModalOpen(false)} className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer">Batal</button>
                <button type="submit" disabled={saveLoading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
                  <span>{userFormMode === 'CREATE' ? 'Simpan User' : 'Update User'}</span>
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
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Settings;

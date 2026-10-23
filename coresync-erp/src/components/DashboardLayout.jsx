import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTaxMode } from '../context/TaxModeContext';
import { useToast } from '../context/ToastContext';
import { hasPermission } from '../utils/permission';
import api from '../utils/api';
import getImageUrl from '../utils/imageUrl';
import ConfirmationModal from './ConfirmationModal';
import { 
  LayoutDashboard, 
  Package, 
  Users,
  ClipboardList, 
  History,
  ArrowRightLeft, 
  ArrowLeftRight,
  Wallet, 
  LogOut, 
  Menu, 
  X, 
  Building,
  User,
  ShieldCheck,
  Layers,
  Settings,
  UserCheck,
  BarChart2,
  Scale,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Boxes,
  ShoppingCart,
  Truck,
  HelpCircle
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const { user, tenant, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tenantsList, setTenantsList] = useState([]);
  const [activeTenant, setActiveTenant] = useState('');
  const { taxMode } = useTaxMode();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const profileDropdownRef = useRef(null);

  // Badge Counts State
  const [badgeCounts, setBadgeCounts] = useState({
    salesOrders: 0,
    purchaseOrders: 0,
    deliveries: 0,
    finance: 0,
    stockOpname: 0,
    lowStock: 0,
    transactionsTotal: 0,
    inventoryTotal: 0
  });

  const fetchBadgeCounts = async () => {
    if (!user) return;
    try {
      const res = await api.get('/reports/badge-counts');
      if (res.data && res.data.data) {
        setBadgeCounts(res.data.data);
      }
    } catch (err) {
      console.debug('Failed to fetch badge counts:', err);
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
    const interval = setInterval(fetchBadgeCounts, 30000); // 30s polling
    const handleRefresh = () => fetchBadgeCounts();
    window.addEventListener('cs:refresh-badges', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('cs:refresh-badges', handleRefresh);
    };
  }, [user, location.pathname]);

  const getBadgeCount = (key) => {
    if (!key || !badgeCounts) return 0;
    return Number(badgeCounts[key]) || 0;
  };

  const getGroupBadgeCount = (item) => {
    if (item.children) {
      return item.children.reduce((acc, c) => acc + (c.badgeKey ? getBadgeCount(c.badgeKey) : 0), 0);
    }
    return getBadgeCount(item.badgeKey);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  const canAccessSettings = !!user;

  useEffect(() => {
    if (user && user.role === 'SUPERADMIN') {
      api.get('/tenant')
        .then(res => {
          setTenantsList(res.data.data);
        })
        .catch(err => console.error(err));
      
      const storedActiveId = localStorage.getItem('activeTenantId');
      if (storedActiveId) {
        setActiveTenant(storedActiveId);
      }
    }
  }, [user]);

  // Find the currently active tenant label for display
  const activeTenantInfo = tenantsList.find(t => String(t.id) === String(activeTenant));

  const handleTenantChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      localStorage.removeItem('activeTenantId');
    } else {
      localStorage.setItem('activeTenantId', val);
    }
    setActiveTenant(val);
    window.location.reload();
  };

  const menuConfig = [
    {
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard
    },
    {
      name: 'Master Data',
      icon: Boxes,
      children: [
        { name: 'Master Barang', path: '/products', icon: Package, module: 'INVENTORY', permKey: 'products', badgeKey: 'lowStock', badgeType: 'warning' },
        { name: 'Kategori Barang', path: '/categories', icon: Layers, module: 'INVENTORY', permKey: 'categories' },
        { name: 'Satuan Barang', path: '/units', icon: Scale, module: 'INVENTORY', permKey: 'units' },
        { name: 'Pelanggan (Customer)', path: '/customers', icon: ShoppingCart, module: 'SALES', permKey: 'customers' },
        { name: 'Pemasok (Supplier)', path: '/suppliers', icon: Truck, module: 'PURCHASE', permKey: 'suppliers' },
        { name: 'Sales Person', path: '/salespersons', icon: UserCheck, module: 'SALES', permKey: 'salespersons' },
        { name: 'Driver & Armada', path: '/drivers', icon: Truck, module: 'SALES', permKey: 'salespersons' },
      ]
    },
    {
      name: 'Stok & Inventori',
      icon: ClipboardList,
      children: [
        { name: 'Stock Opname', path: '/stock-opname', icon: ClipboardList, module: 'INVENTORY', permKey: 'stock_opname', badgeKey: 'stockOpname', badgeType: 'amber' },
        { name: 'Mutasi Antar Gudang', path: '/stock-transfers', icon: ArrowLeftRight, module: 'INVENTORY', permKey: 'inventory' },
        { name: 'Kartu Stok', path: '/stock-ledger', icon: History, module: 'INVENTORY', permKey: 'stock_ledger' },
      ]
    },
    {
      name: 'Transaksi',
      icon: ArrowRightLeft,
      children: [
        { name: 'Penjualan (Sales)', path: '/transactions/sales', icon: ShoppingCart, module: 'SALES', permKey: 'sales_orders', badgeKey: 'salesOrders', badgeType: 'amber' },
        { name: 'Pembelian (Purchase)', path: '/transactions/purchases', icon: Truck, module: 'PURCHASE', permKey: 'purchase_orders', badgeKey: 'purchaseOrders', badgeType: 'indigo' },
        { name: 'Manifest Pengiriman', path: '/delivery-manifest', icon: Truck, module: 'SALES', permKey: 'deliveries', badgeKey: 'deliveries', badgeType: 'emerald' },
      ]
    },
    {
      name: 'Keuangan',
      path: '/finance',
      icon: Wallet,
      module: 'FINANCE',
      permKey: 'finance',
      badgeKey: 'finance',
      badgeType: 'rose'
    },
    {
      name: 'Laporan',
      path: '/reports',
      icon: BarChart2,
      permKey: ['reports.sales', 'reports.purchase', 'reports.inventory', 'reports.finance']
    },
    {
      name: 'Panduan Staff',
      path: '/help',
      icon: HelpCircle
    },
    {
      name: 'Sistem & Log',
      icon: ShieldCheck,
      children: [
        { name: 'Log Aktivitas & Akses', path: '/logs', icon: History, superadminOnly: true },
        { name: 'Super Admin', path: '/super-admin', icon: ShieldAlert, superadminOnly: true }
      ]
    }
  ];

  const isItemVisible = (item) => {
    if (item.superadminOnly) {
      return user && user.role === 'SUPERADMIN';
    }

    if (item.roleRequired) {
      if (!user) return false;
      if (user.role === 'SUPERADMIN') return true;
      if (!item.roleRequired.includes(user.role)) return false;
    }

    if (item.module) {
      if (!tenant || !tenant.modules) return true;
      const isModuleEnabled = Array.isArray(item.module)
        ? item.module.some(m => tenant.modules[m] !== false)
        : tenant.modules[item.module] !== false;
      if (!isModuleEnabled) return false;
    }

    if (!user) return true;
    if (user.role === 'SUPERADMIN' || user.role === 'OWNER') return true;

    if (item.permKey) {
      if (Array.isArray(item.permKey)) {
        return item.permKey.some(pk => {
          if (pk.includes('.')) {
            const [m, a] = pk.split('.');
            return hasPermission(user, m, a);
          }
          return hasPermission(user, pk, 'read');
        });
      }
      if (item.permKey.includes('.')) {
        const [m, a] = item.permKey.split('.');
        return hasPermission(user, m, a);
      }
      return hasPermission(user, item.permKey, 'read');
    }

    return true;
  };

  const [openSubmenus, setOpenSubmenus] = useState({
    'Master Data': true,
    'Stok & Inventori': true,
    'Transaksi': true,
    'Sistem & Log': true
  });

  useEffect(() => {
    menuConfig.forEach(group => {
      if (group.children) {
        const hasActiveChild = group.children.some(child => child.path === location.pathname);
        if (hasActiveChild) {
          setOpenSubmenus(prev => ({ ...prev, [group.name]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleSubmenu = (groupName) => {
    setOpenSubmenus(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    setConfirmLogoutOpen(true);
  };

  const handleConfirmLogout = () => {
    setConfirmLogoutOpen(false);
    logout();
    toast({
      title: 'Berhasil Keluar',
      description: 'Anda telah berhasil logout dari sesi akun.',
      type: 'success'
    });
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-zinc-50/70 font-sans relative overflow-x-clip antialiased">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="md:hidden fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs transition-opacity duration-200"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-zinc-200/80 flex flex-col transform transition-all duration-200 ease-in-out shadow-xs ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20 overflow-hidden'
        }`}
      >
        {/* Branding header */}
        <div className="h-16 px-4 sm:px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-theme-gradient flex items-center justify-center text-white font-extrabold text-xs shadow-xs ring-1 ring-black/5 shrink-0 uppercase tracking-tight">
              {tenant?.companyName ? tenant.companyName.substring(0, 2) : 'CS'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <span className="font-extrabold text-zinc-900 tracking-tight text-sm truncate block leading-tight" title={tenant?.companyName || 'CoreSync ERP'}>
                  {tenant?.companyName || 'CoreSync ERP'}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase block leading-tight mt-0.5">
                  Enterprise Suite
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="md:hidden p-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto">
          {menuConfig.map((item) => {
            const Icon = item.icon;

            // Single Menu Item (No Submenu)
            if (!item.children) {
              if (!isItemVisible(item)) return null;
              const isActive = location.pathname === item.path;
              const isSuperAdminItem = !!item.superadminOnly;
              const singleCount = getGroupBadgeCount(item);

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.path);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    isSuperAdminItem
                      ? isActive
                        ? 'bg-rose-50 text-rose-700 shadow-2xs border border-rose-200'
                        : 'text-rose-600 hover:bg-rose-50/70 font-medium'
                      : isActive
                        ? 'bg-theme-light text-theme shadow-2xs border border-theme-light font-bold'
                        : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 font-medium'
                  }`}
                  title={!sidebarOpen && singleCount > 0 ? `${item.name} (${singleCount})` : item.name}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon size={18} className={
                        isSuperAdminItem
                          ? isActive ? 'text-rose-600' : 'text-rose-400'
                          : isActive ? 'text-theme' : 'text-zinc-500'
                      } />
                      {!sidebarOpen && singleCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-1 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
                          {singleCount > 9 ? '9+' : singleCount}
                        </span>
                      )}
                    </div>
                    {sidebarOpen && <span className="truncate">{item.name}</span>}
                  </div>
                  {sidebarOpen && singleCount > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-all shrink-0 ml-2 ${
                      isActive
                        ? 'bg-white text-theme shadow-2xs'
                        : item.badgeType === 'rose'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200/80'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                      {singleCount > 99 ? '99+' : singleCount}
                    </span>
                  )}
                </button>
              );
            }

            // Submenu Item (With Children)
            const visibleChildren = item.children.filter(isItemVisible);
            if (visibleChildren.length === 0) return null;

            const isOpen = !!openSubmenus[item.name];
            const hasActiveChild = visibleChildren.some(child => child.path === location.pathname);
            const groupCount = getGroupBadgeCount(item);

            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => {
                    if (!sidebarOpen) setSidebarOpen(true);
                    toggleSubmenu(item.name);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    hasActiveChild
                      ? 'text-theme bg-theme-light/70 font-black'
                      : 'text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-800'
                  }`}
                  title={!sidebarOpen && groupCount > 0 ? `${item.name} (${groupCount})` : item.name}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon size={17} className={hasActiveChild ? 'text-theme' : 'text-zinc-400'} />
                      {!sidebarOpen && groupCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 px-1 bg-amber-500 text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs">
                          {groupCount > 9 ? '9+' : groupCount}
                        </span>
                      )}
                    </div>
                    {sidebarOpen && <span className="truncate">{item.name}</span>}
                  </div>
                  {sidebarOpen && (
                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      {groupCount > 0 && (
                        <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded-full transition-all ${
                          hasActiveChild
                            ? 'bg-theme text-white shadow-2xs'
                            : 'bg-amber-100 text-amber-800 border border-amber-200/70'
                        }`}>
                          {groupCount > 99 ? '99+' : groupCount}
                        </span>
                      )}
                      {isOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                    </div>
                  )}
                </button>

                {/* Submenu Children Dropdown with clean vertical line guide */}
                {isOpen && sidebarOpen && (
                  <div className="ml-5 pl-2.5 border-l border-zinc-200/80 space-y-1 my-1">
                    {visibleChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = location.pathname === child.path;
                      const isSuperAdminChild = !!child.superadminOnly;
                      const childCount = getBadgeCount(child.badgeKey);

                      return (
                        <button
                          key={child.name}
                          onClick={() => {
                            navigate(child.path);
                            if (window.innerWidth < 768) setSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                            isSuperAdminChild
                              ? isChildActive
                                ? 'bg-rose-50 text-rose-700 font-bold shadow-2xs'
                                : 'text-rose-500 hover:bg-rose-50/70'
                              : isChildActive
                                ? 'bg-theme text-white font-bold shadow-xs'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <ChildIcon size={15} className={
                              isChildActive ? 'text-white' : isSuperAdminChild ? 'text-rose-400' : 'text-zinc-400'
                            } />
                            <span className="truncate">{child.name}</span>
                          </div>
                          {childCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-full transition-all shrink-0 ml-2 ${
                              isChildActive
                                ? 'bg-white text-theme shadow-2xs'
                                : child.badgeType === 'amber'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200/80'
                                : child.badgeType === 'indigo'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200/80'
                                : child.badgeType === 'emerald'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                                : child.badgeType === 'rose'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200/80'
                                : child.badgeType === 'warning'
                                ? 'bg-amber-50 text-amber-800 border border-amber-300/80 font-black'
                                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                            }`}>
                              {childCount > 99 ? '99+' : childCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer (Status Indikator Pajak) */}
        <div className="p-3 border-t border-zinc-200/80 bg-zinc-50/80 shrink-0">
          {sidebarOpen ? (
            <div className={`px-3 py-2.5 rounded-lg border flex items-center justify-between shadow-2xs transition-all ${
              taxMode === 'PKP'
                ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-800'
                : taxMode === 'NON_PKP'
                ? 'bg-amber-50/90 border-amber-200/80 text-amber-900'
                : 'bg-white border-zinc-200 text-zinc-700'
            }`}>
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  {taxMode === 'PKP' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    taxMode === 'PKP' ? 'bg-emerald-500' : taxMode === 'NON_PKP' ? 'bg-amber-500' : 'bg-zinc-400'
                  }`} />
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</span>
              </div>
              <span className="text-xs font-black tracking-wide">
                {taxMode === 'PKP' ? 'PKP' : taxMode === 'NON_PKP' ? 'NON PKP' : 'SEMUA'}
              </span>
            </div>
          ) : (
            <div className="flex justify-center" title={`Status: ${taxMode === 'PKP' ? 'PKP' : taxMode === 'NON_PKP' ? 'NON PKP' : 'SEMUA'}`}>
              <div className={`w-10 h-8 rounded-md flex items-center justify-center text-[10px] font-black tracking-tight border shadow-2xs ${
                taxMode === 'PKP'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : taxMode === 'NON_PKP'
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-zinc-100 border-zinc-300 text-zinc-700'
              }`}>
                {taxMode === 'PKP' ? 'PKP' : taxMode === 'NON_PKP' ? 'NON' : 'ALL'}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarOpen ? 'md:pl-64' : 'md:pl-20'}`}>
        {/* Header (Frosted Glass Modern Topbar) */}
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-zinc-200/80 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none cursor-pointer border border-transparent hover:border-zinc-200/80 shadow-2xs"
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>
          </div>

          {/* User profile dropdown info */}
          {user && (
            <div className="flex items-center space-x-3 sm:space-x-4">
              {user.role === 'SUPERADMIN' && (
                <div className="flex items-center space-x-2 bg-zinc-50 border border-zinc-200/80 rounded-lg px-3 py-1.5 shadow-2xs">
                  <Building size={14} className="text-zinc-400 shrink-0" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tenant:</span>
                  <select
                    value={activeTenant}
                    onChange={handleTenantChange}
                    className={`text-xs font-semibold bg-transparent outline-none cursor-pointer ${
                      activeTenant ? 'text-indigo-600 font-bold' : 'text-zinc-600'
                    }`}
                  >
                    <option value="">— Home (SUPERADMIN) —</option>
                    {tenantsList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.companyName}{!t.isActive ? ' (Nonaktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* User profile with Clickable Dropdown for Profile & Settings */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(prev => !prev)}
                  className={`flex items-center space-x-2.5 p-1 px-2.5 rounded-lg transition-all border cursor-pointer ${
                    profileDropdownOpen 
                      ? 'bg-zinc-100/90 border-zinc-300 shadow-2xs ring-2 ring-indigo-500/20' 
                      : 'border-zinc-200/60 hover:bg-zinc-100 hover:border-zinc-200 shadow-2xs'
                  }`}
                  title="Menu Akun & Pengaturan"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200/70 overflow-hidden flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 shadow-2xs">
                    {user.metadata?.avatar ? (
                      <img src={getImageUrl(user.metadata.avatar)} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{user.name ? user.name.substring(0, 2).toUpperCase() : 'US'}</span>
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-zinc-950 leading-none">{user.name}</p>
                    <p className="text-[10px] text-zinc-500 leading-none mt-1 flex items-center space-x-1 font-medium">
                      <ShieldCheck size={10} className="text-indigo-500" />
                      <span>{user.role}</span>
                    </p>
                  </div>
                  <ChevronDown 
                    size={14} 
                    className={`text-zinc-400 transition-transform duration-200 hidden sm:block ${
                      profileDropdownOpen ? 'rotate-180 text-zinc-700' : ''
                    }`} 
                  />
                </button>

                {/* Profile Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-dropdown py-2 z-[100] animate-fadeIn">
                    {/* Header Summary */}
                    <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/70 rounded-t-xl">
                      <p className="text-xs font-extrabold text-zinc-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">{user.email || user.username || 'Pengguna CoreSync'}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-theme-light text-theme border border-theme-light">
                          <ShieldCheck size={10} />
                          {user.role}
                        </span>
                        {activeTenantInfo && (
                          <span className="inline-block text-[10px] font-semibold text-zinc-500 truncate max-w-[120px]" title={activeTenantInfo.companyName}>
                            • {activeTenantInfo.companyName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="py-1.5 px-1.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate('/profile');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors text-left cursor-pointer"
                      >
                        <User size={15} className="text-zinc-400" />
                        <div>
                          <p className="leading-none">Profil Saya</p>
                          <p className="text-[10px] text-zinc-400 font-normal mt-0.5">Lihat data akun & kata sandi</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          navigate('/help');
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors text-left cursor-pointer"
                      >
                        <HelpCircle size={15} className="text-zinc-400" />
                        <div>
                          <p className="leading-none">Panduan Staff</p>
                          <p className="text-[10px] text-zinc-400 font-normal mt-0.5">Buku panduan SO, PO & Manifest</p>
                        </div>
                      </button>

                      {canAccessSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            navigate('/settings');
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors text-left cursor-pointer"
                        >
                          <Settings size={15} className="text-zinc-400" />
                          <div>
                            <p className="leading-none">Pengaturan</p>
                            <p className="text-[10px] text-zinc-400 font-normal mt-0.5">Pengaturan tenant & sistem</p>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Logout Button */}
                    <div className="border-t border-zinc-100 pt-1.5 px-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={15} className="text-rose-500" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Page children container */}
        <main className="flex-1 p-5 sm:p-6 md:p-8 max-w-8xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
          {children}
        </main>
      </div>

      {/* Confirmation Modal Logout */}
      <ConfirmationModal
        isOpen={confirmLogoutOpen}
        title="Konfirmasi Keluar"
        message="Apakah Anda yakin ingin keluar dari akun ini? Sesi kerja Anda saat ini akan diakhiri."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmLogout}
        onClose={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
};

export default DashboardLayout;

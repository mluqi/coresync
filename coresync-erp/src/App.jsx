import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';

// Pages
import Login from './pages/Login';
import Overview from './pages/Overview';
import Products from './pages/Products';
import Salespersons from './pages/Salespersons';
import Units from './pages/Units';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Drivers from './pages/Drivers';
import StockOpname from './pages/StockOpname';
import StockTransfers from './pages/StockTransfers';
import StockLedger from './pages/StockLedger';
import Transactions from './pages/Transactions';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import SuperAdmin from './pages/SuperAdmin';
import SalesOrderDetail from './pages/SalesOrderDetail';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import ReturnDetail from './pages/ReturnDetail';
import ProductDetail from './pages/ProductDetail';
import Categories from './pages/Categories';
import Profile from './pages/Profile';
import Logs from './pages/Logs';
import DeliveryManifest from './pages/DeliveryManifest';
import Help from './pages/Help';
import PrintInvoice from './pages/PrintInvoice';

// Permission Route Wrapper
const PermissionRoute = ({ children, requiredModule, requiredPermission }) => {
  const { token, user, tenant, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 1. Verify tenant level module activation
  if (requiredModule && tenant && tenant.modules) {
    const isModuleEnabled = Array.isArray(requiredModule)
      ? requiredModule.some(m => tenant.modules[m] !== false)
      : tenant.modules[requiredModule] !== false;
    if (!isModuleEnabled) {
      return <Navigate to="/" replace />;
    }
  }

  // 2. Verify user level permissions (SUPERADMIN & OWNER bypass)
  if (requiredPermission && user) {
    if (requiredPermission === 'superadmin') {
      if (user.role !== 'SUPERADMIN') return <Navigate to="/" replace />;
    } else if (requiredPermission === 'settings') {
      // Izinkan semua pengguna yang telah login mengakses halaman pengaturan (tab disaring di Settings.jsx, minimal Warna Tema)
      if (!user) {
        return <Navigate to="/login" replace />;
      }
    } else if (user.role !== 'SUPERADMIN' && user.role !== 'OWNER') {
      const permissions = user.metadata?.permissions || {
        sales: true,
        purchase: true,
        inventory: true,
        finance: true
      };

      const hasPerm = (p) => {
        if (typeof permissions[p] === 'boolean') {
          return permissions[p];
        }
        if (permissions[p] && typeof permissions[p] === 'object') {
          return !!permissions[p].read;
        }
        
        let newKey = p;
        if (p === 'inventory') newKey = 'products';
        if (p === 'sales' || p === 'purchase') newKey = 'transactions';
        
        if (permissions[newKey] && typeof permissions[newKey] === 'object') {
          return !!permissions[newKey].read;
        }

        if (user.role === 'ADMIN' || user.role === 'STAFF') {
          return true;
        }
        return false;
      };

      const hasPermission = Array.isArray(requiredPermission)
        ? requiredPermission.some(p => hasPerm(p))
        : hasPerm(requiredPermission);

      if (!hasPermission) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { TaxModeProvider } from './context/TaxModeContext';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <TaxModeProvider>
            <Router>
          <Routes>
            {/* Public login route */}
            <Route path="/login" element={<Login />} />

            {/* Protected dashboard routes with module & permission checks */}
            <Route path="/" element={<PermissionRoute><Overview /></PermissionRoute>} />
            <Route path="/products" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><Products /></PermissionRoute>} />
            <Route path="/products/:id" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><ProductDetail /></PermissionRoute>} />
            <Route path="/categories" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><Categories /></PermissionRoute>} />
            <Route path="/salespersons" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><Salespersons /></PermissionRoute>} />
            <Route path="/units" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><Units /></PermissionRoute>} />
            <Route path="/customers" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><Customers /></PermissionRoute>} />
            <Route path="/suppliers" element={<PermissionRoute requiredModule="PURCHASE" requiredPermission="purchase"><Suppliers /></PermissionRoute>} />
            <Route path="/drivers" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><Drivers /></PermissionRoute>} />
            <Route path="/contacts" element={<PermissionRoute><Navigate to="/customers" replace /></PermissionRoute>} />
            <Route path="/stock-opname" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><StockOpname /></PermissionRoute>} />
            <Route path="/stock-transfers" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><StockTransfers /></PermissionRoute>} />
            <Route path="/stock-ledger" element={<PermissionRoute requiredModule="INVENTORY" requiredPermission="inventory"><StockLedger /></PermissionRoute>} />
            <Route path="/transactions" element={<PermissionRoute requiredModule={['SALES', 'PURCHASE']} requiredPermission={['sales', 'purchase']}><Navigate to="/transactions/sales" replace /></PermissionRoute>} />
            <Route path="/transactions/sales" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><Transactions scope="SALES" /></PermissionRoute>} />
            <Route path="/transactions/purchases" element={<PermissionRoute requiredModule="PURCHASE" requiredPermission="purchase"><Transactions scope="PURCHASE" /></PermissionRoute>} />
            <Route path="/transactions/sales-orders/:id" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><SalesOrderDetail /></PermissionRoute>} />
            <Route path="/transactions/purchase-orders/:id" element={<PermissionRoute requiredModule="PURCHASE" requiredPermission="purchase"><PurchaseOrderDetail /></PermissionRoute>} />
            <Route path="/transactions/returns/:id" element={<PermissionRoute requiredModule={['SALES', 'PURCHASE']} requiredPermission={['sales', 'purchase']}><ReturnDetail /></PermissionRoute>} />
            <Route path="/delivery-manifest" element={<PermissionRoute requiredModule="SALES" requiredPermission="sales"><DeliveryManifest /></PermissionRoute>} />
            <Route path="/finance" element={<PermissionRoute requiredModule="FINANCE" requiredPermission="finance"><Finance /></PermissionRoute>} />
            <Route path="/reports" element={<PermissionRoute requiredModule="FINANCE" requiredPermission="finance"><Reports /></PermissionRoute>} />
            <Route path="/profile" element={<PermissionRoute><Profile /></PermissionRoute>} />
            <Route path="/logs" element={<PermissionRoute requiredPermission="superadmin"><Logs /></PermissionRoute>} />
            <Route path="/settings" element={<PermissionRoute requiredPermission="settings"><Settings /></PermissionRoute>} />
            <Route path="/help" element={<PermissionRoute><Help /></PermissionRoute>} />
            <Route path="/super-admin" element={<PermissionRoute requiredPermission="superadmin"><SuperAdmin /></PermissionRoute>} />

            {/* Standalone Print Routes (Buka di halaman/tab baru tanpa sidebar dashboard) */}
            <Route path="/print/invoice/bulk" element={<PrintInvoice />} />
            <Route path="/print/bulk-invoices" element={<PrintInvoice />} />
            <Route path="/print/invoice/:id" element={<PrintInvoice />} />
            <Route path="/print/:type/:id" element={<PrintInvoice />} />

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
          </TaxModeProvider>
      </ToastProvider>
    </ThemeProvider>
  </AuthProvider>
  );
}

export default App;

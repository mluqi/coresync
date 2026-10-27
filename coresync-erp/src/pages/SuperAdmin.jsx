import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Building2,
  Users,
  Plus,
  Edit2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  RefreshCw,
  Cpu,
  Boxes,
  DollarSign,
  X,
  AlertCircle,
  Loader2,
  Globe,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Search,
  ShieldCheck,
  LayoutGrid,
  List,
  Activity,
  Lock,
  Unlock,
  ArrowRight,
  ArrowUpRight,
  Trash2,
} from "lucide-react";

// ─── Module Definitions ───────────────────────────────────────────────────────
const MODULE_CONFIG = [
  {
    key: "SALES",
    label: "Penjualan & CRM",
    desc: "Sales Orders, Surat Jalan, Salesperson & Komisi",
    icon: ArrowUpRight,
    color: "indigo",
  },
  {
    key: "PURCHASE",
    label: "Pembelian & Purchasing",
    desc: "Purchase Orders, Supplier & Penerimaan Stok",
    icon: ArrowRight,
    color: "blue",
  },
  {
    key: "INVENTORY",
    label: "FIFO Inventory & Stok",
    desc: "Stok FIFO, Opname, Ledger & Pergudangan",
    icon: Boxes,
    color: "emerald",
  },
  {
    key: "FINANCE",
    label: "Keuangan & Akuntansi",
    desc: "Double-Entry COA, Arus Kas & Laporan Laba Rugi",
    icon: DollarSign,
    color: "amber",
  },
];

const PACKAGE_PRESETS = [
  {
    id: "ENTERPRISE",
    name: "Full Enterprise",
    desc: "Semua 4 Modul Aktif",
    modules: ["SALES", "PURCHASE", "INVENTORY", "FINANCE"],
  },
  {
    id: "COMMERCE",
    name: "Dagang & Stok",
    desc: "Sales + Purchasing + Inventory",
    modules: ["SALES", "PURCHASE", "INVENTORY"],
  },
  {
    id: "FINANCE_ONLY",
    name: "Keuangan & Kas",
    desc: "Finance + Sales",
    modules: ["SALES", "FINANCE"],
  },
];

const Field = ({ label, required, children, helpText }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {helpText && <p className="text-[11px] text-zinc-400 mt-1">{helpText}</p>}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-zinc-400 font-sans"
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-sans"
  >
    {children}
  </select>
);

const Modal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "max-w-2xl",
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0 bg-zinc-50/50">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

const SuperAdmin = () => {
  const { tenant: currentTenant, actAsTenant } = useAuth();
  const { toast } = useToast();
  const activeTenantId = localStorage.getItem("activeTenantId");

  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, SUSPENDED
  const [taxFilter, setTaxFilter] = useState("ALL"); // ALL, PKP, NON_PKP
  const [viewMode, setViewMode] = useState("GRID"); // GRID | TABLE

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Create Form State
  const [createForm, setCreateForm] = useState({
    companyName: "",
    subdomain: "",
    taxStatus: "NON_PKP",
    email: "",
    phone: "",
    address: "",
    npwp: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    selectedPackage: "ENTERPRISE",
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    id: null,
    companyName: "",
    subdomain: "",
    taxStatus: "NON_PKP",
    email: "",
    phone: "",
    address: "",
    npwp: "",
    isActive: true,
  });

  // Expandable users state per tenant card
  const [expandedUsers, setExpandedUsers] = useState({});
  const [tenantUsers, setTenantUsers] = useState({});
  const [loadingTenantUsers, setLoadingTenantUsers] = useState({});

  // SuperAdmin Global User Management State
  const [mainTab, setMainTab] = useState("TENANTS"); // TENANTS | GLOBAL_USERS
  const [globalUsers, setGlobalUsers] = useState([]);
  const [loadingGlobalUsers, setLoadingGlobalUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userTenantFilter, setUserTenantFilter] = useState("ALL");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");

  const [globalUserModalOpen, setGlobalUserModalOpen] = useState(false);
  const [globalUserFormMode, setGlobalUserFormMode] = useState("CREATE"); // CREATE, EDIT
  const [editingGlobalUserId, setEditingGlobalUserId] = useState(null);
  const [tenantWarehouses, setTenantWarehouses] = useState([]);

  const parseGranularPermissions = (metadataPermissions) => {
    const base = {
      customers: { read: true, create: true, update: true, delete: false },
      suppliers: { read: true, create: true, update: true, delete: false },
      salespersons: { read: true, create: true, update: true, delete: false },
      sales_orders: { read: true, create: true, update: true, delete: false },
      purchase_orders: {
        read: true,
        create: true,
        update: true,
        delete: false,
      },
      deliveries: { read: true, create: true, update: true, delete: false },
      invoices: { read: true, create: true, update: true, delete: false },
      products: {
        read: true,
        create: true,
        update: true,
        delete: false,
        view_cost: false,
      },
      categories: { read: true, create: true, update: true, delete: false },
      units: { read: true, create: true, update: true, delete: false },
      stock_opname: { read: true, create: true, update: true, delete: false },
      stock_transfers: {
        read: true,
        create: true,
        update: true,
        delete: false,
      },
      stock_ledger: { read: true },
      finance: { read: true, create: true, update: true, delete: false },
      reports: {
        read: true,
        sales: true,
        purchase: true,
        inventory: true,
        finance: true,
      },
    };

    if (!metadataPermissions) return base;

    const result = { ...base };
    for (const mod of Object.keys(base)) {
      if (
        metadataPermissions[mod] &&
        typeof metadataPermissions[mod] === "object"
      ) {
        result[mod] = { ...base[mod], ...metadataPermissions[mod] };
      } else {
        // Legacy fallback mapping
        let legacyFlag = true;
        if (
          mod === "customers" ||
          mod === "suppliers" ||
          mod === "salespersons"
        ) {
          if (
            metadataPermissions.contacts &&
            typeof metadataPermissions.contacts === "object"
          ) {
            result[mod] = { ...metadataPermissions.contacts };
            continue;
          }
        }
        if (
          mod === "sales_orders" ||
          mod === "deliveries" ||
          mod === "invoices" ||
          mod === "purchase_orders"
        ) {
          if (
            metadataPermissions.transactions &&
            typeof metadataPermissions.transactions === "object"
          ) {
            result[mod] = { ...metadataPermissions.transactions };
            continue;
          }
          if (mod === "purchase_orders")
            legacyFlag = metadataPermissions.purchase !== false;
          else legacyFlag = metadataPermissions.sales !== false;
        }
        if (
          mod === "products" ||
          mod === "categories" ||
          mod === "units" ||
          mod === "stock_opname" ||
          mod === "stock_transfers" ||
          mod === "stock_ledger"
        ) {
          if (
            metadataPermissions.products &&
            typeof metadataPermissions.products === "object"
          ) {
            result[mod] = { ...metadataPermissions.products };
            continue;
          }
          legacyFlag = metadataPermissions.inventory !== false;
        }
        if (mod === "finance") {
          legacyFlag = metadataPermissions.finance !== false;
        }

        if (mod === "reports") {
          result[mod] = {
            read: true,
            sales: metadataPermissions.sales !== false,
            purchase: metadataPermissions.purchase !== false,
            inventory: metadataPermissions.inventory !== false,
            finance: metadataPermissions.finance !== false,
          };
        } else if (mod === "stock_ledger") {
          result[mod] = { read: legacyFlag };
        } else {
          result[mod] = {
            read: legacyFlag,
            create: legacyFlag,
            update: legacyFlag,
            delete: false,
          };
        }
      }
    }
    return result;
  };

  const applyPreset = (presetType) => {
    let p = parseGranularPermissions(null);
    if (presetType === "SALES") {
      p.customers = { read: true, create: true, update: true, delete: false };
      p.suppliers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.salespersons = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.sales_orders = {
        read: true,
        create: true,
        update: true,
        delete: false,
      };
      p.purchase_orders = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.deliveries = { read: true, create: true, update: false, delete: false };
      p.invoices = { read: true, create: false, update: false, delete: false };
      p.products = {
        read: true,
        create: false,
        update: false,
        delete: false,
        view_cost: false,
      };
      p.categories = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_transfers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_ledger = { read: false };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = {
        read: true,
        sales: true,
        purchase: false,
        inventory: false,
        finance: false,
      };
    } else if (presetType === "PURCHASING") {
      p.customers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.suppliers = { read: true, create: true, update: true, delete: false };
      p.salespersons = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.sales_orders = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.purchase_orders = {
        read: true,
        create: true,
        update: true,
        delete: false,
      };
      p.deliveries = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.invoices = { read: true, create: false, update: false, delete: false };
      p.products = {
        read: true,
        create: false,
        update: false,
        delete: false,
        view_cost: true,
      };
      p.categories = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_transfers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_ledger = { read: false };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = {
        read: true,
        sales: false,
        purchase: true,
        inventory: false,
        finance: false,
      };
    } else if (presetType === "GUDANG") {
      p.customers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.suppliers = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.salespersons = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.sales_orders = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.purchase_orders = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.deliveries = { read: true, create: true, update: true, delete: false };
      p.invoices = { read: false, create: false, update: false, delete: false };
      p.products = {
        read: true,
        create: true,
        update: true,
        delete: false,
        view_cost: false,
      };
      p.categories = { read: true, create: true, update: true, delete: false };
      p.units = { read: true, create: true, update: true, delete: false };
      p.stock_opname = {
        read: true,
        create: true,
        update: true,
        delete: false,
      };
      p.stock_transfers = {
        read: true,
        create: true,
        update: true,
        delete: false,
      };
      p.stock_ledger = { read: true };
      p.finance = { read: false, create: false, update: false, delete: false };
      p.reports = {
        read: true,
        sales: false,
        purchase: false,
        inventory: true,
        finance: false,
      };
    } else if (presetType === "FINANCE") {
      p.customers = { read: true, create: false, update: false, delete: false };
      p.suppliers = { read: true, create: false, update: false, delete: false };
      p.salespersons = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.sales_orders = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.purchase_orders = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.deliveries = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.invoices = { read: true, create: true, update: true, delete: false };
      p.products = {
        read: true,
        create: false,
        update: false,
        delete: false,
        view_cost: true,
      };
      p.categories = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.units = { read: true, create: false, update: false, delete: false };
      p.stock_opname = {
        read: false,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_transfers = {
        read: true,
        create: false,
        update: false,
        delete: false,
      };
      p.stock_ledger = { read: true };
      p.finance = { read: true, create: true, update: true, delete: true };
      p.reports = {
        read: true,
        sales: true,
        purchase: true,
        inventory: true,
        finance: true,
      };
    } else if (presetType === "ADMIN") {
      for (const k of Object.keys(p)) {
        if (typeof p[k] === "object") {
          for (const a of Object.keys(p[k])) {
            p[k][a] = true;
          }
        }
      }
    } else if (presetType === "CLEAR") {
      for (const k of Object.keys(p)) {
        if (typeof p[k] === "object") {
          for (const a of Object.keys(p[k])) {
            p[k][a] = false;
          }
        }
      }
    }
    setGlobalUserForm((prev) => ({ ...prev, permissions: p }));
  };

  const [globalUserForm, setGlobalUserForm] = useState({
    tenantId: "",
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    warehouseId: "",
    permissions: parseGranularPermissions(null),
  });

  const fetchGlobalUsers = useCallback(async () => {
    setLoadingGlobalUsers(true);
    try {
      const res = await api.get("/users");
      setGlobalUsers(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch global users:", err);
    } finally {
      setLoadingGlobalUsers(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "GLOBAL_USERS") {
      fetchGlobalUsers();
    }
  }, [mainTab, fetchGlobalUsers]);

  const fetchTenantWarehouses = async (tId) => {
    if (!tId) {
      setTenantWarehouses([]);
      return;
    }
    try {
      const res = await api.get(`/warehouses?tenantId=${tId}`);
      setTenantWarehouses(res.data.data || []);
    } catch (err) {
      console.error(err);
      setTenantWarehouses([]);
    }
  };

  const handleOpenCreateGlobalUser = () => {
    const firstTenantId = tenants[0]?.id || "";
    setGlobalUserFormMode("CREATE");
    setEditingGlobalUserId(null);
    setGlobalUserForm({
      tenantId: firstTenantId,
      name: "",
      email: "",
      password: "",
      role: "STAFF",
      warehouseId: "",
      permissions: parseGranularPermissions(null),
    });
    setModalError("");
    if (firstTenantId) fetchTenantWarehouses(firstTenantId);
    setGlobalUserModalOpen(true);
  };

  const handleOpenEditGlobalUser = (userObj) => {
    setGlobalUserFormMode("EDIT");
    setEditingGlobalUserId(userObj.id);
    const targetTenantId = userObj.tenantId || tenants[0]?.id || "";
    setGlobalUserForm({
      tenantId: targetTenantId,
      name: userObj.name || "",
      email: userObj.email || "",
      password: "",
      role: userObj.role || "STAFF",
      warehouseId: userObj.warehouseId || "",
      permissions: parseGranularPermissions(userObj.metadata?.permissions),
    });
    setModalError("");
    if (targetTenantId) fetchTenantWarehouses(targetTenantId);
    setGlobalUserModalOpen(true);
  };

  const handlePermissionCheckbox = (modKey, action) => {
    setGlobalUserForm((prev) => {
      const currentMod = prev.permissions[modKey] || {};
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [modKey]: {
            ...currentMod,
            [action]: !currentMod[action],
          },
        },
      };
    });
  };

  const handleSaveGlobalUser = async (e) => {
    e.preventDefault();
    setModalError("");
    setSaving(true);
    try {
      const isFullAccess =
        globalUserForm.role === "OWNER" || globalUserForm.role === "SUPERADMIN";
      const finalPermissions = isFullAccess
        ? {
            customers: { read: true, create: true, update: true, delete: true },
            suppliers: { read: true, create: true, update: true, delete: true },
            salespersons: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            sales_orders: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            purchase_orders: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            deliveries: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            invoices: { read: true, create: true, update: true, delete: true },
            products: {
              read: true,
              create: true,
              update: true,
              delete: true,
              view_cost: true,
            },
            categories: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            units: { read: true, create: true, update: true, delete: true },
            stock_opname: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            stock_transfers: {
              read: true,
              create: true,
              update: true,
              delete: true,
            },
            stock_ledger: { read: true },
            finance: { read: true, create: true, update: true, delete: true },
            reports: {
              read: true,
              sales: true,
              purchase: true,
              inventory: true,
              finance: true,
            },
          }
        : globalUserForm.permissions;

      if (globalUserFormMode === "CREATE") {
        await api.post("/users", {
          tenantId: parseInt(globalUserForm.tenantId, 10),
          name: globalUserForm.name,
          email: globalUserForm.email,
          password: globalUserForm.password,
          role: globalUserForm.role,
          warehouseId:
            globalUserForm.role === "STAFF" && globalUserForm.warehouseId
              ? parseInt(globalUserForm.warehouseId, 10)
              : null,
          metadata: { permissions: finalPermissions },
        });
        toast.success(`Pengguna ${globalUserForm.name} berhasil ditambahkan!`);
      } else {
        const payload = {
          tenantId: parseInt(globalUserForm.tenantId, 10),
          name: globalUserForm.name,
          email: globalUserForm.email,
          role: globalUserForm.role,
          warehouseId:
            globalUserForm.role === "STAFF" && globalUserForm.warehouseId
              ? parseInt(globalUserForm.warehouseId, 10)
              : null,
          metadata: { permissions: finalPermissions },
        };
        if (globalUserForm.password) payload.password = globalUserForm.password;
        await api.put(`/users/${editingGlobalUserId}`, payload);
        toast.success(`Pengguna ${globalUserForm.name} berhasil diperbarui!`);
      }

      setGlobalUserModalOpen(false);
      fetchGlobalUsers();
      fetchData();
    } catch (err) {
      const msg =
        err.response?.data?.message || "Gagal menyimpan data pengguna.";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGlobalUser = async (userId, userName) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus pengguna "${userName}"?`,
      )
    )
      return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success(`Pengguna "${userName}" berhasil dihapus.`);
      fetchGlobalUsers();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gagal menghapus pengguna.");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        api.get("/tenant"),
        api
          .get("/tenant/superadmin-dashboard")
          .catch(() => ({ data: { data: null } })),
      ]);
      setTenants(tenantsRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      setError(
        err.response?.data?.message || "Gagal memuat data platform SuperAdmin.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Toggle module for tenant
  const handleToggleModule = async (tenant, moduleName, isEnabled) => {
    // Optimistic UI update
    setTenants((prev) =>
      prev.map((t) => {
        if (t.id === tenant.id) {
          return {
            ...t,
            modules: { ...t.modules, [moduleName]: isEnabled },
          };
        }
        return t;
      }),
    );

    try {
      await api.post(`/tenant/${tenant.id}/modules/${moduleName}/toggle`, {
        isEnabled,
      });
    } catch (err) {
      console.error("Failed to toggle module", err);
      // Revert on error
      fetchData();
    }
  };

  // Apply Package Preset to Tenant
  const handleApplyPackage = async (tenant, packageConfig) => {
    const targetModules = packageConfig.modules;
    const currentModules = tenant.modules || {};

    setSaving(true);
    try {
      for (const mod of MODULE_CONFIG) {
        const shouldEnable = targetModules.includes(mod.key);
        if (!!currentModules[mod.key] !== shouldEnable) {
          await api.post(`/tenant/${tenant.id}/modules/${mod.key}/toggle`, {
            isEnabled: shouldEnable,
          });
        }
      }
      fetchData();
    } catch (err) {
      console.error("Failed to apply package preset", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tenant) => {
    const newStatus = !tenant.isActive;
    const actionText = newStatus
      ? "mengaktifkan kembali"
      : "membekukan (suspend)";
    if (
      !window.confirm(
        `Apakah Anda yakin ingin ${actionText} tenant "${tenant.companyName}"?`,
      )
    )
      return;

    try {
      await api.put(`/tenant/${tenant.id}`, { isActive: newStatus });
      toast.info(
        `Tenant "${tenant.companyName}" berhasil ${newStatus ? "diaktifkan" : "dibekukan"}.`,
      );
      fetchData();
    } catch (err) {
      const msg =
        err.response?.data?.message || "Gagal mengubah status tenant.";
      toast.error(msg);
    }
  };

  const handleToggleUsers = async (tenantId) => {
    const isExpanded = !!expandedUsers[tenantId];
    setExpandedUsers((prev) => ({ ...prev, [tenantId]: !isExpanded }));

    if (!isExpanded && !tenantUsers[tenantId]) {
      setLoadingTenantUsers((prev) => ({ ...prev, [tenantId]: true }));
      try {
        const res = await api.get(`/tenant/${tenantId}/users`);
        setTenantUsers((prev) => ({
          ...prev,
          [tenantId]: res.data.data || [],
        }));
      } catch (err) {
        console.error("Failed to load tenant users", err);
      } finally {
        setLoadingTenantUsers((prev) => ({ ...prev, [tenantId]: false }));
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    setSaving(true);

    try {
      const res = await api.post("/tenant", createForm);
      const createdTenant = res.data.data?.tenant;

      if (createdTenant && createForm.selectedPackage) {
        const pkg = PACKAGE_PRESETS.find(
          (p) => p.id === createForm.selectedPackage,
        );
        if (pkg) {
          for (const mod of MODULE_CONFIG) {
            const isEnabled = pkg.modules.includes(mod.key);
            await api
              .post(`/tenant/${createdTenant.id}/modules/${mod.key}/toggle`, {
                isEnabled,
              })
              .catch(() => {});
          }
        }
      }

      toast.success(`Tenant "${createForm.companyName}" berhasil dibuat!`);
      setCreateModalOpen(false);
      setCreateForm({
        companyName: "",
        subdomain: "",
        taxStatus: "NON_PKP",
        email: "",
        phone: "",
        address: "",
        npwp: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        selectedPackage: "ENTERPRISE",
      });
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal membuat tenant baru.";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    setSaving(true);

    try {
      await api.put(`/tenant/${editForm.id}`, editForm);
      toast.success(
        `Data tenant "${editForm.companyName}" berhasil diperbarui!`,
      );
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal mengubah data tenant.";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (t) => {
    setEditForm({
      id: t.id,
      companyName: t.companyName || "",
      subdomain: t.subdomain || "",
      taxStatus: t.taxStatus || "NON_PKP",
      email: t.email || "",
      phone: t.phone || "",
      address: t.address || "",
      npwp: t.npwp || "",
      isActive: t.isActive !== false,
    });
    setModalError("");
    setEditModalOpen(true);
  };

  // Filtering Logic
  const filteredTenants = tenants.filter((t) => {
    const matchSearch =
      t.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toString() === search;

    const matchStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
          ? t.isActive
          : !t.isActive;

    const matchTax = taxFilter === "ALL" ? true : t.taxStatus === taxFilter;

    return matchSearch && matchStatus && matchTax;
  });

  // Calculate platform totals
  const totalTenants = tenants.length;
  const activeTenantsCount = tenants.filter((t) => t.isActive).length;
  const suspendedTenantsCount = totalTenants - activeTenantsCount;
  const totalUsersCount = tenants.reduce(
    (sum, t) => sum + (t.userCount || 0),
    0,
  );

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-zinc-500">
          Memuat SuperAdmin Control Center...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Platform SuperAdmin Control Center"
        subtitle="Kelola tenant perusahaan, batas lisensi, impersonasi tenant, dan konfigurasi platform CoreSync."
        icon={ShieldCheck}
      />
      {/* ───────────────────────────────────────────────────────────── */}
      {/* IMPERSONATION HEADER BANNER                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTenantId && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm uppercase tracking-wider">
                  Mode Impersonasi Tenant Aktif
                </span>
                <span className="px-2 py-0.5 bg-black/20 rounded text-[10px] font-mono">
                  ID: {activeTenantId}
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Anda sedang bertindak sebagai tenant{" "}
                <strong>"{currentTenant?.companyName}"</strong>. Seluruh data
                transaksi & sidebar di-override untuk tenant ini.
              </p>
            </div>
          </div>
          <button
            onClick={() => actAsTenant(null)}
            className="px-4 py-2 bg-white text-amber-900 hover:bg-amber-50 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer shrink-0"
          >
            Hentikan Impersonasi (Kembali ke SuperAdmin Platform)
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUPERADMIN HERO DASHBOARD STATS                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tenants */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Tenant Registered</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-zinc-900 font-mono">
              {totalTenants}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="font-bold text-emerald-600">
                {activeTenantsCount} Aktif
              </span>
              <span className="text-zinc-300">•</span>
              <span className="font-bold text-rose-500">
                {suspendedTenantsCount} Dibekukan
              </span>
            </div>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Platform Users</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-zinc-900 font-mono">
              {totalUsersCount}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Tersebar di seluruh tenant perusahaan
            </p>
          </div>
        </div>

        {/* Active Modules */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
            <span>Modul Terlisensi</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Cpu size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-zinc-900 font-mono">
              4 Core ERP
            </div>
            <p className="text-xs text-emerald-600 font-bold mt-1">
              Sales • Purchase • FIFO • Finance
            </p>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
            <span>Status Infrastruktur</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Activity size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-extrabold text-emerald-700 text-base">
              <CheckCircle size={18} /> Normal & Operasional
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Multi-tenant MySQL & Routing Subdomain
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MAIN NAVIGATION TAB SWITCHER (TENANTS vs GLOBAL USERS)         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-zinc-200 gap-6 pt-2">
        <button
          onClick={() => setMainTab("TENANTS")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer border-b-2 transition-all ${
            mainTab === "TENANTS"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Building2 size={16} />
          <span>Perusahaan Tenant & Modul</span>
        </button>
        <button
          onClick={() => {
            setMainTab("GLOBAL_USERS");
            fetchGlobalUsers();
          }}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer border-b-2 transition-all ${
            mainTab === "GLOBAL_USERS"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Users size={16} />
          <span>Manajemen Pengguna Platform Global (SuperAdmin)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Cross-Tenant RBAC
          </span>
        </button>
      </div>

      {mainTab === "GLOBAL_USERS" ? (
        <div className="space-y-6">
          {/* Global User Control & Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 border border-zinc-200 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
              <div className="relative max-w-xs w-full">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Cari nama, email, perusahaan..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tenant Filter */}
              <select
                value={userTenantFilter}
                onChange={(e) => setUserTenantFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value="ALL">Seluruh Perusahaan Tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.companyName}
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value="ALL">Seluruh Hak Akses / Role</option>
                <option value="SUPERADMIN">SUPERADMIN</option>
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="STAFF">STAFF</option>
              </select>

              <button
                onClick={fetchGlobalUsers}
                disabled={loadingGlobalUsers}
                className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 cursor-pointer disabled:opacity-50"
                title="Refresh Daftar Pengguna"
              >
                <RefreshCw
                  size={16}
                  className={loadingGlobalUsers ? "animate-spin" : ""}
                />
              </button>
            </div>

            <button
              onClick={handleOpenCreateGlobalUser}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <UserPlus size={16} />
              <span>Tambah User Platform Baru</span>
            </button>
          </div>

          {/* Global User Table */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            {loadingGlobalUsers ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <p className="text-xs font-semibold">
                  Memuat daftar akun pengguna platform...
                </p>
              </div>
            ) : globalUsers.filter((u) => {
                const matchSearch =
                  u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.tenant?.companyName
                    ?.toLowerCase()
                    .includes(userSearch.toLowerCase());
                const matchTenant =
                  userTenantFilter === "ALL"
                    ? true
                    : u.tenantId?.toString() === userTenantFilter;
                const matchRole =
                  userRoleFilter === "ALL" ? true : u.role === userRoleFilter;
                return matchSearch && matchTenant && matchRole;
              }).length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                Tidak ada pengguna ditemukan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Nama Lengkap & Email</th>
                      <th className="px-6 py-4">Perusahaan Tenant</th>
                      <th className="px-6 py-4">Role Akses</th>
                      <th className="px-6 py-4">Gudang Tugas</th>
                      <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-700">
                    {globalUsers
                      .filter((u) => {
                        const matchSearch =
                          u.name
                            ?.toLowerCase()
                            .includes(userSearch.toLowerCase()) ||
                          u.email
                            ?.toLowerCase()
                            .includes(userSearch.toLowerCase()) ||
                          u.tenant?.companyName
                            ?.toLowerCase()
                            .includes(userSearch.toLowerCase());
                        const matchTenant =
                          userTenantFilter === "ALL"
                            ? true
                            : u.tenantId?.toString() === userTenantFilter;
                        const matchRole =
                          userRoleFilter === "ALL"
                            ? true
                            : u.role === userRoleFilter;
                        return matchSearch && matchTenant && matchRole;
                      })
                      .map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-zinc-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-zinc-900">{u.name}</p>
                            <p className="text-xs font-mono text-zinc-500">
                              {u.email}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-zinc-900">
                              {u.tenant?.companyName || `Tenant #${u.tenantId}`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase border ${
                                u.role === "SUPERADMIN"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : u.role === "OWNER"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : u.role === "ADMIN"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-zinc-50 text-zinc-700 border-zinc-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-zinc-800">
                            {u.warehouse?.name || "Seluruh Gudang"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => handleOpenEditGlobalUser(u)}
                                className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-all cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteGlobalUser(u.id, u.name)
                                }
                                className="p-1.5 text-rose-500 hover:bg-rose-50 border border-rose-200 rounded-lg transition-all cursor-pointer"
                                title="Hapus Pengguna"
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
        </div>
      ) : (
        <>
          {/* CONTROL & ACTION BAR                                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 border border-zinc-200 rounded-2xl shadow-sm">
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
              <div className="relative max-w-xs w-full">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Cari tenant, subdomain, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status (Aktif & Dibekukan)</option>
                <option value="ACTIVE">Aktif Sahaja</option>
                <option value="SUSPENDED">Dibekukan (Suspended)</option>
              </select>

              {/* Tax Status Filter */}
              <select
                value={taxFilter}
                onChange={(e) => setTaxFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Status Pajak</option>
                <option value="PKP">PKP (PPN 11%)</option>
                <option value="NON_PKP">Non-PKP</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 text-zinc-600 cursor-pointer disabled:opacity-50"
                title="Refresh Data Tenant"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
            </div>

            {/* Actions & View Switcher */}
            <div className="flex items-center gap-3 shrink-0">
              {/* View Switcher */}
              <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                <button
                  onClick={() => setViewMode("GRID")}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "GRID"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode("TABLE")}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "TABLE"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                  title="Tampilan Tabel Dense"
                >
                  <List size={16} />
                </button>
              </div>

              <button
                onClick={() => {
                  setModalError("");
                  setCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                <Plus size={16} />
                <span>Tambah Tenant Perusahaan</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TENANT LISTING: GRID VIEW vs TABLE VIEW                       */}
          {/* ───────────────────────────────────────────────────────────── */}
          {viewMode === "GRID" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTenants.map((t) => {
                const isImpersonatingThis = activeTenantId === t.id.toString();

                return (
                  <div
                    key={t.id}
                    className={`bg-white border rounded-2xl shadow-sm transition-all duration-200 flex flex-col justify-between ${
                      t.isActive
                        ? "border-zinc-200 hover:border-indigo-300"
                        : "border-rose-200 bg-rose-50/20"
                    }`}
                  >
                    <div className="p-6 space-y-5">
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 ${
                              t.isActive
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                : "bg-rose-500 text-white"
                            }`}
                          >
                            {t.companyName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-extrabold text-zinc-900 text-base truncate">
                                {t.companyName}
                              </h3>
                              <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-full font-mono text-[11px] font-bold border border-zinc-200">
                                ID: {t.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs font-mono font-bold text-indigo-600 flex items-center gap-1">
                                <Globe size={13} /> {t.subdomain}.coresync.com
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.taxStatus === "PKP"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {t.taxStatus === "PKP"
                                  ? "PKP (PPN 11%)"
                                  : "Non-PKP"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold border shrink-0 ${
                            t.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {t.isActive ? "AKTIF" : "DIBEKUKAN"}
                        </span>
                      </div>

                      {/* Contact Meta Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 bg-zinc-50 p-3 rounded-xl border border-zinc-150">
                        <div className="truncate">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                            Email Kontak
                          </span>
                          <span className="font-semibold text-zinc-800">
                            {t.email || "—"}
                          </span>
                        </div>
                        <div className="truncate">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                            Telepon
                          </span>
                          <span className="font-semibold text-zinc-800">
                            {t.phone || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Module Subscription Matrix */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-700 uppercase tracking-wider">
                            Modul ERP Terlisensi
                          </span>
                          <div className="flex gap-1">
                            {PACKAGE_PRESETS.map((pkg) => (
                              <button
                                key={pkg.id}
                                onClick={() => handleApplyPackage(t, pkg)}
                                disabled={saving}
                                className="px-2 py-0.5 text-[10px] font-bold bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-700 rounded border border-zinc-200 transition-colors cursor-pointer"
                                title={`Terapkan ${pkg.desc}`}
                              >
                                + {pkg.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {MODULE_CONFIG.map((mod) => {
                            const isEnabled = t.modules?.[mod.key] !== false;
                            const Icon = mod.icon;
                            return (
                              <button
                                key={mod.key}
                                onClick={() =>
                                  handleToggleModule(t, mod.key, !isEnabled)
                                }
                                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                  isEnabled
                                    ? "bg-indigo-50/60 border-indigo-200 text-indigo-900 font-bold"
                                    : "bg-zinc-50 border-zinc-200 text-zinc-400"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon
                                    size={14}
                                    className={
                                      isEnabled
                                        ? "text-indigo-600"
                                        : "text-zinc-400"
                                    }
                                  />
                                  <span className="text-xs">{mod.label}</span>
                                </div>
                                {isEnabled ? (
                                  <ToggleRight
                                    size={22}
                                    className="text-indigo-600 shrink-0"
                                  />
                                ) : (
                                  <ToggleLeft
                                    size={22}
                                    className="text-zinc-300 shrink-0"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Expandable Users Drawer */}
                      <div className="pt-2 border-t border-zinc-100">
                        <button
                          onClick={() => handleToggleUsers(t.id)}
                          className="w-full py-1.5 px-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-xs font-bold text-zinc-600 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5">
                            <Users size={14} className="text-indigo-600" />
                            <span>
                              Daftar User Tenant ({t.userCount || 0} Terdaftar)
                            </span>
                          </div>
                          {expandedUsers[t.id] ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>

                        {expandedUsers[t.id] && (
                          <div className="mt-3 space-y-2 animate-fadeIn">
                            {loadingTenantUsers[t.id] ? (
                              <div className="p-4 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                                <Loader2
                                  size={14}
                                  className="animate-spin text-indigo-600"
                                />
                                <span>Memuat pengguna tenant...</span>
                              </div>
                            ) : (tenantUsers[t.id] || []).length > 0 ? (
                              <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
                                <table className="w-full text-left border-collapse">
                                  <thead className="bg-zinc-100 font-bold text-zinc-600">
                                    <tr>
                                      <th className="p-2">Nama</th>
                                      <th className="p-2">Email</th>
                                      <th className="p-2">Role</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-100 bg-white">
                                    {tenantUsers[t.id].map((u) => (
                                      <tr key={u.id}>
                                        <td className="p-2 font-semibold text-zinc-900">
                                          {u.name}
                                        </td>
                                        <td className="p-2 text-zinc-500 font-mono text-[11px]">
                                          {u.email}
                                        </td>
                                        <td className="p-2">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {u.role}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-400 italic text-center py-2">
                                Belum ada user terdaftar.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="p-4 bg-zinc-50 border-t border-zinc-200 rounded-b-2xl flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                          title="Edit Profil Tenant"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleToggleActive(t)}
                          className={`p-2 border rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm ${
                            t.isActive
                              ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {t.isActive ? (
                            <Lock size={13} />
                          ) : (
                            <Unlock size={13} />
                          )}
                          <span>{t.isActive ? "Bekukan" : "Aktifkan"}</span>
                        </button>
                      </div>

                      {/* Act As Button */}
                      <button
                        onClick={() =>
                          actAsTenant(isImpersonatingThis ? null : t.id)
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                          isImpersonatingThis
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                        }`}
                      >
                        <ShieldCheck size={14} />
                        <span>
                          {isImpersonatingThis
                            ? "Keluar Act As"
                            : "Act As Admin"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-700 uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Tenant / Perusahaan</th>
                      <th className="p-4">Subdomain</th>
                      <th className="p-4">Status Pajak</th>
                      <th className="p-4">Users</th>
                      <th className="p-4">Modul Terlisensi</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Aksi Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredTenants.map((t) => {
                      const isImpersonatingThis =
                        activeTenantId === t.id.toString();

                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/50">
                          <td className="p-4">
                            <div className="font-extrabold text-zinc-900 text-sm">
                              {t.companyName}
                            </div>
                            <div className="text-zinc-400 font-mono text-[11px]">
                              ID: {t.id} • {t.email || "-"}
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-indigo-600">
                            {t.subdomain}.coresync.com
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                t.taxStatus === "PKP"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {t.taxStatus}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-zinc-800">
                            {t.userCount || 0} user
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {MODULE_CONFIG.map((mod) => {
                                const isEnabled =
                                  t.modules?.[mod.key] !== false;
                                return (
                                  <span
                                    key={mod.key}
                                    onClick={() =>
                                      handleToggleModule(t, mod.key, !isEnabled)
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                      isEnabled
                                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                        : "bg-zinc-100 text-zinc-400 line-through"
                                    }`}
                                  >
                                    {mod.label.split(" ")[0]}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                t.isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {t.isActive ? "AKTIF" : "DIBEKUKAN"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() =>
                                  actAsTenant(isImpersonatingThis ? null : t.id)
                                }
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck size={12} />{" "}
                                {isImpersonatingThis ? "Exit" : "Act As"}
                              </button>
                              <button
                                onClick={() => openEditModal(t)}
                                className="p-1.5 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg text-xs font-bold cursor-pointer"
                                title="Edit Tenant"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleToggleActive(t)}
                                className={`p-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                  t.isActive
                                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                                title={t.isActive ? "Bekukan" : "Aktifkan"}
                              >
                                {t.isActive ? (
                                  <Lock size={13} />
                                ) : (
                                  <Unlock size={13} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* CREATE TENANT MODAL                                           */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Modal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            title="Tambah Tenant Perusahaan Baru"
            subtitle="Daftarkan tenant baru beserta akun Owner & lisensi modul ERP awal"
            width="max-w-2xl"
          >
            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* Section 1: Perusahaan */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider border-b pb-1">
                  1. Profil Perusahaan (Tenant)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nama Perusahaan" required>
                    <Input
                      required
                      placeholder="e.g. PT Sukses Mandiri Jaya"
                      value={createForm.companyName}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          companyName: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field
                    label="Subdomain Slug"
                    required
                    helpText="URL: [subdomain].coresync.com"
                  >
                    <div className="flex items-center">
                      <Input
                        required
                        placeholder="suksesmandiri"
                        value={createForm.subdomain}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            subdomain: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, ""),
                          })
                        }
                      />
                      <span className="text-xs text-zinc-400 font-mono pl-2">
                        .coresync.com
                      </span>
                    </div>
                  </Field>

                  <Field label="Status Perpajakan" required>
                    <Select
                      value={createForm.taxStatus}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          taxStatus: e.target.value,
                        })
                      }
                    >
                      <option value="NON_PKP">Non-PKP (Bebas PPN)</option>
                      <option value="PKP">
                        PKP (Pengusaha Kena Pajak - PPN 11%)
                      </option>
                    </Select>
                  </Field>

                  <Field label="Nomor NPWP Perusahaan">
                    <Input
                      placeholder="01.234.567.8-901.000"
                      value={createForm.npwp}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, npwp: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Email Kontak Perusahaan">
                    <Input
                      type="email"
                      placeholder="info@suksesmandiri.com"
                      value={createForm.email}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, email: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="Telepon Kantor">
                    <Input
                      placeholder="021-5551234"
                      value={createForm.phone}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, phone: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>

              {/* Section 2: Owner Credentials */}
              <div className="space-y-4 pt-2 border-t border-zinc-100">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider border-b pb-1">
                  2. Akun Administrator Utama (Owner)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Nama Lengkap Owner" required>
                    <Input
                      required
                      placeholder="Pak Budi Santoso"
                      value={createForm.ownerName}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          ownerName: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Email Login Owner" required>
                    <Input
                      type="email"
                      required
                      placeholder="budi@suksesmandiri.com"
                      value={createForm.ownerEmail}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          ownerEmail: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Password Akun" required>
                    <Input
                      type="password"
                      required
                      placeholder="Password123!"
                      value={createForm.ownerPassword}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          ownerPassword: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </div>

              {/* Section 3: Package Presets */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider border-b pb-1">
                  3. Lisensi Paket Modul ERP Awal
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {PACKAGE_PRESETS.map((pkg) => (
                    <button
                      type="button"
                      key={pkg.id}
                      onClick={() =>
                        setCreateForm({
                          ...createForm,
                          selectedPackage: pkg.id,
                        })
                      }
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        createForm.selectedPackage === pkg.id
                          ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold ring-2 ring-indigo-500/20"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <div className="text-xs font-bold">{pkg.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {pkg.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer disabled:bg-indigo-400"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Buat Perusahaan Baru</span>
                </button>
              </div>
            </form>
          </Modal>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* EDIT TENANT MODAL                                             */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Modal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            title={`Edit Profil Tenant #${editForm.id}`}
            subtitle="Ubah informasi perusahaan, status pajak, dan status operasional"
            width="max-w-xl"
          >
            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nama Perusahaan" required>
                  <Input
                    required
                    value={editForm.companyName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, companyName: e.target.value })
                    }
                  />
                </Field>

                <Field label="Subdomain Slug" required>
                  <Input
                    required
                    value={editForm.subdomain}
                    onChange={(e) =>
                      setEditForm({ ...editForm, subdomain: e.target.value })
                    }
                  />
                </Field>

                <Field label="Status Perpajakan" required>
                  <Select
                    value={editForm.taxStatus}
                    onChange={(e) =>
                      setEditForm({ ...editForm, taxStatus: e.target.value })
                    }
                  >
                    <option value="NON_PKP">Non-PKP (Bebas PPN)</option>
                    <option value="PKP">
                      PKP (Pengusaha Kena Pajak - PPN 11%)
                    </option>
                  </Select>
                </Field>

                <Field label="Status Operasional">
                  <Select
                    value={editForm.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        isActive: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Aktif (Dapat Login)</option>
                    <option value="false">Dibekukan (Suspended)</option>
                  </Select>
                </Field>

                <Field label="Email Kontak">
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                </Field>

                <Field label="Telepon">
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                  />
                </Field>
              </div>

              <Field label="Alamat Perusahaan">
                <textarea
                  rows="2"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </Field>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer disabled:bg-indigo-400"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUPERADMIN GLOBAL USER MODAL (Multi-Tenant RBAC)               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {globalUserModalOpen && (
        <Modal
          open={globalUserModalOpen}
          onClose={() => setGlobalUserModalOpen(false)}
          title={
            globalUserFormMode === "CREATE"
              ? "Tambah Akun Pengguna Platform Baru"
              : "Edit Pengaturan Pengguna Platform"
          }
          subtitle="SuperAdmin Control: Kelola role, alokasi perusahaan tenant, gudang, dan matriks izin akses CRUD."
        >
          {modalError && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSaveGlobalUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Perusahaan Tenant" required>
                <Select
                  value={globalUserForm.tenantId}
                  onChange={(e) => {
                    const newTenantId = e.target.value;
                    setGlobalUserForm({
                      ...globalUserForm,
                      tenantId: newTenantId,
                      warehouseId: "",
                    });
                    fetchTenantWarehouses(newTenantId);
                  }}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.companyName} (ID: {t.id})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Role Akses" required>
                <Select
                  value={globalUserForm.role}
                  onChange={(e) =>
                    setGlobalUserForm({
                      ...globalUserForm,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="STAFF">STAFF (Pengguna Reguler/Gudang)</option>
                  <option value="ADMIN">ADMIN (Manajer Perusahaan)</option>
                  <option value="OWNER">OWNER (Pemilik Perusahaan)</option>
                  <option value="SUPERADMIN">
                    SUPERADMIN (Administrator Platform)
                  </option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nama Lengkap" required>
                <Input
                  type="text"
                  placeholder="e.g. Budi Santoso"
                  value={globalUserForm.name}
                  onChange={(e) =>
                    setGlobalUserForm({
                      ...globalUserForm,
                      name: e.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Alamat Email" required>
                <Input
                  type="email"
                  placeholder="budi@perusahaan.com"
                  value={globalUserForm.email}
                  onChange={(e) =>
                    setGlobalUserForm({
                      ...globalUserForm,
                      email: e.target.value,
                    })
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label={`Kata Sandi ${globalUserFormMode === "EDIT" ? "(Kosongkan jika tidak diubah)" : ""}`}
                required={globalUserFormMode === "CREATE"}
              >
                <Input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={globalUserForm.password}
                  onChange={(e) =>
                    setGlobalUserForm({
                      ...globalUserForm,
                      password: e.target.value,
                    })
                  }
                />
              </Field>

              {globalUserForm.role === "STAFF" && (
                <Field label="Gudang Tugas">
                  <Select
                    value={globalUserForm.warehouseId}
                    onChange={(e) =>
                      setGlobalUserForm({
                        ...globalUserForm,
                        warehouseId: e.target.value,
                      })
                    }
                  >
                    <option value="">Seluruh Gudang</option>
                    {tenantWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            {/* Granular Module Level Permissions checklist */}
            {globalUserForm.role !== "OWNER" &&
              globalUserForm.role !== "SUPERADMIN" && (
                <div className="border-t border-zinc-200 pt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
                      Matriks Granular Hak Akses Modul
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                        Template Preset:
                      </span>
                      <button
                        type="button"
                        onClick={() => applyPreset("SALES")}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("PURCHASING")}
                        className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Purchasing
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("GUDANG")}
                        className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Gudang
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("FINANCE")}
                        className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Finance
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("ADMIN")}
                        className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-900 text-white rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Full Akses
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("CLEAR")}
                        className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded text-[10px] font-bold cursor-pointer transition-all"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-64 border border-zinc-200 rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase z-10">
                        <tr>
                          <th className="px-3.5 py-2">Modul ERP</th>
                          <th className="px-2.5 py-2 text-center w-16">
                            Lihat
                          </th>
                          <th className="px-2.5 py-2 text-center w-16">
                            Tambah
                          </th>
                          <th className="px-2.5 py-2 text-center w-16">Ubah</th>
                          <th className="px-2.5 py-2 text-center w-16">
                            Hapus
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                        {[
                          {
                            group: "1. Master Kontak",
                            key: "customers",
                            name: "Pelanggan (Customer)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "1. Master Kontak",
                            key: "suppliers",
                            name: "Pemasok (Supplier)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "1. Master Kontak",
                            key: "salespersons",
                            name: "Sales Person",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "2. Transaksi Operasional",
                            key: "sales_orders",
                            name: "Sales Order (SO)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "2. Transaksi Operasional",
                            key: "purchase_orders",
                            name: "Purchase Order (PO)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "2. Transaksi Operasional",
                            key: "deliveries",
                            name: "Surat Jalan (SJ)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "2. Transaksi Operasional",
                            key: "invoices",
                            name: "Faktur (Invoice/Bills)",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "products",
                            name: "Master Katalog Barang",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "categories",
                            name: "Kategori Barang",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "units",
                            name: "Satuan Barang",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "stock_opname",
                            name: "Stock Opname",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "stock_transfers",
                            name: "Mutasi Stok Antar Gudang",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "3. Master Barang & Inventori",
                            key: "stock_ledger",
                            name: "Kartu Stok (Ledger)",
                            actions: ["read"],
                          },
                          {
                            group: "4. Keuangan & Akuntansi",
                            key: "finance",
                            name: "Kas, Bank & Jurnal",
                            actions: ["read", "create", "update", "delete"],
                          },
                          {
                            group: "5. Laporan ERP",
                            key: "reports",
                            name: "Laporan (Sales, PO, Stok, Fin)",
                            isReport: true,
                            actions: [
                              "sales",
                              "purchase",
                              "inventory",
                              "finance",
                            ],
                          },
                        ].map((m, idx, arr) => {
                          const isFirstInGroup =
                            idx === 0 || arr[idx - 1].group !== m.group;
                          return (
                            <React.Fragment key={m.key}>
                              {isFirstInGroup && (
                                <tr className="bg-zinc-100/70 border-y border-zinc-200">
                                  <td
                                    colSpan="5"
                                    className="px-3.5 py-1 text-[11px] font-bold text-zinc-700 uppercase tracking-wider"
                                  >
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
                                  {m.key === "products" && (
                                    <label className="mt-1 flex items-center space-x-1.5 text-[10px] text-amber-750 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer w-fit hover:bg-amber-100/60 transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={
                                          !!globalUserForm.permissions.products
                                            ?.view_cost
                                        }
                                        onChange={() =>
                                          handlePermissionCheckbox(
                                            "products",
                                            "view_cost",
                                          )
                                        }
                                        className="w-3 h-3 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-amber-900">
                                        Lihat Harga Beli & HPP
                                      </span>
                                    </label>
                                  )}
                                </td>

                                {m.isReport ? (
                                  <td
                                    colSpan="4"
                                    className="px-2.5 py-1.5 text-center"
                                  >
                                    <div className="flex items-center justify-center space-x-3 text-[11px]">
                                      {[
                                        "sales",
                                        "purchase",
                                        "inventory",
                                        "finance",
                                      ].map((repKey) => {
                                        const isChecked = !!(
                                          globalUserForm.permissions.reports &&
                                          globalUserForm.permissions.reports[
                                            repKey
                                          ]
                                        );
                                        const repLabels = {
                                          sales: "Penjualan",
                                          purchase: "Pembelian",
                                          inventory: "Stok",
                                          finance: "Keuangan",
                                        };
                                        return (
                                          <label
                                            key={repKey}
                                            className="inline-flex items-center space-x-1 cursor-pointer"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() =>
                                                handlePermissionCheckbox(
                                                  "reports",
                                                  repKey,
                                                )
                                              }
                                              className="w-3.5 h-3.5 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="text-zinc-600 font-semibold">
                                              {repLabels[repKey]}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </td>
                                ) : (
                                  ["read", "create", "update", "delete"].map(
                                    (action) => {
                                      const isSupported =
                                        m.actions.includes(action);
                                      const isChecked =
                                        isSupported &&
                                        !!(
                                          globalUserForm.permissions[m.key] &&
                                          globalUserForm.permissions[m.key][
                                            action
                                          ]
                                        );
                                      return (
                                        <td
                                          key={action}
                                          className="px-2.5 py-1.5 text-center"
                                        >
                                          {isSupported ? (
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() =>
                                                handlePermissionCheckbox(
                                                  m.key,
                                                  action,
                                                )
                                              }
                                              className="w-3.5 h-3.5 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                          ) : (
                                            <span className="text-zinc-300 font-mono text-[10px]">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      );
                                    },
                                  )
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

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setGlobalUserModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer disabled:bg-indigo-400"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Simpan Pengguna Platform</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default SuperAdmin;

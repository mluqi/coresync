import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api";
import DataTable from "../components/DataTable";
import ConfirmationModal from "../components/ConfirmationModal";
import SearchSelect from "../components/SearchSelect";
import PageHeader from "../components/PageHeader";
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Package,
  Upload,
  Eye,
  Image as ImageIcon,
  Tag,
  DollarSign,
  Layers,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTaxMode } from "../context/TaxModeContext";
import { hasPermission } from "../utils/permission";
import {
  formatRupiah,
  formatStockBreakdown,
  formatStockBreakdownCompact,
} from "../utils/format";
import getImageUrl from "../utils/imageUrl";

// --- Helper: debounce ---
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const Products = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { taxMode, taxStatusQuery } = useTaxMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // URL state
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const categoryFilter = searchParams.get("category") || "";
  const taxStatusFilter = searchParams.get("taxStatus") || "";
  const effectiveTaxStatus = taxStatusFilter || taxStatusQuery;
  const lowStockFilter = searchParams.get("lowStock") === "true";
  const sortBy = searchParams.get("sortBy") || "name";
  const sortDir = searchParams.get("sortDir") || "ASC";

  // Local input state
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [units, setUnits] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState(null);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleSort = (sKey, sDir) => {
    const next = new URLSearchParams(searchParams);
    next.set("sortBy", sKey);
    next.set("sortDir", sDir);
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [autoSku, setAutoSku] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productUnits, setProductUnits] = useState([]);
  const [productSuppliers, setProductSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    unit: "KRT",
    sellingPrice: "",
    purchasePrice: "",
    taxId: "",
    categoryId: "",
    category: "",
    supplierId: "",
    supplier: "",
    minStock: 10,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [zoomModal, setZoomModal] = useState({
    isOpen: false,
    url: "",
    title: "",
  });

  // --- Excel Import States ---
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importStats, setImportStats] = useState(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info",
  });

  const canRead = hasPermission(user, "products", "read");
  const canCreate = hasPermission(user, "products", "create");
  const canUpdate = hasPermission(user, "products", "update");
  const canDelete = hasPermission(user, "products", "delete");
  const canViewCost = hasPermission(user, "products", "view_cost");

  useEffect(() => {
    if (location.state?.editProductId && products.length > 0) {
      const target = products.find(
        (p) => p.id === location.state.editProductId,
      );
      if (target) {
        handleOpenEdit(target);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, products]);

  // Helper: Chained Multi-Unit calculation & price suggestions
  const getChainedUnitInfo = (
    index,
    currentUnits,
    baseUnit,
    baseBuyPrice,
    baseSellPrice,
  ) => {
    const parentUnitName =
      index === 0
        ? baseUnit || "Satuan Dasar"
        : currentUnits[index - 1]?.unitName || `Satuan Tingkat ${index + 1}`;

    let totalFactor = 1;
    for (let i = 0; i <= index; i++) {
      const qty = parseFloat(currentUnits[i]?.qtyFactor) || 1;
      totalFactor *= qty;
    }

    const parentBuyPrice =
      index === 0
        ? parseFloat(baseBuyPrice) || 0
        : parseFloat(currentUnits[index - 1]?.purchasePrice) || 0;

    const parentSellPrice =
      index === 0
        ? parseFloat(baseSellPrice) || 0
        : parseFloat(currentUnits[index - 1]?.sellingPrice) || 0;

    const currentQty = parseFloat(currentUnits[index]?.qtyFactor) || 1;
    const suggestedBuy =
      currentQty > 0 ? Math.round(parentBuyPrice / currentQty) : 0;
    const suggestedSell =
      currentQty > 0 ? Math.round(parentSellPrice / currentQty) : 0;

    return {
      parentUnitName,
      totalFactor: Math.round(totalFactor * 10000) / 10000,
      suggestedBuy,
      suggestedSell,
    };
  };

  const handleAddAlternateUnit = () => {
    const nextIndex = productUnits.length;
    const defaultUnitName =
      nextIndex === 0
        ? "renceng"
        : nextIndex === 1
          ? "pcs"
          : units[0]?.name || "pcs";

    setProductUnits((prev) => [
      ...prev,
      {
        unitName: defaultUnitName,
        relationType: "ECERAN",
        qtyFactor: nextIndex === 0 ? "20" : "10",
        purchasePrice: "",
        sellingPrice: "",
        isBaseUnit: false,
      },
    ]);
  };

  const handleUpdateAlternateUnit = (index, field, value) => {
    setProductUnits((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveAlternateUnit = (index) => {
    setProductUnits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file extension & type: JPG, JPEG, PNG only
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error(
        "Hanya file gambar dengan format JPG, JPEG, dan PNG yang diizinkan!",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file gambar maksimal 5MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  // Sync debounced search to URL (and reset to page 1)
  useEffect(() => {
    if (debouncedSearch !== search) {
      const next = new URLSearchParams(searchParams);
      if (debouncedSearch) {
        next.set("search", debouncedSearch);
      } else {
        next.delete("search");
      }
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }
  }, [debouncedSearch]);

  // Sync input value with URL param when it changes externally
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  // Fetch when page, limit, search, category filter, taxStatus filter, lowStock or sort changes in URL
  useEffect(() => {
    fetchData();
  }, [
    page,
    limit,
    search,
    categoryFilter,
    taxStatusFilter,
    lowStockFilter,
    sortBy,
    sortDir,
    taxMode,
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const prodParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortBy,
        sortDir: sortDir,
      });
      if (search.trim()) prodParams.set("search", search.trim());
      if (categoryFilter.trim())
        prodParams.set("category", categoryFilter.trim());
      if (effectiveTaxStatus) prodParams.set("taxStatus", effectiveTaxStatus);
      if (lowStockFilter) prodParams.set("lowStock", "true");

      const prodRes = await api.get(`/products?${prodParams.toString()}`);
      const taxRes = await api.get("/taxes");
      const unitRes = await api.get("/units?limit=100&isActive=true");
      const catRes = await api.get("/categories");
      const suppRes = await api
        .get("/suppliers?limit=100")
        .catch(() => ({ data: { data: [] } }));

      setProducts(prodRes.data.data);
      setPagination(prodRes.data.pagination);
      setTaxes(taxRes.data.data);
      setUnits(unitRes.data.data || []);
      setCategoriesList(catRes.data.data || []);
      setSuppliersList(suppRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gagal memuat data barang.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", newPage.toString());
    setSearchParams(next, { replace: true });
  };

  const handleAddSupplier = () => {
    const availableSupp =
      suppliersList.find(
        (s) =>
          String(s.id) !== String(formData.supplierId) &&
          !productSuppliers.some(
            (ps) => String(ps.supplierId) === String(s.id),
          ),
      ) || suppliersList[0];

    setProductSuppliers((prev) => [
      ...prev,
      {
        supplierId: availableSupp?.id || "",
        purchasePrice: "",
        minOrderQty: "1",
        notes: "",
      },
    ]);
  };

  const handleUpdateSupplier = (index, field, value) => {
    setProductSuppliers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveSupplier = (index) => {
    setProductSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenAdd = async () => {
    setEditingProduct(null);
    setAutoSku(true);
    setProductUnits([]);
    setProductSuppliers([]);
    const defaultCat = categoriesList[0];
    const defaultSupp =
      suppliersList.find((s) => s.code === "SUP-00026") || suppliersList[0];

    let nextSkuPreview = "PRD-00001";
    try {
      const res = await api.get("/products/next-sku");
      if (res.data?.data?.nextSku) {
        nextSkuPreview = res.data.data.nextSku;
      }
    } catch (e) {
      console.error("Failed to get next SKU:", e);
    }

    setFormData({
      sku: nextSkuPreview,
      name: "",
      unit:
        units.find((u) => u.name === "KRT")?.name || units[0]?.name || "KRT",
      sellingPrice: "",
      purchasePrice: "",
      taxId: taxes[0]?.id || "",
      categoryId: defaultCat?.id || "",
      category: defaultCat?.name || "",
      supplierId: defaultSupp?.id || "",
      supplier: defaultSupp?.name || "",
      minStock: 10,
    });
    setImageFile(null);
    setImagePreview("");
    setSaveError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setAutoSku(false);

    // Sort alternate units by items per base ascending (e.g. 20 Renceng, then 200 Pcs)
    const sortedAlternateUnits = (prod.units || [])
      .filter((u) => !u.isBaseUnit && parseFloat(u.conversionRatio) !== 1)
      .map((u) => {
        const rawRatio = parseFloat(u.conversionRatio) || 1.0;
        const totalItemsPerBase =
          rawRatio < 1.0 ? Math.round(1 / rawRatio) : rawRatio;
        return {
          ...u,
          totalItemsPerBase,
        };
      })
      .sort((a, b) => a.totalItemsPerBase - b.totalItemsPerBase);

    let prevTotal = 1;
    const altUnits = sortedAlternateUnits.map((u) => {
      const stepQty =
        u.totalItemsPerBase > 0 && prevTotal > 0
          ? Math.round((u.totalItemsPerBase / prevTotal) * 10000) / 10000
          : 1;
      prevTotal = u.totalItemsPerBase;
      return {
        ...u,
        relationType: "ECERAN",
        qtyFactor: String(stepQty),
        purchasePrice: u.purchasePrice || "",
        sellingPrice: u.sellingPrice || "",
      };
    });

    setProductUnits(altUnits);

    const primarySuppId =
      prod.supplierId || prod.supplier?.id || prod.metadata?.supplierId;
    const altSuppliers = (prod.productSuppliers || [])
      .filter(
        (ps) =>
          !ps.isPrimary && String(ps.supplierId) !== String(primarySuppId),
      )
      .map((ps) => ({
        supplierId: ps.supplierId,
        purchasePrice: ps.purchasePrice || "",
        minOrderQty: String(ps.minOrderQty || 1),
        notes: ps.notes || "",
      }));
    setProductSuppliers(altSuppliers);

    setFormData({
      sku: prod.sku,
      name: prod.name,
      unit: prod.unit,
      sellingPrice: prod.sellingPrice,
      purchasePrice: prod.purchasePrice || 0,
      taxId: prod.taxId || "",
      categoryId: prod.categoryId || prod.category?.id || "",
      category: prod.category?.name || prod.metadata?.category || "",
      supplierId:
        prod.supplierId || prod.supplier?.id || prod.metadata?.supplierId || "",
      supplier: prod.supplier?.name || prod.metadata?.supplier || "",
      minStock: prod.minStock !== undefined ? prod.minStock : 10,
    });
    setImageFile(null);
    setImagePreview(prod.image || prod.metadata?.image || "");
    setSaveError("");
    setModalOpen(true);
  };

  const handleConfirmDelete = (product) => {
    setConfirmConfig({
      isOpen: true,
      title: "Hapus Barang",
      message: `Apakah Anda yakin ingin menghapus barang ${product.name}? Data yang terhapus tidak dapat dikembalikan.`,
      type: "danger",
      onConfirm: async () => {
        try {
          setSaveLoading(true);
          await api.delete(`/products/${product.id}`);
          toast.success(`Barang "${product.name}" berhasil dihapus.`);
          fetchData();
        } catch (err) {
          const msg = err.response?.data?.message || "Gagal menghapus barang.";
          setError(msg);
          toast.error(msg);
        } finally {
          setSaveLoading(false);
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSave = async () => {
    setSaveError("");
    setSaveLoading(true);

    let finalSku = formData.sku ? formData.sku.trim() : "";

    // Calculate cumulative chained conversion ratio for each tier
    let cumulativeFactor = 1;
    const alternatePayload = productUnits.map((u) => {
      const stepQty = parseFloat(u.qtyFactor) || 1.0;
      cumulativeFactor *= stepQty;
      const ratio = 1 / cumulativeFactor; // Conversion ratio to base unit
      return {
        unitName: u.unitName,
        conversionRatio: ratio,
        isBaseUnit: false,
        purchasePrice: parseFloat(u.purchasePrice) || 0,
        sellingPrice: parseFloat(u.sellingPrice) || 0,
      };
    });

    const allUnitsPayload = [
      {
        unitName: formData.unit,
        conversionRatio: 1.0,
        isBaseUnit: true,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
      },
      ...alternatePayload,
    ];

    const allSuppliersPayload = [
      {
        supplierId: formData.supplierId,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        isPrimary: true,
      },
      ...productSuppliers
        .filter(
          (ps) =>
            ps.supplierId &&
            String(ps.supplierId) !== String(formData.supplierId),
        )
        .map((ps) => ({
          supplierId: ps.supplierId,
          purchasePrice:
            ps.purchasePrice !== ""
              ? parseFloat(ps.purchasePrice)
              : parseFloat(formData.purchasePrice) || 0,
          minOrderQty: parseFloat(ps.minOrderQty) || 1,
          isPrimary: false,
          notes: ps.notes || null,
        })),
    ];

    const dataPayload = new FormData();
    dataPayload.append("sku", finalSku);
    dataPayload.append("name", formData.name);
    dataPayload.append("unit", formData.unit);
    dataPayload.append("sellingPrice", formData.sellingPrice);
    dataPayload.append("purchasePrice", formData.purchasePrice || 0);
    dataPayload.append(
      "minStock",
      formData.minStock !== undefined ? formData.minStock : 10,
    );
    if (formData.categoryId)
      dataPayload.append("categoryId", formData.categoryId);
    if (formData.supplierId)
      dataPayload.append("supplierId", formData.supplierId);
    if (formData.taxId) dataPayload.append("taxId", formData.taxId);
    dataPayload.append(
      "metadata",
      JSON.stringify({
        category: formData.category,
        supplier: formData.supplier,
        supplierId: formData.supplierId,
      }),
    );
    dataPayload.append("units", JSON.stringify(allUnitsPayload));
    dataPayload.append("suppliers", JSON.stringify(allSuppliersPayload));

    if (imageFile) {
      dataPayload.append("image", imageFile);
    } else if (imagePreview === "" && editingProduct) {
      dataPayload.append("image", "");
    }

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, dataPayload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`Data barang "${formData.name}" berhasil diperbarui!`);
      } else {
        await api.post("/products", dataPayload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`Barang baru "${formData.name}" berhasil ditambahkan!`);
      }
      setSaveLoading(false);
      setModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal menyimpan barang.";
      setSaveError(msg);
      toast.error(msg);
      setSaveLoading(false);
    } finally {
      setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleConfirmSave = (e) => {
    e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: editingProduct ? "Ubah Detail Barang" : "Tambah Barang Baru",
      message: `Apakah Anda yakin ingin menyimpan data barang ${formData.name}?`,
      type: "info",
      onConfirm: () => handleSave(),
    });
  };

  const columns = [
    {
      key: "image",
      label: "Gambar",
      headerClassName: "w-16 text-center",
      className: "text-center",
      render: (_, row) => {
        const rawImgUrl = row.image || row.metadata?.image;
        if (!rawImgUrl) {
          return (
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex flex-col items-center justify-center text-zinc-400 mx-auto shadow-2xs">
              <Package size={18} />
            </div>
          );
        }
        const fullImgUrl = getImageUrl(rawImgUrl);
        return (
          <div
            onClick={() =>
              setZoomModal({ isOpen: true, url: fullImgUrl, title: row.name })
            }
            className="w-10 h-10 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-indigo-500/30 transition-all mx-auto group relative shadow-2xs"
            title="Klik untuk memperbesar gambar"
          >
            <img
              src={fullImgUrl}
              alt={row.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Eye size={14} className="text-white" />
            </div>
          </div>
        );
      },
    },
    {
      key: "sku",
      label: "SKU",
      sortable: true,
      className: "font-mono font-semibold text-zinc-900",
      render: (v, row) => (
        <button
          onClick={() => navigate(`/products/${row.id}`)}
          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-left cursor-pointer"
        >
          {v}
        </button>
      ),
    },
    {
      key: "name",
      label: "Nama Barang",
      sortable: true,
      className: "font-medium text-zinc-900",
      render: (v, row) => (
        <button
          onClick={() => navigate(`/products/${row.id}`)}
          className="font-bold text-zinc-900 hover:text-indigo-600 text-left cursor-pointer"
        >
          {v}
        </button>
      ),
    },
    {
      key: "category",
      label: "Kategori",
      render: (_, row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
          {row.category?.name ||
            row.metadata?.category ||
            row.metadata?.kategori ||
            "Umum"}
        </span>
      ),
    },
    {
      key: "unit",
      label: "Satuan",
      render: (v, row) => {
        const altUnits = row.units
          ? row.units.filter(
              (u) => !u.isBaseUnit && parseFloat(u.conversionRatio) !== 1,
            )
          : [];
        return (
          <div className="space-y-1">
            <span className="font-bold text-zinc-900 text-xs flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-mono font-bold uppercase">
                {v ? v.toUpperCase() : "PCS"}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold">
                (Base)
              </span>
            </span>
            {altUnits.length > 0 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help"
                title={altUnits
                  .map((u) => {
                    const r = parseFloat(u.conversionRatio);
                    const desc =
                      r < 1
                        ? `1 ${v} = ${Math.round(1 / r)} ${u.unitName}`
                        : `1 ${u.unitName} = ${r} ${v}`;
                    return `${desc} (Harga Jual: Rp ${parseFloat(u.sellingPrice).toLocaleString("id-ID")})`;
                  })
                  .join("\n")}
              >
                + {altUnits.length} Satuan (
                {altUnits.map((u) => u.unitName).join(", ")})
              </span>
            )}
          </div>
        );
      },
    },
    ...(canViewCost
      ? [
          {
            key: "purchasePrice",
            label: "Harga Beli",
            sortable: true,
            className: "font-mono text-zinc-600",
            render: (v) => `Rp${parseFloat(v || 0).toLocaleString("id-ID")}`,
          },
        ]
      : []),
    {
      key: "sellingPrice",
      label: "Harga Jual",
      sortable: true,
      className: "font-semibold text-zinc-950 font-mono",
      render: (v) => `Rp${parseFloat(v).toLocaleString("id-ID")}`,
    },
    {
      key: "tax",
      label: "Status Pajak",
      render: (tax) => {
        const isPkp =
          tax?.rate > 0 && !tax?.name?.toLowerCase().includes("non");
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
              isPkp
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs"
                : "bg-zinc-100 text-zinc-600 border-zinc-200"
            }`}
          >
            {isPkp ? tax.name || "PKP (PPN)" : tax?.name || "Non-PKP"}
          </span>
        );
      },
    },
    {
      key: "totalStock",
      label: "Stok Gudang",
      sortable: true,
      sortKey: "stock",
      className: "text-right font-bold text-zinc-900 font-mono",
      headerClassName: "text-right",
      render: (v, row) => {
        const stock = v !== undefined ? v : row.stock || 0;
        const min = row.minStock !== undefined ? row.minStock : 10;
        const isLow = stock <= min;
        const isOut = stock === 0;
        const fullBreakdown = formatStockBreakdown(stock, row);
        const compactBreakdown = formatStockBreakdownCompact(stock, row);

        const units = row.units || row.availableUnits || [];
        const hasSubUnits = units.some((u) => !u.isBaseUnit);

        return (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 justify-end">
              {isOut && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                  HABIS
                </span>
              )}
              {!isOut && isLow && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200">
                  MENIPIS
                </span>
              )}
              <span
                className={`font-mono font-extrabold text-xs ${isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-zinc-900"}`}
              >
                {compactBreakdown}
              </span>
            </div>

            {hasSubUnits && (
              <span
                className="text-[10px] font-medium text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 font-mono text-right"
                title={`Rincian Stok Lengkap: ${fullBreakdown}`}
              >
                {fullBreakdown}
              </span>
            )}

            <div className="flex items-center justify-end flex-wrap gap-1.5 text-[10px] text-zinc-400 font-mono font-normal">
              {parseFloat(row.totalBonusStock || 0) > 0 ? (
                <span
                  className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold"
                  title="Stok Bonus (Free Goods/Promo)"
                >
                  Bonus: {formatStockBreakdownCompact(row.totalBonusStock, row)}
                </span>
              ) : (
                <span className="text-zinc-400">Bonus: 0</span>
              )}
              {row.allocatedStock > 0 && (
                <span
                  className="text-amber-700 font-semibold"
                  title="Stok sudah dipesan di SO tapi belum dikirim"
                >
                  Terpesan:{" "}
                  {formatStockBreakdownCompact(row.allocatedStock, row)}
                </span>
              )}
              <span>
                Min: {min} {row.unit || "KRT"}
              </span>
            </div>
          </div>
        );
      },
    },
    ...(canRead || canUpdate || canDelete
      ? [
          {
            key: "id",
            label: "Tindakan",
            headerClassName: "text-center w-28",
            className: "text-center",
            render: (_, row) => (
              <div className="flex items-center justify-center space-x-1">
                <button
                  onClick={() => navigate(`/products/${row.id}`)}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-lg transition-all cursor-pointer"
                  title="Lihat Detail Barang"
                >
                  <Eye size={15} />
                </button>
                {canUpdate && (
                  <button
                    onClick={() => handleOpenEdit(row)}
                    className="p-1.5 text-zinc-500 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded-lg transition-all cursor-pointer"
                    title="Ubah Barang"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleConfirmDelete(row)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                    title="Hapus Barang"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const unitOptions = units.map((u) => ({
    value: u.name,
    label: u.name.toUpperCase(),
    sublabel: u.description || "",
  }));
  if (unitOptions.length === 0) {
    unitOptions.push({ value: "pcs", label: "PCS", sublabel: "Default unit" });
  }

  const categoryOptions = categoriesList.map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.code ? `Kode SKU: ${c.code}` : "",
  }));

  const supplierOptions = suppliersList.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: s.code ? `Kode: ${s.code}` : "",
  }));

  const categoryFilterOptions = [
    { value: "", label: "Semua Kategori" },
    ...categoriesList.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
      sublabel: cat.code ? `Kode SKU: ${cat.code}` : "",
    })),
  ];

  const taxOptions = taxes.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.rate}%)`,
    sublabel: `Tarif: ${t.rate}%`,
  }));

  const [exportLoading, setExportLoading] = useState(false);

  const handleExportExcel = async () => {
    if (exportLoading) return;
    try {
      setExportLoading(true);
      toast.info("Mengambil seluruh data master barang dari server...");

      const res = await api.get("/products?limit=all");
      const allProducts = res.data?.data || [];

      if (!allProducts || allProducts.length === 0) {
        toast.error("Tidak ada data barang untuk diunduh.");
        return;
      }

      toast.info(`Menyusun ${allProducts.length} data barang ke Excel...`);

      const singleRowHeaders = [
        "No",
        "SKU / Kode Barang",
        "Nama Barang",
        "Kategori",
        "Supplier Utama",
        "Supplier Alternatif",
        "Satuan Dasar",
        ...(canViewCost ? ["Harga Beli Dasar"] : []),
        "Harga Jual Dasar",
        "Stok Total",
        "Stok Alokasi SO",
        "Stok Efektif",
        "Pajak (PPN)",
        "Satuan Alternatif 1",
        "Konversi Satuan 1 (Isi per Satuan Dasar)",
        ...(canViewCost ? ["Harga Beli Satuan 1"] : []),
        "Harga Jual Satuan 1",
        "Satuan Alternatif 2",
        "Konversi Satuan 2 (Isi per Satuan Dasar)",
        ...(canViewCost ? ["Harga Beli Satuan 2"] : []),
        "Harga Jual Satuan 2",
        "Stok Minimum",
        "Deskripsi",
      ];

      const rows = allProducts.map((p, idx) => {
        let primarySupp = p.supplier?.name || p.metadata?.supplier;
        if (!primarySupp || primarySupp === "SUPPLIER UMUM") {
          if (p.description && p.description.includes("Supplier:")) {
            const match = p.description.match(/Supplier:\s*([^;\n]+)/i);
            if (
              match &&
              match[1].trim() &&
              match[1].trim() !== "SUPPLIER UMUM"
            ) {
              primarySupp = match[1].trim();
            }
          }
        }
        if (!primarySupp) primarySupp = "SUPPLIER UMUM";

        const altSuppliers = (p.productSuppliers || [])
          .filter(
            (ps) =>
              !ps.isPrimary && String(ps.supplierId) !== String(p.supplierId),
          )
          .map((ps) => ps.supplier?.name)
          .filter(Boolean)
          .join(", ");

        const altUnits = (p.units || []).filter(
          (u) => !u.isBaseUnit && parseFloat(u.conversionRatio) !== 1,
        );

        const alt1 = altUnits[0] || null;
        const alt2 = altUnits[1] || null;

        const conv1 = alt1
          ? parseFloat(alt1.conversionRatio) < 1
            ? Math.round(1 / parseFloat(alt1.conversionRatio))
            : parseFloat(alt1.conversionRatio)
          : "";
        const conv2 = alt2
          ? parseFloat(alt2.conversionRatio) < 1
            ? Math.round(1 / parseFloat(alt2.conversionRatio))
            : parseFloat(alt2.conversionRatio)
          : "";

        const row = [
          String(idx + 1),
          p.sku || "",
          p.name || "",
          p.category?.name || p.metadata?.category || "",
          primarySupp,
          altSuppliers || "-",
          p.unit || "KRT",
        ];

        if (canViewCost) row.push(String(p.purchasePrice || 0));
        row.push(String(p.sellingPrice || 0));
        row.push(String(p.stock !== undefined ? p.stock : 0));
        row.push(String(p.allocatedStock !== undefined ? p.allocatedStock : 0));
        row.push(
          String(
            p.availableStock !== undefined ? p.availableStock : p.stock || 0,
          ),
        );
        row.push(
          p.tax
            ? `${p.tax.name} (${p.tax.rate}%)`
            : p.taxId === 1
              ? "PKP"
              : "Non-PPN",
        );
        row.push(alt1 ? alt1.unitName || "" : "");
        row.push(conv1 ? String(conv1) : "");
        if (canViewCost) row.push(alt1 ? String(alt1.purchasePrice || "") : "");
        row.push(alt1 ? String(alt1.sellingPrice || "") : "");
        row.push(alt2 ? alt2.unitName || "" : "");
        row.push(conv2 ? String(conv2) : "");
        if (canViewCost) row.push(alt2 ? String(alt2.purchasePrice || "") : "");
        row.push(alt2 ? String(alt2.sellingPrice || "") : "");
        row.push(String(p.minStock !== undefined ? p.minStock : 10));
        row.push(p.description || "");

        return row;
      });

      const wsData = [singleRowHeaders, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-fit column widths
      const cols = [
        { wch: 6 }, // No
        { wch: 20 }, // SKU
        { wch: 38 }, // Nama
        { wch: 18 }, // Kategori
        { wch: 26 }, // Supplier Utama
        { wch: 24 }, // Supplier Alternatif
        { wch: 12 }, // Satuan Dasar
      ];
      if (canViewCost) cols.push({ wch: 16 }); // Harga Beli Dasar
      cols.push({ wch: 16 }); // Harga Jual Dasar
      cols.push({ wch: 12 }); // Stok Total
      cols.push({ wch: 14 }); // Stok Alokasi
      cols.push({ wch: 14 }); // Stok Efektif
      cols.push({ wch: 14 }); // Pajak
      cols.push({ wch: 18 }); // Satuan Alt 1
      cols.push({ wch: 22 }); // Konversi Alt 1
      if (canViewCost) cols.push({ wch: 18 }); // Harga Beli Alt 1
      cols.push({ wch: 18 }); // Harga Jual Alt 1
      cols.push({ wch: 18 }); // Satuan Alt 2
      cols.push({ wch: 22 }); // Konversi Alt 2
      if (canViewCost) cols.push({ wch: 18 }); // Harga Beli Alt 2
      cols.push({ wch: 18 }); // Harga Jual Alt 2
      cols.push({ wch: 14 }); // Stok Minimum
      cols.push({ wch: 30 }); // Deskripsi

      ws["!cols"] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Master_Barang");

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Data_Master_Barang_CoreSync_${dateStr}.xlsx`);
      toast.success(
        `Berhasil mengunduh ${allProducts.length} data barang lengkap ke Excel!`,
      );
    } catch (err) {
      console.error("Export product error:", err);
      toast.error(
        "Gagal mengunduh data barang: " +
          (err.response?.data?.message || err.message || "Terjadi kesalahan"),
      );
    } finally {
      setExportLoading(false);
    }
  };

  // ─── Excel Template Download & Import Handlers ───────────────────────────
  const downloadExcelTemplate = () => {
    const headers = [
      "No",
      "Kode Barang (SKU)",
      "Nama Barang",
      "Kategori ID",
      "Supplier ID",
      "Satuan Dasar",
      "Harga Jual Satuan",
      "Harga Beli Satuan",
      "Stok Minimum",
      "Status Pajak (PKP / Non-PKP)",
      "Deskripsi / Keterangan",
      "Satuan Alternatif 1",
      "Konversi Satuan 1 (Isi per Satuan Dasar)",
      "Harga Jual Satuan 1",
      "Harga Beli Satuan 1",
      "Satuan Alternatif 2",
      "Konversi Satuan 2 (Isi per Satuan Alternatif 1)",
      "Harga Jual Satuan 2",
      "Harga Beli Satuan 2",
      "Stok Awal",
    ];

    const sampleRow1 = [
      "1",
      "KOBE-BONCABE-LV10",
      "KOBE BON CABE LV 10 6GR NEW",
      "1", // Kategori ID 1 = Bumbu Dapur
      "1", // Supplier ID 1 = PT. ARTA DWITUNGGAL ABADI
      "KRT",
      "185000",
      "165000",
      "10",
      "PKP",
      "Boncabe Level 10 kemasan sachet 6gr",
      "RCG",
      "20",
      "9500",
      "8250",
      "PCS",
      "10",
      "1000",
      "825",
      "50",
    ];

    const sampleRow2 = [
      "2",
      "INDOMIE-GOR-SP",
      "INDOMIE GORENG SPESIAL 85GR",
      "6", // Kategori ID 6 = Mie & Pasta
      "26", // Supplier ID 26 = SUPPLIER UMUM
      "KRT",
      "118000",
      "105000",
      "20",
      "PKP",
      "Indomie Goreng Rasa Spesial isi 40 bungkus",
      "PCS",
      "40",
      "3100",
      "2650",
      "",
      "",
      "",
      "",
      "100",
    ];

    const sampleRow3 = [
      "3",
      "KERUPUK-CK-MAWAR",
      "KERUPUK CAHAYA KITA MAWAR",
      "5", // Kategori ID 5 = Kerupuk / Makanan Ringan
      "2", // Supplier ID 2 = CAHAYA KITA
      "BAL",
      "65000",
      "55000",
      "5",
      "Non-PKP",
      "Kerupuk Mawar Bal 5kg",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "30",
    ];

    const wsData = [headers, sampleRow1, sampleRow2, sampleRow3];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Barang");

    // Reference Sheet for Category & Supplier IDs
    const refData = [
      ["=== DAFTAR KATEGORI ID (PILIH SALAH SATU ID DI BAWAH) ===", "", ""],
      ["Kategori ID", "Kode Kategori", "Nama Kategori"],
      ...categoriesList.map((c) => [String(c.id), c.code || "", c.name || ""]),
      ["", "", ""],
      ["=== DAFTAR SUPPLIER ID (PILIH SALAH SATU ID DI BAWAH) ===", "", ""],
      ["Supplier ID", "Kode Supplier", "Nama Supplier"],
      ...suppliersList.map((s) => [String(s.id), s.code || "", s.name || ""]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    XLSX.utils.book_append_sheet(wb, wsRef, "Petunjuk_ID_Referensi");

    XLSX.writeFile(wb, "Format_Master_Barang_CoreSync.xlsx");
    toast.success(
      "Template Excel dengan Petunjuk ID Referensi berhasil diunduh!",
    );
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportError("");
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (!rows || rows.length < 2) {
          setImportError("File Excel tidak memiliki baris data.");
          setImportPreview([]);
          return;
        }

        setImportPreview(rows.slice(0, 12));
      } catch (err) {
        setImportError("Gagal membaca file Excel: " + err.message);
        setImportPreview([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (!importFile) {
      setImportError("Pilih file Excel terlebih dahulu.");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportStats(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", importFile);

      const res = await api.post("/products/import", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setImportStats(res.data.stats);
      toast.success(res.data.message || "Import data master barang berhasil!");
      fetchData();
    } catch (err) {
      console.error("Import product error:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Gagal memproses file import.";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Header with Main Actions */}
      <PageHeader
        title="Daftar Master Barang"
        subtitle="Kelola katalog produk, harga beli, harga jual, dan persediaan stok."
        icon={Package}
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={exportLoading}
              title="Unduh seluruh data master barang ke file Excel"
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
            >
              {exportLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              <span>Unduh Data Excel</span>
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  setImportPreview([]);
                  setImportError("");
                  setImportStats(null);
                  setImportModalOpen(true);
                }}
                className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <FileSpreadsheet size={15} />
                <span>Import Excel</span>
              </button>
            )}

            {canCreate && (
              <button
                onClick={handleOpenAdd}
                className="bg-theme bg-theme-hover text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Tambah Barang</span>
              </button>
            )}
          </div>
        }
      />

      {/* Filter & Search Toolbar (Placed neatly below PageHeader) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-3 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Left Side: Search + Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Cari nama barang, SKU..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-zinc-50/70 focus:bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
            />
            {inputValue && (
              <button
                onClick={() => setInputValue("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Category Select2 */}
          <div className="w-full sm:w-48">
            <SearchSelect
              options={categoryFilterOptions}
              value={categoryFilter}
              onChange={(opt) => updateParam("category", opt ? opt.value : "")}
              placeholder="Semua Kategori"
              searchPlaceholder="Cari kategori..."
            />
          </div>

          {/* Filter Status Pajak (PKP / Non-PKP) */}
          <div className="w-full sm:w-44">
            <select
              value={taxStatusFilter}
              onChange={(e) => updateParam("taxStatus", e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50/70 focus:bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
            >
              <option value="">Semua Pajak</option>
              <option value="PKP">Barang PKP (PPN)</option>
              <option value="NON_PKP">Barang Non-PKP</option>
            </select>
          </div>

          {/* Filter Stok Menipis Toggle */}
          <button
            type="button"
            onClick={() =>
              updateParam("lowStock", lowStockFilter ? "" : "true")
            }
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border shrink-0 ${
              lowStockFilter
                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-zinc-50/70 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            }`}
            title="Filter produk dengan stok <= batas minimum"
          >
            <AlertTriangle
              size={14}
              className={lowStockFilter ? "text-white" : "text-amber-500"}
            />
            <span>Stok Menipis</span>
          </button>
        </div>

        {/* Right Side: Page Limit */}
        <div className="flex items-center space-x-1.5 shrink-0 self-end lg:self-center">
          <span className="text-xs font-semibold text-zinc-500 hidden sm:inline">
            Tampilkan:
          </span>
          <select
            value={limit}
            onChange={(e) => updateParam("limit", e.target.value)}
            className="px-3 py-2 bg-zinc-50/70 focus:bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
          >
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Error info banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Products DataTable */}
      <DataTable
        columns={columns}
        data={products}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        emptyText="Belum ada data barang."
        emptyIcon={<Package size={40} />}
        rowKey="id"
      />

      {/* Add/Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {editingProduct
                      ? "Ubah Master Barang"
                      : "Tambah Barang Baru"}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Lengkapi data barang, skema harga beli/jual, satuan, dan
                    foto produk.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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

              <form
                id="productForm"
                onSubmit={handleConfirmSave}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left & Middle: Product Info & Pricing (2 cols) */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Section 1: General Info */}
                    <div className="space-y-3.5">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag size={13} className="text-indigo-600" />
                        <span>Informasi Umum Barang</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* SKU */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                              SKU / Kode Barang{" "}
                              {!autoSku && (
                                <span className="text-rose-500">*</span>
                              )}
                            </label>
                            {!editingProduct && (
                              <div className="flex items-center space-x-1.5 select-none">
                                <input
                                  type="checkbox"
                                  id="autoSku"
                                  checked={autoSku}
                                  onChange={(e) => {
                                    setAutoSku(e.target.checked);
                                    if (e.target.checked)
                                      setFormData((prev) => ({
                                        ...prev,
                                        sku: "",
                                      }));
                                  }}
                                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                />
                                <label
                                  htmlFor="autoSku"
                                  className="text-[11px] font-bold text-zinc-500 hover:text-zinc-700 cursor-pointer uppercase"
                                >
                                  Otomatis
                                </label>
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            required={!autoSku}
                            placeholder={
                              autoSku
                                ? "PRD-00001 (Otomatis)"
                                : "e.g. PRD-00001"
                            }
                            value={formData.sku || ""}
                            onChange={(e) =>
                              setFormData({ ...formData, sku: e.target.value })
                            }
                            disabled={editingProduct || autoSku}
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold text-indigo-700 placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none disabled:opacity-80"
                          />
                          {autoSku && !editingProduct && (
                            <span className="text-[10px] text-zinc-400 font-medium block">
                              Format SKU otomatis: PRD-XXXXX (Meneruskan nomor
                              urut produk terakhir)
                            </span>
                          )}
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
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Kategori */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Kategori
                          </label>
                          <SearchSelect
                            options={categoryOptions}
                            value={formData.categoryId}
                            onChange={(opt) => {
                              const selCat = categoriesList.find(
                                (c) =>
                                  String(c.id) === String(opt ? opt.value : ""),
                              );
                              setFormData({
                                ...formData,
                                categoryId: opt ? opt.value : "",
                                category: selCat
                                  ? selCat.code || selCat.name
                                  : "",
                              });
                            }}
                            placeholder="Pilih Kategori..."
                            searchPlaceholder="Cari kategori..."
                          />
                        </div>

                        {/* Supplier */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Pemasok / Supplier
                          </label>
                          <SearchSelect
                            options={supplierOptions}
                            value={formData.supplierId}
                            onChange={(opt) => {
                              const selSupp = suppliersList.find(
                                (s) =>
                                  String(s.id) === String(opt ? opt.value : ""),
                              );
                              setFormData({
                                ...formData,
                                supplierId: opt ? opt.value : "",
                                supplier: selSupp ? selSupp.name : "",
                              });
                            }}
                            placeholder="Pilih Supplier..."
                            searchPlaceholder="Cari supplier..."
                          />
                        </div>

                        {/* Satuan Utama (Base Unit) */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Satuan Utama (Base Unit){" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <SearchSelect
                            options={unitOptions}
                            value={formData.unit}
                            onChange={(opt) =>
                              setFormData({
                                ...formData,
                                unit: opt ? opt.value : "",
                              })
                            }
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
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {productSuppliers.length} Rekanan
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleAddSupplier}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>+ Tambah Supplier Alternatif</span>
                          </button>
                        </div>

                        {productSuppliers.length > 0 ? (
                          <div className="space-y-2 bg-zinc-50/70 p-3 rounded-xl border border-zinc-200">
                            {productSuppliers.map((ps, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-2.5 rounded-lg border border-zinc-200 shadow-2xs"
                              >
                                <div className="flex-1 min-w-[200px] w-full">
                                  <label className="text-[10px] font-semibold text-zinc-500 uppercase block mb-1">
                                    Supplier Alternatif #{idx + 1}
                                  </label>
                                  <SearchSelect
                                    options={supplierOptions.filter(
                                      (opt) =>
                                        String(opt.value) !==
                                        String(formData.supplierId),
                                    )}
                                    value={ps.supplierId}
                                    onChange={(opt) =>
                                      handleUpdateSupplier(
                                        idx,
                                        "supplierId",
                                        opt ? opt.value : "",
                                      )
                                    }
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
                                      placeholder={
                                        formData.purchasePrice
                                          ? `Acuan: ${formData.purchasePrice}`
                                          : "0"
                                      }
                                      value={ps.purchasePrice}
                                      onChange={(e) =>
                                        handleUpdateSupplier(
                                          idx,
                                          "purchasePrice",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-800 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
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
                            (Opsional) Jika barang ini bisa dipasok oleh
                            supplier lain selain Supplier Utama di atas, klik{" "}
                            <strong>+ Tambah Supplier Alternatif</strong>.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Pricing & Tax */}
                    <div className="space-y-3.5 border-t border-zinc-100 pt-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign size={13} className="text-indigo-600" />
                        <span>
                          {canViewCost
                            ? "Harga Beli, Harga Jual & Pajak"
                            : "Harga Jual & Pajak"}
                        </span>
                      </h4>

                      <div
                        className={`grid grid-cols-1 ${canViewCost ? "sm:grid-cols-2" : ""} gap-4`}
                      >
                        {canViewCost && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                                Harga Beli Dasar (Rp)
                              </label>
                              {formData.purchasePrice > 0 && (
                                <span className="text-xs font-mono font-bold text-indigo-600">
                                  {formatRupiah(formData.purchasePrice)}
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              required
                              placeholder="0"
                              value={formData.purchasePrice}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  purchasePrice: e.target.value,
                                })
                              }
                              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                              Harga Jual Dasar (Rp)
                            </label>
                            {formData.sellingPrice > 0 && (
                              <span className="text-xs font-mono font-bold text-indigo-600">
                                {formatRupiah(formData.sellingPrice)}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            required
                            placeholder="0"
                            value={formData.sellingPrice}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                sellingPrice: e.target.value,
                              })
                            }
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-indigo-700"
                          />
                        </div>
                      </div>

                      {/* Margin Calculation Preview */}
                      {canViewCost &&
                        formData.sellingPrice > 0 &&
                        formData.purchasePrice > 0 && (
                          <div className="p-3 bg-indigo-50/60 border border-indigo-150 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-semibold text-indigo-900">
                              Estimasi Profit Margin Base:
                            </span>
                            <div className="flex items-center space-x-3 font-mono font-bold">
                              <span className="text-emerald-600">
                                +Rp{" "}
                                {(
                                  parseFloat(formData.sellingPrice) -
                                  parseFloat(formData.purchasePrice)
                                ).toLocaleString("id-ID")}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px]">
                                {(
                                  ((parseFloat(formData.sellingPrice) -
                                    parseFloat(formData.purchasePrice)) /
                                    parseFloat(formData.purchasePrice)) *
                                  100
                                ).toFixed(1)}
                                % Margin
                              </span>
                            </div>
                          </div>
                        )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                            Default Pajak PPN
                          </label>
                          <SearchSelect
                            options={taxOptions}
                            value={formData.taxId}
                            onChange={(opt) =>
                              setFormData({
                                ...formData,
                                taxId: opt ? opt.value : "",
                              })
                            }
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
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                minStock: e.target.value,
                              })
                            }
                            className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold placeholder-zinc-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-zinc-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Product Image Upload */}
                  <div className="space-y-3.5">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon size={13} className="text-indigo-600" />
                      <span>Foto Produk</span>
                    </h4>

                    <div className="border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 flex flex-col items-center justify-center space-y-4">
                      {imagePreview ? (
                        <div className="relative w-44 h-44 rounded-2xl border border-zinc-200 overflow-hidden group bg-white shadow-sm shrink-0">
                          <img
                            src={getImageUrl(imagePreview)}
                            alt="Preview"
                            className="w-full h-full object-cover"
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
                          <span className="text-xs font-semibold text-zinc-400 mt-2">
                            Belum ada foto
                          </span>
                        </div>
                      )}

                      <div className="w-full text-center space-y-2">
                        <input
                          type="file"
                          id="productImageInput"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="productImageInput"
                          className="inline-flex items-center justify-center space-x-2 w-full py-2.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          <Upload size={14} className="text-indigo-600" />
                          <span>
                            {imagePreview
                              ? "Ganti Foto Produk"
                              : "Pilih Foto (JPG/PNG)"}
                          </span>
                        </label>
                        <p className="text-[11px] text-zinc-400 leading-normal">
                          Maks 5MB (.jpg, .jpeg, .png). Otomatis dikompresi
                          dengan Sharp.
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
                        <Layers size={14} className="text-indigo-600" />
                        <span>
                          Multi-Satuan Bertingkat & Skema Harga Eceran/Grosir
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Konversi berantai: isi per tingkat di atasnya (contoh: 1{" "}
                        {formData.unit || "Karton"} = 20 Renceng, 1 Renceng = 10
                        Pcs).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAlternateUnit}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      <Plus size={14} />
                      <span>+ Tambah Satuan Turunan</span>
                    </button>
                  </div>

                  {productUnits.length === 0 ? (
                    <div className="p-5 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl text-center text-xs text-zinc-400 space-y-1">
                      <p className="font-semibold text-zinc-600">
                        Hanya menggunakan 1 Satuan Dasar (
                        {formData.unit || "karton"}).
                      </p>
                      <p>
                        Klik tombol <b>"+ Tambah Satuan Turunan"</b> di atas
                        jika produk ini memiliki kemasan bertingkat seperti
                        Renceng, Pack, atau Pcs.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {productUnits.map((uRow, idx) => {
                        const info = getChainedUnitInfo(
                          idx,
                          productUnits,
                          formData.unit,
                          formData.purchasePrice,
                          formData.sellingPrice,
                        );

                        const itemBuy = parseFloat(uRow.purchasePrice) || 0;
                        const itemSell = parseFloat(uRow.sellingPrice) || 0;
                        const itemProfit = itemSell - itemBuy;
                        const itemMargin =
                          itemBuy > 0
                            ? ((itemProfit / itemBuy) * 100).toFixed(1)
                            : 0;

                        return (
                          <div
                            key={idx}
                            className="p-4 bg-gradient-to-br from-zinc-50 to-indigo-50/30 border border-indigo-100/80 rounded-2xl space-y-3 relative shadow-2xs transition-all"
                          >
                            {/* Card Header with Level Badge & Delete */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-2.5">
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                                  {idx + 2}
                                </span>
                                <span className="text-xs font-bold text-indigo-950">
                                  Tingkat {idx + 2} (Turunan dari:{" "}
                                  <span className="underline uppercase">
                                    {info.parentUnitName}
                                  </span>
                                  )
                                </span>
                                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 shadow-3xs">
                                  Total: 1 {formData.unit || "Dasar"} ={" "}
                                  {info.totalFactor} {uRow.unitName || "Satuan"}
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
                                  onChange={(opt) =>
                                    handleUpdateAlternateUnit(
                                      idx,
                                      "unitName",
                                      opt ? opt.value : "",
                                    )
                                  }
                                  placeholder="Pilih satuan..."
                                  searchPlaceholder="Cari satuan..."
                                />
                              </div>

                              {/* 2. Isi per Parent Unit */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-700 uppercase block truncate">
                                  1 {info.parentUnitName} Berisi Berapa{" "}
                                  {uRow.unitName || "Unit"}?
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    required
                                    min="0.0001"
                                    step="any"
                                    placeholder="e.g. 20"
                                    value={uRow.qtyFactor}
                                    onChange={(e) =>
                                      handleUpdateAlternateUnit(
                                        idx,
                                        "qtyFactor",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full pl-3 pr-14 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-zinc-800 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 h-[38px]"
                                  />
                                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-zinc-400 uppercase pointer-events-none">
                                    {uRow.unitName || "unit"}
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
                                    {info.suggestedBuy > 0 &&
                                      !uRow.purchasePrice && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateAlternateUnit(
                                              idx,
                                              "purchasePrice",
                                              String(info.suggestedBuy),
                                            )
                                          }
                                          className="text-[9px] text-indigo-600 hover:underline font-bold"
                                        >
                                          Isi Rp{" "}
                                          {info.suggestedBuy.toLocaleString(
                                            "id-ID",
                                          )}
                                        </button>
                                      )}
                                  </div>
                                  <input
                                    type="number"
                                    placeholder={
                                      info.suggestedBuy > 0
                                        ? `Saran: ${info.suggestedBuy}`
                                        : "0"
                                    }
                                    value={uRow.purchasePrice}
                                    onChange={(e) =>
                                      handleUpdateAlternateUnit(
                                        idx,
                                        "purchasePrice",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-indigo-600 h-[38px]"
                                  />
                                </div>
                              )}

                              {/* 4. Harga Jual Satuan */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-zinc-600 uppercase block">
                                    Harga Jual (Rp)
                                  </label>
                                  {info.suggestedSell > 0 &&
                                    !uRow.sellingPrice && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateAlternateUnit(
                                            idx,
                                            "sellingPrice",
                                            String(info.suggestedSell),
                                          )
                                        }
                                        className="text-[9px] text-emerald-600 hover:underline font-bold"
                                      >
                                        Isi Rp{" "}
                                        {info.suggestedSell.toLocaleString(
                                          "id-ID",
                                        )}
                                      </button>
                                    )}
                                </div>
                                <input
                                  type="number"
                                  required
                                  placeholder={
                                    info.suggestedSell > 0
                                      ? `Saran: ${info.suggestedSell}`
                                      : "0"
                                  }
                                  value={uRow.sellingPrice}
                                  onChange={(e) =>
                                    handleUpdateAlternateUnit(
                                      idx,
                                      "sellingPrice",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-mono font-bold text-indigo-700 outline-none focus:border-indigo-600 h-[38px]"
                                />
                              </div>
                            </div>

                            {/* Profit Margin Info Strip */}
                            {itemSell > 0 && (
                              <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-zinc-500 font-medium border-t border-zinc-150">
                                <span>
                                  Harga Jual:{" "}
                                  <b className="font-mono text-indigo-700">
                                    Rp {itemSell.toLocaleString("id-ID")}
                                  </b>{" "}
                                  / {uRow.unitName || "unit"}
                                </span>
                                {itemBuy > 0 && (
                                  <div className="flex items-center space-x-2 font-mono">
                                    <span className="text-emerald-600 font-bold">
                                      Margin: +Rp{" "}
                                      {itemProfit.toLocaleString("id-ID")} (
                                      {itemMargin}%)
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

            {/* Sticky Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                form="productForm"
                disabled={saveLoading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 cursor-pointer disabled:bg-indigo-400 transition-all"
              >
                {saveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {editingProduct ? "Simpan Perubahan" : "Tambah Barang"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Image Modal */}
      {zoomModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setZoomModal({ isOpen: false, url: "", title: "" })}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h4 className="text-sm font-bold text-zinc-900 truncate">
                {zoomModal.title}
              </h4>
              <button
                onClick={() =>
                  setZoomModal({ isOpen: false, url: "", title: "" })
                }
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-zinc-900 p-2">
              <img
                src={zoomModal.url}
                alt={zoomModal.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

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
                    Import Master Barang dari Excel
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Unggah file Excel / CSV untuk menambahkan atau memperbarui
                    katalog produk secara massal
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
              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition-all bg-zinc-50/50">
                <input
                  type="file"
                  id="excelProductFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="excelProductFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-zinc-800 block">
                      {importFile
                        ? importFile.name
                        : "Klik untuk pilih file Excel (.xlsx / .xls / .csv)"}
                    </span>
                    <span className="text-xs text-zinc-400 mt-1 block">
                      Mendukung kolom SKU, Nama Barang, Kategori, Satuan, Harga
                      Jual, Harga Beli, Pajak, dan Multi-Satuan
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Helper Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <span className="text-zinc-600">
                  Belum punya formatnya? Unduh file contoh template Excel
                  berikut:
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

              {/* Error Alert */}
              {importError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Result Stats */}
              {importStats && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle size={18} className="text-emerald-600" />
                    Proses Import Master Barang Berhasil!
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block">Total Baris</span>
                      <span className="text-base font-bold text-zinc-800">
                        {importStats.totalProcessed}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block text-emerald-600 font-semibold">
                        Barang Baru
                      </span>
                      <span className="text-base font-bold text-emerald-700">
                        +{importStats.created}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 block text-indigo-600 font-semibold">
                        Diperbarui
                      </span>
                      <span className="text-base font-bold text-indigo-700">
                        {importStats.updated}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {importPreview.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-zinc-700 mb-2 flex items-center justify-between">
                    <span>
                      Pratinjau Data Excel ({importPreview.length - 1} baris
                      terdeteksi):
                    </span>
                    <span className="text-[11px] text-zinc-400 font-normal">
                      Menampilkan maks. 10 baris pertama
                    </span>
                  </h4>
                  <div className="border border-zinc-200 rounded-xl overflow-x-auto max-h-60">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <tbody className="divide-y divide-zinc-100">
                        {importPreview.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? "bg-indigo-50/80 font-bold text-indigo-900 sticky top-0"
                                : "hover:bg-zinc-50 text-zinc-700"
                            }
                          >
                            <td className="p-2 border-r border-zinc-200 font-mono text-zinc-400 bg-zinc-50/60 text-center w-8">
                              {rIdx + 1}
                            </td>
                            {row.slice(0, 10).map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="p-2 border-r border-zinc-100 whitespace-nowrap truncate max-w-[150px]"
                              >
                                {String(cell || "—")}
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
                    ? "bg-zinc-400 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {importLoading && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                <span>
                  {importLoading
                    ? "Memproses Import..."
                    : "Proses Import Sekarang"}
                </span>
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
        loading={saveLoading}
      />
    </div>
  );
};

export default Products;

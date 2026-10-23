import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../utils/api";
import DataTable from "../components/DataTable";
import SearchSelect from "../components/SearchSelect";
import PageHeader from "../components/PageHeader";
import ConfirmationModal from "../components/ConfirmationModal";
import {
  Plus,
  Loader2,
  AlertCircle,
  ClipboardList,
  Search,
  X,
  Printer,
  PackageCheck,
  AlertTriangle,
  Package,
  Info,
  CheckCircle,
  Edit2,
  Trash2,
  Lock,
  Save,
  FileSpreadsheet,
  Calendar,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permission";
import { getImageUrl } from "../utils/imageUrl";

// --- Helper: debounce ---
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const PAGE_SIZE = 15;

// Helper to determine multi-unit structure for a product
const getProductUnitStructure = (p) => {
  const baseUnitName = (p.unit || "PCS").toUpperCase();
  const units = (p.units || []).filter((u) => u.unitName);

  // 1. Alternate unit with conversionRatio > 1 (e.g. base=PCS, alt=KRT with conversionRatio=24)
  const bigCandidate = units.find(
    (u) => !u.isBaseUnit && parseFloat(u.conversionRatio) > 1,
  );
  if (bigCandidate) {
    const ratio = parseFloat(bigCandidate.conversionRatio);
    return {
      hasMultiUnit: true,
      bigUnitName: (bigCandidate.unitName || "KRT").toUpperCase(),
      bigRatio: ratio,
      smallUnitName: baseUnitName,
      smallRatio: 1,
      capacity: Math.round(ratio),
      isBaseSmall: true,
      conversionHint: `1 ${bigCandidate.unitName.toUpperCase()} = ${Math.round(ratio)} ${baseUnitName}`,
    };
  }

  // 2. Alternate unit with conversionRatio < 1 (e.g. base=KRT, alt=PCS with conversionRatio=0.05 -> 20 pcs per KRT)
  const smallCandidate = units.find(
    (u) =>
      !u.isBaseUnit &&
      parseFloat(u.conversionRatio) < 1 &&
      parseFloat(u.conversionRatio) > 0,
  );
  if (smallCandidate) {
    const smallRatio = parseFloat(smallCandidate.conversionRatio);
    const capacity = Math.round(1 / smallRatio);
    return {
      hasMultiUnit: true,
      bigUnitName: baseUnitName,
      bigRatio: 1,
      smallUnitName: (smallCandidate.unitName || "PCS").toUpperCase(),
      smallRatio: smallRatio,
      capacity: capacity,
      isBaseSmall: false,
      conversionHint: `1 ${baseUnitName} = ${capacity} ${smallCandidate.unitName.toUpperCase()}`,
    };
  }

  // 3. Single unit
  return {
    hasMultiUnit: false,
    bigUnitName: baseUnitName,
    bigRatio: 1,
    smallUnitName: "",
    smallRatio: 0,
    capacity: 1,
    isBaseSmall: false,
    conversionHint: "",
  };
};

// Helper to determine 3-tier unit structure (Satuan Terbesar -> Menengah -> Terkecil)
const getProductThreeTierUnits = (p) => {
  if (p.unitTiers) return p.unitTiers;

  const rawUnits = (p.units || [])
    .map((u) => ({
      unitName: (u.unitName || "").trim().toUpperCase(),
      conversionRatio: parseFloat(u.conversionRatio) || 1.0,
      isBaseUnit: !!u.isBaseUnit,
    }))
    .filter((u) => u.unitName);

  const baseUnitName = (p.unit || "PCS").trim().toUpperCase();
  if (!rawUnits.some((u) => u.unitName === baseUnitName)) {
    rawUnits.push({
      unitName: baseUnitName,
      conversionRatio: 1.0,
      isBaseUnit: true,
    });
  }

  const map = new Map();
  rawUnits.forEach((u) => {
    if (!map.has(u.unitName)) {
      map.set(u.unitName, u);
    }
  });
  const unique = Array.from(map.values());
  // Higher conversionRatio = larger unit capacity
  unique.sort((a, b) => b.conversionRatio - a.conversionRatio);

  let unit1 = null;
  let unit2 = null;
  let unit3 = null;

  if (unique.length >= 3) {
    unit1 = unique[0];
    unit2 = unique[1];
    unit3 = unique[unique.length - 1];
  } else if (unique.length === 2) {
    unit1 = unique[0];
    unit2 = null;
    unit3 = unique[1];
  } else if (unique.length === 1) {
    unit1 = unique[0];
    unit2 = null;
    unit3 = null;
  }

  return {
    unit1: unit1
      ? { name: unit1.unitName, ratio: unit1.conversionRatio }
      : null,
    unit2: unit2
      ? { name: unit2.unitName, ratio: unit2.conversionRatio }
      : null,
    unit3: unit3
      ? { name: unit3.unitName, ratio: unit3.conversionRatio }
      : null,
    allUnits: unique,
  };
};

// Calculate base total quantity from 3-tier units
const calculateThreeTierBaseQty = (qty1, qty2, qty3, unitTiers) => {
  const q1 = parseFloat(qty1) || 0;
  const q2 = parseFloat(qty2) || 0;
  const q3 = parseFloat(qty3) || 0;

  const r1 = unitTiers?.unit1?.ratio || 1.0;
  const r2 = unitTiers?.unit2?.ratio || 0;
  const r3 = unitTiers?.unit3?.ratio || 0;

  return q1 * r1 + q2 * r2 + q3 * r3;
};

// Break down total quantity in base units into { bigQty, smallQty }
const breakdownQty = (qty, structure) => {
  const safe = parseFloat(qty) || 0;
  if (!structure.hasMultiUnit) {
    return { bigQty: safe, smallQty: 0 };
  }
  if (structure.isBaseSmall) {
    const bigQty = Math.floor(safe / structure.capacity);
    const smallQty = Math.round(safe % structure.capacity);
    return { bigQty, smallQty };
  } else {
    const bigQty = Math.floor(safe);
    const smallQty = Math.round((safe - bigQty) * structure.capacity);
    return { bigQty, smallQty };
  }
};

// Combine { bigQty, smallQty } into actual base quantity
const combineToActualBase = (bigQty, smallQty, structure) => {
  const b = parseFloat(bigQty) || 0;
  const s = parseFloat(smallQty) || 0;
  if (!structure.hasMultiUnit) {
    return b;
  }
  if (structure.isBaseSmall) {
    return b * structure.capacity + s;
  } else {
    return b + s * structure.smallRatio;
  }
};

// Format breakdown string e.g. "10 KRT + 12 PCS"
const formatBreakdownText = (bigQty, smallQty, structure) => {
  const b = parseFloat(bigQty) || 0;
  const s = parseFloat(smallQty) || 0;
  if (!structure.hasMultiUnit) {
    return `${b} ${structure.bigUnitName}`;
  }
  if (b > 0 && s > 0) {
    return `${b} ${structure.bigUnitName} + ${s} ${structure.smallUnitName}`;
  } else if (b > 0) {
    return `${b} ${structure.bigUnitName}`;
  } else if (s > 0) {
    return `${s} ${structure.smallUnitName}`;
  }
  return `0 ${structure.bigUnitName}`;
};

// Format difference badge info
const formatDiffBadge = (actualBase, systemBase, structure) => {
  const diff = (parseFloat(actualBase) || 0) - (parseFloat(systemBase) || 0);
  if (Math.abs(diff) < 0.0001) {
    return { label: "Sesuai", type: "match", value: 0 };
  }

  if (!structure.hasMultiUnit) {
    const sign = diff > 0 ? `+${diff}` : `${diff}`;
    return {
      label: `${sign} ${structure.bigUnitName}`,
      type: diff > 0 ? "plus" : "minus",
      value: diff,
    };
  }

  const { bigQty: diffB, smallQty: diffS } = breakdownQty(
    Math.abs(diff),
    structure,
  );
  let diffStr = "";
  if (diffB > 0 && diffS > 0) {
    diffStr = `${diffB} ${structure.bigUnitName} + ${diffS} ${structure.smallUnitName}`;
  } else if (diffB > 0) {
    diffStr = `${diffB} ${structure.bigUnitName}`;
  } else {
    diffStr = `${diffS} ${structure.smallUnitName}`;
  }

  if (diff > 0) {
    return { label: `+${diffStr}`, type: "plus", value: diff };
  } else {
    return { label: `-${diffStr}`, type: "minus", value: diff };
  }
};

const formatStockBreakdownClient = (qty, baseUnitName, availableUnits = []) => {
  const currentStock = parseFloat(qty) || 0;
  const baseUnit = (baseUnitName || "PCS").toUpperCase();

  if (currentStock <= 0) return `0 ${baseUnit}`;

  const bigUnit = (availableUnits || [])
    .filter((u) => !u.isBaseUnit && parseFloat(u.conversionRatio) > 1)
    .sort(
      (a, b) => parseFloat(b.conversionRatio) - parseFloat(a.conversionRatio),
    )[0];

  if (bigUnit) {
    const ratio = Math.round(parseFloat(bigUnit.conversionRatio));
    const bigName = (bigUnit.unitName || "KRT").toUpperCase();
    const bigQty = Math.floor(currentStock / ratio);
    const rem = Math.round(currentStock % ratio);
    return rem > 0
      ? `${bigQty} ${bigName} (isi ${ratio}) lebih ${rem} ${baseUnit}`
      : `${bigQty} ${bigName} (isi ${ratio}) lebih 0`;
  }

  const smallUnit = (availableUnits || [])
    .filter(
      (u) =>
        !u.isBaseUnit &&
        parseFloat(u.conversionRatio) < 1 &&
        parseFloat(u.conversionRatio) > 0,
    )
    .sort(
      (a, b) => parseFloat(a.conversionRatio) - parseFloat(b.conversionRatio),
    )[0];

  if (smallUnit) {
    const smallRatio = parseFloat(smallUnit.conversionRatio);
    const cap = Math.round(1 / smallRatio);
    const smallName = (smallUnit.unitName || "PCS").toUpperCase();
    const bigQty = Math.floor(currentStock);
    const rem = Math.round((currentStock - bigQty) * cap);
    return rem > 0
      ? `${bigQty} ${baseUnit} (isi ${cap}) lebih ${rem} ${smallName}`
      : `${bigQty} ${baseUnit} (isi ${cap}) lebih 0`;
  }

  return `${currentStock} ${baseUnit}`;
};

const StockOpname = () => {
  const { user } = useAuth();
  const canRead = hasPermission(user, "stock_opname", "read");
  const canCreate = hasPermission(user, "stock_opname", "create");
  const canUpdate = hasPermission(user, "stock_opname", "update");
  const canDelete = hasPermission(user, "stock_opname", "delete");
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";

  // Local input for debouncing
  const [inputValue, setInputValue] = useState(search);
  const debouncedSearch = useDebounce(inputValue, 400);

  const [opnames, setOpnames] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState(null);

  // Modal State for New / Edit Opname
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [opnameType, setOpnameType] = useState("REGULAR"); // REGULAR, EXPIRED
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [opnameDate, setOpnameDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [modalItemSearch, setModalItemSearch] = useState("");
  const [opnameItems, setOpnameItems] = useState([]); // array of items
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Manual SO Form Dedicated States
  const [manualSoModalOpen, setManualSoModalOpen] = useState(false);
  const [manualSoWarehouseId, setManualSoWarehouseId] = useState("");
  const [manualSoDate, setManualSoDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [manualSoAuditor, setManualSoAuditor] = useState("");
  const [manualSoSearch, setManualSoSearch] = useState("");
  const [manualSoItems, setManualSoItems] = useState([]);
  const [showSystemRef, setShowSystemRef] = useState(false);
  const [manualSoLoading, setManualSoLoading] = useState(false);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info",
  });

  // Sync debounced search to URL
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

  // Sync local input with URL
  useEffect(() => {
    setInputValue(search);
  }, [search]);

  // Fetch when page or search parameters change in URL
  useEffect(() => {
    fetchActiveData();
  }, [page, search]);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchActiveData = async () => {
    try {
      setLoading(true);
      setError("");

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });
      if (search.trim()) queryParams.set("search", search.trim());

      const opRes = await api.get(`/stock-opnames?${queryParams.toString()}`);
      setOpnames(opRes.data.data);
      setPagination(opRes.data.pagination);
    } catch (err) {
      setError(
        err.response?.data?.message || "Gagal memuat data stock opname.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [whRes, prodRes] = await Promise.all([
        api.get("/warehouses"),
        api.get("/products?limit=all"),
      ]);
      setWarehouses(whRes.data.data || []);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      console.error("Failed to load master data", err);
    }
  };

  const handlePageChange = (newPage) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", newPage.toString());
    setSearchParams(next, { replace: true });
  };

  const handleOpenNew = async () => {
    if (warehouses.length === 0) {
      alert("Tambahkan gudang terlebih dahulu!");
      return;
    }

    const defaultWhId = warehouses[0].id;
    setEditingId(null);
    setSelectedWarehouseId(defaultWhId);
    setOpnameDate(new Date().toISOString().split("T")[0]);
    setOpnameType("REGULAR");
    setModalItemSearch("");
    setSaveError("");

    try {
      setLoading(true);
      const prodRes = await api.get("/products?limit=all");
      const allProds = prodRes.data.data || [];
      setProducts(allProds);
      initItemsForWarehouse(defaultWhId, allProds);
      setModalOpen(true);
    } catch (err) {
      initItemsForWarehouse(defaultWhId, products);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = async (row) => {
    if (row.status === "COMPLETED") {
      toast.error("Stock Opname yang sudah Finalized tidak dapat diubah lagi.");
      return;
    }

    try {
      setLoading(true);
      const [res, prodRes] = await Promise.all([
        api.get(`/stock-opnames/${row.id}`),
        api.get("/products?limit=all"),
      ]);
      const draft = res.data.data;
      const allProds = prodRes.data.data || products;
      setProducts(allProds);

      setEditingId(draft.id);
      setSelectedWarehouseId(draft.warehouseId);
      setOpnameDate(
        draft.opnameDate
          ? draft.opnameDate.split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      const detectedType = draft.notes?.includes("[EXPIRED]")
        ? "EXPIRED"
        : "REGULAR";
      setOpnameType(detectedType);
      setModalItemSearch("");
      setSaveError("");

      // Map products merged with saved draft items
      const mappedItems = allProds.map((p) => {
        const stockList = p.warehouseStocks || p.stocks || [];
        const warehouseStock = stockList.find(
          (s) => parseInt(s.warehouseId) === parseInt(draft.warehouseId),
        );
        const systemQty = warehouseStock
          ? parseFloat(warehouseStock.stock) || 0
          : 0;

        const structure = getProductUnitStructure(p);
        const { bigQty: sysBig, smallQty: sysSmall } = breakdownQty(
          systemQty,
          structure,
        );
        const systemBreakdownText = formatBreakdownText(
          sysBig,
          sysSmall,
          structure,
        );

        // Find existing saved item in draft
        const draftItem = (draft.items || []).find((i) => i.productId === p.id);

        if (draftItem) {
          const meta = draftItem.metadata || {};
          const actualQty =
            draftItem.actualQty !== undefined ? draftItem.actualQty : systemQty;
          const { bigQty: actBig, smallQty: actSmall } = breakdownQty(
            actualQty,
            structure,
          );

          const besarInput =
            meta.besarInput !== undefined ? meta.besarInput : actBig;
          const kecilInput =
            meta.kecilInput !== undefined ? meta.kecilInput : actSmall;
          const actualBreakdownText = formatBreakdownText(
            besarInput,
            kecilInput,
            structure,
          );

          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            image: p.image || p.metadata?.image || p.metadata?.imageUrl || null,
            categoryName: p.category?.name || p.metadata?.category || "",
            baseUnitName: (p.unit || "PCS").toUpperCase(),
            systemQty,
            systemBigQty: sysBig,
            systemSmallQty: sysSmall,
            systemBreakdownText,
            structure,
            besarInput,
            kecilInput,
            actualQty,
            actualBreakdownText,
            expiredBesar:
              detectedType === "EXPIRED"
                ? meta.expiredBesar !== undefined
                  ? meta.expiredBesar
                  : meta.inputQty || 0
                : 0,
            expiredKecil:
              detectedType === "EXPIRED" ? meta.expiredKecil || 0 : 0,
          };
        } else {
          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            image: p.image || p.metadata?.image || p.metadata?.imageUrl || null,
            categoryName: p.category?.name || p.metadata?.category || "",
            baseUnitName: (p.unit || "PCS").toUpperCase(),
            systemQty,
            systemBigQty: sysBig,
            systemSmallQty: sysSmall,
            systemBreakdownText,
            structure,
            besarInput: sysBig,
            kecilInput: sysSmall,
            actualQty: systemQty,
            actualBreakdownText: systemBreakdownText,
            expiredBesar: 0,
            expiredKecil: 0,
          };
        }
      });

      setOpnameItems(mappedItems);
      setModalOpen(true);
    } catch (err) {
      toast.error("Gagal memuat rincian draft Stock Opname.");
    } finally {
      setLoading(false);
    }
  };

  const initItemsForWarehouse = (whId, prodList = products) => {
    const items = prodList.map((p) => {
      const stockList = p.warehouseStocks || p.stocks || [];
      const warehouseStock = stockList.find(
        (s) => parseInt(s.warehouseId) === parseInt(whId),
      );
      const systemQty = warehouseStock
        ? parseFloat(warehouseStock.stock) || 0
        : 0;

      const structure = getProductUnitStructure(p);
      const { bigQty: sysBig, smallQty: sysSmall } = breakdownQty(
        systemQty,
        structure,
      );
      const systemBreakdownText = formatBreakdownText(
        sysBig,
        sysSmall,
        structure,
      );

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        image: p.image || p.metadata?.image || p.metadata?.imageUrl || null,
        categoryName: p.category?.name || p.metadata?.category || "",
        baseUnitName: (p.unit || "PCS").toUpperCase(),
        systemQty,
        systemBigQty: sysBig,
        systemSmallQty: sysSmall,
        systemBreakdownText,
        structure,
        besarInput: sysBig,
        kecilInput: sysSmall,
        actualQty: systemQty,
        actualBreakdownText: systemBreakdownText,
        expiredBesar: 0,
        expiredKecil: 0,
      };
    });
    setOpnameItems(items);
  };

  const handleWarehouseChange = (whId) => {
    setSelectedWarehouseId(whId);
    initItemsForWarehouse(whId, products);
  };

  const handleMultiUnitQtyChange = (index, unitType, value) => {
    const updated = [...opnameItems];
    const item = updated[index];
    const struct = item.structure;

    if (opnameType === "EXPIRED") {
      if (unitType === "besar") item.expiredBesar = value;
      if (unitType === "kecil") item.expiredKecil = value;

      const expBase = combineToActualBase(
        item.expiredBesar,
        item.expiredKecil,
        struct,
      );
      item.actualQty = Math.max(0, item.systemQty - expBase);
      const { bigQty: actBig, smallQty: actSmall } = breakdownQty(
        item.actualQty,
        struct,
      );
      item.actualBreakdownText = formatBreakdownText(actBig, actSmall, struct);
    } else {
      if (unitType === "besar") item.besarInput = value;
      if (unitType === "kecil") item.kecilInput = value;

      item.actualQty = combineToActualBase(
        item.besarInput,
        item.kecilInput,
        struct,
      );
      item.actualBreakdownText = formatBreakdownText(
        item.besarInput,
        item.kecilInput,
        struct,
      );
    }

    setOpnameItems(updated);
  };

  const handleTypeChange = (type) => {
    setOpnameType(type);
    const resetItems = opnameItems.map((item) => {
      const struct = item.structure;
      const { bigQty: sysBig, smallQty: sysSmall } = breakdownQty(
        item.systemQty,
        struct,
      );
      const systemBreakdownText = formatBreakdownText(sysBig, sysSmall, struct);

      return {
        ...item,
        besarInput: sysBig,
        kecilInput: sysSmall,
        actualQty: item.systemQty,
        actualBreakdownText: systemBreakdownText,
        expiredBesar: 0,
        expiredKecil: 0,
      };
    });
    setOpnameItems(resetItems);
  };

  const handleSaveDraft = async (e) => {
    if (e) e.preventDefault();
    setSaveError("");
    setSaveLoading(true);

    try {
      const itemsPayload = opnameItems.map((item) => {
        const struct = item.structure;
        return {
          productId: item.productId,
          systemQty: item.systemQty,
          actualQty: item.actualQty,
          unitName: struct.bigUnitName,
          conversionRatio: struct.bigRatio,
          metadata: {
            hasMultiUnit: struct.hasMultiUnit,
            besarInput: item.besarInput,
            besarUnit: struct.bigUnitName,
            kecilInput: item.kecilInput,
            kecilUnit: struct.smallUnitName,
            capacity: struct.capacity,
            actualQty: item.actualQty,
            actualBreakdownText: item.actualBreakdownText,
            expiredBesar: item.expiredBesar,
            expiredKecil: item.expiredKecil,
          },
          notes:
            opnameType === "EXPIRED"
              ? `Expired: ${formatBreakdownText(item.expiredBesar, item.expiredKecil, struct)}`
              : `Fisik: ${item.actualBreakdownText}`,
        };
      });

      const payload = {
        warehouseId: parseInt(selectedWarehouseId),
        opnameDate,
        notes:
          opnameType === "EXPIRED"
            ? "[EXPIRED] Pemusnahan Stok Expired"
            : "[REGULAR] Penyesuaian Fisik Stok Opname",
        items: itemsPayload,
      };

      if (editingId) {
        await api.put(`/stock-opnames/${editingId}`, payload);
        toast.success("Draft Stock Opname berhasil diperbarui!");
      } else {
        await api.post("/stock-opnames", payload);
        toast.success("Draft Stock Opname baru berhasil disimpan!");
      }

      setModalOpen(false);
      fetchActiveData();
    } catch (err) {
      setSaveError(
        err.response?.data?.message || "Gagal menyimpan Stock Opname.",
      );
      toast.error(
        err.response?.data?.message || "Gagal menyimpan Stock Opname.",
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveAndFinalizeModal = (e) => {
    if (e) e.preventDefault();
    setConfirmConfig({
      isOpen: true,
      title: "Finalisasi Stock Opname",
      message:
        "Apakah Anda yakin ingin memfinalisasi Stock Opname ini? Setelah divalidasi, kartu stok FIFO dan persediaan gudang akan diperbarui secara permanen dan tidak dapat diubah lagi.",
      type: "info",
      onConfirm: async () => {
        setSaveLoading(true);
        try {
          // First save/update draft
          const itemsPayload = opnameItems.map((item) => {
            const struct = item.structure;
            return {
              productId: item.productId,
              systemQty: item.systemQty,
              actualQty: item.actualQty,
              unitName: struct.bigUnitName,
              conversionRatio: struct.bigRatio,
              metadata: {
                hasMultiUnit: struct.hasMultiUnit,
                besarInput: item.besarInput,
                besarUnit: struct.bigUnitName,
                kecilInput: item.kecilInput,
                kecilUnit: struct.smallUnitName,
                capacity: struct.capacity,
                actualQty: item.actualQty,
                actualBreakdownText: item.actualBreakdownText,
                expiredBesar: item.expiredBesar,
                expiredKecil: item.expiredKecil,
              },
              notes:
                opnameType === "EXPIRED"
                  ? `Expired: ${formatBreakdownText(item.expiredBesar, item.expiredKecil, struct)}`
                  : `Fisik: ${item.actualBreakdownText}`,
            };
          });

          const payload = {
            warehouseId: parseInt(selectedWarehouseId),
            opnameDate,
            notes:
              opnameType === "EXPIRED"
                ? "[EXPIRED] Pemusnahan Stok Expired"
                : "[REGULAR] Penyesuaian Fisik Stok Opname",
            items: itemsPayload,
          };

          let opnameIdToFinalize = editingId;
          if (editingId) {
            await api.put(`/stock-opnames/${editingId}`, payload);
          } else {
            const createRes = await api.post("/stock-opnames", payload);
            opnameIdToFinalize = createRes.data?.data?.id;
          }

          // Then finalize
          if (opnameIdToFinalize) {
            await api.post(`/stock-opnames/${opnameIdToFinalize}/finalize`);
            toast.success(
              `Stock Opname #${opnameIdToFinalize} berhasil divalidasi & stok diperbarui!`,
            );
          }

          setModalOpen(false);
          fetchActiveData();
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Gagal memfinalisasi Stock Opname.",
          );
        } finally {
          setSaveLoading(false);
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleConfirmFinalize = (opname) => {
    setConfirmConfig({
      isOpen: true,
      title: "Finalisasi Stock Opname",
      message: `Apakah Anda yakin ingin memfinalisasi Stock Opname #${opname.id}? Kartu stok FIFO gudang "${opname.warehouse?.name || "Gudang"}" akan diperbarui secara permanen.`,
      type: "info",
      onConfirm: async () => {
        setSaveLoading(true);
        try {
          await api.post(`/stock-opnames/${opname.id}/finalize`);
          toast.success(
            `Stock Opname #${opname.id} berhasil divalidasi & stok diperbarui!`,
          );
          fetchActiveData();
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Gagal memfinalisasi Stock Opname.",
          );
        } finally {
          setSaveLoading(false);
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteDraft = async (opname) => {
    setConfirmConfig({
      isOpen: true,
      title: "Hapus Draft Opname",
      message: `Apakah Anda yakin ingin menghapus Draft Stock Opname #${opname.id}? Data draft yang terhapus tidak dapat dikembalikan.`,
      type: "danger",
      onConfirm: async () => {
        setSaveLoading(true);
        try {
          await api.delete(`/stock-opnames/${opname.id}`);
          toast.success(`Draft Stock Opname #${opname.id} berhasil dihapus.`);
          fetchActiveData();
        } catch (err) {
          toast.error(
            err.response?.data?.message ||
              "Gagal menghapus draft Stock Opname.",
          );
        } finally {
          setSaveLoading(false);
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const fetchWorksheetData = async (whId, opId) => {
    try {
      const res = await api.get("/stock-opnames/worksheet-data", {
        params: {
          warehouseId: whId,
          opnameId: opId,
        },
      });
      return res.data?.data || null;
    } catch (err) {
      console.error("Failed to fetch worksheet data:", err);
      toast.error("Gagal mengambil data analitik inventori opname.");
      return null;
    }
  };

  const handlePrintWorksheet = async () => {
    const data = await fetchWorksheetData(selectedWarehouseId, editingId);
    if (!data) return;

    const printWindow = window.open("", "_blank");
    const dateStr = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const wh = data.warehouse || {};
    const title = `Lembar Kerja (Worksheet) Stock Opname`;
    const opnameTypeLabel =
      opnameType === "EXPIRED"
        ? "Pemusnahan Barang Expired"
        : "Penyesuaian Stok Fisik";

    const rowsHtml = (data.items || [])
      .map((item, index) => {
        const stockDisplay =
          item.stockBreakdown || `${item.stock} ${item.unit}`;
        const ageDisplay =
          item.receiptAgeFormatted ||
          (item.receiptAge !== null && item.receiptAge !== undefined
            ? `${item.receiptAge} Hari`
            : item.receiptFormatted || "-");
        const monthlySalesDisplay =
          item.monthlySalesFormatted ||
          (item.monthlySales !== undefined
            ? `${item.monthlySales} ${item.unit}`
            : `${item.mur} ${item.unit}`);

        return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="font-family: monospace; font-weight: bold;">${item.sku || "-"}</td>
          <td><strong>${item.name || "-"}</strong></td>
          <td style="text-align: center; font-family: monospace;">${item.warehouseCode || "-"}</td>
          <td style="text-align: center; font-size: 11px; font-weight: bold;">${ageDisplay}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; font-size: 11px;">${stockDisplay}</td>
          <td style="border: 2px solid #999; background: #fafafa; width: 90px; text-align: center;"></td>
          <td style="text-align: right; font-family: monospace;">${monthlySalesDisplay}</td>
          <td style="width: 110px; border-bottom: 1px dotted #999;"></td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${wh.name}</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; font-size: 11px; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            h2 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
            p { margin: 0; color: #475569; font-size: 11px; }
            .meta-info { font-size: 11px; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: 700; color: #334155; text-align: center; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer-sign { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid; }
            .sign-box { width: 180px; text-align: center; }
            .line { border-bottom: 1px solid #0f172a; margin-top: 45px; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h2>${title}</h2>
              <p>Gudang: <strong>${wh.name}</strong> (${wh.code}) | Tipe: <strong>${opnameTypeLabel}</strong></p>
            </div>
            <div class="meta-info">
              <p>Tanggal Cetak: <strong>${dateStr}</strong></p>
              <p>Total Item: <strong>${(data.items || []).length} Produk</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 110px;">Kode Barang</th>
                <th>Nama Barang</th>
                <th style="width: 80px;">Kode Gudang</th>
                <th style="width: 140px;">Umur Penerimaan Terakhir</th>
                <th style="width: 170px;">Stok Sistem (Perincian Satuan)</th>
                <th style="width: 90px; background-color: #e2e8f0;">Fisik Riil</th>
                <th style="width: 120px;">Rata-Rata (1 Bulan)</th>
                <th style="width: 110px;">Paraf / Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer-sign">
            <div class="sign-box">
              <p>Petugas Opname Lapangan</p>
              <div class="line"></div>
              <p style="margin-top: 4px; color: #64748b;">( Tanda Tangan & Nama )</p>
            </div>
            <div class="sign-box">
              <p>Kepala Gudang / Supervisor</p>
              <div class="line"></div>
              <p style="margin-top: 4px; color: #64748b;">( Tanda Tangan & Nama )</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadExcelWorksheet = async () => {
    toast.info("Menyiapkan data unduhan Excel...");
    const data = await fetchWorksheetData(selectedWarehouseId, editingId);
    if (!data) return;

    const wh = data.warehouse || {};
    const exportData = (data.items || []).map((item, idx) => ({
      No: idx + 1,
      "Kode Barang": item.sku || "-",
      "Nama Barang": item.name || "-",
      "Kode Gudang": item.warehouseCode || "-",
      "Nama Gudang": item.warehouseName || "-",
      "Tanggal Penerimaan Terakhir": item.receiptDate || "-",
      "Umur Penerimaan Terakhir":
        item.receiptAgeFormatted ||
        (item.receiptAge !== null && item.receiptAge !== undefined
          ? `${item.receiptAge} Hari`
          : "-"),
      "Kuantitas Penerimaan Terakhir": item.receiptQty
        ? `${item.receiptQty} ${item.unit}`
        : "-",
      "Stok Sistem (Total)": item.stock,
      Satuan: item.unit,
      "Rincian Stok Sistem":
        item.stockBreakdown || `${item.stock} ${item.unit}`,
      "Fisik Riil (Hitung Lapangan)":
        item.actualQty !== undefined && editingId ? item.actualQty : "",
      "Rata-rata Penjualan (1 Bulan)":
        item.monthlySales !== undefined ? item.monthlySales : item.mur,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 6 }, // No
      { wch: 18 }, // Kode Barang
      { wch: 40 }, // Nama Barang
      { wch: 14 }, // Kode Gudang
      { wch: 22 }, // Nama Gudang
      { wch: 22 }, // Penerimaan Tanggal
      { wch: 22 }, // Umur Penerimaan
      { wch: 22 }, // Penerimaan Qty
      { wch: 16 }, // Stok Sistem Total
      { wch: 10 }, // Satuan
      { wch: 32 }, // Rincian Stok
      { wch: 22 }, // Fisik Riil
      { wch: 24 }, // Rata-rata 1 Bulan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Worksheet Opname");
    const safeDate = new Date().toISOString().split("T")[0];
    XLSX.writeFile(
      workbook,
      `Worksheet_Stock_Opname_${wh.code || "Gudang"}_${safeDate}.xlsx`,
    );
    toast.success("Worksheet Stock Opname berhasil diunduh!");
  };

  // --- Manual SO Form Methods ---
  const loadManualSoItems = async (whId) => {
    try {
      setManualSoLoading(true);
      const data = await fetchWorksheetData(whId);
      const items = data?.items || [];
      if (items.length > 0) {
        const mapped = items.map((item) => {
          const tiers = item.unitTiers || getProductThreeTierUnits(item);
          return {
            productId: item.productId,
            sku: item.sku || "-",
            name: item.name || "-",
            categoryName: item.categoryName || "",
            unit: item.unit || "PCS",
            stock: item.stock || 0,
            stockBreakdown: item.stockBreakdown || `${item.stock} ${item.unit}`,
            unit1: tiers.unit1,
            unit2: tiers.unit2,
            unit3: tiers.unit3,
            qty1: "",
            qty2: "",
            qty3: "",
            notes: "",
          };
        });
        setManualSoItems(mapped);
      } else {
        const mapped = products.map((p) => {
          const stockList = p.warehouseStocks || p.stocks || [];
          const ws = stockList.find(
            (s) => parseInt(s.warehouseId) === parseInt(whId),
          );
          const systemQty = ws ? parseFloat(ws.stock) || 0 : 0;
          const tiers = getProductThreeTierUnits(p);
          return {
            productId: p.id,
            sku: p.sku || "-",
            name: p.name || "-",
            categoryName: p.category?.name || "",
            unit: p.unit || "PCS",
            stock: systemQty,
            stockBreakdown: `${systemQty} ${p.unit}`,
            unit1: tiers.unit1,
            unit2: tiers.unit2,
            unit3: tiers.unit3,
            qty1: "",
            qty2: "",
            qty3: "",
            notes: "",
          };
        });
        setManualSoItems(mapped);
      }
    } catch (err) {
      console.error("Failed to load manual SO items:", err);
      toast.error("Gagal memuat produk untuk Form SO Manual.");
    } finally {
      setManualSoLoading(false);
    }
  };

  const handleOpenManualSoModal = async (initialWhId = null) => {
    const whId = initialWhId || selectedWarehouseId || warehouses[0]?.id || "";
    if (!whId) {
      toast.error("Tambahkan gudang terlebih dahulu!");
      return;
    }
    setManualSoWarehouseId(whId);
    setManualSoDate(new Date().toISOString().split("T")[0]);
    setManualSoAuditor(user?.name || "");
    setManualSoSearch("");
    setShowSystemRef(false);
    setManualSoModalOpen(true);
    await loadManualSoItems(whId);
  };

  const handleManualSoItemChange = (productId, field, value) => {
    setManualSoItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const handlePrintManualSoForm = () => {
    const wh =
      warehouses.find(
        (w) => parseInt(w.id) === parseInt(manualSoWarehouseId),
      ) || {};
    const whName = wh.name || "Gudang";
    const whCode = wh.metadata?.code || wh.code || `WH-00${wh.id || ""}`;
    const printWindow = window.open("", "_blank");
    const opnameDateFormatted = manualSoDate
      ? new Date(manualSoDate).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    // Filter items according to search if any
    const itemsToPrint = manualSoItems.filter((item) => {
      if (!manualSoSearch.trim()) return true;
      const q = manualSoSearch.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
      );
    });

    const rowsHtml = itemsToPrint
      .map((item, index) => {
        const u1Name = item.unit1?.name || item.unit || "KRT";
        const u2Name = item.unit2?.name || null;
        const u3Name = item.unit3?.name || null;

        const col1Content = `
        <div class="box-count">
          <span class="unit-tag">[${u1Name}]</span>
          <span class="val-text">${item.qty1 !== "" ? item.qty1 : "......"}</span>
        </div>
      `;

        const col2Content = u2Name
          ? `
        <div class="box-count">
          <span class="unit-tag">[${u2Name}]</span>
          <span class="val-text">${item.qty2 !== "" ? item.qty2 : "......"}</span>
        </div>
      `
          : `<div class="unit-dash">-</div>`;

        const col3Content = u3Name
          ? `
        <div class="box-count">
          <span class="unit-tag">[${u3Name}]</span>
          <span class="val-text">${item.qty3 !== "" ? item.qty3 : "......"}</span>
        </div>
      `
          : `<div class="unit-dash">-</div>`;

        return `
        <tr>
          <td style="text-align: center; font-weight: bold; color: #475569;">${index + 1}</td>
          <td><strong>${item.name || "-"}</strong></td>
          <td style="font-family: monospace; font-weight: bold; color: #1e293b;">${item.sku || "-"}</td>
          <td>${col1Content}</td>
          <td>${col2Content}</td>
          <td>${col3Content}</td>
          <td style="font-size: 10px; color: #64748b;">${item.notes || ""}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Formulir SO Manual - ${whName}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 5px; color: #0f172a; font-size: 11px; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            h2 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
            p { margin: 0; color: #475569; font-size: 11px; }
            .meta-info { font-size: 11px; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #94a3b8; padding: 5px 8px; vertical-align: middle; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: 800; color: #1e293b; text-align: center; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .box-count { border: 1.5px solid #64748b; background: #ffffff; border-radius: 4px; height: 24px; display: flex; align-items: center; justify-content: space-between; padding: 0 6px; }
            .unit-tag { font-size: 10px; font-weight: 700; color: #334155; }
            .val-text { font-size: 11px; font-family: monospace; font-weight: bold; color: #0f172a; }
            .unit-dash { text-align: center; color: #cbd5e1; font-weight: bold; }
            .footer-sign { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid; }
            .sign-box { width: 220px; text-align: center; }
            .line { border-bottom: 1px solid #0f172a; margin-top: 45px; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h2>FORMULIR STOCK OPNAME MANUAL (LEMBAR HITUNG FISIK)</h2>
              <p>Gudang: <strong>${whName}</strong> (${whCode}) | Tanggal Opname: <strong>${opnameDateFormatted}</strong></p>
            </div>
            <div class="meta-info">
              <p>Petugas / Auditor: <strong>${manualSoAuditor || "................................"}</strong></p>
              <p>Total Item: <strong>${itemsToPrint.length} Produk</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th style="text-align: left; width: 280px;">Nama Produk</th>
                <th style="text-align: left; width: 120px;">SKU Produk</th>
                <th style="width: 130px; background-color: #e0f2fe; color: #0369a1;">Tangga Satuan 1<br><span style="font-size: 9px; font-weight: normal;">(Terbesar)</span></th>
                <th style="width: 130px; background-color: #f0fdf4; color: #15803d;">Tangga Satuan 2<br><span style="font-size: 9px; font-weight: normal;">(Menengah)</span></th>
                <th style="width: 130px; background-color: #fefce8; color: #a16207;">Tangga Satuan 3<br><span style="font-size: 9px; font-weight: normal;">(Terkecil)</span></th>
                <th style="width: 140px;">Paraf / Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer-sign">
            <div class="sign-box">
              <p>Petugas Penghitung Lapangan</p>
              <div class="line"></div>
              <p style="margin-top: 4px; color: #64748b;">( ${manualSoAuditor || "Tanda Tangan & Nama"} )</p>
            </div>
            <div class="sign-box">
              <p>Petugas Verifikasi / Saksi</p>
              <div class="line"></div>
              <p style="margin-top: 4px; color: #64748b;">( Tanda Tangan & Nama )</p>
            </div>
            <div class="sign-box">
              <p>Kepala Gudang / Supervisor</p>
              <div class="line"></div>
              <p style="margin-top: 4px; color: #64748b;">( Tanda Tangan & Nama )</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadExcelManualSo = () => {
    toast.info("Menyiapkan data unduhan Excel Form SO Manual...");
    const wh =
      warehouses.find(
        (w) => parseInt(w.id) === parseInt(manualSoWarehouseId),
      ) || {};
    const safeDate = manualSoDate || new Date().toISOString().split("T")[0];

    const exportData = manualSoItems.map((item, idx) => ({
      No: idx + 1,
      "Nama Produk": item.name || "-",
      "SKU Produk": item.sku || "-",
      "Satuan 1 (Terbesar)": item.unit1?.name || item.unit || "-",
      "Fisik Satuan 1": item.qty1 !== "" ? item.qty1 : "",
      "Satuan 2 (Menengah)": item.unit2 ? item.unit2.name : "-",
      "Fisik Satuan 2": item.unit2 ? (item.qty2 !== "" ? item.qty2 : "") : "-",
      "Satuan 3 (Terkecil)": item.unit3 ? item.unit3.name : "-",
      "Fisik Satuan 3": item.unit3 ? (item.qty3 !== "" ? item.qty3 : "") : "-",
      "Catatan / Paraf Lapangan": item.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 6 }, // No
      { wch: 42 }, // Nama Produk
      { wch: 18 }, // SKU Produk
      { wch: 18 }, // Satuan 1
      { wch: 18 }, // Fisik Satuan 1
      { wch: 18 }, // Satuan 2
      { wch: 18 }, // Fisik Satuan 2
      { wch: 18 }, // Satuan 3
      { wch: 18 }, // Fisik Satuan 3
      { wch: 25 }, // Catatan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Form SO Manual");
    XLSX.writeFile(
      workbook,
      `Form_SO_Manual_${wh.name || "Gudang"}_${safeDate}.xlsx`,
    );
    toast.success("File Form SO Manual Excel berhasil diunduh!");
  };

  const handleConvertManualSoToDraft = async () => {
    const hasAnyInput = manualSoItems.some(
      (it) =>
        (it.qty1 !== "" && it.qty1 !== null && it.qty1 !== undefined) ||
        (it.qty2 !== "" && it.qty2 !== null && it.qty2 !== undefined) ||
        (it.qty3 !== "" && it.qty3 !== null && it.qty3 !== undefined),
    );

    if (!hasAnyInput) {
      toast.error("Belum ada data kuantitas fisik yang diinput.");
      return;
    }

    try {
      setSaveLoading(true);
      const itemsPayload = manualSoItems.map((it) => {
        const hasInput =
          (it.qty1 !== "" && it.qty1 !== null && it.qty1 !== undefined) ||
          (it.qty2 !== "" && it.qty2 !== null && it.qty2 !== undefined) ||
          (it.qty3 !== "" && it.qty3 !== null && it.qty3 !== undefined);

        const actualQty = hasInput
          ? calculateThreeTierBaseQty(it.qty1, it.qty2, it.qty3, {
              unit1: it.unit1,
              unit2: it.unit2,
              unit3: it.unit3,
            })
          : it.stock;

        return {
          productId: it.productId,
          actualQty,
          notes: it.notes || "",
          metadata: {
            qty1: it.qty1 || 0,
            unit1: it.unit1?.name || item.unit,
            qty2: it.qty2 || 0,
            unit2: it.unit2?.name || "",
            qty3: it.qty3 || 0,
            unit3: it.unit3?.name || "",
          },
        };
      });

      const payload = {
        warehouseId: parseInt(manualSoWarehouseId),
        opnameDate: manualSoDate,
        notes: `[REGULAR] SO Manual Lapangan (${manualSoDate}) - Auditor: ${manualSoAuditor || user?.name || "Petugas"}`,
        items: itemsPayload,
      };

      const res = await api.post("/stock-opnames", payload);
      toast.success(
        res.data?.message ||
          "Draft Stock Opname berhasil dibuat dari Form Manual!",
      );
      setManualSoModalOpen(false);
      fetchActiveData();
    } catch (err) {
      console.error("Failed to create draft from manual SO:", err);
      toast.error(
        err.response?.data?.message || "Gagal menyimpan Draft Stock Opname.",
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePrintOpnameResult = async (opname) => {
    const data = await fetchWorksheetData(opname.warehouseId, opname.id);
    const printWindow = window.open("", "_blank");
    const dateStr = new Date(opname.createdAt).toLocaleString("id-ID");
    const wh = opname.warehouse || data?.warehouse || {};
    const title = `Laporan Hasil Stock Opname #${opname.id}`;

    const itemsList =
      data?.items ||
      (opname.items || []).map((it, idx) => ({
        no: idx + 1,
        sku: it.product?.sku || "-",
        name: it.product?.name || "-",
        warehouseCode: wh.code || `WH-00${opname.warehouseId}`,
        receiptDate: "-",
        receiptQty: 0,
        receiptAgeFormatted: "-",
        receiptFormatted: "-",
        stock: it.systemQty,
        stockBreakdown: `${it.systemQty} ${it.product?.unit || "karton"}`,
        actualQty: it.actualQty,
        actualBreakdown: `${it.actualQty} ${it.product?.unit || "karton"}`,
        adjustmentQty: it.actualQty - it.systemQty,
        unit: it.product?.unit || "karton",
        monthlySales: 0,
        monthlySalesFormatted: `0 ${it.product?.unit || "karton"}`,
        mur: 0,
      }));

    const rowsHtml = itemsList
      .map((item, index) => {
        const diff = item.actualQty - item.stock;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        const stockDisplay =
          item.stockBreakdown || `${item.stock} ${item.unit}`;
        const actualDisplay =
          item.actualBreakdown || `${item.actualQty} ${item.unit}`;
        const ageDisplay =
          item.receiptAgeFormatted ||
          (item.receiptAge !== null && item.receiptAge !== undefined
            ? `${item.receiptAge} Hari`
            : "-");
        const monthlySalesDisplay =
          item.monthlySalesFormatted ||
          (item.monthlySales !== undefined
            ? `${item.monthlySales} ${item.unit}`
            : `${item.mur} ${item.unit}`);

        return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td style="font-family: monospace; font-weight: bold;">${item.sku || "-"}</td>
          <td><strong>${item.name || "-"}</strong></td>
          <td style="text-align: center; font-family: monospace;">${item.warehouseCode || "-"}</td>
          <td style="text-align: center; font-size: 11px; font-weight: bold;">${ageDisplay}</td>
          <td style="text-align: right; font-family: monospace; font-size: 11px;">${stockDisplay}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; font-size: 11px;">${actualDisplay}</td>
          <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${diff < 0 ? "#dc2626" : diff > 0 ? "#16a34a" : "#0f172a"};">${diffStr} ${item.unit}</td>
          <td style="text-align: right; font-family: monospace;">${monthlySalesDisplay}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${wh.name}</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; font-size: 11px; }
            .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            h2 { margin: 0 0 4px 0; font-size: 16px; color: #0f172a; text-transform: uppercase; }
            p { margin: 0; color: #475569; font-size: 11px; }
            .meta-info { font-size: 11px; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            th { background-color: #f1f5f9; text-transform: uppercase; font-size: 10px; font-weight: 700; color: #334155; text-align: center; }
            tr:nth-child(even) { background-color: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <h2>${title}</h2>
              <p>Gudang: <strong>${wh.name}</strong> (${wh.code || "-"}) | Status: <strong>${opname.status}</strong></p>
              <p>Catatan: ${opname.notes || "-"}</p>
            </div>
            <div class="meta-info">
              <p>Waktu Eksekusi: <strong>${dateStr}</strong></p>
              <p>Total Item: <strong>${itemsList.length} Produk</strong></p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 100px;">Kode Barang</th>
                <th>Nama Barang</th>
                <th style="width: 75px;">Kode Gudang</th>
                <th style="width: 130px;">Umur Penerimaan Terakhir</th>
                <th style="width: 160px;">Stok Sistem (Perincian)</th>
                <th style="width: 160px;">Stok Fisik (Perincian)</th>
                <th style="width: 90px;">Selisih</th>
                <th style="width: 120px;">Rata-Rata (1 Bulan)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadExcelOpnameResult = async (opname) => {
    toast.info("Menyiapkan file Excel hasil Opname...");
    const data = await fetchWorksheetData(opname.warehouseId, opname.id);
    const wh = opname.warehouse || data?.warehouse || {};

    const itemsList =
      data?.items ||
      (opname.items || []).map((it, idx) => ({
        no: idx + 1,
        sku: it.product?.sku || "-",
        name: it.product?.name || "-",
        warehouseCode: wh.code || `WH-00${opname.warehouseId}`,
        warehouseName: wh.name || "Gudang",
        receiptDate: "-",
        receiptQty: 0,
        receiptAgeFormatted: "-",
        stock: it.systemQty,
        stockBreakdown: `${it.systemQty} ${it.product?.unit || "karton"}`,
        actualQty: it.actualQty,
        actualBreakdown: `${it.actualQty} ${it.product?.unit || "karton"}`,
        adjustmentQty: it.actualQty - it.systemQty,
        unit: it.product?.unit || "karton",
        monthlySales: 0,
        mur: 0,
      }));

    const exportData = itemsList.map((item, idx) => ({
      No: idx + 1,
      "Kode Barang": item.sku || "-",
      "Nama Barang": item.name || "-",
      "Kode Gudang": item.warehouseCode || "-",
      "Nama Gudang": item.warehouseName || wh.name || "-",
      "Tanggal Penerimaan Terakhir": item.receiptDate || "-",
      "Umur Penerimaan Terakhir":
        item.receiptAgeFormatted ||
        (item.receiptAge !== null && item.receiptAge !== undefined
          ? `${item.receiptAge} Hari`
          : "-"),
      "Kuantitas Penerimaan Terakhir": item.receiptQty
        ? `${item.receiptQty} ${item.unit}`
        : "-",
      "Stok Sistem (Total)": item.stock,
      "Rincian Stok Sistem":
        item.stockBreakdown || `${item.stock} ${item.unit}`,
      "Stok Fisik (Total)": item.actualQty,
      "Rincian Stok Fisik":
        item.actualBreakdown || `${item.actualQty} ${item.unit}`,
      "Selisih Penyesuaian": item.actualQty - item.stock,
      Satuan: item.unit,
      "Rata-rata Penjualan (1 Bulan)":
        item.monthlySales !== undefined ? item.monthlySales : item.mur,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 6 }, // No
      { wch: 18 }, // Kode Barang
      { wch: 40 }, // Nama Barang
      { wch: 14 }, // Kode Gudang
      { wch: 22 }, // Nama Gudang
      { wch: 22 }, // Penerimaan Tanggal
      { wch: 22 }, // Umur Penerimaan
      { wch: 22 }, // Penerimaan Qty
      { wch: 16 }, // Stok Sistem Total
      { wch: 32 }, // Rincian Stok Sistem
      { wch: 16 }, // Stok Fisik Total
      { wch: 32 }, // Rincian Stok Fisik
      { wch: 16 }, // Selisih
      { wch: 10 }, // Satuan
      { wch: 24 }, // Rata-rata 1 Bulan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Opname #${opname.id}`);
    const safeDate = new Date(opname.createdAt).toISOString().split("T")[0];
    XLSX.writeFile(
      workbook,
      `Hasil_Stock_Opname_Doc#${opname.id}_${safeDate}.xlsx`,
    );
    toast.success("File Excel hasil Stock Opname berhasil diunduh!");
  };

  const columns = [
    {
      key: "opnameDate",
      label: "Tanggal Opname",
      className: "text-xs font-mono font-bold text-zinc-800",
      render: (v, row) => {
        const d = v || row.createdAt;
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      },
    },
    {
      key: "warehouse",
      label: "Gudang Opname",
      render: (w) => w?.name || "Gudang",
    },
    {
      key: "items",
      label: "Jumlah Barang",
      className: "text-center font-mono font-bold",
      headerClassName: "text-center",
      render: (items) => `${items ? items.length : 0} produk`,
    },
    {
      key: "notes",
      label: "Catatan & Tipe",
      className: "text-zinc-600 font-medium",
      render: (notes) => {
        if (!notes) return "-";
        return notes.replace("[EXPIRED] ", "").replace("[REGULAR] ", "");
      },
    },
    {
      key: "status",
      label: "Status Opname",
      className: "text-center",
      headerClassName: "text-center",
      render: (status, row) =>
        status === "COMPLETED" ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Lock size={12} />
            <span>Finalized</span>
          </span>
        ) : (
          <button
            onClick={() => handleConfirmFinalize(row)}
            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-all cursor-pointer"
            title="Klik untuk memfinalisasi draft opname ini"
          >
            <CheckCircle size={12} className="text-amber-600" />
            <span>Draft (Klik Finalisasi)</span>
          </button>
        ),
    },
    {
      key: "actions",
      label: "Aksi",
      className: "text-center",
      headerClassName: "text-center",
      render: (_, row) => (
        <div className="flex items-center justify-center space-x-1">
          {row.status === "DRAFT" ? (
            <>
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-lg cursor-pointer transition-all"
                title="Ubah Draft Opname"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleConfirmFinalize(row)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg cursor-pointer transition-all"
                title="Finalisasi & Update Stok FIFO"
              >
                <CheckCircle size={14} />
              </button>
              <button
                onClick={() => handleDeleteDraft(row)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg cursor-pointer transition-all"
                title="Hapus Draft Opname"
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <span
              className="p-1.5 text-zinc-300 cursor-not-allowed"
              title="Dokumen Finalized terkunci"
            >
              <Lock size={14} />
            </span>
          )}
          <button
            onClick={() => handleDownloadExcelOpnameResult(row)}
            className="p-1.5 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg cursor-pointer transition-all"
            title="Download Hasil Opname (.xlsx)"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handlePrintOpnameResult(row)}
            className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 rounded-lg cursor-pointer transition-all"
            title="Cetak Hasil Opname"
          >
            <Printer size={14} />
          </button>
        </div>
      ),
    },
  ];

  const warehouseOptions = warehouses.map((wh) => ({
    value: wh.id,
    label: wh.name,
    sublabel: wh.address,
  }));

  // Filter items in modal based on search query
  const filteredModalItems = opnameItems.filter((item) => {
    if (!modalItemSearch.trim()) return true;
    const q = modalItemSearch.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(q))
    );
  });

  // Calculate live stats inside modal
  const totalItemsCount = opnameItems.length;
  const itemsWithDiscrepancy = opnameItems.filter((item) => {
    if (opnameType === "EXPIRED") return (parseFloat(item.expiredQty) || 0) > 0;
    return item.actualQty !== item.systemQty;
  }).length;

  if (!canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Akses Ditolak</h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mt-1">
            Anda tidak memiliki izin untuk mengakses modul Stock Opname.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <PageHeader
        title="Stock Opname & Penyesuaian FIFO"
        subtitle="Audit riwayat penyesuaian stok fisik riil gudang dengan kartu stok FIFO sistem."
        icon={ClipboardList}
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenManualSoModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              title="Formulir khusus SO Manual (3 tangga satuan dari terbesar ke terkecil)"
            >
              <FileSpreadsheet size={15} />
              <span>Form SO Manual</span>
            </button>
            {canCreate && (
              <button
                onClick={handleOpenNew}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Buat Opname Baru</span>
              </button>
            )}
          </div>
        }
      />

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder={`Cari riwayat opname (catatan)...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs font-medium"
          />
          {inputValue && (
            <button
              onClick={() => {
                setInputValue("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Opname History DataTable */}
      <DataTable
        columns={columns}
        data={opnames}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        emptyText="Belum ada riwayat penyesuaian stok opname."
        emptyIcon={<ClipboardList size={40} />}
        rowKey="id"
      />

      {/* Upgraded Modern UI/UX Stock Opname Form Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-8xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Modal Top Banner Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {editingId
                      ? `Ubah Draft Stock Opname #${editingId}`
                      : "Form Audit Stock Opname Baru"}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Pilih gudang sasaran dan sesuaikan kuantitas fisik sesuai
                    audit lapangan.
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

            {/* Error notice */}
            {saveError && (
              <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2.5 text-rose-700 text-xs shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Control Panel Header Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 shrink-0 bg-zinc-50/70 p-3.5 border border-zinc-200/80 rounded-2xl">
                  {/* Gudang Selection */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                      Gudang Audit Opname
                    </label>
                    <SearchSelect
                      options={warehouseOptions}
                      value={selectedWarehouseId}
                      onChange={(opt) =>
                        handleWarehouseChange(opt ? opt.value : "")
                      }
                      placeholder="Pilih Gudang..."
                      searchPlaceholder="Cari gudang..."
                      disabled={!!editingId}
                    />
                  </div>

                  {/* Tanggal Opname */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block flex items-center gap-1.5">
                      <Calendar size={13} className="text-zinc-500" />
                      <span>Tanggal Stock Opname</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={opnameDate}
                        onChange={(e) => setOpnameDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-2xs"
                        required
                      />
                    </div>
                  </div>

                  {/* Tipe Opname Selector */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                      Mode Penyesuaian
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-zinc-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleTypeChange("REGULAR")}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          opnameType === "REGULAR"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <PackageCheck size={14} />
                        <span>Fisik (Reguler)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange("EXPIRED")}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                          opnameType === "EXPIRED"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <AlertTriangle size={14} />
                        <span>Barang Expired</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Toolbar & Summary Metrics Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  {/* Search inside modal */}
                  <div className="relative max-w-sm w-full">
                    <Search
                      size={15}
                      className="absolute left-3 top-2.5 text-zinc-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      placeholder="Filter nama barang / SKU..."
                      value={modalItemSearch}
                      onChange={(e) => setModalItemSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium shadow-2xs"
                    />
                    {modalItemSearch && (
                      <button
                        type="button"
                        onClick={() => setModalItemSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Summary Indicators */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold border border-zinc-200">
                      Total:{" "}
                      <span className="font-mono font-extrabold">
                        {totalItemsCount}
                      </span>{" "}
                      Barang
                    </span>
                    {itemsWithDiscrepancy > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center space-x-1">
                        <AlertCircle size={13} className="text-amber-600" />
                        <span>
                          Selisih:{" "}
                          <strong className="font-mono">
                            {itemsWithDiscrepancy}
                          </strong>{" "}
                          Produk
                        </span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle size={13} />
                        <span>Fisik Sesuai Sistem</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenManualSoModal(selectedWarehouseId)
                      }
                      className="px-3 py-1 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold shadow-2xs flex items-center space-x-1 cursor-pointer transition-all shrink-0"
                      title="Buka Form SO Manual (Format 3 Kolom Satuan)"
                    >
                      <ClipboardList size={13} className="text-emerald-600" />
                      <span className="hidden md:inline">Form SO Manual</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadExcelWorksheet}
                      className="px-3 py-1 bg-white border border-zinc-200 text-zinc-700 hover:text-emerald-600 rounded-lg text-xs font-bold shadow-2xs hover:bg-zinc-50 flex items-center space-x-1 cursor-pointer transition-all shrink-0"
                      title="Unduh Lembar Kerja Format Excel (.xlsx)"
                    >
                      <FileSpreadsheet size={13} className="text-emerald-600" />
                      <span className="hidden md:inline">Download Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintWorksheet}
                      className="px-3 py-1 bg-white border border-zinc-200 text-zinc-700 hover:text-indigo-600 rounded-lg text-xs font-bold shadow-2xs hover:bg-zinc-50 flex items-center space-x-1 cursor-pointer transition-all shrink-0"
                      title="Cetak Lembar Kerja Lapangan"
                    >
                      <Printer size={13} />
                      <span className="hidden md:inline">Cetak Worksheet</span>
                    </button>
                  </div>
                </div>

                {/* Items Audit List Scrollable Area */}
                <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl bg-zinc-50/50 p-3 min-h-0">
                  <div className="space-y-2">
                    {filteredModalItems.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400 space-y-2">
                        <Package className="w-10 h-10 mx-auto opacity-30" />
                        <p className="text-xs font-semibold">
                          Tidak ada barang yang cocok dengan pencarian.
                        </p>
                      </div>
                    ) : (
                      filteredModalItems.map((item) => {
                        const originalIndex = opnameItems.findIndex(
                          (i) => i.productId === item.productId,
                        );
                        const diff = item.actualQty - item.systemQty;

                        return (
                          <div
                            key={item.productId}
                            className={`bg-white border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs transition-all ${
                              diff !== 0
                                ? "border-amber-300 ring-1 ring-amber-500/20 bg-amber-50/10"
                                : "border-zinc-200/90 hover:border-zinc-300"
                            }`}
                          >
                            {/* Product Info with Thumbnail Image */}
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                {item.image ? (
                                  <img
                                    src={getImageUrl(item.image)}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      if (e.target.nextSibling)
                                        e.target.nextSibling.style.display =
                                          "flex";
                                    }}
                                  />
                                ) : null}
                                <div
                                  className={`w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-100 ${item.image ? "hidden" : ""}`}
                                >
                                  <Package
                                    size={18}
                                    className="text-zinc-400"
                                  />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold uppercase border border-zinc-200">
                                    {item.sku}
                                  </span>
                                  {item.categoryName && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                      {item.categoryName}
                                    </span>
                                  )}
                                  {item.structure?.conversionHint && (
                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100/80 px-1.5 py-0.5 rounded border border-zinc-200 font-mono">
                                      ⚡ {item.structure.conversionHint}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-zinc-900 text-xs sm:text-sm truncate block mt-0.5">
                                  {item.name}
                                </span>
                              </div>
                            </div>

                            {/* Inputs & Conversions Controls */}
                            <div className="flex flex-wrap md:flex-nowrap items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-100">
                              {/* System Stock */}
                              <div className="text-left md:text-right min-w-[90px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                  Stok Sistem
                                </span>
                                <span className="text-xs font-black text-zinc-800 font-mono block mt-0.5">
                                  {item.systemBreakdownText ||
                                    `${item.systemQty} ${item.baseUnitName}`}
                                </span>
                                {item.structure?.hasMultiUnit && (
                                  <span className="text-[9px] text-zinc-400 font-mono block">
                                    (Total: {item.systemQty} {item.baseUnitName}
                                    )
                                  </span>
                                )}
                              </div>

                              {/* Multi-Unit Inputs */}
                              <div className="flex items-center gap-2">
                                {/* Input Satuan Besar */}
                                <div className="w-24">
                                  <span
                                    className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block mb-0.5 truncate"
                                    title={item.structure?.bigUnitName}
                                  >
                                    {item.structure?.hasMultiUnit
                                      ? `${item.structure.bigUnitName} (Utuh)`
                                      : item.structure?.bigUnitName}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step={
                                      item.structure?.hasMultiUnit
                                        ? "1"
                                        : "0.01"
                                    }
                                    placeholder="0"
                                    value={
                                      opnameType === "EXPIRED"
                                        ? (item.expiredBesar ?? "")
                                        : (item.besarInput ?? "")
                                    }
                                    onChange={(e) =>
                                      handleMultiUnitQtyChange(
                                        originalIndex,
                                        "besar",
                                        e.target.value,
                                      )
                                    }
                                    onFocus={(e) => e.target.select()}
                                    className="w-full px-2 py-1.5 text-center bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-black font-mono text-zinc-950 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
                                    title={`Jumlah fisik dalam ${item.structure?.bigUnitName}`}
                                  />
                                </div>

                                {/* Input Satuan Kecil / Ecer (jika multi-satuan) */}
                                {item.structure?.hasMultiUnit && (
                                  <div className="w-24">
                                    <span
                                      className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5 truncate"
                                      title={item.structure.smallUnitName}
                                    >
                                      {item.structure.smallUnitName} (Ecer)
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      max={
                                        item.structure.capacity
                                          ? item.structure.capacity - 1
                                          : undefined
                                      }
                                      placeholder="0"
                                      value={
                                        opnameType === "EXPIRED"
                                          ? (item.expiredKecil ?? "")
                                          : (item.kecilInput ?? "")
                                      }
                                      onChange={(e) =>
                                        handleMultiUnitQtyChange(
                                          originalIndex,
                                          "kecil",
                                          e.target.value,
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      className="w-full px-2 py-1.5 text-center bg-emerald-50/60 border border-emerald-300 rounded-lg text-xs font-black font-mono text-emerald-950 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                                      title={`Jumlah eceran/sisa dalam ${item.structure.smallUnitName}`}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Hasil Fisik & Selisih Badge */}
                              <div className="text-right min-w-[110px]">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                                  Total Fisik
                                </span>
                                <div className="flex flex-col items-end mt-0.5">
                                  <strong className="text-xs font-black text-indigo-900 font-mono">
                                    {item.actualBreakdownText ||
                                      `${item.actualQty} ${item.baseUnitName}`}
                                  </strong>
                                  {(() => {
                                    const diffInfo = formatDiffBadge(
                                      item.actualQty,
                                      item.systemQty,
                                      item.structure,
                                    );
                                    if (diffInfo.type === "match") {
                                      return (
                                        <span className="inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">
                                          ✓ Sesuai
                                        </span>
                                      );
                                    }
                                    return (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-black font-mono border ${
                                          diffInfo.type === "plus"
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                            : "bg-rose-100 text-rose-800 border-rose-300"
                                        }`}
                                      >
                                        {diffInfo.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Audit Notice */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-indigo-900 shrink-0">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    Anda dapat menyimpan dokumen sebagai <strong>Draft</strong>{" "}
                    untuk diedit kembali nanti. Saat divalidasi (
                    <strong>Finalized</strong>), sistem akan memperbarui kartu
                    stok gudang secara permanen dan dokumen tidak dapat diubah
                    lagi.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-all"
                >
                  Batal
                </button>
                <div className="flex items-center space-x-2.5">
                  {/* Save Draft Button */}
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saveLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-amber-300 transition-all"
                  >
                    {saveLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    <span>Simpan Sebagai Draft</span>
                  </button>

                  {/* Save & Finalize Button */}
                  <button
                    type="button"
                    onClick={handleSaveAndFinalizeModal}
                    disabled={saveLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-emerald-400 transition-all"
                  >
                    {saveLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle size={15} />
                    )}
                    <span>Simpan & Finalisasi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Manual Stock Opname Modal (Form SO Manual 3 Tangga Satuan) */}
      {manualSoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-linear-to-r from-emerald-50/50 via-white to-zinc-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-zinc-900">
                      Formulir Stock Opname Manual (Hitung Fisik)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                      3 Tangga Satuan
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Format:{" "}
                    <strong>
                      Nama Produk | SKU Produk | Tangga Stok Satuan (Terbesar
                      &rarr; Menengah &rarr; Terkecil)
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManualSoModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Config & Filter Bar */}
            <div className="px-6 py-3.5 bg-zinc-50 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {/* Gudang Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-zinc-600">
                    Gudang:
                  </span>
                  <select
                    value={manualSoWarehouseId}
                    onChange={(e) => {
                      const newWhId = e.target.value;
                      setManualSoWarehouseId(newWhId);
                      loadManualSoItems(newWhId);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.metadata?.code || w.code || `WH-00${w.id}`}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tanggal SO */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-zinc-600">
                    Tanggal SO:
                  </span>
                  <input
                    type="date"
                    value={manualSoDate}
                    onChange={(e) => setManualSoDate(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                {/* Auditor / Petugas SO */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-zinc-600">
                    Petugas:
                  </span>
                  <input
                    type="text"
                    placeholder="Nama Petugas Lapangan..."
                    value={manualSoAuditor}
                    onChange={(e) => setManualSoAuditor(e.target.value)}
                    className="text-xs px-2.5 py-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 w-44"
                  />
                </div>
              </div>

              {/* Search & Ref Toggle */}
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama atau SKU produk..."
                    value={manualSoSearch}
                    onChange={(e) => setManualSoSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <label className="flex items-center space-x-2 text-xs font-bold text-zinc-600 cursor-pointer select-none shrink-0 bg-white px-3 py-1.5 rounded-xl border border-zinc-200 shadow-2xs hover:bg-zinc-50 transition-all">
                  <input
                    type="checkbox"
                    checked={showSystemRef}
                    onChange={(e) => setShowSystemRef(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                  />
                  <span>Tampilkan Stok Sistem</span>
                </label>
              </div>
            </div>

            {/* Summary Indicator bar */}
            <div className="px-6 py-2.5 bg-white border-b border-zinc-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700 font-bold border border-zinc-200">
                  Total Produk:{" "}
                  <span className="font-mono font-extrabold text-zinc-900">
                    {manualSoItems.length}
                  </span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                  Telah Diisi:{" "}
                  <span className="font-mono font-extrabold">
                    {
                      manualSoItems.filter(
                        (i) => i.qty1 !== "" || i.qty2 !== "" || i.qty3 !== "",
                      ).length
                    }
                  </span>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleDownloadExcelManualSo}
                  className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-emerald-300 text-zinc-700 hover:text-emerald-700 rounded-xl text-xs font-bold shadow-2xs hover:bg-emerald-50/50 flex items-center space-x-1.5 cursor-pointer transition-all"
                  title="Unduh Excel Form SO Manual (3 Kolom Satuan)"
                >
                  <FileSpreadsheet size={14} className="text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintManualSoForm}
                  className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-indigo-300 text-zinc-700 hover:text-indigo-700 rounded-xl text-xs font-bold shadow-2xs hover:bg-indigo-50/50 flex items-center space-x-1.5 cursor-pointer transition-all"
                  title="Cetak Formulir SO Manual Untuk Lembar Hitung Lapangan"
                >
                  <Printer size={14} className="text-indigo-600" />
                  <span>Cetak Lembar Hitung (Print)</span>
                </button>
              </div>
            </div>

            {/* Scrollable Table Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-50/60 min-h-0">
              {manualSoLoading ? (
                <div className="py-24 text-center text-zinc-500 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs font-medium">
                    Memuat data produk dan tangga satuan...
                  </p>
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100/90 text-zinc-700 uppercase tracking-wider font-extrabold text-[11px] border-b border-zinc-200">
                        <th className="py-3 px-3 text-center w-12">No</th>
                        <th className="py-3 px-4">Nama Produk</th>
                        <th className="py-3 px-3 w-32">SKU Produk</th>
                        <th className="py-3 px-3 w-44 bg-sky-50 text-sky-900 border-x border-sky-100">
                          <div className="flex items-center space-x-1">
                            <span>Satuan 1 (Terbesar)</span>
                          </div>
                        </th>
                        <th className="py-3 px-3 w-44 bg-emerald-50 text-emerald-900 border-r border-emerald-100">
                          <div className="flex items-center space-x-1">
                            <span>Satuan 2 (Menengah)</span>
                          </div>
                        </th>
                        <th className="py-3 px-3 w-44 bg-amber-50 text-amber-900 border-r border-amber-100">
                          <div className="flex items-center space-x-1">
                            <span>Satuan 3 (Terkecil)</span>
                          </div>
                        </th>
                        <th className="py-3 px-3 w-40">Catatan / Paraf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {manualSoItems
                        .filter((item) => {
                          if (!manualSoSearch.trim()) return true;
                          const q = manualSoSearch.toLowerCase().trim();
                          return (
                            item.name.toLowerCase().includes(q) ||
                            item.sku.toLowerCase().includes(q) ||
                            (item.categoryName &&
                              item.categoryName.toLowerCase().includes(q))
                          );
                        })
                        .map((item, index) => {
                          const u1Name = item.unit1?.name || item.unit || "KRT";
                          const u2Name = item.unit2?.name || null;
                          const u3Name = item.unit3?.name || null;

                          return (
                            <tr
                              key={item.productId}
                              className="hover:bg-zinc-50/80 transition-colors"
                            >
                              <td className="py-3 px-3 text-center font-bold text-zinc-500 font-mono">
                                {index + 1}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-bold text-zinc-900 leading-snug">
                                  {item.name}
                                </p>
                                {item.categoryName && (
                                  <span className="inline-block mt-0.5 text-[10px] text-zinc-400 font-medium">
                                    {item.categoryName}
                                  </span>
                                )}
                                {showSystemRef && (
                                  <p className="mt-1 text-[11px] text-zinc-500 font-mono">
                                    Stok Sistem:{" "}
                                    <strong className="text-zinc-700">
                                      {item.stockBreakdown ||
                                        `${item.stock} ${item.unit}`}
                                    </strong>
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-zinc-700 text-[11px]">
                                {item.sku}
                              </td>

                              {/* Satuan 1 (Terbesar) */}
                              <td className="py-2.5 px-3 bg-sky-50/30 border-x border-sky-100">
                                <div className="flex items-center space-x-2">
                                  <span className="px-2 py-1 rounded-md bg-sky-100 text-sky-800 font-extrabold text-[10px] uppercase shrink-0 border border-sky-200">
                                    {u1Name}
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={item.qty1}
                                    onChange={(e) =>
                                      handleManualSoItemChange(
                                        item.productId,
                                        "qty1",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 shadow-2xs"
                                  />
                                </div>
                              </td>

                              {/* Satuan 2 (Menengah) */}
                              <td className="py-2.5 px-3 bg-emerald-50/30 border-r border-emerald-100">
                                {u2Name ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase shrink-0 border border-emerald-200">
                                      {u2Name}
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={item.qty2}
                                      onChange={(e) =>
                                        handleManualSoItemChange(
                                          item.productId,
                                          "qty2",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-center font-bold text-zinc-300">
                                    -
                                  </div>
                                )}
                              </td>

                              {/* Satuan 3 (Terkecil) */}
                              <td className="py-2.5 px-3 bg-amber-50/30 border-r border-amber-100">
                                {u3Name ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase shrink-0 border border-amber-200">
                                      {u3Name}
                                    </span>
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={item.qty3}
                                      onChange={(e) =>
                                        handleManualSoItemChange(
                                          item.productId,
                                          "qty3",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 shadow-2xs"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-center font-bold text-zinc-300">
                                    -
                                  </div>
                                )}
                              </td>

                              {/* Catatan */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  placeholder="Catatan fisik..."
                                  value={item.notes}
                                  onChange={(e) =>
                                    handleManualSoItemChange(
                                      item.productId,
                                      "notes",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                                />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setManualSoModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer transition-all"
              >
                Tutup
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleConvertManualSoToDraft}
                  disabled={saveLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-emerald-400 transition-all"
                  title="Simpan kuantitas yang telah diinput ke dalam Draft Stock Opname sistem"
                >
                  {saveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>Simpan Hasil ke Draft Opname</span>
                </button>
              </div>
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

export default StockOpname;

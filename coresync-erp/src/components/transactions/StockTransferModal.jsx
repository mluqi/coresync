import { useState, useEffect } from "react";
import {
  X,
  Trash2,
  Loader2,
  Truck,
  AlertCircle,
  ArrowLeftRight,
  Gift,
} from "lucide-react";
import SearchSelect from "../SearchSelect";

// Helper to extract all sorted available units for a product (Terbesar -> Menengah -> Terkecil)
const getProductUnitsList = (prod) => {
  if (!prod) return [];
  const baseUnit = (prod.unit || "PCS").trim().toUpperCase();
  const rawUnits = (prod.units || [])
    .map((u) => ({
      unitName: (u.unitName || "").trim().toUpperCase(),
      conversionRatio: parseFloat(u.conversionRatio) || 1.0,
      isBaseUnit: !!u.isBaseUnit,
    }))
    .filter((u) => u.unitName);

  if (!rawUnits.some((u) => u.unitName === baseUnit)) {
    rawUnits.push({
      unitName: baseUnit,
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
  // Sort descending: larger unit first (e.g. KRT -> RCG -> PCS)
  unique.sort((a, b) => b.conversionRatio - a.conversionRatio);
  return unique;
};

const StockTransferModal = ({
  isOpen,
  onClose,
  warehouses = [],
  products = [],
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    transferType: "WAREHOUSE", // 'WAREHOUSE' | 'STOCK_TYPE'
    sourceStockType: "REGULAR", // 'REGULAR' | 'BONUS'
    destinationStockType: "BONUS", // 'REGULAR' | 'BONUS'
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    transferDate: new Date().toISOString().split("T")[0],
    driverName: "",
    vehicleNumber: "",
    notes: "",
    autoShip: true,
    items: [
      { productId: "", qty: 1, unit: "", conversionRatio: 1.0, notes: "" },
    ],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const defaultSource = warehouses[0]?.id ? String(warehouses[0].id) : "";
      const defaultDest = warehouses[1]?.id
        ? String(warehouses[1].id)
        : defaultSource;
      setFormData({
        transferType: "WAREHOUSE",
        sourceStockType: "REGULAR",
        destinationStockType: "BONUS",
        sourceWarehouseId: defaultSource,
        destinationWarehouseId: defaultDest,
        transferDate: new Date().toISOString().split("T")[0],
        driverName: "",
        vehicleNumber: "",
        notes: "",
        autoShip: true,
        items: [
          { productId: "", qty: 1, unit: "", conversionRatio: 1.0, notes: "" },
        ],
      });
      setError("");
    }
  }, [isOpen, warehouses]);

  if (!isOpen) return null;

  const isTypeMutation = formData.transferType === "STOCK_TYPE";
  const sourceWhId = parseInt(formData.sourceWarehouseId);
  const destWhId = parseInt(formData.destinationWarehouseId);

  // Helper to get available stock at source warehouse depending on sourceStockType (in base unit)
  const getProductStockAtSource = (productId) => {
    if (!productId || !sourceWhId) return 0;
    const p = products.find((prod) => prod.id === parseInt(productId));
    if (!p) return 0;
    const whStock = p.warehouseStocks?.find(
      (ws) => ws.warehouseId === sourceWhId,
    );
    if (!whStock) return 0;
    return formData.sourceStockType === "BONUS"
      ? parseFloat(whStock.bonusStock || 0)
      : parseFloat(whStock.stock || 0);
  };

  const productOptions = products.map((p) => {
    const stockAtSource = getProductStockAtSource(p.id);
    const stockTypeLabel =
      formData.sourceStockType === "BONUS" ? "Bonus" : "Reguler";
    return {
      value: p.id,
      label: p.name,
      sublabel: `SKU: ${p.sku} | Stok ${stockTypeLabel} Gudang Asal: ${stockAtSource} ${p.unit || "PCS"}`,
    };
  });

  const handleItemChange = (idx, field, val) => {
    const newItems = [...formData.items];
    if (field === "productId") {
      const prod = products.find((p) => p.id === parseInt(val));
      const units = getProductUnitsList(prod);
      const defUnit = units.find((u) => u.isBaseUnit) ||
        units[0] || { unitName: prod?.unit || "PCS", conversionRatio: 1.0 };
      newItems[idx] = {
        ...newItems[idx],
        productId: val,
        unit: defUnit.unitName,
        conversionRatio: defUnit.conversionRatio,
      };
    } else if (field === "unit") {
      const prod = products.find(
        (p) => p.id === parseInt(newItems[idx].productId),
      );
      const units = getProductUnitsList(prod);
      const chosen = units.find((u) => u.unitName === val) || {
        unitName: val,
        conversionRatio: 1.0,
      };
      newItems[idx] = {
        ...newItems[idx],
        unit: chosen.unitName,
        conversionRatio: chosen.conversionRatio,
      };
    } else {
      newItems[idx][field] = val;
    }
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { productId: "", qty: 1, unit: "", conversionRatio: 1.0, notes: "" },
      ],
    });
  };

  const removeItem = (idx) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== idx);
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
      setError("Gudang Asal dan Gudang Tujuan wajib dipilih.");
      return;
    }

    if (!isTypeMutation && sourceWhId === destWhId) {
      setError(
        "Untuk mutasi antar gudang, Gudang Asal dan Gudang Tujuan tidak boleh sama.",
      );
      return;
    }

    if (
      isTypeMutation &&
      sourceWhId === destWhId &&
      formData.sourceStockType === formData.destinationStockType
    ) {
      setError(
        "Tipe stok asal dan tujuan tidak boleh sama jika berada di gudang yang sama.",
      );
      return;
    }

    const validItems = formData.items.filter(
      (it) => it.productId && parseFloat(it.qty) > 0,
    );
    if (validItems.length === 0) {
      setError("Pilih minimal 1 barang dengan kuantitas lebih dari 0.");
      return;
    }

    // Check stock if autoShip is checked (aggregate base quantity per product)
    if (formData.autoShip) {
      const reqBaseByProduct = {};
      for (const it of validItems) {
        const pid = parseInt(it.productId);
        const ratio = parseFloat(it.conversionRatio) || 1.0;
        const baseQty = (parseFloat(it.qty) || 0) * ratio;
        reqBaseByProduct[pid] = (reqBaseByProduct[pid] || 0) + baseQty;
      }

      for (const [pidStr, totalReqBase] of Object.entries(reqBaseByProduct)) {
        const pid = parseInt(pidStr);
        const available = getProductStockAtSource(pid);
        if (totalReqBase > available) {
          const prod = products.find((p) => p.id === pid);
          const typeLabel =
            formData.sourceStockType === "BONUS" ? "Bonus" : "Reguler";
          setError(
            `Stok ${typeLabel} barang "${prod ? prod.name : pid}" di gudang asal tidak mencukupi (Tersedia: ${available} ${prod?.unit || "PCS"}, Diminta total setara: ${totalReqBase.toFixed(4)} ${prod?.unit || "PCS"}).`,
          );
          return;
        }
      }
    }

    try {
      setLoading(true);
      await onSuccess({
        transferType: formData.transferType,
        sourceStockType: formData.sourceStockType,
        destinationStockType: formData.destinationStockType,
        sourceWarehouseId: sourceWhId,
        destinationWarehouseId: destWhId,
        transferDate: formData.transferDate,
        driverName: formData.driverName,
        vehicleNumber: formData.vehicleNumber,
        notes: formData.notes,
        autoShip: formData.autoShip,
        items: validItems.map((it) => ({
          productId: parseInt(it.productId),
          qty: parseFloat(it.qty),
          unit: it.unit || null,
          conversionRatio: parseFloat(it.conversionRatio) || 1.0,
          sourceStockType: formData.sourceStockType,
          destinationStockType: formData.destinationStockType,
          notes: it.notes,
        })),
      });
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Gagal menyimpan mutasi transfer.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-3xl w-full max-h-[92vh] shadow-2xl p-5 sm:p-6 relative flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-zinc-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isTypeMutation
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                  : "bg-indigo-50 border-indigo-200 text-indigo-600"
              }`}
            >
              {isTypeMutation ? <Gift size={20} /> : <Truck size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {isTypeMutation
                  ? "Mutasi Tipe Stok (Reguler ⟷ Bonus)"
                  : "Mutasi / Transfer Antar Gudang"}
              </h3>
              <p className="text-xs text-zinc-500">
                {isTypeMutation
                  ? "Konversi atau relokasi stok antara Stok Reguler (komersial) dan Stok Bonus (promo/gratis)"
                  : "Pindahkan stok persediaan dari gudang asal ke gudang cabang/toko"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 space-y-4 overflow-y-auto pr-1"
        >
          {/* Transfer Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
              Jenis Mutasi
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, transferType: "WAREHOUSE" })
                }
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  !isTypeMutation
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold ring-2 ring-indigo-500/20"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <Truck
                  size={18}
                  className={
                    !isTypeMutation ? "text-indigo-600" : "text-zinc-400"
                  }
                />
                <div>
                  <div className="text-xs font-bold">Mutasi Antar Gudang</div>
                  <div className="text-[10px] text-zinc-500 font-normal">
                    Pindah stok fisik antar lokasi gudang
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, transferType: "STOCK_TYPE" })
                }
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  isTypeMutation
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold ring-2 ring-emerald-500/20"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <ArrowLeftRight
                  size={18}
                  className={
                    isTypeMutation ? "text-emerald-600" : "text-zinc-400"
                  }
                />
                <div>
                  <div className="text-xs font-bold">
                    Mutasi Tipe Stok (Reguler ⟷ Bonus)
                  </div>
                  <div className="text-[10px] text-zinc-500 font-normal">
                    Ubah status stok (Jual ke Bonus / sebaliknya)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Stock Type Converter Bar (Only when STOCK_TYPE) */}
          {isTypeMutation && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
              <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                Arah Perubahan Tipe Stok
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Dari Tipe Asal:
                  </span>
                  <select
                    value={formData.sourceStockType}
                    onChange={(e) => {
                      const src = e.target.value;
                      setFormData({
                        ...formData,
                        sourceStockType: src,
                        destinationStockType:
                          src === "REGULAR" ? "BONUS" : "REGULAR",
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value="REGULAR">
                      Stok Reguler (Komersial / Jual)
                    </option>
                    <option value="BONUS">
                      Stok Bonus (Free Goods / Promo)
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Menjadi Tipe Tujuan:
                  </span>
                  <select
                    value={formData.destinationStockType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destinationStockType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-zinc-800 outline-none cursor-pointer"
                  >
                    <option value="BONUS">
                      Stok Bonus (Free Goods / Promo)
                    </option>
                    <option value="REGULAR">
                      Stok Reguler (Komersial / Jual)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Gudang Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Gudang Asal (Sumber)
              </label>
              <select
                value={formData.sourceWarehouseId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sourceWarehouseId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                required
              >
                <option value="">Pilih Gudang Asal</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Gudang Tujuan (Penerima)
              </label>
              <select
                value={formData.destinationWarehouseId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    destinationWarehouseId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                required
              >
                <option value="">Pilih Gudang Tujuan</option>
                {warehouses
                  .filter(
                    (w) =>
                      isTypeMutation ||
                      String(w.id) !== String(formData.sourceWarehouseId),
                  )
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Transfer Info: Date, Driver, Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                Tanggal Mutasi
              </label>
              <input
                type="date"
                required
                value={formData.transferDate}
                onChange={(e) =>
                  setFormData({ ...formData, transferDate: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                Nama Driver / Kurir
              </label>
              <input
                type="text"
                placeholder={
                  isTypeMutation ? "Internal Staff" : "Contoh: Budi Santoso"
                }
                value={formData.driverName}
                onChange={(e) =>
                  setFormData({ ...formData, driverName: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                No. Polisi / Referensi
              </label>
              <input
                type="text"
                placeholder={isTypeMutation ? "INTERNAL" : "Contoh: G 8492 BE"}
                value={formData.vehicleNumber}
                onChange={(e) =>
                  setFormData({ ...formData, vehicleNumber: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none uppercase font-mono"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-2 pt-2 border-t border-zinc-200">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Daftar Barang yang Di-{isTypeMutation ? "mutasi" : "transfer"}
              </h4>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                + Tambah Baris Barang
              </button>
            </div>

            <div className="space-y-2.5">
              {formData.items.map((item, idx) => {
                const availableStock = getProductStockAtSource(item.productId);
                const selectedProd = products.find(
                  (p) => p.id === parseInt(item.productId),
                );
                const prodUnits = getProductUnitsList(selectedProd);
                const stockTypeLabel =
                  formData.sourceStockType === "BONUS" ? "Bonus" : "Reguler";

                const currentRatio = parseFloat(item.conversionRatio) || 1.0;
                const availableInSelectedUnit =
                  currentRatio > 0
                    ? availableStock / currentRatio
                    : availableStock;
                const reqBase = (parseFloat(item.qty) || 0) * currentRatio;
                const isStockInsufficient = reqBase > availableStock;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2"
                  >
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 min-w-0">
                        <SearchSelect
                          options={productOptions}
                          value={item.productId}
                          onChange={(opt) =>
                            handleItemChange(
                              idx,
                              "productId",
                              opt ? opt.value : "",
                            )
                          }
                          placeholder={`Pilih Barang (${stockTypeLabel})...`}
                          searchPlaceholder="Cari barang..."
                        />
                      </div>

                      {/* Qty Input */}
                      <div className="w-24 shrink-0">
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) =>
                            handleItemChange(idx, "qty", e.target.value)
                          }
                          className="w-full px-2.5 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none font-mono text-center font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      {/* Unit Selector */}
                      <div className="w-44 shrink-0">
                        {selectedProd && prodUnits.length > 0 ? (
                          <select
                            value={item.unit || selectedProd.unit || "PCS"}
                            onChange={(e) =>
                              handleItemChange(idx, "unit", e.target.value)
                            }
                            className="w-full px-2.5 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold font-mono outline-none cursor-pointer text-indigo-900 bg-indigo-50/30 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                          >
                            {prodUnits.map((u, uIdx) => {
                              let tierLabel = "";
                              if (prodUnits.length >= 3) {
                                tierLabel =
                                  uIdx === 0
                                    ? "(Satuan 1/Terbesar)"
                                    : uIdx === prodUnits.length - 1
                                      ? "(Satuan 3/Terkecil)"
                                      : "(Satuan 2/Menengah)";
                              } else if (prodUnits.length === 2) {
                                tierLabel =
                                  uIdx === 0
                                    ? "(Satuan Terbesar)"
                                    : "(Satuan Terkecil)";
                              }
                              return (
                                <option key={u.unitName} value={u.unitName}>
                                  {u.unitName} {tierLabel}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <div className="px-2.5 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-bold font-mono text-zinc-500 text-center uppercase">
                            {selectedProd?.unit || "PCS"}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={formData.items.length === 1}
                        className="p-2 text-zinc-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {selectedProd && (
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-500 px-1 pt-1 border-t border-zinc-100">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-zinc-700">
                            Satuan Dipilih:{" "}
                            <strong className="uppercase font-mono text-indigo-700">
                              {item.unit || selectedProd.unit}
                            </strong>
                          </span>
                          {currentRatio !== 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 text-[10px] font-mono border border-amber-200">
                              Setara: {reqBase.toFixed(4)} {selectedProd.unit}{" "}
                              (rasio: {currentRatio})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <span
                            className={`font-semibold ${isStockInsufficient ? "text-rose-600 font-bold" : "text-zinc-600"}`}
                          >
                            Stok {stockTypeLabel} Tersedia di Asal:{" "}
                            <strong>
                              {availableInSelectedUnit.toFixed(2)}{" "}
                              {item.unit || selectedProd.unit}
                            </strong>
                            {currentRatio !== 1 && (
                              <span className="text-zinc-400 font-normal">
                                {" "}
                                (total: {availableStock} {selectedProd.unit})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes & Auto Ship Toggle */}
          <div className="space-y-3 pt-2 border-t border-zinc-200">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                Catatan Tambahan (Opsional)
              </label>
              <textarea
                rows="2"
                placeholder={
                  isTypeMutation
                    ? "Contoh: Alokasi stok reguler untuk promo festival diskon"
                    : "Tuliskan catatan mutasi transfer..."
                }
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
              <div>
                <label className="text-xs font-bold text-indigo-950 block">
                  Proses & Eksekusi Langsung (Status: IN_TRANSIT)
                </label>
                <span className="text-[11px] text-indigo-700 block">
                  Stok tipe asal langsung terpotong saat form disimpan
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, autoShip: !formData.autoShip })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.autoShip ? "bg-indigo-600" : "bg-zinc-300"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.autoShip ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-zinc-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs ${
                isTypeMutation
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>
                {isTypeMutation
                  ? "Simpan Mutasi Tipe Stok"
                  : "Simpan Mutasi Transfer"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockTransferModal;

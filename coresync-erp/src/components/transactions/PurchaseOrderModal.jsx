import React from "react";
import {
  X,
  Package,
  Trash2,
  FileText,
  Loader2,
  Settings2,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  Zap,
} from "lucide-react";
import SearchSelect from "../SearchSelect";
import { formatRupiah, getProductStructure, calculateTieredItemSubtotal, formatTieredBonusDisplay } from "../../utils/format";
import { generateDocumentNumber } from "../../utils/documentNumber";
import getImageUrl from "../../utils/imageUrl";

const PurchaseOrderModal = ({
  isOpen,
  onClose,
  poFormMode,
  poForm,
  setPoForm,
  purchaseOrders,
  suppliers,
  supplierOptions,
  warehouses,
  taxes,
  products,
  productOptions,
  actionLoading,
  actionError,
  handleConfirmCreatePo,
  handlePoItemChange,
  addPoItem,
  removePoItem,
  user,
}) => {
  if (!isOpen) return null;

  const isStaff = user?.role === "STAFF";

  const selectedSupId = poForm.contactId ? parseInt(poForm.contactId) : null;
  const selectedSupplier = suppliers?.find((s) => s.id === selectedSupId);
  const selectedSupName = selectedSupplier?.name?.trim().toLowerCase();

  // Filter products by selected supplier. If product has no supplier, still show it.
  const filteredProducts = React.useMemo(() => {
    if (!selectedSupId) return products || [];

    return (products || []).filter((p) => {
      const pSupId = p.supplierId || p.supplier?.id || p.metadata?.supplierId;
      const pSupName = (p.supplier?.name || p.metadata?.supplier || "")
        .trim()
        .toLowerCase();

      // If product has no supplier -> always show
      if (!pSupId && !pSupName) {
        return true;
      }

      // If matches supplier ID
      if (pSupId && parseInt(pSupId) === selectedSupId) {
        return true;
      }

      // If matches supplier Name
      if (selectedSupName && pSupName && pSupName === selectedSupName) {
        return true;
      }

      return false;
    });
  }, [products, selectedSupId, selectedSupName]);

  const poProductOptions = React.useMemo(() => {
    return filteredProducts.map((p) => {
      const stock = p.totalStock !== undefined ? p.totalStock : p.stock || 0;
      const supName =
        p.supplier?.name || p.metadata?.supplier || "Tanpa Supplier";
      return {
        value: p.id,
        label: p.name,
        sublabel: `Supplier: ${supName} | Stok: ${stock} ${p.unit || "PCS"} | Beli: Rp${parseFloat(p.purchasePrice || 0).toLocaleString("id-ID")}`,
      };
    });
  }, [filteredProducts]);

  const [globalDiscountMode, setGlobalDiscountMode] = React.useState("PERCENT");
  const wasOpenRef = React.useRef(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(
    Boolean(
      poForm.autoReceive ||
      parseFloat(poForm.globalDiscountPercent || 0) > 0 ||
      parseFloat(poForm.globalDiscountAmount || 0) > 0,
    ),
  );

  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const initialMode =
        poForm.globalDiscountMode ||
        (parseFloat(poForm.globalDiscountAmount || 0) > 0 &&
        (!poForm.globalDiscountPercent ||
          parseFloat(poForm.globalDiscountPercent) === 0)
          ? "AMOUNT"
          : "PERCENT");
      setGlobalDiscountMode(initialMode);
      if (
        Boolean(
          poForm.autoReceive ||
          parseFloat(poForm.globalDiscountPercent || 0) > 0 ||
          parseFloat(poForm.globalDiscountAmount || 0) > 0,
        )
      ) {
        setShowAdvancedOptions(true);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const applyTax = poForm.applyTax;
  const taxInclusive = poForm.taxInclusive;
  const selectedTax = taxes.find((t) => t.id === parseInt(poForm.taxId));
  const taxRate = applyTax && selectedTax ? parseFloat(selectedTax.rate) : 0;

  let subtotal = 0;
  let taxAmount = 0;
  let grandTotal = 0;

  const originalSum = poForm.items.reduce((sum, item) => {
    const selProduct = products.find((p) => p.id === parseInt(item.productId)) || item.product;
    const struct = getProductStructure(selProduct);
    const { netSubtotal } = calculateTieredItemSubtotal(item, struct);
    return sum + netSubtotal;
  }, 0);

  const globalDiscountPercent = parseFloat(poForm.globalDiscountPercent || 0);
  const numDiscountPercent = parseFloat(poForm.globalDiscountPercent || 0);
  const numDiscountAmount = parseFloat(poForm.globalDiscountAmount || 0);

  const effectiveGlobalDiscount = Math.min(
    originalSum,
    globalDiscountMode === "AMOUNT"
      ? Math.max(0, numDiscountAmount)
      : Math.max(0, originalSum * (numDiscountPercent / 100)),
  );

  const netOriginalSum = Math.max(0, originalSum - effectiveGlobalDiscount);

  if (applyTax && taxRate > 0) {
    if (taxInclusive) {
      grandTotal = netOriginalSum;
      subtotal = grandTotal / (1 + taxRate / 100);
      taxAmount = grandTotal - subtotal;
    } else {
      subtotal = netOriginalSum;
      taxAmount = subtotal * (taxRate / 100);
      grandTotal = subtotal + taxAmount;
    }
  } else {
    subtotal = netOriginalSum;
    taxAmount = 0;
    grandTotal = netOriginalSum;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl sm:rounded-3xl max-w-[96vw] w-full h-[92vh] max-h-[95vh] shadow-2xl p-4 sm:p-6 relative flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-100 mb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {poFormMode === "CREATE"
                ? "Buat Purchase Order (PO) Baru"
                : "Ubah Purchase Order (PO)"}
            </h3>
            <p className="text-xs text-zinc-500">
              Pesan pasokan barang dari supplier dengan pembayaran Lunas/Tempo
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {actionError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs shrink-0">
            {actionError}
          </div>
        )}

        <form
          onSubmit={handleConfirmCreatePo}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-1">
            {/* Left Column (Scroll Mandiri) */}
            <div className="lg:col-span-1 flex flex-col min-h-0 h-full overflow-y-auto pr-1.5 space-y-4">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-4">
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Informasi Supplier
                </h4>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                    Supplier
                  </label>
                  <SearchSelect
                    options={supplierOptions}
                    value={poForm.contactId}
                    onChange={(opt) =>
                      setPoForm({ ...poForm, contactId: opt ? opt.value : "" })
                    }
                    placeholder="Pilih Supplier..."
                    searchPlaceholder="Cari supplier..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                    Nomor PO
                  </label>
                  <input
                    type="text"
                    required
                    value={poForm.poNumber}
                    onChange={(e) =>
                      setPoForm({ ...poForm, poNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={poForm.poDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setPoForm((prev) => ({
                        ...prev,
                        poDate: newDate,
                        poNumber:
                          poFormMode === "CREATE"
                            ? generateDocumentNumber(
                                "PO",
                                newDate,
                                purchaseOrders,
                              )
                            : prev.poNumber,
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none"
                  />
                </div>

                {/* Mode Persetujuan PO (Approval Mode) */}
                <div className="space-y-2 p-3 bg-white rounded-xl border border-zinc-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                      Alur Persetujuan PO
                    </label>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        poForm.requireApproval !== false
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {poForm.requireApproval !== false
                        ? "Butuh Approval"
                        : "Tanpa Approval (Selesai)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPoForm({ ...poForm, requireApproval: true })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        poForm.requireApproval !== false
                          ? "border-amber-500 bg-amber-50/70 text-amber-900 font-bold ring-2 ring-amber-500/20"
                          : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <ShieldCheck
                          size={14}
                          className={
                            poForm.requireApproval !== false
                              ? "text-amber-600"
                              : "text-zinc-400"
                          }
                        />
                        <span>Butuh Approval</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                        Alur verifikasi berjenjang
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPoForm({
                          ...poForm,
                          requireApproval: false,
                          autoReceive: true,
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        poForm.requireApproval === false
                          ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold ring-2 ring-emerald-500/20"
                          : "border-zinc-200 bg-zinc-50/50 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2
                          size={14}
                          className={
                            poForm.requireApproval === false
                              ? "text-emerald-600"
                              : "text-zinc-400"
                          }
                        />
                        <span>Tanpa Approval</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                        Langsung tuntas & stok masuk
                      </div>
                    </button>
                  </div>
                  {poForm.requireApproval === false && (
                    <div className="text-[10px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200 flex items-start gap-1.5 leading-tight">
                      <Zap
                        size={13}
                        className="text-emerald-600 shrink-0 mt-0.5"
                      />
                      <span>
                        PO akan langsung berstatus <strong>SELESAI</strong> dan
                        stok barang otomatis masuk ke gudang tujuan saat
                        disimpan.
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Term */}
                <div className="space-y-2 pt-2 border-t border-zinc-200">
                  <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                    Ketentuan Pembayaran
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "LUNAS", label: "Lunas", desc: "100%" },
                      { id: "DP", label: "DP", desc: "Uang Muka" },
                      { id: "TEMPO", label: "Tempo", desc: "Kredit" },
                    ].map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() =>
                          setPoForm({ ...poForm, paymentTerm: t.id })
                        }
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          poForm.paymentTerm === t.id
                            ? "border-theme bg-theme-light text-theme font-bold ring-2 ring-theme/20"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                        }`}
                      >
                        <div className="text-xs font-bold">{t.label}</div>
                        <div className="text-[10px] text-zinc-400">
                          {t.desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  {poForm.paymentTerm === "DP" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-semibold text-zinc-700 block">
                        Nominal Uang Muka / DP (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          poForm.dpAmount === 0 || poForm.dpAmount === ""
                            ? ""
                            : poForm.dpAmount
                        }
                        onChange={(e) =>
                          setPoForm({
                            ...poForm,
                            dpAmount:
                              e.target.value === ""
                                ? ""
                                : parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none font-mono"
                        placeholder="0"
                      />
                    </div>
                  )}

                  {(poForm.paymentTerm === "TEMPO" ||
                    poForm.paymentTerm === "DP") && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] font-semibold text-zinc-700 block">
                        Tanggal Jatuh Tempo
                      </label>
                      <input
                        type="date"
                        value={poForm.dueDate}
                        onChange={(e) =>
                          setPoForm({ ...poForm, dueDate: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Tax Options Section */}
                <div className="pt-2 border-t border-zinc-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      Terapkan Pajak (PKP)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPoForm({ ...poForm, applyTax: !applyTax })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${applyTax ? "bg-theme" : "bg-zinc-200"}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${applyTax ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </div>

                  {applyTax && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                          Tarif Pajak PPN
                        </label>
                        <select
                          value={poForm.taxId}
                          onChange={(e) =>
                            setPoForm({ ...poForm, taxId: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-medium outline-none cursor-pointer"
                          required={applyTax}
                        >
                          <option value="">Pilih Pajak</option>
                          {taxes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.rate}%)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">
                          Skema Perhitungan Pajak
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPoForm({ ...poForm, taxInclusive: false })
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              !poForm.taxInclusive
                                ? "border-theme bg-theme-light/70 text-theme font-bold ring-2 ring-theme/20"
                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                            }`}
                          >
                            <div className="text-xs font-bold flex items-center gap-1">
                              <span>Belum Termasuk</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                              + Pajak di luar harga
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setPoForm({ ...poForm, taxInclusive: true })
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              poForm.taxInclusive
                                ? "border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold ring-2 ring-emerald-500/20"
                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                            }`}
                          >
                            <div className="text-xs font-bold flex items-center gap-1">
                              <span>Sudah Termasuk</span>
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                              Pajak di dalam harga
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Collapsible Section: Pengaturan Tambahan */}
                <div className="pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions((prev) => !prev)}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 size={15} className="text-zinc-500" />
                      <span>Pengaturan Tambahan (Diskon, Gudang, Faktur)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <span className="text-[10px] font-normal">
                        {showAdvancedOptions ? "Sembunyikan" : "Buka"}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${showAdvancedOptions ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>

                  {showAdvancedOptions && (
                    <div className="mt-3 space-y-4 pt-1">
                      {/* Potongan / Diskon Total Section */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                              Potongan / Diskon Total
                            </label>
                            <span className="text-[10px] text-zinc-400 block">
                              Diskon menyeluruh untuk seluruh PO
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode("PERCENT");
                                const numAmt = parseFloat(
                                  poForm.globalDiscountAmount || 0,
                                );
                                const pct =
                                  originalSum > 0
                                    ? (numAmt / originalSum) * 100
                                    : parseFloat(
                                        poForm.globalDiscountPercent || 0,
                                      );
                                const cleanPct = Math.round(pct * 100) / 100;
                                const newAmt = Math.round(
                                  originalSum * (cleanPct / 100),
                                );
                                setPoForm((prev) => ({
                                  ...prev,
                                  globalDiscountPercent: cleanPct,
                                  globalDiscountAmount: newAmt,
                                  globalDiscountMode: "PERCENT",
                                }));
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                globalDiscountMode === "PERCENT"
                                  ? "bg-white text-zinc-900 shadow-2xs"
                                  : "text-zinc-500 hover:text-zinc-700"
                              }`}
                            >
                              % Persen
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode("AMOUNT");
                                const numPct = parseFloat(
                                  poForm.globalDiscountPercent || 0,
                                );
                                const amt =
                                  parseFloat(
                                    poForm.globalDiscountAmount || 0,
                                  ) || Math.round(originalSum * (numPct / 100));
                                setPoForm((prev) => ({
                                  ...prev,
                                  globalDiscountAmount: amt,
                                  globalDiscountMode: "AMOUNT",
                                }));
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                globalDiscountMode === "AMOUNT"
                                  ? "bg-white text-zinc-900 shadow-2xs"
                                  : "text-zinc-500 hover:text-zinc-700"
                              }`}
                            >
                              Rp Rupiah
                            </button>
                          </div>
                        </div>

                        {globalDiscountMode === "PERCENT" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                placeholder="0"
                                value={
                                  poForm.globalDiscountPercent !== undefined &&
                                  poForm.globalDiscountPercent !== null
                                    ? poForm.globalDiscountPercent
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = parseFloat(val) || 0;
                                  const amt = Math.round(
                                    originalSum * (num / 100),
                                  );
                                  setPoForm((prev) => ({
                                    ...prev,
                                    globalDiscountPercent: val,
                                    globalDiscountAmount: amt,
                                    globalDiscountMode: "PERCENT",
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none font-mono focus:ring-2 focus:ring-zinc-200 focus:border-theme"
                              />
                              <span className="text-sm font-bold text-zinc-500">
                                %
                              </span>
                            </div>
                            {parseFloat(poForm.globalDiscountPercent || 0) >
                              0 &&
                              originalSum > 0 && (
                                <div className="text-[11px] text-amber-700 font-mono font-medium flex justify-between">
                                  <span>Potongan:</span>
                                  <strong>
                                    -
                                    {formatRupiah(
                                      originalSum *
                                        (parseFloat(
                                          poForm.globalDiscountPercent || 0,
                                        ) /
                                          100),
                                    )}
                                  </strong>
                                </div>
                              )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500 font-mono">
                                Rp
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={originalSum}
                                step="any"
                                placeholder="0"
                                value={
                                  poForm.globalDiscountAmount !== undefined &&
                                  poForm.globalDiscountAmount !== null
                                    ? poForm.globalDiscountAmount
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = parseFloat(val) || 0;
                                  const pct =
                                    originalSum > 0
                                      ? (num / originalSum) * 100
                                      : 0;
                                  setPoForm((prev) => ({
                                    ...prev,
                                    globalDiscountAmount: val,
                                    globalDiscountPercent:
                                      Math.round(pct * 100) / 100,
                                    globalDiscountMode: "AMOUNT",
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none font-mono focus:ring-2 focus:ring-zinc-200 focus:border-theme"
                              />
                            </div>
                            {effectiveGlobalDiscount > 0 && originalSum > 0 && (
                              <div className="text-[11px] text-amber-700 font-mono font-medium flex justify-between">
                                <span>Setara dengan:</span>
                                <strong>
                                  {(
                                    (effectiveGlobalDiscount / originalSum) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </strong>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quick Preset Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(
                            user?.tenant?.settings?.purchaseOrderDiscounts ||
                            user?.tenant?.settings?.salesOrderDiscounts || [
                              0, 5, 10, 15, 20, 25,
                            ]
                          ).map((discPct) => (
                            <button
                              key={discPct}
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode("PERCENT");
                                const amt = Math.round(
                                  originalSum * (discPct / 100),
                                );
                                setPoForm((prev) => ({
                                  ...prev,
                                  globalDiscountPercent: discPct,
                                  globalDiscountAmount: amt,
                                  globalDiscountMode: "PERCENT",
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                globalDiscountMode === "PERCENT" &&
                                parseFloat(
                                  poForm.globalDiscountPercent || 0,
                                ) === discPct
                                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                  : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                              }`}
                            >
                              {discPct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Gudang Penerima Selection */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-2">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                          Gudang Penerima
                        </label>
                        <span className="text-[10px] text-zinc-500 block">
                          Pilih gudang tujuan untuk alokasi penerimaan barang
                        </span>
                        <select
                          value={poForm.warehouseId}
                          onChange={(e) =>
                            setPoForm({
                              ...poForm,
                              warehouseId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none cursor-pointer font-semibold mt-1"
                          required
                        >
                          <option value="">Pilih Gudang</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Auto Options: Auto Invoice & Auto Receive (Surat Jalan Masuk) */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                              Otomatis Terbitkan Invoice
                            </label>
                            <span className="text-[10px] text-zinc-500 block">
                              Buat Tagihan Pembelian (INV-xxx) secara otomatis
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPoForm({
                                ...poForm,
                                autoInvoice: !poForm.autoInvoice,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${poForm.autoInvoice ? "bg-theme" : "bg-zinc-200"}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${poForm.autoInvoice ? "translate-x-5" : "translate-x-0"}`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-dashed border-zinc-200">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                                Otomatis Terima Stok & SJM
                              </label>
                              {poForm.requireApproval === false && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                  Otomatis Aktif
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 block">
                              Stok langsung masuk & Surat Jalan Masuk
                              diterbitkan
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={poForm.requireApproval === false}
                            onClick={() =>
                              setPoForm({
                                ...poForm,
                                autoReceive: !poForm.autoReceive,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              poForm.autoReceive ||
                              poForm.requireApproval === false
                                ? "bg-theme"
                                : "bg-zinc-200"
                            } ${poForm.requireApproval === false ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                poForm.autoReceive ||
                                poForm.requireApproval === false
                                  ? "translate-x-5"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Items (Scroll Mandiri & Totalan Fixed) */}
            <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-hidden">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Item Barang Dipesan ({poForm.items.length})
                  </h4>
                  {selectedSupplier ? (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span>
                        Supplier: <strong>{selectedSupplier.name}</strong> (
                        {filteredProducts.length} barang tersedia)
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      Semua Barang ({products?.length || 0})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addPoItem}
                  className="text-xs font-bold text-theme hover:underline cursor-pointer"
                >
                  + Tambah Item
                </button>
              </div>

              {/* Div List Barang - Scroll Mandiri */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 space-y-2 pr-1.5">
                {poForm.items.map((item, idx) => {
                  const selProduct = products.find(
                    (p) =>
                      p.id === item.productId ||
                      p.id === parseInt(item.productId),
                  ) || item.product;
                  const rawImgUrl =
                    selProduct?.image || selProduct?.metadata?.image;
                  const fullImgUrl = rawImgUrl ? getImageUrl(rawImgUrl) : null;
                  const struct = getProductStructure(selProduct);
                  const { totalBaseQty, totalBaseBonusQty, grossSubtotal, netSubtotal: itemSubtotal } = calculateTieredItemSubtotal(item, struct);
                  const itemDiscount = parseFloat(item.discount) || 0;

                  // Filter out products already selected on other rows
                  const rowProductOptions = poProductOptions.filter(
                    (opt) =>
                      !poForm.items.some(
                        (it, otherIdx) =>
                          otherIdx !== idx &&
                          parseInt(it.productId) === parseInt(opt.value),
                      ),
                  );

                  return (
                    <div
                      key={idx}
                      className="bg-white p-3 border border-zinc-200 rounded-xl shadow-xs space-y-1.5"
                    >
                      <div className="flex gap-2.5 items-center">
                        {/* Product Image Thumbnail */}
                        {fullImgUrl ? (
                          <div className="w-10 h-10 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 shadow-2xs">
                            <img
                              src={fullImgUrl}
                              alt={selProduct?.name || "Product"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0 shadow-2xs">
                            <Package size={18} />
                          </div>
                        )}

                        <SearchSelect
                          options={rowProductOptions}
                          value={item.productId}
                          onChange={(opt) =>
                            handlePoItemChange(
                              idx,
                              "productId",
                              opt ? opt.value : "",
                            )
                          }
                          placeholder="Pilih Barang..."
                          searchPlaceholder="Cari barang..."
                          className="flex-1 min-w-0"
                        />

                        {/* Kuantitas Beli (Reguler): Dual Unit jika hasMultiUnit */}
                        {struct.hasMultiUnit ? (
                          <div className="flex items-center space-x-1 shrink-0" title={`Kuantitas Beli: ${struct.conversionHint}`}>
                            <div className="w-14">
                              <label className="text-[9px] font-bold text-zinc-500 uppercase block text-center mb-0.5 truncate" title={struct.bigUnitName}>
                                {struct.bigUnitName}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={item.bigQty !== undefined ? (item.bigQty === "" ? "" : item.bigQty) : (item.qty === "" ? "" : item.qty)}
                                onChange={(e) =>
                                  handlePoItemChange(
                                    idx,
                                    "bigQty",
                                    e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-1.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs outline-none font-mono text-center font-bold text-zinc-800"
                              />
                            </div>
                            <div className="w-14">
                              <label className="text-[9px] font-bold text-zinc-500 uppercase block text-center mb-0.5 truncate" title={struct.smallUnitName}>
                                {struct.smallUnitName}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                value={item.smallQty === "" ? "" : (item.smallQty || "")}
                                onChange={(e) =>
                                  handlePoItemChange(
                                    idx,
                                    "smallQty",
                                    e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-1.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs outline-none font-mono text-center font-bold text-zinc-800"
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="w-16 shrink-0"
                            title="Kuantitas Beli (Reguler)"
                          >
                            <label className="text-[9px] font-bold text-zinc-500 uppercase block text-center mb-0.5">
                              Beli
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              placeholder="Qty"
                              value={item.qty === "" ? "" : item.qty}
                              onChange={(e) =>
                                handlePoItemChange(
                                  idx,
                                  "qty",
                                  e.target.value === ""
                                    ? ""
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs outline-none font-mono text-center font-semibold"
                              required
                            />
                          </div>
                        )}

                        {/* Kuantitas Bonus dari Supplier: Dual Unit jika hasMultiUnit */}
                        {struct.hasMultiUnit ? (
                          <div className="flex items-center space-x-1 shrink-0" title="Bonus Supplier">
                            <div className="w-12">
                              <label className="text-[9px] font-bold text-emerald-600 uppercase block text-center mb-0.5 truncate" title={`Bonus ${struct.bigUnitName}`}>
                                +{struct.bigUnitName}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="+0"
                                value={item.bigBonusQty === "" ? "" : (item.bigBonusQty || "")}
                                onChange={(e) =>
                                  handlePoItemChange(
                                    idx,
                                    "bigBonusQty",
                                    e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-1 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs outline-none font-mono text-center font-semibold text-emerald-700"
                              />
                            </div>
                            <div className="w-12">
                              <label className="text-[9px] font-bold text-emerald-600 uppercase block text-center mb-0.5 truncate" title={`Bonus ${struct.smallUnitName}`}>
                                +{struct.smallUnitName}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                placeholder="+0"
                                value={item.smallBonusQty === "" ? "" : (item.smallBonusQty || "")}
                                onChange={(e) =>
                                  handlePoItemChange(
                                    idx,
                                    "smallBonusQty",
                                    e.target.value === "" ? "" : parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-full px-1 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs outline-none font-mono text-center font-semibold text-emerald-700"
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="w-16 shrink-0"
                            title="Kuantitas Bonus dari Supplier (Masuk ke Stok Bonus, HPP Rp 0)"
                          >
                            <label className="text-[9px] font-bold text-emerald-600 uppercase block text-center mb-0.5">
                              +Bonus
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="+0"
                              value={
                                item.bonusQty === 0 || item.bonusQty === ""
                                  ? ""
                                  : item.bonusQty
                              }
                              onChange={(e) =>
                                handlePoItemChange(
                                  idx,
                                  "bonusQty",
                                  e.target.value === ""
                                    ? ""
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-full px-2 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs outline-none font-mono text-center font-semibold text-emerald-700"
                            />
                          </div>
                        )}

                        <div className="w-24 shrink-0">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-0.5">
                            Harga Beli
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Harga (Rp)"
                            value={item.price === "" ? "" : item.price}
                            onChange={(e) =>
                              handlePoItemChange(
                                idx,
                                "price",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-full px-2 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs outline-none font-mono font-semibold"
                            required
                          />
                        </div>

                        {/* Diskon Item Input (% or Rp) */}
                        <div className="w-24 shrink-0">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-0.5">
                            Diskon Item
                          </label>
                          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:ring-1 focus-within:ring-theme">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={
                                item.discountType === "PERCENT"
                                  ? item.discountPercent || ""
                                  : item.discount || ""
                              }
                              onChange={(e) => {
                                if (item.discountType === "PERCENT") {
                                  handlePoItemChange(
                                    idx,
                                    "discountPercent",
                                    parseFloat(e.target.value) || 0,
                                  );
                                } else {
                                  handlePoItemChange(
                                    idx,
                                    "discount",
                                    parseFloat(e.target.value) || 0,
                                  );
                                }
                              }}
                              className="w-full px-1.5 py-1.5 bg-transparent text-xs outline-none font-mono font-semibold text-right"
                              title={
                                item.discountType === "PERCENT"
                                  ? "Diskon per item (%)"
                                  : "Diskon per item (Rp)"
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newType =
                                  item.discountType === "PERCENT"
                                    ? "AMOUNT"
                                    : "PERCENT";
                                handlePoItemChange(
                                  idx,
                                  "discountType",
                                  newType,
                                );
                              }}
                              className="px-1.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-[10px] font-bold text-zinc-700 transition-colors border-l border-zinc-200 cursor-pointer shrink-0"
                              title="Klik untuk ubah jenis diskon (% / Rp)"
                            >
                              {item.discountType === "PERCENT" ? "%" : "Rp"}
                            </button>
                          </div>
                        </div>

                        {poForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePoItem(idx)}
                            className="p-1.5 mt-3 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 text-[11px] text-zinc-500 font-mono">
                        <div className="flex flex-wrap items-center gap-2">
                          {struct.hasMultiUnit ? (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              Total Dipesan: {item.bigQty !== undefined ? (item.bigQty === "" ? 0 : item.bigQty) : (item.qty || 0)} {struct.bigUnitName}
                              {parseFloat(item.smallQty || 0) > 0 ? ` + ${item.smallQty} ${struct.smallUnitName}` : ""}
                              {" "}(@{formatRupiah(item.price || struct.bigPrice)}/{struct.bigUnitName}
                              {struct.smallPrice > 0 ? `, ${formatRupiah(struct.smallPrice)}/${struct.smallUnitName}` : ""})
                            </span>
                          ) : (
                            <span>
                              Harga Beli:{" "}
                              <strong className="text-zinc-800">
                                {formatRupiah(item.price)}
                              </strong>
                            </span>
                          )}
                          {itemDiscount > 0 && (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                              Diskon: -{formatRupiah(itemDiscount)} (
                              {item.discountPercent
                                ? `${Number(item.discountPercent).toFixed(1)}%`
                                : `${((itemDiscount / (parseFloat(item.price) || 1)) * 100).toFixed(1)}%`}
                              )
                            </span>
                          )}
                          {parseFloat(totalBaseBonusQty) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              +{formatTieredBonusDisplay(totalBaseBonusQty, item, selProduct)} Bonus
                              Masuk
                            </span>
                          )}
                          {selProduct && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <span>
                                Stok Reg:{" "}
                                {selProduct.totalStock !== undefined
                                  ? selProduct.totalStock
                                  : selProduct.stock || 0}
                              </span>
                              {parseFloat(selProduct.totalBonusStock || 0) >
                                0 && (
                                <span className="text-emerald-700">
                                  | Bonus: {selProduct.totalBonusStock}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Subtotal:</span>
                          <span className="font-extrabold text-theme">
                            {formatRupiah(itemSubtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Card - Fixed / Docked */}
              <div className="shrink-0 mt-3 bg-zinc-50 p-3 sm:p-3.5 border border-zinc-200 rounded-xl space-y-1.5 text-xs shadow-2xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Jumlah Barang (Bruto)</span>
                  <span className="font-semibold text-zinc-900 font-mono">
                    {formatRupiah(originalSum)}
                  </span>
                </div>
                {effectiveGlobalDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs text-amber-700 font-semibold">
                    <span>
                      Diskon Total PO{" "}
                      {globalDiscountMode === "PERCENT"
                        ? `(${globalDiscountPercent}%)`
                        : `(${((effectiveGlobalDiscount / (originalSum || 1)) * 100).toFixed(1)}%)`}
                    </span>
                    <span className="font-mono">
                      -{formatRupiah(effectiveGlobalDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-zinc-200">
                  <span className="text-zinc-500">Subtotal (DPP)</span>
                  <span className="font-semibold text-zinc-900 font-mono">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                {applyTax && selectedTax && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">
                      PPN ({selectedTax.rate}%){" "}
                      {taxInclusive
                        ? "(Termasuk Dalam Harga)"
                        : "(Ditambahkan)"}
                    </span>
                    <span className="font-semibold text-zinc-900 font-mono">
                      {taxInclusive ? "" : "+"}
                      {formatRupiah(taxAmount)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                  <span className="font-bold text-zinc-900">
                    Total Pembelian
                  </span>
                  <span className="font-extrabold text-theme font-mono text-base">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Batal
            </button>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={actionLoading}
                onClick={(e) => handleConfirmCreatePo(e, true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <FileText size={16} />
                <span>
                  {poFormMode === "CREATE"
                    ? "Simpan sebagai Draft"
                    : "Simpan Tetap Draft"}
                </span>
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={(e) => handleConfirmCreatePo(e, false)}
                className={`flex-1 sm:flex-none px-5 py-2 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-md ${
                  poForm.requireApproval === false
                    ? "bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/20"
                    : "bg-theme bg-theme-hover"
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {!actionLoading && poForm.requireApproval === false && (
                  <CheckCircle2 size={16} />
                )}
                <span>
                  {poForm.requireApproval === false
                    ? poFormMode === "CREATE"
                      ? "Simpan & Selesaikan PO"
                      : "Selesaikan Langsung PO"
                    : poFormMode === "CREATE"
                      ? isStaff
                        ? "Simpan & Ajukan Persetujuan"
                        : "Simpan & Setujui PO"
                      : isStaff
                        ? "Simpan & Ajukan Persetujuan"
                        : "Simpan & Diproses"}
                </span>
              </button>
            </div>
          </div>
          {poForm.requireApproval === false ? (
            <p className="text-[11px] text-emerald-700 text-center sm:text-right pt-2 font-medium">
              * Mode <strong>Tanpa Approval</strong>: PO langsung berstatus{" "}
              <strong>SELESAI</strong> dan stok barang otomatis masuk ke gudang
              tujuan.
            </p>
          ) : (
            isStaff && (
              <p className="text-[11px] text-zinc-500 text-center sm:text-right pt-2">
                * PO yang diajukan oleh Staff akan masuk ke status{" "}
                <strong>Menunggu Persetujuan</strong> dari Admin/Manager atau
                Owner.
              </p>
            )
          )}
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderModal;

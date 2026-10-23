import React from 'react';
import { X, Package, Trash2, FileText, Loader2, AlertCircle, Settings2, ChevronDown, HelpCircle, Check, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import SearchSelect from '../SearchSelect';
import { formatRupiah, formatStockBreakdown, formatStockBreakdownCompact } from '../../utils/format';
import { generateDocumentNumber } from '../../utils/documentNumber';
import getImageUrl from '../../utils/imageUrl';

const SalesOrderModal = ({
  isOpen,
  onClose,
  soFormMode,
  soForm,
  setSoForm,
  salesOrders,
  customers,
  customerOptions,
  salespersons,
  salespersonOptions,
  taxes,
  warehouses,
  products,
  productOptions,
  drivers = [],
  actionLoading,
  actionError,
  handleConfirmCreateSo,
  handleSoItemChange,
  addSoItem,
  removeSoItem,
  user,
  isAlreadyShipped = false
}) => {
  if (!isOpen) return null;

  const applyTax = soForm.applyTax;
  // Penjualan ke customer PKP: PPN sudah termasuk harga (inklusif), bukan di luar harga
  const taxInclusive = soForm.taxInclusive !== undefined ? Boolean(soForm.taxInclusive) : Boolean(applyTax);
  const selectedTax = taxes.find(t => t.id === parseInt(soForm.taxId));
  const taxRate = (applyTax && selectedTax) ? parseFloat(selectedTax.rate) : 0;

  const [globalDiscountMode, setGlobalDiscountMode] = React.useState('PERCENT');
  const wasOpenRef = React.useRef(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(
    Boolean(soForm.autoSj || parseFloat(soForm.globalDiscountPercent || 0) > 0 || parseFloat(soForm.globalDiscountAmount || 0) > 0)
  );

  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const initialMode = soForm.globalDiscountMode || (
        (parseFloat(soForm.globalDiscountAmount || 0) > 0 && (!soForm.globalDiscountPercent || parseFloat(soForm.globalDiscountPercent) === 0))
          ? 'AMOUNT'
          : 'PERCENT'
      );
      setGlobalDiscountMode(initialMode);
      if (Boolean(soForm.autoSj || parseFloat(soForm.globalDiscountPercent || 0) > 0 || parseFloat(soForm.globalDiscountAmount || 0) > 0)) {
        setShowAdvancedOptions(true);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  // Ensure current customer is always in customer options
  const effectiveCustomerOptions = React.useMemo(() => {
    if (soForm.contactId && !customerOptions.some(opt => String(opt.value) === String(soForm.contactId))) {
      const cust = customers?.find(c => String(c.id) === String(soForm.contactId));
      if (cust) {
        const addressParts = [cust.address, cust.address2, cust.districtName ? `Kec. ${cust.districtName}` : ''].filter(Boolean);
        const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Alamat belum diatur';
        return [{
          value: cust.id,
          label: `${cust.code ? `[${cust.code}] ` : ''}${cust.name}`,
          sublabel: `${addressStr}${cust.phone ? ` • ${cust.phone}` : ''}`,
          name: cust.name,
          code: cust.code,
          raw: cust
        }, ...customerOptions];
      }
    }
    return customerOptions;
  }, [customerOptions, customers, soForm.contactId]);

  // Ensure current salesperson is always in salesperson options
  const effectiveSalespersonOptions = React.useMemo(() => {
    if (soForm.salesperson && !salespersonOptions.some(opt => String(opt.value) === String(soForm.salesperson))) {
      const sp = salespersons?.find(s => String(s.id) === String(soForm.salesperson) || s.name === soForm.salesperson);
      if (sp) {
        return [{
          value: sp.id,
          label: sp.name,
          sublabel: sp.commissionRate > 0 ? `Komisi: ${sp.commissionRate}%` : undefined
        }, ...salespersonOptions];
      }
    }
    return salespersonOptions;
  }, [salespersonOptions, salespersons, soForm.salesperson]);

  let subtotal = 0;
  let taxAmount = 0;
  let grandTotal = 0;

  const originalSum = soForm.items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.price) || 0;
    const discount = parseFloat(item.discount) || 0;
    return sum + (qty * Math.max(0, price - discount));
  }, 0);

  const globalDiscountPercent = parseFloat(soForm.globalDiscountPercent || 0);
  const numDiscountPercent = parseFloat(soForm.globalDiscountPercent || 0);
  const numDiscountAmount = parseFloat(soForm.globalDiscountAmount || 0);

  const effectiveGlobalDiscount = Math.min(
    originalSum,
    globalDiscountMode === 'AMOUNT'
      ? Math.max(0, numDiscountAmount)
      : Math.max(0, originalSum * (numDiscountPercent / 100))
  );

  const netOriginalSum = Math.max(0, originalSum - effectiveGlobalDiscount);

  // Penjualan ke customer PKP: PPN sudah termasuk harga (inklusif)
  if (applyTax && taxRate > 0) {
    if (taxInclusive) {
      grandTotal = netOriginalSum;
      subtotal = grandTotal / (1 + (taxRate / 100));
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

  // Helper to determine if a product is PKP / Taxable
  const checkIsTaxable = (opt) => {
    const prod = products.find(p => p.id === opt.value || p.id === parseInt(opt.value));
    if (prod) {
      if (prod.taxId && prod.tax) {
        return parseFloat(prod.tax.rate) > 0;
      }
      if (prod.taxId) return true;
    }
    return !!opt?.isTaxable;
  };

  // Filter product options strictly by active Tax / PKP mode
  const taxFilteredProductOptions = React.useMemo(() => {
    return productOptions.filter(opt => {
      const isPkp = checkIsTaxable(opt);
      return applyTax ? isPkp : !isPkp;
    });
  }, [productOptions, products, applyTax]);

  // Detect bonus stock shortages
  const bonusShortageItems = React.useMemo(() => {
    const list = [];
    soForm.items.forEach((item, idx) => {
      const bonusQty = parseInt(item.bonusQty) || 0;
      if (bonusQty > 0) {
        const selProduct = products.find(p => p.id === item.productId || p.id === parseInt(item.productId));
        if (selProduct) {
          const selWhId = parseInt(soForm.warehouseId);
          const whStockObj = selWhId && selProduct?.warehouseStocks ? selProduct.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
          const bonusPhysical = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (selProduct.totalBonusStock !== undefined ? parseFloat(selProduct.totalBonusStock) : 0);
          const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
          const reqBonusBase = bonusQty * bonusRatio;
          if (reqBonusBase > bonusPhysical) {
            list.push({
              idx,
              productName: selProduct.name,
              unit: selProduct.unit || 'pcs',
              bonusAvailable: bonusPhysical,
              bonusRequested: reqBonusBase,
              shortage: reqBonusBase - bonusPhysical,
              isZero: bonusPhysical <= 0
            });
          }
        }
      }
    });
    return list;
  }, [soForm.items, soForm.warehouseId, products]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl sm:rounded-3xl max-w-[96vw] w-full h-[92vh] max-h-[95vh] shadow-2xl p-4 sm:p-6 relative flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-100 mb-4 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              {soFormMode === 'CREATE' ? 'Buat Sales Order (SO) Baru' : (isAlreadyShipped ? 'Revisi Sales Order Terkirim / Selesai' : 'Ubah Sales Order (SO)')}
            </h3>
            <p className="text-xs text-zinc-500">
              {isAlreadyShipped 
                ? 'Penyesuaian kuantitas/harga pesanan yang telah dikirim (Otomatis rekonsiliasi stok gudang & tagihan)'
                : 'Mendukung Pembayaran Lunas, Uang Muka (DP), & Tempo (Kredit)'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {isAlreadyShipped && (
          <div className="mb-4 bg-indigo-50/90 border border-indigo-200 rounded-xl p-3.5 text-indigo-900 text-xs flex items-start gap-2.5 shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-indigo-950 text-xs">Mode Revisi Pesanan Terkirim / Selesai Aktif</p>
              <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
                Anda dapat merevisi jumlah barang atau harga secara langsung. Jika Anda <strong>mengurangi jumlah barang</strong>, selisih barang otomatis dikembalikan ke stok gudang. Jika Anda <strong>menambah jumlah barang</strong>, selisihnya otomatis dipotong dari stok gudang, dan dokumen Surat Jalan serta Tagihan Invoice akan otomatis disinkronkan.
              </p>
            </div>
          </div>
        )}

        {actionError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs shrink-0">
            {actionError}
          </div>
        )}

        {bonusShortageItems.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950">
                Peringatan: {bonusShortageItems.length} produk memiliki kuantitas bonus melebihi stok bonus tersedia!
              </p>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                {bonusShortageItems.map((s, i) => (
                  <li key={i}>
                    <strong>{s.productName}</strong>: Diminta bonus <strong>{s.bonusRequested} {s.unit}</strong>, sedangkan stok bonus di gudang {s.isZero ? 'KOSONG (0)' : `hanya tersedia ${s.bonusAvailable} ${s.unit} (Kurang ${s.shortage} ${s.unit})`}.
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-amber-700 mt-1">
                💡 <em>Catatan: Anda dapat menyesuaikan jumlah bonus atau menyimpannya sebagai <strong>Draft</strong> jika barang bonus akan masuk kemudian.</em>
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleConfirmCreateSo} className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-1">
            {/* Left Column: Form Fields (Side Informasi Transaksi - Scroll Mandiri) */}
            <div className="lg:col-span-1 flex flex-col min-h-0 h-full overflow-y-auto pr-1.5 space-y-4">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-4">
                <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Informasi Transaksi</h4>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Customer</label>
                  <SearchSelect
                    options={effectiveCustomerOptions}
                    value={soForm.contactId}
                    onSearch={async (query) => {
                      if (!query || !query.trim()) return customerOptions;
                      try {
                        const res = await api.get(`/customers?search=${encodeURIComponent(query.trim())}&limit=50`);
                        const list = res.data?.data || [];
                        return list.map(c => {
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
                      } catch (err) {
                        console.error('Remote search customer failed:', err);
                        return customerOptions;
                      }
                    }}
                    onChange={(opt) => {
                      const selectedCust = opt?.raw || customers?.find(c => String(c.id) === String(opt ? opt.value : ''));
                      const topDays = parseInt(selectedCust?.topDays || 0);
                      const assignedSpId = selectedCust?.salespersonId || selectedCust?.salesperson_id || '';

                      let newPaymentTerm = soForm.paymentTerm;
                      let newDueDate = soForm.dueDate;

                      // If customer has TOP days configured (> 0)
                      if (topDays > 0) {
                        const baseDate = new Date(soForm.soDate || new Date());
                        baseDate.setDate(baseDate.getDate() + topDays);
                        newDueDate = baseDate.toISOString().split('T')[0];
                        newPaymentTerm = 'TEMPO';
                      } else if (newPaymentTerm === 'TEMPO' && !newDueDate) {
                        const baseDate = new Date(soForm.soDate || new Date());
                        baseDate.setDate(baseDate.getDate() + 30);
                        newDueDate = baseDate.toISOString().split('T')[0];
                      }

                      setSoForm(prev => ({
                        ...prev,
                        contactId: opt ? opt.value : '',
                        salesperson: assignedSpId ? assignedSpId : prev.salesperson,
                        paymentTerm: newPaymentTerm,
                        dueDate: newDueDate
                      }));
                    }}
                    placeholder="Pilih Pelanggan..."
                    searchPlaceholder="Cari nama toko, kode, atau alamat..."
                  />

                  {/* Customer Quick Meta Info */}
                  {soForm.contactId && (() => {
                    const cust = customers?.find(c => c.id === parseInt(soForm.contactId) || c.id === soForm.contactId);
                    if (!cust) return null;
                    const sp = salespersons?.find(s => s.id === (cust.salespersonId || cust.salesperson_id));
                    return (
                      <div className="mt-1 px-2.5 py-1.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-semibold">
                          Tempo (TOP): <strong className="text-indigo-700">{cust.topDays ? `${cust.topDays} Hari` : '0 Hari (Cash)'}</strong>
                        </span>
                        {sp && (
                          <span>
                            Salesman: <strong className="text-indigo-700">{sp.code ? `[${sp.code}] ` : ''}{sp.name}</strong>
                          </span>
                        )}
                        {cust.districtName && (
                          <span className="text-zinc-500">
                            Kec. {cust.districtName}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Nomor SO</label>
                  <input
                    type="text"
                    required
                    value={soForm.soNumber}
                    onChange={(e) => setSoForm({ ...soForm, soNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={soForm.soDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const selectedCust = customers?.find(c => c.id === parseInt(soForm.contactId) || c.id === soForm.contactId);
                      const topDays = parseInt(selectedCust?.topDays || 0);

                      let newDueDate = soForm.dueDate;
                      if (soForm.paymentTerm === 'TEMPO' || soForm.paymentTerm === 'DP') {
                        const daysToAdd = topDays > 0 ? topDays : 30;
                        const baseDate = new Date(newDate || new Date());
                        baseDate.setDate(baseDate.getDate() + daysToAdd);
                        newDueDate = baseDate.toISOString().split('T')[0];
                      }

                      setSoForm(prev => ({
                        ...prev,
                        soDate: newDate,
                        dueDate: newDueDate,
                        soNumber: soFormMode === 'CREATE' ? generateDocumentNumber('SO', newDate, salesOrders) : prev.soNumber
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm outline-none"
                  />
                </div>

                {/* Payment Term Selection */}
                <div className="space-y-2 pt-2 border-t border-zinc-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Ketentuan Pembayaran</label>
                    {(() => {
                      const cust = customers?.find(c => c.id === parseInt(soForm.contactId) || c.id === soForm.contactId);
                      return cust?.topDays > 0 ? (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          TOP {cust.topDays} Hari
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'LUNAS', label: 'COD / Tunai', desc: 'Bayar saat kirim' },
                      { id: 'TEMPO', label: 'Tempo', desc: 'Kredit (TOP)' },
                      { id: 'DP', label: 'DP', desc: 'Uang Muka' }
                    ].map(t => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          const selectedCust = customers?.find(c => c.id === parseInt(soForm.contactId) || c.id === soForm.contactId);
                          const topDays = parseInt(selectedCust?.topDays || 0);

                          let newDueDate = soForm.dueDate;
                          if (t.id === 'TEMPO' || t.id === 'DP') {
                            const daysToAdd = topDays > 0 ? topDays : 30;
                            const baseDate = new Date(soForm.soDate || new Date());
                            baseDate.setDate(baseDate.getDate() + daysToAdd);
                            newDueDate = baseDate.toISOString().split('T')[0];
                          }

                          setSoForm(prev => ({
                            ...prev,
                            paymentTerm: t.id,
                            dueDate: newDueDate
                          }));
                        }}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          soForm.paymentTerm === t.id
                            ? 'border-theme bg-theme-light text-theme font-bold ring-2 ring-theme/20'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{t.label}</div>
                        <div className="text-[10px] text-zinc-400">{t.desc}</div>
                      </button>
                    ))}
                  </div>

                  {soForm.paymentTerm === 'DP' && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-semibold text-zinc-700 block">Nominal Uang Muka / DP (Rp)</label>
                        {soForm.dpAmount > 0 && (
                          <span className="text-xs font-mono font-bold text-theme">{formatRupiah(soForm.dpAmount)}</span>
                        )}
                      </div>
                      <input
                        type="number"
                        value={soForm.dpAmount}
                        onChange={(e) => setSoForm({ ...soForm, dpAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none font-mono font-semibold"
                        placeholder="0"
                      />
                    </div>
                  )}

                  {(soForm.paymentTerm === 'TEMPO' || soForm.paymentTerm === 'DP') && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-700 block">Tanggal Jatuh Tempo</label>
                        {(() => {
                          const cust = customers?.find(c => c.id === parseInt(soForm.contactId) || c.id === soForm.contactId);
                          return cust?.topDays > 0 ? (
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              (Otomatis +{cust.topDays} hari dari tanggal SO)
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <input
                        type="date"
                        value={soForm.dueDate}
                        onChange={(e) => setSoForm({ ...soForm, dueDate: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block">Sales Person</label>
                  <SearchSelect
                    options={effectiveSalespersonOptions}
                    value={soForm.salesperson}
                    onChange={(opt) => setSoForm({ ...soForm, salesperson: opt ? opt.value : '' })}
                    placeholder="— Pilih Salesperson —"
                    searchPlaceholder="Cari salesperson..."
                    clearable={true}
                  />
                </div>

                {/* Metode Pemenuhan Barang (Kirim Armada vs Ambil di Tempat) */}
                <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Metode Pemenuhan / Pengiriman</label>
                      <span className="text-[10px] text-zinc-500 block">Tentukan cara penyerahan barang ke pelanggan</span>
                    </div>
                    {soForm.fulfillmentType === 'PICKUP' ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Potong Stok Langsung
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Jadwal Armada Mobil
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSoForm(prev => ({
                          ...prev,
                          fulfillmentType: 'DELIVERY'
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        soForm.fulfillmentType !== 'PICKUP'
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold ring-2 ring-indigo-500/20'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>🚚 Kirim via Armada</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">Pengiriman terjadwal lewat sopir & antrean manifest armada</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSoForm(prev => ({
                          ...prev,
                          fulfillmentType: 'PICKUP'
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        soForm.fulfillmentType === 'PICKUP'
                          ? 'border-amber-600 bg-amber-50/90 text-amber-950 font-bold ring-2 ring-amber-500/20'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>🏪 Ambil di Toko / Langsung</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">Customer bawa sendiri barangnya (Self-Pickup)</div>
                    </button>
                  </div>

                  {soForm.fulfillmentType === 'PICKUP' && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed mt-2">
                      💡 <strong>Ambil di Toko / Langsung:</strong> Stok gudang akan dipotong seketika saat pesanan disetujui & faktur diterbitkan. Pesanan ini <strong>otomatis tidak masuk</strong> ke antrean Manifest Pengiriman Armada.
                    </div>
                  )}
                </div>

                {/* Skema Penjualan (PKP vs Non-PKP) - Diletakkan di Bawah Sales Person & di Luar Pengaturan Tambahan */}
                <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-2 shadow-2xs">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Skema Dokumen Penjualan</label>
                    <span className="text-[10px] text-zinc-500 block">Pilih klasifikasi faktur untuk administrasi & pelaporan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const ppnTax = taxes.find(t => t.rate > 0) || taxes[0];
                        setSoForm(prev => ({
                          ...prev,
                          applyTax: true,
                          taxInclusive: true, // PPN sudah termasuk harga
                          taxId: ppnTax ? ppnTax.id : prev.taxId
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        soForm.applyTax
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>🟢 Jalur PKP</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">Faktur Pajak resmi (Harga sudah termasuk PPN)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSoForm(prev => ({
                          ...prev,
                          applyTax: false,
                          taxId: null
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        !soForm.applyTax
                          ? 'border-zinc-500 bg-zinc-100 text-zinc-900 font-bold ring-2 ring-zinc-400/20'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>⚪ Jalur Non-PKP</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">Penjualan toko umum / warung</div>
                    </button>
                  </div>
                </div>

                {/* Collapsible Section: Pengaturan Tambahan */}
                <div className="pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(prev => !prev)}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <Settings2 size={15} className="text-zinc-500" />
                      <span>Pengaturan Tambahan (Diskon, Gudang, Faktur)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <span className="text-[10px] font-normal">{showAdvancedOptions ? 'Sembunyikan' : 'Buka'}</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {showAdvancedOptions && (
                    <div className="mt-3 space-y-4 pt-1">
                      {/* Diskon Total SO Section */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Potongan / Diskon Total</label>
                            <span className="text-[10px] text-zinc-400 block">Diskon menyeluruh untuk seluruh pesanan</span>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode('PERCENT');
                                const numAmt = parseFloat(soForm.globalDiscountAmount || 0);
                                const pct = originalSum > 0 ? (numAmt / originalSum) * 100 : parseFloat(soForm.globalDiscountPercent || 0);
                                const cleanPct = Math.round(pct * 100) / 100;
                                const newAmt = Math.round(originalSum * (cleanPct / 100));
                                setSoForm(prev => ({
                                  ...prev,
                                  globalDiscountPercent: cleanPct,
                                  globalDiscountAmount: newAmt,
                                  globalDiscountMode: 'PERCENT'
                                }));
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                globalDiscountMode === 'PERCENT'
                                  ? 'bg-white text-zinc-900 shadow-2xs'
                                  : 'text-zinc-500 hover:text-zinc-700'
                              }`}
                            >
                              % Persen
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode('AMOUNT');
                                const numPct = parseFloat(soForm.globalDiscountPercent || 0);
                                const amt = parseFloat(soForm.globalDiscountAmount || 0) || Math.round(originalSum * (numPct / 100));
                                setSoForm(prev => ({
                                  ...prev,
                                  globalDiscountAmount: amt,
                                  globalDiscountMode: 'AMOUNT'
                                }));
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                globalDiscountMode === 'AMOUNT'
                                  ? 'bg-white text-zinc-900 shadow-2xs'
                                  : 'text-zinc-500 hover:text-zinc-700'
                              }`}
                            >
                              Rp Rupiah
                            </button>
                          </div>
                        </div>

                        {globalDiscountMode === 'PERCENT' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                placeholder="0"
                                value={soForm.globalDiscountPercent !== undefined && soForm.globalDiscountPercent !== null ? soForm.globalDiscountPercent : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = parseFloat(val) || 0;
                                  const amt = Math.round(originalSum * (num / 100));
                                  setSoForm(prev => ({
                                    ...prev,
                                    globalDiscountPercent: val,
                                    globalDiscountAmount: amt,
                                    globalDiscountMode: 'PERCENT'
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none font-mono focus:ring-2 focus:ring-zinc-200 focus:border-theme"
                              />
                              <span className="text-sm font-bold text-zinc-500">%</span>
                            </div>
                            {parseFloat(soForm.globalDiscountPercent || 0) > 0 && originalSum > 0 && (
                              <div className="text-[11px] text-amber-700 font-mono font-medium flex justify-between">
                                <span>Potongan:</span>
                                <strong>-{formatRupiah(originalSum * (parseFloat(soForm.globalDiscountPercent || 0) / 100))}</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-zinc-500 font-mono">Rp</span>
                              <input
                                type="number"
                                min="0"
                                max={originalSum}
                                step="any"
                                placeholder="0"
                                value={soForm.globalDiscountAmount !== undefined && soForm.globalDiscountAmount !== null ? soForm.globalDiscountAmount : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = parseFloat(val) || 0;
                                  const pct = originalSum > 0 ? (num / originalSum) * 100 : 0;
                                  setSoForm(prev => ({
                                    ...prev,
                                    globalDiscountAmount: val,
                                    globalDiscountPercent: Math.round(pct * 100) / 100,
                                    globalDiscountMode: 'AMOUNT'
                                  }));
                                }}
                                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold outline-none font-mono focus:ring-2 focus:ring-zinc-200 focus:border-theme"
                              />
                            </div>
                            {effectiveGlobalDiscount > 0 && originalSum > 0 && (
                              <div className="text-[11px] text-amber-700 font-mono font-medium flex justify-between">
                                <span>Setara dengan:</span>
                                <strong>{((effectiveGlobalDiscount / originalSum) * 100).toFixed(1)}%</strong>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quick Preset Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(user?.tenant?.settings?.salesOrderDiscounts || [0, 5, 10, 15, 20, 25]).map((discPct) => (
                            <button
                              key={discPct}
                              type="button"
                              onClick={() => {
                                setGlobalDiscountMode('PERCENT');
                                const amt = Math.round(originalSum * (discPct / 100));
                                setSoForm(prev => ({
                                  ...prev,
                                  globalDiscountPercent: discPct,
                                  globalDiscountAmount: amt,
                                  globalDiscountMode: 'PERCENT'
                                }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                globalDiscountMode === 'PERCENT' && parseFloat(soForm.globalDiscountPercent || 0) === discPct
                                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                              }`}
                            >
                              {discPct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Warehouse Selection & Delivery Workflow Information */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Gudang Pemenuhan Stok</label>
                          <span className="text-[10px] text-zinc-500 block">Pilih gudang asal untuk alokasi barang</span>
                          <select
                            value={soForm.warehouseId}
                            onChange={(e) => setSoForm({ ...soForm, warehouseId: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none cursor-pointer font-semibold mt-1"
                          >
                            <option value="">Pilih Gudang</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>

                        {soForm.fulfillmentType === 'PICKUP' ? (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                            💡 <strong>Alur Ambil Sendiri:</strong> Stok dipotong langsung dari gudang ini saat SO disetujui. Dokumen serah terima barang diterbitkan otomatis dan tidak masuk antrean Manifest Armada.
                          </div>
                        ) : (
                          <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
                            💡 <strong>Alur Pengiriman:</strong> Surat Jalan (SJ) dan pemotongan stok otomatis diterbitkan saat pesanan dimasukkan ke dalam <strong>Manifest Pengiriman</strong> (Armada Mobil). Status SO akan berubah menjadi <em>"Dikirim"</em> saat manifest dibuat.
                          </div>
                        )}
                      </div>

                      {/* Auto Invoice Option */}
                      <div className="p-3 bg-white rounded-xl border border-zinc-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Terbitkan Faktur Tagihan</label>
                            <span className="text-[10px] text-zinc-500 block">Otomatis buat nomor faktur penjualan (INV)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSoForm({ ...soForm, autoInvoice: !soForm.autoInvoice })}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${soForm.autoInvoice ? 'bg-theme' : 'bg-zinc-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${soForm.autoInvoice ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Items List & Realtime Calculations (Scroll Mandiri & Totalan Fixed) */}
            <div className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-hidden">
              {/* Header Item Barang & Filter */}
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2 shrink-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Item Barang ({soForm.items.length})</h4>
                  {applyTax ? (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      Filter: Barang PKP / PPN ({taxFilteredProductOptions.length} produk)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md">
                      Filter: Barang Non-PKP ({taxFilteredProductOptions.length} produk)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addSoItem}
                  className="text-xs font-bold text-theme hover:underline cursor-pointer"
                >
                  + Tambah Item
                </button>
              </div>

              {/* Items List (Scroll Sendiri) */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-200 rounded-xl p-3 sm:p-4 bg-zinc-50/50 space-y-2 pr-2">
                <div className="space-y-2">
                  {soForm.items.map((item, idx) => {
                    const selProduct = products.find(p => p.id === item.productId || p.id === parseInt(item.productId)) || item.product;
                    const rawImgUrl = selProduct?.image || selProduct?.metadata?.image;
                    const fullImgUrl = rawImgUrl ? getImageUrl(rawImgUrl) : null;
                    const itemQty = parseFloat(item.qty) || 0;
                    const itemPrice = parseFloat(item.price) || 0;
                    const itemDiscount = parseFloat(item.discount) || 0;
                    const itemSubtotal = itemQty * Math.max(0, itemPrice - itemDiscount);

                    // Available units for this product
                    const availableUnits = (() => {
                      if (!selProduct) return [{ value: item.unit || 'pcs', label: (item.unit || 'pcs').toUpperCase() }];
                      const list = [];
                      if (selProduct.units && Array.isArray(selProduct.units) && selProduct.units.length > 0) {
                        selProduct.units.forEach(u => {
                          const cleanUnit = (/^\d+$/.test(String(u.unitName || '').trim())) ? (selProduct.unit || 'pcs') : u.unitName;
                          if (cleanUnit && !list.some(existing => existing.value.toLowerCase() === cleanUnit.toLowerCase())) {
                            list.push({
                              value: cleanUnit,
                              label: cleanUnit.toUpperCase(),
                              ratio: parseFloat(u.conversionRatio || 1),
                              sellingPrice: u.sellingPrice
                            });
                          }
                        });
                      }
                      if (selProduct.unit && !list.some(u => u.value.toLowerCase() === selProduct.unit.toLowerCase())) {
                        list.push({
                          value: selProduct.unit,
                          label: selProduct.unit.toUpperCase(),
                          ratio: 1,
                          sellingPrice: selProduct.sellingPrice
                        });
                      }
                      if (list.length === 0) {
                        list.push({ value: 'pcs', label: 'PCS', ratio: 1, sellingPrice: selProduct.sellingPrice });
                      }
                      return list;
                    })();

                    // Filter out products already selected on other rows from the tax-filtered options
                    let rowProductOptions = taxFilteredProductOptions.filter(opt => 
                      !soForm.items.some((it, otherIdx) => otherIdx !== idx && (parseInt(it.productId) === parseInt(opt.value)))
                    );

                    // Guarantee the selected product for this row is present in options even if tax-filtered or not yet in taxFilteredProductOptions
                    if (item.productId && !rowProductOptions.some(opt => String(opt.value) === String(item.productId))) {
                      const currentItemOpt = productOptions.find(opt => String(opt.value) === String(item.productId));
                      if (currentItemOpt) {
                        rowProductOptions = [currentItemOpt, ...rowProductOptions];
                      } else if (selProduct || item.product) {
                        const pObj = selProduct || item.product;
                        rowProductOptions = [{
                          value: parseInt(item.productId) || pObj.id,
                          label: pObj.name,
                          sublabel: `SKU: ${pObj.sku || '-'} | Rp${parseFloat(item.price || pObj.sellingPrice || 0).toLocaleString('id-ID')}`
                        }, ...rowProductOptions];
                      }
                    }

                    // Check if selected product mismatches current tax scheme
                    const isMismatch = selProduct && (applyTax ? !checkIsTaxable({ value: selProduct.id }) : checkIsTaxable({ value: selProduct.id }));

                    return (
                      <div key={idx} className={`bg-white p-3 border rounded-xl shadow-xs space-y-2 ${isMismatch ? 'border-amber-300 bg-amber-50/20' : 'border-zinc-200'}`}>
                        <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
                          {/* Product Image Thumbnail */}
                          {fullImgUrl ? (
                            <div className="w-9 h-9 rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 shrink-0 shadow-2xs">
                              <img src={fullImgUrl} alt={selProduct?.name || 'Product'} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0 shadow-2xs">
                              <Package size={17} />
                            </div>
                          )}

                          {/* Product SearchSelect */}
                          <div className="flex-1 min-w-[200px]">
                            <SearchSelect
                              options={rowProductOptions}
                              value={item.productId}
                              onChange={(opt) => handleSoItemChange(idx, 'productId', opt ? opt.value : '')}
                              placeholder={rowProductOptions.length === 0 ? "Tidak ada barang sesuai filter" : "Pilih Barang..."}
                              searchPlaceholder="Cari barang..."
                              className="w-full"
                            />
                          </div>

                          {/* Pilihan Satuan (Unit) */}
                          <div className="w-24 shrink-0">
                            <select
                              value={item.unit || selProduct?.unit || 'pcs'}
                              onChange={(e) => handleSoItemChange(idx, 'unit', e.target.value)}
                              className="w-full px-2 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none font-bold text-zinc-700 cursor-pointer focus:border-theme focus:ring-1 focus:ring-theme"
                              title="Pilih Satuan Barang"
                            >
                              {availableUnits.map(u => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Qty Input */}
                          <div className="w-16 shrink-0">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Qty"
                              value={item.qty}
                              onChange={(e) => handleSoItemChange(idx, 'qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              className="w-full px-2 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none font-mono text-center font-bold focus:border-theme focus:ring-1 focus:ring-theme"
                              required
                              title="Jumlah Quantity Beli"
                            />
                          </div>

                          {/* Bonus Input + Unit Selection */}
                          {(() => {
                            const selWhId = parseInt(soForm.warehouseId);
                            const whStockObj = selWhId && selProduct?.warehouseStocks ? selProduct.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
                            const bonusPhysical = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (selProduct?.totalBonusStock !== undefined ? parseFloat(selProduct.totalBonusStock) : 0);
                            const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
                            const reqBonusBaseQty = (parseFloat(item.bonusQty) || 0) * bonusRatio;
                            const isBonusShortage = reqBonusBaseQty > bonusPhysical;

                            return (
                              <div className={`flex items-center rounded-xl border overflow-hidden shrink-0 transition-colors ${
                                isBonusShortage
                                  ? 'border-rose-300 bg-rose-50/80 focus-within:ring-1 focus-within:ring-rose-500'
                                  : 'border-emerald-200 bg-emerald-50/60 focus-within:ring-1 focus-within:ring-emerald-500'
                              }`}>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="+Bns"
                                  value={item.bonusQty || ''}
                                  onChange={(e) => handleSoItemChange(idx, 'bonusQty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                                  className={`w-14 px-2 py-2 bg-transparent text-xs outline-none font-mono text-center font-bold ${
                                    isBonusShortage ? 'text-rose-800 placeholder-rose-400' : 'text-emerald-800 placeholder-emerald-400'
                                  }`}
                                  title={isBonusShortage ? `Stok bonus kurang! Tersedia: ${bonusPhysical}, Diminta: ${reqBonusBaseQty}` : "Jumlah Bonus Barang (Free Goods - Rp 0)"}
                                />
                                <select
                                  value={item.bonusUnit || item.unit || selProduct?.unit || 'pcs'}
                                  onChange={(e) => handleSoItemChange(idx, 'bonusUnit', e.target.value)}
                                  className={`px-1.5 py-2 text-[10px] font-bold border-l outline-none cursor-pointer ${
                                    isBonusShortage
                                      ? 'bg-rose-100/80 text-rose-900 border-rose-300 hover:bg-rose-200/80'
                                      : 'bg-emerald-100/70 text-emerald-900 border-emerald-200 hover:bg-emerald-200/70'
                                  }`}
                                  title="Pilih Satuan Bonus"
                                >
                                  {availableUnits.map(u => (
                                    <option key={u.value} value={u.value}>{u.label}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}

                          {/* Price Input */}
                          <div className="w-28 shrink-0">
                            <input
                              type="number"
                              placeholder="Harga"
                              value={item.price}
                              onChange={(e) => handleSoItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs outline-none font-mono font-semibold focus:border-theme focus:ring-1 focus:ring-theme"
                              required
                              title="Harga Satuan"
                            />
                          </div>

                          {/* Diskon Item Input (% or Rp) */}
                          <div className="w-32 shrink-0 flex items-center rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden focus-within:ring-1 focus-within:ring-theme">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Diskon"
                              value={item.discountType === 'PERCENT' ? (item.discountPercent !== undefined && item.discountPercent !== null ? item.discountPercent : '') : (item.discount !== undefined && item.discount !== null ? item.discount : '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (item.discountType === 'PERCENT') {
                                  handleSoItemChange(idx, 'discountPercent', val);
                                } else {
                                  handleSoItemChange(idx, 'discount', val);
                                }
                              }}
                              className="w-full px-2 py-2 bg-transparent text-xs outline-none font-mono font-semibold text-right"
                              title={item.discountType === 'PERCENT' ? 'Diskon per item (%)' : 'Diskon per item (Rp)'}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newType = item.discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT';
                                handleSoItemChange(idx, 'discountType', newType);
                              }}
                              className="px-2 py-2 bg-zinc-200 hover:bg-zinc-300 text-[10px] font-bold text-zinc-700 transition-colors border-l border-zinc-200 cursor-pointer shrink-0"
                              title="Klik untuk ubah jenis diskon (% / Rp)"
                            >
                              {item.discountType === 'PERCENT' ? '%' : 'Rp'}
                            </button>
                          </div>

                          {soForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSoItem(idx)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer shrink-0 transition-colors"
                              title="Hapus baris item"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {/* Item Row Summary & Stock Information */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 px-1 pt-1 border-t border-dashed border-zinc-200/80 text-[11px] text-zinc-500 font-mono">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>Harga Satuan: <strong className="text-zinc-800">{formatRupiah(item.price)}</strong>/{item.unit || selProduct?.unit || 'PCS'}</span>
                            {itemDiscount > 0 && (
                              <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                Diskon: -{formatRupiah(itemDiscount)} ({item.discountPercent ? `${Number(item.discountPercent).toFixed(1)}%` : `${((itemDiscount / (itemPrice || 1)) * 100).toFixed(1)}%`})
                              </span>
                            )}
                            {parseInt(item.bonusQty) > 0 && (
                              <span className={`px-1.5 py-0.5 rounded border font-bold ${
                                (() => {
                                  const selWhId = parseInt(soForm.warehouseId);
                                  const whStockObj = selWhId && selProduct?.warehouseStocks ? selProduct.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
                                  const bonusPhysical = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (selProduct?.totalBonusStock !== undefined ? parseFloat(selProduct.totalBonusStock) : 0);
                                  const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
                                  const reqBonusBaseQty = (parseInt(item.bonusQty) || 0) * bonusRatio;
                                  return reqBonusBaseQty > bonusPhysical ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                })()
                              }`}>
                                Bonus: +{item.bonusQty} {item.bonusUnit || item.unit || selProduct?.unit || 'PCS'} (Rp 0)
                              </span>
                            )}
                            {selProduct && (() => {
                              const selWhId = parseInt(soForm.warehouseId);
                              const whStockObj = selWhId && selProduct?.warehouseStocks ? selProduct.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
                              
                              const regularPhysical = whStockObj ? parseFloat(whStockObj.stock || 0) : (selProduct.totalStock !== undefined ? parseFloat(selProduct.totalStock) : parseFloat(selProduct.stock || 0));
                              const bonusPhysical = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (selProduct.totalBonusStock !== undefined ? parseFloat(selProduct.totalBonusStock) : 0);
                              
                              const allocated = selProduct.allocatedStock || 0;
                              const availableRegular = selWhId ? regularPhysical : (selProduct.availableStock !== undefined ? parseFloat(selProduct.availableStock) : Math.max(0, regularPhysical - allocated));
                              const availableBonus = bonusPhysical;

                              const buyRatio = parseFloat(item.conversionRatio || 1);
                              const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
                              const reqRegularBaseQty = (parseInt(item.qty) || 0) * buyRatio;
                              const reqBonusBaseQty = (parseInt(item.bonusQty) || 0) * bonusRatio;

                              const isOutOfRegular = availableRegular <= 0;
                              const isRegularInsufficient = reqRegularBaseQty > availableRegular;

                              const isOutOfBonus = availableBonus <= 0;
                              const isBonusInsufficient = reqBonusBaseQty > 0 && reqBonusBaseQty > availableBonus;

                              // Conversion hint calculation
                              const units = selProduct.units || selProduct.availableUnits || [];
                              const altUnit = units.find(u => !u.isBaseUnit);
                              let conversionHint = '';
                              if (altUnit) {
                                const cr = parseFloat(altUnit.conversionRatio);
                                if (cr > 1) {
                                  conversionHint = `1 ${altUnit.unitName} = ${Math.round(cr)} ${selProduct.unit}`;
                                } else if (cr < 1 && cr > 0) {
                                  conversionHint = `1 ${selProduct.unit} = ${Math.round(1 / cr)} ${altUnit.unitName}`;
                                }
                              }

                              return (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {conversionHint && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Rasio konversi satuan">
                                      ⚡ {conversionHint}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200" title={`Stok fisik reguler: ${formatStockBreakdown(regularPhysical, selProduct)}`}>
                                    Fisik: {formatStockBreakdownCompact(regularPhysical, selProduct)}
                                  </span>
                                  {allocated > 0 && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title={`Stok sudah dipesan di SO lain: ${formatStockBreakdown(allocated, selProduct)}`}>
                                      Terpesan: {formatStockBreakdownCompact(allocated, selProduct)}
                                    </span>
                                  )}
                                  {/* Regular stock badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    isOutOfRegular
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : isRegularInsufficient
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`} title={`Stok reguler siap dijual: ${formatStockBreakdown(availableRegular, selProduct)}`}>
                                    <span>Tersedia: {formatStockBreakdown(availableRegular, selProduct)}</span>
                                    {isRegularInsufficient && (
                                      <span className="text-rose-700 font-bold ml-1">
                                        (Kurang {formatStockBreakdownCompact(reqRegularBaseQty - availableRegular, selProduct)})
                                      </span>
                                    )}
                                  </span>

                                  {/* Bonus stock badge */}
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    availableBonus <= 0
                                      ? (reqBonusBaseQty > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200')
                                      : isBonusInsufficient
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-teal-50 text-teal-800 border-teal-200'
                                  }`} title={`Stok bonus yang tersedia di gudang: ${formatStockBreakdown(availableBonus, selProduct)}`}>
                                    <span>Stok Bonus: {formatStockBreakdown(availableBonus, selProduct)}</span>
                                    {isBonusInsufficient && (
                                      <span className="text-rose-700 font-bold ml-1">
                                        ({availableBonus <= 0 ? 'Kosong' : `Kurang ${formatStockBreakdownCompact(reqBonusBaseQty - availableBonus, selProduct)}`})
                                      </span>
                                    )}
                                  </span>

                                  {(reqRegularBaseQty > 0 || reqBonusBaseQty > 0) && (buyRatio !== 1 || bonusRatio !== 1) && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200" title="Total kuantitas pesanan ekuivalen dalam satuan dasar">
                                      Setara: {formatStockBreakdownCompact(reqRegularBaseQty + reqBonusBaseQty, selProduct)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <span>Subtotal:</span>
                            <span className="font-extrabold text-theme">{formatRupiah(itemSubtotal)}</span>
                          </div>
                        </div>

                        {/* Bonus Shortage Alert for this item row */}
                        {selProduct && parseInt(item.bonusQty) > 0 && (() => {
                          const selWhId = parseInt(soForm.warehouseId);
                          const whStockObj = selWhId && selProduct?.warehouseStocks ? selProduct.warehouseStocks.find(ws => ws.warehouseId === selWhId) : null;
                          const bonusPhysical = whStockObj ? parseFloat(whStockObj.bonusStock || 0) : (selProduct.totalBonusStock !== undefined ? parseFloat(selProduct.totalBonusStock) : 0);
                          const bonusRatio = parseFloat(item.bonusConversionRatio || 1);
                          const reqBonusBaseQty = (parseInt(item.bonusQty) || 0) * bonusRatio;
                          const isInsufficient = reqBonusBaseQty > bonusPhysical;

                          if (!isInsufficient) return null;

                          return (
                            <div className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-800 font-semibold flex items-center justify-between gap-2 mt-1">
                              <div className="flex items-center gap-1.5">
                                <AlertCircle size={13} className="text-rose-600 shrink-0" />
                                <span>
                                  <strong>Peringatan Stok Bonus:</strong> Stok bonus <strong>{selProduct.name}</strong> {bonusPhysical <= 0 ? 'KOSONG (0)' : 'tidak mencukupi'} {soForm.warehouseId ? 'di gudang terpilih' : ''} (Tersedia: <strong>{formatStockBreakdownCompact(bonusPhysical, selProduct)}</strong>, Diminta: <strong>{formatStockBreakdownCompact(reqBonusBaseQty, selProduct)}</strong>).
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300 shrink-0">
                                {bonusPhysical <= 0 ? 'Stok Bonus 0' : `Kurang ${formatStockBreakdownCompact(reqBonusBaseQty - bonusPhysical, selProduct)}`}
                              </span>
                            </div>
                          );
                        })()}

                        {isMismatch && (
                          <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-semibold flex items-center gap-1.5 mt-1">
                            <AlertCircle size={13} className="text-amber-600 shrink-0" />
                            <span>
                              Barang ini berstatus <strong>{checkIsTaxable({ value: selProduct.id }) ? 'PKP' : 'Non-PKP'}</strong>, tidak sesuai dengan skema transaksi <strong>{applyTax ? 'PKP' : 'Non-PKP'}</strong> saat ini.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculation Summary Card (Totalan selalu tampak di layar tanpa scroll) */}
              <div className="shrink-0 mt-3 bg-zinc-50 p-3 sm:p-3.5 border border-zinc-200 rounded-xl space-y-1.5 text-xs shadow-2xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-medium">Jumlah Barang (Bruto)</span>
                  <span className="font-semibold text-zinc-900 font-mono">{formatRupiah(originalSum)}</span>
                </div>
                {effectiveGlobalDiscount > 0 && (
                  <div className="flex justify-between items-center text-xs text-amber-700 font-semibold">
                    <span>
                      Diskon Total SO {globalDiscountMode === 'PERCENT' ? `(${globalDiscountPercent}%)` : `(${((effectiveGlobalDiscount / (originalSum || 1)) * 100).toFixed(1)}%)`}
                    </span>
                    <span className="font-mono">-{formatRupiah(effectiveGlobalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-zinc-200">
                  <span className="text-zinc-500 font-medium">Skema Transaksi</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                    applyTax ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}>
                    {applyTax ? `🟢 Jalur PKP (PPN ${taxRate}% Termasuk)` : '⚪ Jalur Non-PKP'}
                  </span>
                </div>
                {applyTax && taxRate > 0 && (
                  <div className="space-y-1 text-xs text-zinc-600 pt-1 border-t border-dotted border-zinc-200">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Dasar Pengenaan Pajak (DPP)</span>
                      <span className="font-mono font-semibold text-zinc-800">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-800 font-medium">
                      <span>PPN ({taxRate}% Sudah Termasuk)</span>
                      <span className="font-mono font-bold">{formatRupiah(taxAmount)}</span>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                  <span className="font-bold text-zinc-900 text-sm">Total Tagihan SO</span>
                  <span className="font-extrabold text-theme font-mono text-base sm:text-lg">{formatRupiah(grandTotal)}</span>
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
                onClick={(e) => handleConfirmCreateSo(e, true)}
                className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <FileText size={16} />
                <span>{soFormMode === 'CREATE' ? 'Simpan sebagai Draft' : 'Simpan Tetap Draft'}</span>
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={(e) => handleConfirmCreateSo(e, false)}
                className="flex-1 sm:flex-none px-5 py-2 bg-theme bg-theme-hover text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-md"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{soFormMode === 'CREATE' ? 'Simpan & Konfirmasi SO' : 'Simpan & Diproses (Konfirmasi)'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesOrderModal;

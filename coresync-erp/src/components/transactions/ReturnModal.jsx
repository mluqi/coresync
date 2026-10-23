import React from 'react';
import { Trash2, Loader2, CheckCircle, AlertTriangle, Building2 } from 'lucide-react';
import SearchSelect from '../SearchSelect';
import { formatRupiah, formatQty } from '../../utils/format';

const ReturnModal = ({
  isOpen,
  onClose,
  retForm,
  setRetForm,
  warehouses = [],
  productOptions = [],
  actionLoading,
  actionError,
  handleConfirmCreateReturn,
  handleRetItemChange,
  addRetItem,
  removeRetItem
}) => {
  if (!isOpen) return null;

  const regularWarehouses = warehouses.filter(w => w.type !== 'QUARANTINE');
  const quarantineWarehouses = warehouses.filter(w => w.type === 'QUARANTINE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Buat Retur Barang</h3>
            <p className="text-xs text-zinc-500">Pemisahan otomatis barang layak jual (Gudang Utama) vs rusak/cacat (Gudang Retur)</p>
          </div>
        </div>

        {actionError && (
          <div className="my-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs shrink-0">
            {actionError}
          </div>
        )}

        <form onSubmit={handleConfirmCreateReturn} className="flex-1 flex flex-col min-h-0 mt-3">
          <div className="mb-3 shrink-0">
            <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block mb-1">Tahap Skema Dokumen Retur</label>
            <select
              value={retForm.status || 'FORM_ISSUED'}
              onChange={(e) => setRetForm({ ...retForm, status: e.target.value })}
              className="w-full px-3.5 py-2 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 focus:bg-white outline-none cursor-pointer"
            >
              <option value="FORM_ISSUED">Mode 1: Terbitkan Form Retur Sales (Pengajuan Baru - Stok Belum Berubah)</option>
              <option value="COMPLETED">Mode 2: Langsung Surat Retur Resmi & Update Stok FIFO Gudang</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
            <div>
              <label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Nomor Retur</label>
              <input
                type="text"
                required
                value={retForm.returnNumber}
                onChange={(e) => setRetForm({ ...retForm, returnNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Tanggal Retur</label>
              <input
                type="date"
                required
                value={retForm.returnDate}
                onChange={(e) => setRetForm({ ...retForm, returnDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Dual Warehouse Selection */}
          <div className="grid grid-cols-2 gap-3 mb-3 shrink-0 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
            <div>
              <label className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Gudang Utama (Stok Layak)
              </label>
              <select
                value={retForm.warehouseId}
                onChange={(e) => setRetForm({ ...retForm, warehouseId: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer font-medium"
                required
              >
                {regularWarehouses.length > 0 ? (
                  regularWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                ) : (
                  warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Gudang Retur (Barang Rusak)
              </label>
              <select
                value={retForm.quarantineWarehouseId || ''}
                onChange={(e) => setRetForm({ ...retForm, quarantineWarehouseId: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 outline-none cursor-pointer font-medium"
              >
                <option value="">-- Pilih Gudang Retur/Karantina --</option>
                {quarantineWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} (Gudang Retur)</option>
                ))}
                {regularWarehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto mb-3 border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Item Barang Diretur & Quality Control</h4>
              <button
                type="button"
                onClick={addRetItem}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                + Tambah Baris
              </button>
            </div>

            <div className="space-y-3">
              {retForm.items.map((item, idx) => {
                const isDamaged = item.condition === 'DAMAGED';
                return (
                  <div key={idx} className={`p-3 border rounded-xl space-y-2.5 transition-all ${
                    isDamaged ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-zinc-200'
                  }`}>
                    {/* Header baris item */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <SearchSelect
                          options={productOptions}
                          value={item.productId}
                          onChange={(opt) => handleRetItemChange(idx, 'productId', opt ? opt.value : '')}
                          placeholder="Pilih Barang..."
                          searchPlaceholder="Cari barang..."
                          className="flex-1 min-w-0"
                        />
                      </div>
                      {item.originalQty && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px] shrink-0 border border-indigo-100">
                          Terkirim: {formatQty(item.originalQty)} pcs
                        </span>
                      )}
                      {retForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRetItem(idx)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                          title="Hapus baris retur ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Condition Selector: Layak Jual vs Rusak */}
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase shrink-0">Kondisi Fisik:</span>
                      <div className="flex items-center gap-1.5 flex-1">
                        <button
                          type="button"
                          onClick={() => handleRetItemChange(idx, 'condition', 'GOOD')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            !isDamaged
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          <CheckCircle size={12} />
                          <span>Layak Jual (Gudang Utama)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRetItemChange(idx, 'condition', 'DAMAGED')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            isDamaged
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          <AlertTriangle size={12} />
                          <span>Rusak / Cacat (Gudang Retur)</span>
                        </button>
                      </div>
                    </div>

                    {/* Qty, Price, Subtotal, Reason */}
                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-0.5">Qty Diretur</label>
                        <input
                          type="number"
                          min="1"
                          max={item.originalQty || 9999}
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) => handleRetItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none font-mono font-bold"
                          required
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-0.5">Harga Satuan</label>
                        <input
                          type="number"
                          placeholder="Harga Satuan"
                          value={item.price}
                          onChange={(e) => handleRetItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none font-mono"
                          required
                        />
                      </div>

                      <div className="col-span-5 text-right">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5">Subtotal</span>
                        <span className="font-bold text-xs font-mono text-zinc-900 block py-1.5">
                          {formatRupiah((item.qty || 0) * (item.price || 0))}
                        </span>
                      </div>

                      {isDamaged && (
                        <div className="col-span-12 mt-1">
                          <input
                            type="text"
                            placeholder="Keterangan kerusakan (e.g. Kemasan bocor / Segel rusak / Expired)..."
                            value={item.reason || ''}
                            onChange={(e) => handleRetItemChange(idx, 'reason', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-900 placeholder:text-rose-400 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Retur</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnModal;

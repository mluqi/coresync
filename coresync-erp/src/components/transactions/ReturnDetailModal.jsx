import React from 'react';
import { X, CheckCircle2, Printer } from 'lucide-react';
import { formatRupiah, formatQty } from '../../utils/format';

const ReturnDetailModal = ({
  isOpen,
  onClose,
  selectedReturDetail,
  onPrintForm,
  onPrintBlank
}) => {
  if (!isOpen || !selectedReturDetail) return null;

  const ret = selectedReturDetail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-3xl w-full shadow-2xl p-6 relative flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-zinc-900 font-mono">Detail Retur #{ret.returnNumber}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                ret.type === 'SALES_RETURN' ? 'bg-theme-light text-theme' : 'bg-amber-100 text-amber-800'
              }`}>
                {ret.type === 'SALES_RETURN' ? 'Retur Penjualan (Customer)' : 'Retur Pembelian (Supplier)'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Tanggal Retur: {ret.returnDate}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 my-4 pr-1">
          <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 p-4 border border-zinc-200 rounded-xl">
            <div>
              <span className="text-zinc-500 block">Faktur Acuan:</span>
              <span className="font-bold font-mono text-zinc-900">{ret.invoice?.invoiceNumber || '—'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Gudang Penyimpanan:</span>
              <span className="font-bold text-zinc-900">{ret.warehouse?.name || '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-zinc-500 block">Alasan / Catatan Retur:</span>
              <span className="font-semibold text-zinc-800">{ret.notes || '—'}</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-2">Item Barang Diretur</h4>
            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 border-b font-bold text-zinc-600">
                  <tr>
                    <th className="p-3">SKU & Produk</th>
                    <th className="p-3">Kondisi & Target Gudang</th>
                    <th className="p-3 text-right">Qty Retur</th>
                    <th className="p-3 text-right">Harga Satuan</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ret.items?.map(item => {
                    const isDamaged = item.condition === 'DAMAGED';
                    const targetWhName = item.targetWarehouse?.name || ret.warehouse?.name || 'Gudang';
                    return (
                      <tr key={item.id} className={isDamaged ? 'bg-rose-50/20' : ''}>
                        <td className="p-3">
                          <p className="font-bold text-zinc-900">{item.product?.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">{item.product?.sku}</p>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {isDamaged ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                🔴 Rusak / Cacat &rarr; {targetWhName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                🟢 Layak Jual &rarr; {targetWhName}
                              </span>
                            )}
                            {item.reason && (
                              <p className="text-[10px] text-rose-600 font-medium italic">
                                Alasan: {item.reason}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{formatQty(item.qty)} {item.product?.unit || 'pcs'}</td>
                        <td className="p-3 text-right font-mono">{formatRupiah(item.price)}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatRupiah(item.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>
              Stok barang telah disesuaikan secara otomatis di gudang <strong>{ret.warehouse?.name}</strong> melalui Engine Inventory FIFO.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            {onPrintForm && (
              <button
                type="button"
                onClick={() => onPrintForm(ret)}
                className="px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer size={14} /> Cetak Form Ini
              </button>
            )}
            {onPrintBlank && (
              <button
                type="button"
                onClick={onPrintBlank}
                className="px-3 py-2 bg-zinc-100 border border-zinc-200 text-zinc-700 hover:bg-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer size={14} /> Cetak Form Kosong
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnDetailModal;

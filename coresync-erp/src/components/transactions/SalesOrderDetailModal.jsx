import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User, Phone, MapPin, FileCheck, Printer, CreditCard, Truck, Clock, Edit2 } from 'lucide-react';
import { formatRupiah, getDocPaymentInfo, formatQty } from '../../utils/format';
import EditPaymentTermsModal from './EditPaymentTermsModal';

const SalesOrderDetailModal = ({
  isOpen,
  onClose,
  selectedSoDetail,
  canUpdate,
  triggerPrint,
  handleOpenPaymentModal,
  onOpenSjModal,
  onOpenEditSo,
  onViewEvidence,
  onRefresh
}) => {
  if (!isOpen || !selectedSoDetail) return null;

  const navigate = useNavigate();
  const so = selectedSoDetail;
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const { total, paid, remaining, status: paymentStatus, term, payments: paymentsList, isFullyPaid, isPartial } = getDocPaymentInfo(so);
  const manifestNum = so.metadata?.manifestNumber;
  const manifestStatus = so.metadata?.manifestStatus;
  const isDelivered = so.status === 'DELIVERED' || manifestStatus === 'DELIVERED';
  const isDeliveredUnpaid = isDelivered && !isFullyPaid && so.status !== 'CANCELLED';
  const isCompleted = so.status === 'COMPLETED' || so.status === 'SELESAI' || (isDelivered && isFullyPaid);
  const isManifestScheduled = manifestStatus === 'SCHEDULED' || manifestStatus === 'ACTIVE' || (!manifestStatus && Boolean(manifestNum));
  const isWaitingShipment = so.status === 'WAITING_SHIPMENT' || (isManifestScheduled && !isCompleted && so.status !== 'CANCELLED' && !isDelivered);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl sm:rounded-3xl max-w-5xl w-full h-[92vh] max-h-[95vh] shadow-2xl p-4 sm:p-6 relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-zinc-200 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-extrabold text-zinc-900 font-mono">Detail SO #{so.soNumber}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isCompleted ? 'bg-emerald-100 text-emerald-800' :
                isDeliveredUnpaid ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                isWaitingShipment ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                so.status === 'SHIPPED' ? 'bg-sky-100 text-sky-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {isCompleted ? 'SELESAI' : isDeliveredUnpaid ? 'SUDAH DIKIRIM (TEMPO)' : isWaitingShipment ? 'MENUNGGU DIKIRIM' : so.status === 'SHIPPED' ? 'DIKIRIM' : so.status === 'APPROVED' ? 'DISETUJUI' : so.status}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                term === 'TEMPO' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
                term === 'COD' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                term === 'DP' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-zinc-100 text-zinc-700 border border-zinc-200'
              }`}>
                {term === 'TEMPO' ? `TEMPO ${so.metadata?.dueDate ? `(${so.metadata.dueDate})` : ''}` :
                 term === 'COD' ? 'COD' :
                 term === 'DP' ? 'DP' : 'TUNAI'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isFullyPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                isPartial ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {isFullyPaid ? 'LUNAS' : isPartial ? `SEBAGIAN (${formatRupiah(paid)})` : 'BELUM LUNAS'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Dibuat pada {new Date(so.createdAt).toLocaleString('id-ID')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Status Tracking Timeline Bar */}
        <div className="my-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl shrink-0">
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Tracking Operational & Status</h4>
          <div className="grid grid-cols-4 gap-2 text-center relative">
            <div className={`p-2 rounded-lg border text-xs font-bold ${
              so.status === 'DRAFT' || so.status === 'APPROVED' || so.status === 'SHIPPED' || isWaitingShipment
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-zinc-100 text-zinc-400'
            }`}>
              1. Order Draft
            </div>
            <div className={`p-2 rounded-lg border text-xs font-bold ${
              so.status === 'APPROVED' || so.status === 'SHIPPED' || isWaitingShipment
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-zinc-100 text-zinc-400'
            }`}>
              2. Disetujui
            </div>
            <div className={`p-2 rounded-lg border text-xs font-bold ${
              so.status === 'SHIPPED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : isWaitingShipment
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-zinc-100 text-zinc-400'
            }`}>
              3. {isWaitingShipment ? 'Terjadwal Manifest' : 'Pengiriman (SJ)'}
            </div>
            <div className={`p-2 rounded-lg border text-xs font-bold ${
              paymentStatus === 'PAID'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              4. Pelunasan
            </div>
          </div>
        </div>

        {/* Main 2-Column Split Content (Scroll Mandiri & Totalan Fixed) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-1">
          {/* Left Column (5 Cols): Side Informasi Transaksi & Pelanggan (Scroll Mandiri) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 h-full overflow-y-auto pr-1 space-y-3.5">
            {/* Info Pelanggan */}
            <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-2 text-xs shadow-2xs">
              <h4 className="font-bold text-zinc-900 border-b border-zinc-100 pb-1.5 flex items-center gap-1.5 text-xs">
                <User size={14} className="text-theme" /> Informasi Pelanggan
              </h4>
              <p className="text-sm font-bold text-zinc-900">{so.customer?.name || 'Pelanggan Retail'}</p>
              <p className="text-zinc-500 flex items-center gap-1"><Phone size={12} /> {so.customer?.phone || '-'}</p>
              <p className="text-zinc-500 flex items-start gap-1"><MapPin size={12} className="shrink-0 mt-0.5" /> {so.customer?.address || '-'}</p>
            </div>

            {/* Info Transaksi & Sales & Skema Dokumen */}
            <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
              <h4 className="font-bold text-zinc-900 border-b border-zinc-100 pb-1.5 flex items-center gap-1.5 text-xs">
                <FileCheck size={14} className="text-theme" /> Informasi Transaksi & Sales
              </h4>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Sales Person:</span>
                <span className="font-bold text-zinc-900">{so.metadata?.salesperson || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Skema Dokumen:</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                  (so.taxId && parseFloat(so.tax?.rate || so.taxAmount || 0) > 0) || so.applyTax
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}>
                  {(so.taxId && parseFloat(so.tax?.rate || so.taxAmount || 0) > 0) || so.applyTax
                    ? '🟢 Jalur PKP (PPN)' 
                    : '⚪ Jalur Non-PKP'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Ketentuan Bayar:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-theme">{so.metadata?.paymentTerm || 'LUNAS'}</span>
                  {remaining > 0 && canUpdate && (
                    <button
                      type="button"
                      onClick={() => setTermsModalOpen(true)}
                      className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold cursor-pointer transition-all"
                      title="Ubah Syarat Bayar (Tempo / COD)"
                    >
                      Ubah
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Jatuh Tempo:</span>
                <span className="font-mono text-rose-600 font-bold">{so.metadata?.dueDate || '—'}</span>
              </div>
              {so.warehouse?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Gudang:</span>
                  <span className="font-semibold text-zinc-800">{so.warehouse.name}</span>
                </div>
              )}
            </div>

            {/* Riwayat Pembayaran */}
            <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">Riwayat Pembayaran</h4>
                <span className="text-[10px] font-bold text-zinc-400">{paymentsList.length} Catatan</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {paymentsList.length > 0 ? (
                  paymentsList.map((p, idx) => (
                    <div key={idx} className="bg-zinc-50/80 p-2.5 border border-zinc-200 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-bold text-zinc-900">{formatRupiah(p.amount)}</p>
                        <p className="text-[10px] text-zinc-500">{p.date} • {p.method} • {p.notes || '-'}</p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {p.evidence && onViewEvidence && (
                          <button
                            type="button"
                            onClick={() => onViewEvidence(p.evidence, `Bukti Pembayaran SO #${so.soNumber} (${formatRupiah(p.amount)})`)}
                            className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 cursor-pointer"
                          >
                            Bukti Foto
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">Tercatat</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-zinc-400 italic py-3 text-[11px]">Belum ada riwayat pembayaran.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Items List & Total Calculation Card (Scroll Mandiri & Totalan Fixed) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 h-full overflow-hidden">
            {/* Header Rincian Item */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">
                Rincian Barang Dipesan ({so.items?.length || 0} Item)
              </h4>
            </div>

            {/* Scrollable Items Table */}
            <div className="flex-1 min-h-0 overflow-y-auto border border-zinc-200 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600 z-10 text-[11px]">
                  <tr>
                    <th className="p-2.5">SKU & Barang</th>
                    <th className="p-2.5 text-right">Qty</th>
                    <th className="p-2.5 text-right">Harga Satuan</th>
                    <th className="p-2.5 text-right">Diskon</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {so.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="p-2.5">
                        <p className="font-bold text-zinc-900">{item.product?.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{item.product?.sku}</p>
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        <span className="font-bold">{formatQty(item.qty)} {item.unit || item.product?.unit || 'pcs'}</span>
                        {parseFloat(item.bonusQty || 0) > 0 && (
                          <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                            +{formatQty(item.bonusQty)} {item.bonusUnit || item.unit || item.product?.unit || 'pcs'} Bonus
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">{formatRupiah(item.price)}</td>
                      <td className="p-2.5 text-right font-mono text-rose-600">-{formatRupiah(item.discount)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-zinc-900">{formatRupiah(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculation Summary Card (Selalu terlihat langsung tanpa scroll) */}
            <div className="shrink-0 mt-3 bg-zinc-50 p-3 sm:p-3.5 border border-zinc-200 rounded-xl space-y-1.5 text-xs shadow-2xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal Barang:</span>
                <span className="font-mono font-bold text-zinc-900">{formatRupiah(so.subtotal)}</span>
              </div>
              {parseFloat(so.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Pajak (PPN):</span>
                  <span className="font-mono font-bold text-emerald-800">+{formatRupiah(so.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-200 pt-1.5 text-sm">
                <span>Total Tagihan SO:</span>
                <span className="font-mono text-theme text-base sm:text-lg font-extrabold">{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold pt-0.5">
                <span>Total Telah Dibayar:</span>
                <span className="font-mono font-bold">{formatRupiah(paid)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-extrabold border-t border-dashed border-zinc-200 pt-1.5 text-sm">
                <span>Sisa Tagihan (Belum Bayar):</span>
                <span className="font-mono font-extrabold">{formatRupiah(remaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200 shrink-0">
          <button
            onClick={() => triggerPrint(so, 'SO')}
            className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} /> Cetak Faktur / Dokumen
          </button>

          <div className="flex items-center gap-3">
            {['DRAFT', 'CONFIRMED', 'APPROVED', 'PENDING'].includes(so.status) && onOpenEditSo && canUpdate && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEditSo(so);
                }}
                className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                title="Ubah Sales Order"
              >
                <Edit2 size={14} className="text-amber-600" />
                <span>Ubah Pesanan</span>
              </button>
            )}

            {!isWaitingShipment && !manifestNum && so.status !== 'SHIPPED' && so.status !== 'COMPLETED' && so.status !== 'CANCELLED' && canUpdate && (
              <button
                onClick={() => {
                  onClose();
                  navigate('/delivery-manifest');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                title="Buka Halaman Manifest Pengiriman"
              >
                <Truck size={14} /> Atur di Manifest Pengiriman
              </button>
            )}

            {remaining > 0 && canUpdate && (
              <>
                <button
                  onClick={() => setTermsModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  title="Ubah Syarat Bayar (Tempo / COD)"
                >
                  <Clock size={14} /> Ubah Syarat (Tempo/COD)
                </button>
                <button
                  onClick={() => handleOpenPaymentModal(so, 'SO')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <CreditCard size={14} /> Catat Pembayaran Sisa ({formatRupiah(remaining)})
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Edit Payment Terms Modal */}
      <EditPaymentTermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        so={so}
        onSuccess={() => {
          if (onRefresh) onRefresh(so.id);
        }}
      />
    </div>
  );
};

export default SalesOrderDetailModal;

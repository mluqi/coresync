import React from 'react';
import { X, Loader2, UploadCloud, Trash2 } from 'lucide-react';
import { formatRupiah } from '../../utils/format';

const PaymentRecordModal = ({
  isOpen,
  onClose,
  paymentTargetDoc,
  paymentForm,
  setPaymentForm,
  evidenceFile,
  setEvidenceFile,
  evidencePreview,
  setEvidencePreview,
  actionLoading,
  actionError,
  handleRecordPaymentSubmit
}) => {
  if (!isOpen || !paymentTargetDoc) return null;

  const handleEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceFile(file);
    setEvidencePreview(URL.createObjectURL(file));
  };

  const handleRemoveEvidence = () => {
    setEvidenceFile(null);
    setEvidencePreview('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative my-8">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-200 mb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Catat Pembayaran</h3>
            <p className="text-xs text-zinc-500 font-mono">{paymentTargetDoc.docNumber} ({paymentTargetDoc.contactName})</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {actionError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
            {actionError}
          </div>
        )}

        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
          <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
            <div className="flex justify-between text-zinc-500">
              <span>Total Tagihan:</span>
              <span className="font-mono font-bold text-zinc-900">{formatRupiah(paymentTargetDoc.total)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Sudah Dibayar:</span>
              <span className="font-mono font-bold">{formatRupiah(paymentTargetDoc.paid)}</span>
            </div>
            <div className="flex justify-between text-rose-600 font-bold border-t pt-1">
              <span>Sisa Tagihan:</span>
              <span className="font-mono">{formatRupiah(paymentTargetDoc.remaining)}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-zinc-700 block">Nominal Pembayaran (Rp)</label>
              {paymentForm.amount > 0 && (
                <span className="font-mono font-bold text-emerald-600">
                  {formatRupiah(paymentForm.amount)}
                </span>
              )}
            </div>
            <input
              type="number"
              required
              min="1"
              max={paymentTargetDoc.remaining}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="font-semibold text-zinc-700 block mb-1">Tanggal Pembayaran</label>
            <input
              type="date"
              required
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
            />
          </div>

          <div>
            <label className="font-semibold text-zinc-700 block mb-1">Metode Pembayaran</label>
            <select
              value={paymentForm.paymentMethod || 'CASH'}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none cursor-pointer"
            >
              <option value="CASH">Tunai (Cash)</option>
              <option value="BANK_TRANSFER">Transfer Bank</option>
              <option value="GIRO">Bilyet Giro / Cek</option>
              <option value="QRIS">QRIS / E-Wallet</option>
              <option value="OTHERS">Lainnya</option>
            </select>
            <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${(!paymentForm.paymentMethod || paymentForm.paymentMethod === 'CASH') ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
              {(!paymentForm.paymentMethod || paymentForm.paymentMethod === 'CASH')
                ? 'Otomatis masuk ke akun: Kas (Tunai)'
                : 'Otomatis masuk ke akun: Bank (Non-Tunai)'}
            </p>
          </div>

          <div>
            <label className="font-semibold text-zinc-700 block mb-1">Catatan</label>
            <input
              type="text"
              placeholder="Catatan pembayaran..."
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
            />
          </div>

          {/* Upload Foto Bukti Pembayaran / Transfer */}
          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <label className="font-semibold text-zinc-700 flex items-center justify-between">
              <span>Foto Bukti Transfer / Nota</span>
              <span className="text-[10px] text-zinc-400 font-normal">(Opsional)</span>
            </label>

            {evidencePreview ? (
              <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                <img 
                  src={evidencePreview} 
                  alt="Preview Bukti" 
                  className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0" 
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 truncate">{evidenceFile?.name || 'Bukti Pembayaran'}</p>
                  <button
                    type="button"
                    onClick={handleRemoveEvidence}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>Hapus Foto</span>
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-emerald-400 bg-zinc-50/50 hover:bg-emerald-50/20 rounded-xl p-3.5 cursor-pointer transition-all">
                <UploadCloud className="w-5 h-5 text-zinc-400 mb-1" />
                <span className="text-xs font-semibold text-zinc-700">Pilih Foto Bukti Transfer</span>
                <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, JPEG (Maks. 5MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEvidenceChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-emerald-600/20"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Simpan Pembayaran</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentRecordModal;

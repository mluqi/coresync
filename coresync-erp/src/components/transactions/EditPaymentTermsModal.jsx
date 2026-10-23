import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, CheckCircle2, AlertCircle, Save, ArrowRight } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import api from '../../utils/api';
import { useToast } from '../../context/ToastContext';

const EditPaymentTermsModal = ({
  isOpen,
  onClose,
  so,
  onSuccess
}) => {
  if (!isOpen || !so) return null;
  const { toast } = useToast();

  const metadata = so.metadata || {};
  const currentTerm = metadata.paymentTerm || 'LUNAS';
  const currentDueDate = metadata.dueDate || '';
  const currentDp = metadata.dpAmount || 0;
  const customerTopDays = parseInt(so.customer?.topDays || 0);

  const [paymentTerm, setPaymentTerm] = useState(currentTerm);
  const [dueDate, setDueDate] = useState(currentDueDate);
  const [dpAmount, setDpAmount] = useState(currentDp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPaymentTerm(currentTerm);
    setDueDate(currentDueDate);
    setDpAmount(currentDp);
    setError('');

    // If switching to TEMPO and no dueDate is set, default to today + topDays
    if (currentTerm === 'TEMPO' && !currentDueDate) {
      const days = customerTopDays > 0 ? customerTopDays : 30;
      const target = new Date();
      target.setDate(target.getDate() + days);
      setDueDate(target.toISOString().split('T')[0]);
    }
  }, [isOpen, so]);

  const handleTermChange = (termId) => {
    setPaymentTerm(termId);
    if ((termId === 'TEMPO' || termId === 'DP') && !dueDate) {
      const days = customerTopDays > 0 ? customerTopDays : 30;
      const target = new Date();
      target.setDate(target.getDate() + days);
      setDueDate(target.toISOString().split('T')[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if ((paymentTerm === 'TEMPO' || paymentTerm === 'DP') && !dueDate) {
        throw new Error('Tanggal jatuh tempo wajib diisi untuk pembayaran Tempo/DP.');
      }

      const res = await api.put(`/sales-orders/${so.id}/terms`, {
        paymentTerm,
        dueDate: (paymentTerm === 'TEMPO' || paymentTerm === 'DP') ? dueDate : null,
        dpAmount: paymentTerm === 'DP' ? parseFloat(dpAmount || 0) : 0
      });

      toast({
        title: 'Syarat Pembayaran Diperbarui',
        description: res.data?.message || 'Syarat pembayaran berhasil diperbarui.',
        type: 'success'
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal mengubah syarat pembayaran.';
      setError(msg);
      toast({
        title: 'Gagal Mengubah Syarat Bayar',
        description: msg,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-900 font-mono">Ubah Syarat Bayar #{so.soNumber}</h3>
              <p className="text-[11px] text-zinc-500">Pelanggan: <strong className="text-zinc-700">{so.customer?.name || 'Pelanggan'}</strong></p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Tagihan Saat Ini */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Total Nilai Pesanan</span>
              <strong className="font-mono text-zinc-900 text-sm font-black">{formatRupiah(so.totalAmount || 0)}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Syarat Bayar Saat Ini</span>
              <span className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                currentTerm === 'TEMPO' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
              }`}>
                {currentTerm === 'TEMPO' ? `TEMPO (Jatuh tempo: ${currentDueDate || '-'})` : currentTerm}
              </span>
            </div>
          </div>

          {/* Pilihan Metode Bayar Baru */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
              Pilih Ketentuan Bayar Baru
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'LUNAS', label: 'COD / Tunai', desc: 'Bayar saat kirim' },
                { id: 'TEMPO', label: 'Tempo', desc: customerTopDays > 0 ? `TOP ${customerTopDays} Hari` : 'Kredit' },
                { id: 'DP', label: 'DP', desc: 'Uang Muka' }
              ].map(t => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => handleTermChange(t.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    paymentTerm === t.id
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  <div className="text-xs font-bold">{t.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Tambahan untuk Tempo / DP */}
          {(paymentTerm === 'TEMPO' || paymentTerm === 'DP') && (
            <div className="p-3.5 bg-violet-50/50 border border-violet-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-violet-900 flex items-center gap-1">
                    <Calendar size={13} /> Tanggal Jatuh Tempo
                  </label>
                  {customerTopDays > 0 && (
                    <span className="text-[10px] text-violet-700 font-semibold bg-violet-100 px-1.5 py-0.2 rounded">
                      Default TOP: {customerTopDays} Hari
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-xs outline-hidden font-mono font-bold text-zinc-900 focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {paymentTerm === 'DP' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-violet-900 block">Nominal Uang Muka / DP (Rp)</label>
                  <input
                    type="number"
                    value={dpAmount}
                    onChange={(e) => setDpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-xs outline-hidden font-mono font-bold"
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          )}

          {/* Catatan / Keterangan SOP */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            💡 <strong>Info:</strong> Mengubah syarat pembayaran tidak akan membatalkan pengiriman/surat jalan yang sudah terbit, dan otomatis menyinkronkan tanggal jatuh tempo pada Faktur Penjualan (Invoice).
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default EditPaymentTermsModal;

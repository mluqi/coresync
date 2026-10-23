import React from 'react';
import { Loader2 } from 'lucide-react';

const InvoiceModal = ({
  isOpen,
  onClose,
  invForm,
  setInvForm,
  actionLoading,
  actionError,
  handleConfirmCreateInvoice
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">Terbitkan Faktur Invoice</h3>
        {actionError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
            {actionError}
          </div>
        )}
        <form onSubmit={handleConfirmCreateInvoice} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Nomor Faktur</label>
            <input
              type="text"
              required
              value={invForm.invoiceNumber}
              onChange={(e) => setInvForm({ ...invForm, invoiceNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Tanggal Faktur</label>
              <input
                type="date"
                required
                value={invForm.invoiceDate}
                onChange={(e) => setInvForm({ ...invForm, invoiceDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Jatuh Tempo</label>
              <input
                type="date"
                required
                value={invForm.dueDate}
                onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">Nomor Faktur Pajak (e-Faktur PKP)</label>
            <input
              type="text"
              placeholder="e.g. 010.000-24.12345678 (opsional)"
              value={invForm.taxInvoiceNumber}
              onChange={(e) => setInvForm({ ...invForm, taxInvoiceNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-theme bg-theme-hover text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Terbitkan Faktur</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceModal;

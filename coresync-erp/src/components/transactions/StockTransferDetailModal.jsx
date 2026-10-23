import React, { useState } from "react";
import {
  X,
  Printer,
  Truck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Package,
  Clock,
  Loader2,
  User,
  FileText,
  Gift,
  ArrowLeftRight,
} from "lucide-react";

const StockTransferDetailModal = ({
  isOpen,
  onClose,
  transfer,
  onUpdateStatus,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !transfer) return null;

  const isTypeMutation = transfer.transferType === "STOCK_TYPE";

  const handleStatusChange = async (newStatus) => {
    if (
      !window.confirm(
        `Konfirmasi untuk mengubah status mutasi transfer menjadi ${newStatus}?`,
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      setError("");
      await onUpdateStatus(transfer.id, newStatus);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Gagal mengubah status mutasi transfer.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case "DRAFT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            DRAFT
          </span>
        );
      case "IN_TRANSIT":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            SEDANG DIKIRIM (IN TRANSIT)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            SELESAI DITERIMA
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            DIBATALKAN
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700">
            {st}
          </span>
        );
    }
  };

  const totalQty = (transfer.items || []).reduce(
    (acc, it) => acc + (parseFloat(it.qty) || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-3xl w-full max-h-[92vh] shadow-2xl p-5 sm:p-6 relative flex flex-col print:border-none print:shadow-none print:max-w-none print:h-auto">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-zinc-100 mb-4 shrink-0 print:border-b-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-base font-extrabold text-indigo-900">
                {transfer.transferNumber}
              </span>
              {getStatusBadge(transfer.status)}
              {isTypeMutation ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Gift size={12} />
                  <span>Mutasi Tipe Stok</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Truck size={12} />
                  <span>Mutasi Antar Gudang</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Tanggal:{" "}
              {new Date(transfer.transferDate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Cetak Dokumen
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Warehouse Route Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Gudang Asal (Sumber)
              </span>
              <div className="text-sm font-bold text-zinc-900">
                {transfer.sourceWarehouse?.name || "-"}
              </div>
              {isTypeMutation && (
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    transfer.sourceStockType === "BONUS"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-200 text-zinc-800"
                  }`}
                >
                  Tipe:{" "}
                  {transfer.sourceStockType === "BONUS"
                    ? "Stok Bonus"
                    : "Stok Reguler"}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Gudang Tujuan (Penerima)
              </span>
              <div className="text-sm font-bold text-indigo-700">
                {transfer.destinationWarehouse?.name || "-"}
              </div>
              {isTypeMutation && (
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    transfer.destinationStockType === "BONUS"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-200 text-zinc-800"
                  }`}
                >
                  Tipe:{" "}
                  {transfer.destinationStockType === "BONUS"
                    ? "Stok Bonus"
                    : "Stok Reguler"}
                </span>
              )}
            </div>
          </div>

          {/* Courier & Vehicle Info */}
          {(transfer.driverName ||
            transfer.vehicleNumber ||
            transfer.notes) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white border border-zinc-200 rounded-xl text-xs">
              {transfer.driverName && (
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase">
                    Petugas / Kurir:
                  </span>
                  <span className="font-semibold text-zinc-800">
                    {transfer.driverName}
                  </span>
                </div>
              )}
              {transfer.vehicleNumber && (
                <div>
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase">
                    No. Polisi / Ref:
                  </span>
                  <span className="font-mono font-bold text-zinc-800 uppercase">
                    {transfer.vehicleNumber}
                  </span>
                </div>
              )}
              {transfer.notes && (
                <div className="sm:col-span-3 pt-1 border-t border-zinc-100">
                  <span className="text-zinc-400 block text-[10px] font-bold uppercase">
                    Catatan:
                  </span>
                  <span className="text-zinc-700">{transfer.notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Rincian Barang yang Di-mutasi
            </h4>
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-600 font-bold border-b border-zinc-200">
                  <tr>
                    <th className="p-3">No</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-right">Kuantitas</th>
                    <th className="p-3 text-left">Satuan</th>
                    <th className="p-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(transfer.items || []).map((it, idx) => {
                    const ratio = parseFloat(it.conversionRatio) || 1.0;
                    const hasAltUnit =
                      it.unit &&
                      it.product?.unit &&
                      it.unit.toUpperCase() !== it.product.unit.toUpperCase();
                    const baseQty = (parseFloat(it.qty) || 0) * ratio;

                    return (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="p-3 text-zinc-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-mono font-semibold text-zinc-800">
                          {it.product?.sku || "-"}
                        </td>
                        <td className="p-3 font-bold text-zinc-900">
                          {it.product?.name || "-"}
                          {hasAltUnit && (
                            <span className="block text-[10px] text-amber-700 font-mono font-normal mt-0.5">
                              (Setara: {baseQty.toFixed(2)} {it.product?.unit})
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-900">
                          {it.qty}
                        </td>
                        <td className="p-3 font-mono uppercase font-bold text-indigo-700">
                          {it.unit || it.product?.unit || "PCS"}
                        </td>
                        <td className="p-3 text-zinc-500">{it.notes || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-zinc-50 font-bold border-t border-zinc-200">
                  <tr>
                    <td
                      colSpan={3}
                      className="p-3 text-right uppercase text-zinc-600"
                    >
                      Total Macam Barang:
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-indigo-900">
                      {(transfer.items || []).length} Item
                    </td>
                    <td colSpan={2} className="p-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Action Buttons for Workflow Status Transitions */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-100 mt-2 shrink-0 print:hidden">
          <div>
            {transfer.status === "IN_TRANSIT" && (
              <button
                type="button"
                onClick={() => handleStatusChange("CANCELLED")}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle size={14} /> Batalkan Pengiriman & Kembalikan Stok
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {transfer.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => handleStatusChange("IN_TRANSIT")}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                <Truck size={14} /> Kirim Barang (In Transit)
              </button>
            )}

            {transfer.status === "IN_TRANSIT" && (
              <button
                type="button"
                onClick={() => handleStatusChange("COMPLETED")}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                <CheckCircle2 size={14} /> Konfirmasi Selesai Diterima
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockTransferDetailModal;

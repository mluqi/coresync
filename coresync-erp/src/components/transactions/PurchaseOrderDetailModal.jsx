import {
  X,
  User,
  Boxes,
  CreditCard,
  Printer,
  PackageCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  formatRupiah,
  getDocPaymentInfo,
  formatQty,
  formatTieredQtyDisplay,
  formatTieredBonusDisplay,
} from "../../utils/format";

const PurchaseOrderDetailModal = ({
  isOpen,
  onClose,
  selectedPoDetail,
  canUpdate,
  handleOpenPaymentModal,
  handleApprovePo,
  handleRejectPo,
  user,
  onViewEvidence,
  triggerPrint,
}) => {
  if (!isOpen || !selectedPoDetail) return null;

  const po = selectedPoDetail;
  const {
    total,
    paid,
    remaining,
    term,
    payments: paymentsList,
    isFullyPaid,
    isPartial,
  } = getDocPaymentInfo(po);
  const sjmNumber =
    po.metadata?.sjmNumber ||
    po.metadata?.deliveryNumber ||
    (po.poNumber?.startsWith("PO.")
      ? po.poNumber.replace(/^PO\./, "SJM.")
      : po.poNumber?.startsWith("PO-")
        ? po.poNumber.replace(/^PO-/, "SJM-")
        : `SJM-${po.poNumber}`);
  const isReceived =
    po.status === "RECEIVED" ||
    po.status === "COMPLETED" ||
    po.status === "SELESAI" ||
    po.metadata?.sjmNumber;
  const isPendingApproval =
    po.status === "PENDING_APPROVAL" || po.status === "PENDING";
  const isApproved =
    po.status === "APPROVED" || po.status === "ORDERED" || isReceived;
  const isRejected = po.status === "REJECTED";
  const isApprover = ["ADMIN", "MANAGER", "OWNER", "SUPERADMIN"].includes(
    user?.role,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full shadow-2xl p-6 relative flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-extrabold text-zinc-900 font-mono">
                Detail PO #{po.poNumber}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  po.status === "RECEIVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : isPendingApproval
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : isApproved
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isRejected
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {isPendingApproval
                  ? "MENUNGGU PERSETUJUAN"
                  : po.status === "APPROVED"
                    ? "DISETUJUI"
                    : isRejected
                      ? "DITOLAK"
                      : po.status}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  term === "TEMPO"
                    ? "bg-violet-50 text-violet-700 border border-violet-200"
                    : term === "COD"
                      ? "bg-sky-50 text-sky-700 border border-sky-200"
                      : term === "DP"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                }`}
              >
                {term === "TEMPO"
                  ? `TEMPO ${po.metadata?.dueDate ? `(${po.metadata.dueDate})` : ""}`
                  : term === "COD"
                    ? "COD"
                    : term === "DP"
                      ? "DP"
                      : "TUNAI"}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isFullyPaid
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : isPartial
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {isFullyPaid
                  ? "LUNAS"
                  : isPartial
                    ? `SEBAGIAN (${formatRupiah(paid)})`
                    : "BELUM LUNAS"}
              </span>
              {isReceived && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                  SJM: {sjmNumber}
                </span>
              )}
              {po.metadata?.receiveEvidence && onViewEvidence && (
                <button
                  type="button"
                  onClick={() =>
                    onViewEvidence(
                      po.metadata.receiveEvidence,
                      `Bukti Penerimaan Barang PO #${po.poNumber}`,
                    )
                  }
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                >
                  Bukti Fisik Barang
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Dibuat pada {new Date(po.createdAt).toLocaleString("id-ID")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-6 my-4 pr-1">
          {/* SJM (Surat Jalan Masuk) Card if Received */}
          {isReceived && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2 flex-wrap gap-2">
                <h4 className="font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageCheck size={15} className="text-blue-600" /> Surat
                  Jalan Penerimaan Barang (SJM)
                </h4>
                {triggerPrint && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      triggerPrint(po, "SJM");
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer size={12} />
                    <span>Cetak SJM</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="bg-white/90 p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Nomor SJM:
                  </span>
                  <span className="font-mono font-bold text-blue-700">
                    {sjmNumber}
                  </span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Tanggal Masuk:
                  </span>
                  <span className="font-bold text-zinc-900">
                    {po.metadata?.receiveDate || po.poDate}
                  </span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Petugas Penerima:
                  </span>
                  <span className="font-bold text-zinc-900">
                    {po.metadata?.receivedBy || "Staff Gudang"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-1.5">
                <User size={14} className="text-theme" /> Informasi Supplier
              </h4>
              <p className="text-sm font-bold text-zinc-900">
                {po.supplier?.name || "Supplier General"}
              </p>
              <p className="text-zinc-500">{po.supplier?.address || "-"}</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-zinc-900 border-b pb-2 flex items-center gap-1.5">
                <Boxes size={14} className="text-theme" /> Informasi Gudang
                Masuk & Bayar
              </h4>
              <div className="flex justify-between">
                <span className="text-zinc-500">Gudang Masuk:</span>
                <span className="font-bold text-zinc-900">
                  {po.warehouse?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ketentuan Bayar:</span>
                <span className="font-bold text-theme">
                  {po.metadata?.paymentTerm || "LUNAS"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Jatuh Tempo:</span>
                <span className="font-mono text-rose-600 font-bold">
                  {po.metadata?.dueDate || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-2">
              Item Barang Pembelian
            </h4>
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600">
                  <tr>
                    <th className="p-3">SKU & Barang</th>
                    <th className="p-3 text-right">Qty Dipesan</th>
                    <th className="p-3 text-right">Harga Beli</th>
                    <th className="p-3 text-right">Diskon Item</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {po.items?.map((item) => {
                    const metaItem = (po.metadata?.itemsDetail || []).find(
                      (it) => String(it.productId) === String(item.productId),
                    );
                    return (
                      <tr key={item.id}>
                        <td className="p-3">
                          <p className="font-bold text-zinc-900">
                            {item.product?.name ||
                              item.name ||
                              "Produk Tidak Ditemukan"}
                          </p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            {item.product?.sku || item.sku || "-"}
                          </p>
                        </td>
                        <td className="p-3 text-right font-mono">
                          <span className="font-bold">
                            {formatTieredQtyDisplay(
                              item.qty,
                              metaItem,
                              item.product,
                            )}
                          </span>
                          {parseFloat(item.bonusQty || 0) > 0 && (
                            <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">
                              +
                              {formatTieredBonusDisplay(
                                item.bonusQty,
                                metaItem,
                                item.product,
                              )}{" "}
                              Bonus
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatRupiah(item.price)}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-600">
                          {parseFloat(item.discount || 0) > 0
                            ? `-${formatRupiah(item.discount)}`
                            : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-zinc-900">
                          {formatRupiah(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-bold text-zinc-900 text-xs uppercase tracking-wider">
                Riwayat Pembayaran Supplier
              </h4>
              <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 max-h-44 overflow-y-auto space-y-2 text-xs">
                {paymentsList.length > 0 ? (
                  paymentsList.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-2.5 border border-zinc-200 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-zinc-900">
                          {formatRupiah(p.amount)}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {p.date} • {p.method}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {p.evidence && onViewEvidence && (
                          <button
                            type="button"
                            onClick={() =>
                              onViewEvidence(
                                p.evidence,
                                `Bukti Pembayaran Supplier PO #${po.poNumber} (${formatRupiah(p.amount)})`,
                              )
                            }
                            className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 cursor-pointer"
                          >
                            Bukti Foto
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                          Dibayar
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-zinc-400 italic py-4 text-xs">
                    Belum ada catatan pembayaran supplier.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-zinc-50 p-4 border border-zinc-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal Barang:</span>
                <span className="font-mono font-bold text-zinc-900">
                  {formatRupiah(
                    po.items && po.items.length > 0
                      ? po.items.reduce(
                          (sum, item) => sum + parseFloat(item.subtotal || 0),
                          0,
                        )
                      : parseFloat(po.subtotal || po.totalAmount || 0) +
                          parseFloat(po.metadata?.globalDiscountAmount || 0),
                  )}
                </span>
              </div>
              {(parseFloat(po.metadata?.globalDiscountAmount || 0) > 0 ||
                parseFloat(po.metadata?.globalDiscountPercent || 0) > 0) && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>
                    Diskon Total PO{" "}
                    {po.metadata?.globalDiscountPercent
                      ? `(${po.metadata.globalDiscountPercent}%)`
                      : ""}
                    :
                  </span>
                  <span className="font-mono">
                    -{formatRupiah(po.metadata.globalDiscountAmount || 0)}
                  </span>
                </div>
              )}
              {parseFloat(po.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Pajak (PPN):</span>
                  <span className="font-mono font-bold text-emerald-800">
                    +{formatRupiah(po.taxAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-200 pt-1.5 text-sm">
                <span>Total Pembelian PO:</span>
                <span className="font-mono text-theme text-base font-extrabold">
                  {formatRupiah(total)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Total Dibayar:</span>
                <span className="font-mono">{formatRupiah(paid)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-extrabold border-t pt-2 text-sm">
                <span>Sisa Pembayaran Supplier:</span>
                <span className="font-mono">{formatRupiah(remaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 shrink-0 flex-wrap">
          {isPendingApproval && isApprover && canUpdate && handleApprovePo && (
            <button
              type="button"
              onClick={() => {
                onClose();
                handleApprovePo(po);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={14} /> Setujui Purchase Order
            </button>
          )}

          {isPendingApproval && isApprover && canUpdate && handleRejectPo && (
            <button
              type="button"
              onClick={() => {
                onClose();
                handleRejectPo(po);
              }}
              className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle size={14} /> Tolak PO
            </button>
          )}

          {triggerPrint && isReceived && (
            <button
              type="button"
              onClick={() => {
                onClose();
                triggerPrint(po, "SJM");
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={14} /> Cetak SJM
            </button>
          )}

          {triggerPrint && (
            <button
              type="button"
              onClick={() => {
                onClose();
                triggerPrint(po, "INV");
              }}
              className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={14} /> Cetak PO
            </button>
          )}

          {remaining > 0 && canUpdate && (
            <button
              onClick={() => handleOpenPaymentModal(po, "PO")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <CreditCard size={14} /> Catat Pembayaran Supplier (
              {formatRupiah(remaining)})
            </button>
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
  );
};

export default PurchaseOrderDetailModal;

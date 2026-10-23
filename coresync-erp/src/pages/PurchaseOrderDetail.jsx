import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permission";
import PageHeader from "../components/PageHeader";
import InvoicePrintTemplate from "../components/transactions/InvoicePrintTemplate";
import {
  ArrowLeft,
  Printer,
  CreditCard,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Phone,
  MapPin,
  Boxes,
  FileCheck,
  X,
  ChevronRight,
  Truck,
  XCircle,
  UploadCloud,
  Paperclip,
  Trash2,
  ZoomIn,
  Camera,
  Clock,
} from "lucide-react";
import {
  formatRupiah,
  getDocPaymentInfo,
  formatQty,
  formatTieredQtyDisplay,
  formatTieredBonusDisplay,
} from "../utils/format";
import { getImageUrl } from "../utils/imageUrl";

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canUpdate = hasPermission(user, "purchase_orders", "update");
  const canDelete = hasPermission(user, "purchase_orders", "delete");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [po, setPo] = useState(null);

  // Payment Recording State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState(null);
  const [paymentEvidencePreview, setPaymentEvidencePreview] = useState("");

  // Receive PO Modal State
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    receiveDate: new Date().toISOString().split("T")[0],
    notes: "Penerimaan stok barang PO sesuai surat jalan supplier",
  });
  const [receiveEvidenceFile, setReceiveEvidenceFile] = useState(null);
  const [receiveEvidencePreview, setReceiveEvidencePreview] = useState("");

  // Lightbox Image Preview Modal
  const [previewImage, setPreviewImage] = useState({
    isOpen: false,
    url: "",
    title: "",
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [coas, setCoas] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "BANK_TRANSFER",
    accountId: "",
    notes: "Pelunasan sisa angsuran supplier",
  });

  useEffect(() => {
    fetchPoDetail();
    fetchCoas();
  }, [id]);

  const fetchPoDetail = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/purchase-orders/${id}`);
      setPo(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Gagal memuat detail Purchase Order.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCoas = async () => {
    try {
      const res = await api.get("/chart-of-accounts?limit=100");
      const list = (res.data.data || []).filter(
        (c) => c.accountType === "ASSET" || c.type === "ASSET",
      );
      setCoas(list);
      if (list.length > 0) {
        setPaymentForm((prev) => ({ ...prev, accountId: list[0].id }));
      }
    } catch (err) {
      console.error("Failed to load COA for payments", err);
    }
  };

  const handleOpenPaymentModal = () => {
    if (!po) return;
    const { total, paid, remaining } = getDocPaymentInfo(po);

    setPaymentForm({
      amount: remaining,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "CASH",
      notes:
        remaining === total
          ? "Pembayaran Supplier Lunas"
          : "Pelunasan sisa angsuran supplier",
    });
    setPaymentEvidenceFile(null);
    setPaymentEvidencePreview("");
    setActionError("");
    setPaymentModalOpen(true);
  };

  const handlePaymentEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaymentEvidenceFile(file);
    setPaymentEvidencePreview(URL.createObjectURL(file));
  };

  const handleRemovePaymentEvidence = () => {
    setPaymentEvidenceFile(null);
    setPaymentEvidencePreview("");
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError("");
    try {
      const formData = new FormData();
      formData.append("amount", paymentForm.amount);
      formData.append("paymentDate", paymentForm.paymentDate);
      formData.append("paymentMethod", paymentForm.paymentMethod);
      if (paymentForm.accountId)
        formData.append("accountId", paymentForm.accountId);
      if (paymentForm.notes) formData.append("notes", paymentForm.notes);
      if (paymentEvidenceFile) formData.append("evidence", paymentEvidenceFile);

      await api.post(`/purchase-orders/${id}/payment`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPaymentModalOpen(false);
      fetchPoDetail();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Gagal mencatat pembayaran.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReceiveModal = () => {
    setReceiveForm({
      receiveDate: new Date().toISOString().split("T")[0],
      notes: "Penerimaan stok barang PO sesuai surat jalan supplier",
    });
    setReceiveEvidenceFile(null);
    setReceiveEvidencePreview("");
    setActionError("");
    setReceiveModalOpen(true);
  };

  const handleReceiveEvidenceChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiveEvidenceFile(file);
    setReceiveEvidencePreview(URL.createObjectURL(file));
  };

  const handleRemoveReceiveEvidence = () => {
    setReceiveEvidenceFile(null);
    setReceiveEvidencePreview("");
  };

  const handleReceiveStockSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError("");
    try {
      const formData = new FormData();
      formData.append("receiveDate", receiveForm.receiveDate);
      if (receiveForm.notes) formData.append("notes", receiveForm.notes);
      if (receiveEvidenceFile) formData.append("evidence", receiveEvidenceFile);

      await api.post(`/purchase-orders/${id}/receive`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReceiveModalOpen(false);
      fetchPoDetail();
    } catch (err) {
      setActionError(err.response?.data?.message || "Gagal menerima stok PO.");
    } finally {
      setActionLoading(false);
    }
  };

  const [printMode, setPrintMode] = useState("PO");

  const handlePrintPo = () => {
    try {
      sessionStorage.setItem("print_current_doc", JSON.stringify(po));
      sessionStorage.setItem("print_current_type", "PO");
    } catch (e) {
      console.warn("Could not cache doc to sessionStorage", e);
    }
    window.open(`/print/invoice/${id}?type=PO`, "_blank");
  };

  const handlePrintSjm = () => {
    try {
      sessionStorage.setItem("print_current_doc", JSON.stringify(po));
      sessionStorage.setItem("print_current_type", "SJM");
    } catch (e) {
      console.warn("Could not cache doc to sessionStorage", e);
    }
    window.open(`/print/invoice/${id}?type=SJM`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-theme" />
        <p className="text-zinc-500 font-medium text-sm">
          Memuat detail Purchase Order...
        </p>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-12 px-4">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-900">
              Purchase Order Tidak Ditemukan
            </h3>
            <p className="text-xs text-rose-700 mt-1">
              {error ||
                "Data Purchase Order dengan ID tersebut tidak ditemukan atau telah dihapus."}
            </p>
          </div>
          <button
            onClick={() => navigate("/transactions?tab=PO")}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer inline-flex items-center space-x-2"
          >
            <ArrowLeft size={15} />
            <span>Kembali ke Daftar Transaksi PO</span>
          </button>
        </div>
      </div>
    );
  }

  const {
    total,
    paid,
    remaining,
    status: paymentStatus,
    term,
    isFullyPaid,
    isPartial,
  } = getDocPaymentInfo(po);
  const paymentsList = po.metadata?.payments || [];
  const receivesList = po.metadata?.receives || [];
  const sjmNumber =
    po.metadata?.sjmNumber ||
    po.metadata?.deliveryNumber ||
    (po.poNumber?.startsWith("PO.")
      ? po.poNumber.replace(/^PO\./, "SJM.")
      : po.poNumber?.startsWith("PO-")
        ? po.poNumber.replace(/^PO-/, "SJM-")
        : `SJM-${po.poNumber}`);

  const isCompleted = po.status === "COMPLETED" || po.status === "SELESAI";
  const isReceived = po.status === "RECEIVED" || isCompleted;
  const isShipped = po.status === "SHIPPED" || isReceived;
  const isPendingApproval =
    po.status === "PENDING_APPROVAL" || po.status === "PENDING";
  const isApproved =
    po.status === "APPROVED" ||
    po.status === "ORDERED" ||
    isShipped ||
    isReceived;
  const isRejected = po.status === "REJECTED";
  const isApprover = ["ADMIN", "MANAGER", "OWNER", "SUPERADMIN"].includes(
    user?.role,
  );

  const handleApprovePo = async () => {
    if (
      !window.confirm(
        `Setujui Purchase Order #${po.poNumber}? Setelah disetujui, Staff Gudang dapat memproses penerimaan barang fisik.`,
      )
    )
      return;
    try {
      setActionLoading(true);
      await api.put(`/purchase-orders/${id}/approve`);
      fetchPoDetail();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menyetujui Purchase Order.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectPo = async () => {
    const reason = window.prompt(
      `Alasan penolakan Purchase Order #${po.poNumber}:`,
      "Data PO perlu diperbaiki",
    );
    if (reason === null) return;

    try {
      setActionLoading(true);
      await api.put(`/purchase-orders/${id}/reject`, { reason });
      fetchPoDetail();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menolak Purchase Order.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleShipPo = async () => {
    try {
      setActionLoading(true);
      await api.put(`/purchase-orders/${id}/ship`);
      fetchPoDetail();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal mengubah status pengiriman.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompletePo = async () => {
    if (
      !window.confirm(
        `Selesaikan Purchase Order #${po.poNumber}? Seluruh fisik barang telah diterima di gudang dan transaksi dianggap selesai sepenuhnya.`,
      )
    )
      return;
    try {
      setActionLoading(true);
      await api.put(`/purchase-orders/${id}/complete`);
      fetchPoDetail();
    } catch (err) {
      alert(
        err.response?.data?.message || "Gagal menyelesaikan Purchase Order.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPo = async () => {
    const reason = window.prompt(
      `Alasan pembatalan Purchase Order #${po.poNumber}:`,
      "Dibatalkan oleh pengguna",
    );
    if (reason === null) return;

    try {
      setActionLoading(true);
      await api.put(`/purchase-orders/${id}/cancel`, { reason });
      fetchPoDetail();
    } catch (err) {
      alert(err.response?.data?.message || "Gagal membatalkan Purchase Order.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Printable Area Wrapper */}
      <div
        id="print-area"
        className="hidden print:block p-4 sm:p-8 bg-white text-zinc-950 font-sans text-xs"
      >
        <InvoicePrintTemplate type={printMode} data={po} />
      </div>

      {/* Screen Header & Navigation */}
      <PageHeader
        title={`PO #${po.poNumber}`}
        subtitle={`Supplier: ${po.supplier?.name || "-"} | Tanggal PO: ${po.poDate}`}
        backUrl="/transactions?tab=PO"
        backText="Kembali ke Transactions"
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                po.status === "COMPLETED" || po.status === "SELESAI"
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                  : po.status === "RECEIVED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : po.status === "SHIPPED"
                      ? "bg-sky-50 text-sky-700 border border-sky-200"
                      : isPendingApproval
                        ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                        : po.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : isRejected
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : po.status === "CANCELLED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {po.status === "COMPLETED"
                ? "SELESAI"
                : po.status === "RECEIVED"
                  ? "DITERIMA GUDANG"
                  : po.status === "SHIPPED"
                    ? "DIKIRIM SUPPLIER"
                    : isPendingApproval
                      ? "MENUNGGU PERSETUJUAN"
                      : po.status === "APPROVED"
                        ? "DISETUJUI"
                        : isRejected
                          ? "DITOLAK"
                          : po.status === "ORDERED"
                            ? "DIPESAN"
                            : po.status}
            </span>
            {/* Tipe Pembayaran */}
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
              {term === "TEMPO" ? (
                <>
                  <Clock size={11} />
                  <span>
                    TEMPO{" "}
                    {po.metadata?.dueDate ? `(${po.metadata.dueDate})` : ""}
                  </span>
                </>
              ) : term === "COD" ? (
                <>
                  <Truck size={11} />
                  <span>COD</span>
                </>
              ) : term === "DP" ? (
                <>
                  <CreditCard size={11} />
                  <span>DP</span>
                </>
              ) : (
                <span>TUNAI</span>
              )}
            </span>

            {/* Status Pembayaran */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isFullyPaid
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                  : isPartial
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {isFullyPaid ? (
                <>
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>LUNAS</span>
                </>
              ) : isPartial ? (
                <>
                  <CreditCard size={11} className="text-amber-600" />
                  <span>SEBAGIAN ({formatRupiah(paid)})</span>
                </>
              ) : (
                <>
                  <Clock size={11} className="text-rose-600" />
                  <span>BELUM LUNAS</span>
                </>
              )}
            </span>
            {(isReceived || po.metadata?.sjmNumber) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                SJM: {sjmNumber}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2 print:hidden flex-wrap">
            {/* Action 0: Persetujuan untuk Admin/Manager/Owner */}
            {isPendingApproval && isApprover && canUpdate && (
              <>
                <button
                  onClick={handleApprovePo}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Setujui Purchase Order ini"
                >
                  <CheckCircle2 size={14} /> Setujui Purchase Order
                </button>
                <button
                  onClick={handleRejectPo}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Tolak Purchase Order ini"
                >
                  <XCircle size={14} /> Tolak PO
                </button>
              </>
            )}

            {/* Action 1: Tandai Dikirim Supplier jika sudah disetujui & belum dikirim */}
            {!isShipped &&
              isApproved &&
              po.status !== "CANCELLED" &&
              canUpdate && (
                <button
                  onClick={handleShipPo}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Tandai pesanan sedang dalam proses pengiriman supplier"
                >
                  <Truck size={14} /> Tandai Sedang Dikirim
                </button>
              )}

            {/* Action 2: Konfirmasi Terima Stok oleh Orang Gudang (hanya jika sudah disetujui) */}
            {!isReceived &&
              isApproved &&
              po.status !== "CANCELLED" &&
              canUpdate && (
                <button
                  onClick={handleOpenReceiveModal}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Konfirmasi barang fisik sampai dan tambahkan stok ke gudang"
                >
                  <PackageCheck size={14} /> Konfirmasi Terima Stok Gudang
                </button>
              )}

            {/* Action 2.5: Tandai Selesai jika sudah diterima di gudang & belum selesai */}
            {isReceived &&
              !isCompleted &&
              po.status !== "CANCELLED" &&
              canUpdate && (
                <button
                  onClick={handleCompletePo}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Tandai pesanan PO telah selesai sepenuhnya"
                >
                  <CheckCircle2 size={14} /> Tandai PO Selesai
                </button>
              )}

            {(isReceived || po.metadata?.sjmNumber) && (
              <button
                onClick={handlePrintSjm}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Cetak Surat Jalan Masuk / Bukti Penerimaan Barang"
              >
                <Printer size={14} /> Cetak SJM (Surat Jalan Masuk)
              </button>
            )}

            {po.metadata?.receiveEvidence && (
              <button
                type="button"
                onClick={() =>
                  setPreviewImage({
                    isOpen: true,
                    url: getImageUrl(po.metadata.receiveEvidence),
                    title: `Bukti Penerimaan Barang PO #${po.poNumber}`,
                  })
                }
                className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Paperclip size={14} /> Bukti Foto Barang
              </button>
            )}

            {remaining > 0 && po.status !== "CANCELLED" && canUpdate && (
              <button
                onClick={handleOpenPaymentModal}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CreditCard size={14} /> Bayar Supplier (
                {formatRupiah(remaining)})
              </button>
            )}

            <button
              onClick={handlePrintPo}
              className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={14} /> Cetak PO
            </button>

            {po.status !== "CANCELLED" && !isCompleted && canUpdate && (
              <button
                onClick={handleCancelPo}
                className="px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle size={14} /> Batalkan PO
              </button>
            )}
          </div>
        }
      />

      {/* Alert Banner for Completed PO */}
      {isCompleted && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start space-x-3 text-indigo-900 shadow-xs print:hidden">
          <CheckCircle2 size={20} className="shrink-0 text-indigo-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-sm">Purchase Order SELESAI</p>
            <p className="text-indigo-700">
              Seluruh proses Purchase Order ini telah rampung. Stok barang telah
              dicatat masuk ke gudang melalui SJM dan transaksi telah
              diselesaikan.
            </p>
          </div>
        </div>
      )}

      {/* Alert Banner for Pending Approval */}
      {isPendingApproval && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-900 shadow-xs print:hidden">
          <AlertCircle size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-sm">
              Menunggu Persetujuan (Pending Approval)
            </p>
            <p className="text-amber-700">
              Purchase Order ini dibuat oleh Staff dan sedang menunggu
              persetujuan dari <strong>Admin/Manager</strong> atau{" "}
              <strong>Owner</strong>.
              {isApprover
                ? " Sebagai Admin/Manager/Owner, Anda dapat langsung menyetujui PO ini melalui tombol di pojok kanan atas."
                : " Staff Gudang baru dapat memproses penerimaan barang fisik setelah PO ini disetujui."}
            </p>
          </div>
        </div>
      )}

      {/* Alert Banner for Rejected PO */}
      {isRejected && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-900 shadow-xs print:hidden">
          <XCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-extrabold text-sm">Purchase Order Ditolak</p>
            <p className="text-rose-700">
              Alasan Penolakan:{" "}
              <strong>
                {po.metadata?.rejectionReason || "Ditolak oleh manajemen"}
              </strong>{" "}
              (Ditolak oleh {po.metadata?.rejectedBy || "Manager"})
            </p>
          </div>
        </div>
      )}

      {/* Visual Tracking Timeline Card: 5 Tahap Alur PO */}
      <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-3 print:hidden">
        <h3 className="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">
          Alur Operasional Purchase Order
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-center">
          {/* Step 1: PO Dibuat */}
          <div
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
              po.status !== "CANCELLED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            <span>1. PO Dibuat</span>
          </div>

          {/* Step 2: Persetujuan Manager / Owner */}
          <div
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
              isApproved || isShipped || isReceived || po.status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : isPendingApproval
                  ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                  : isRejected
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {isApproved ||
            isShipped ||
            isReceived ||
            po.status === "COMPLETED" ? (
              <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            ) : isRejected ? (
              <XCircle size={14} className="shrink-0 text-rose-600" />
            ) : (
              <Clock size={14} className="shrink-0 text-amber-600" />
            )}
            <span>2. Persetujuan</span>
          </div>

          {/* Step 3: Dikirim Supplier */}
          <div
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
              isShipped
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : po.status === "APPROVED"
                  ? "bg-sky-50 text-sky-800 border-sky-300"
                  : "bg-zinc-100 text-zinc-400"
            }`}
          >
            <Truck size={14} className="shrink-0" />
            <span>3. Pengiriman</span>
          </div>

          {/* Step 4: Konfirmasi Terima Gudang */}
          <div
            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
              isReceived
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : po.status === "SHIPPED"
                  ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse"
                  : "bg-zinc-100 text-zinc-400"
            }`}
          >
            <PackageCheck size={14} className="shrink-0" />
            <span>4. Terima Gudang</span>
          </div>

          {/* Step 5: Selesai */}
          <div
            className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 ${
              po.status === "COMPLETED" || po.status === "SELESAI"
                ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                : "bg-zinc-100 text-zinc-400 border-zinc-200"
            }`}
          >
            <CheckCircle2 size={14} className="shrink-0" />
            <span>5. Selesai</span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* SJM & Goods Receipt Physical Card */}
          {(po.status === "RECEIVED" ||
            po.status === "COMPLETED" ||
            po.status === "SELESAI" ||
            po.metadata?.sjmNumber) && (
            <div className="p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200 rounded-2xl shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2.5 flex-wrap gap-2">
                <h4 className="font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-2">
                  <PackageCheck size={16} className="text-blue-600" /> Surat
                  Jalan Penerimaan Barang (SJM)
                </h4>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePrintSjm}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer size={12} />
                    <span>Cetak SJM</span>
                  </button>
                  {po.metadata?.receiveEvidence && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          isOpen: true,
                          url: getImageUrl(po.metadata.receiveEvidence),
                          title: `Bukti Foto Penerimaan Fisik PO #${po.poNumber}`,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-amber-800 border border-amber-300 hover:bg-amber-50 transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <Paperclip size={12} />
                      <span>Foto Barang</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/90 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Nomor SJM:
                  </span>
                  <span className="font-mono font-bold text-sm text-blue-700">
                    {sjmNumber}
                  </span>
                </div>
                <div className="bg-white/90 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Tanggal Masuk:
                  </span>
                  <span className="font-bold text-zinc-900">
                    {po.metadata?.receiveDate || po.poDate}
                  </span>
                </div>
                <div className="bg-white/90 p-3 rounded-xl border border-blue-100 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-semibold block uppercase">
                    Petugas Penerima:
                  </span>
                  <span className="font-bold text-zinc-900">
                    {po.metadata?.receivedBy || "Staff Gudang"}
                  </span>
                </div>
              </div>

              {receivesList?.[0]?.notes && (
                <p className="text-[11px] text-blue-900 italic bg-blue-100/50 p-2.5 rounded-lg">
                  Catatan: "{receivesList[0].notes}"
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supplier Info */}
            <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-3">
              <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <User size={15} className="text-indigo-600" /> Informasi
                Supplier
              </h4>
              <div>
                <p className="text-base font-bold text-zinc-900">
                  {po.supplier?.name || "Pemasok Umum"}
                </p>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <Phone size={12} />{" "}
                  {po.supplier?.phone || "Tidak ada nomor kontak"}
                </p>
                <p className="text-xs text-zinc-500 mt-1 flex items-start gap-1">
                  <MapPin size={12} className="shrink-0 mt-0.5" />{" "}
                  {po.supplier?.address || "Tidak ada alamat"}
                </p>
              </div>
            </div>

            {/* Warehouse & Payment Info */}
            <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-3 text-xs">
              <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <Boxes size={15} className="text-indigo-600" /> Gudang &
                Ketentuan Bayar
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tanggal PO:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {po.poDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gudang Tujuan:</span>
                  <span className="font-bold text-indigo-700">
                    {po.warehouse?.name || "Gudang Utama"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ketentuan Bayar:</span>
                  <span className="font-bold text-zinc-900">
                    {po.metadata?.paymentTerm || "LUNAS"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Jatuh Tempo:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {po.metadata?.dueDate || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
            <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">
              Rincian Barang Dipesan
            </h4>
            <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600">
                  <tr>
                    <th className="p-3">SKU & Barang</th>
                    <th className="p-3 text-right">Kuantitas</th>
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

          {/* Payment Log */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">
                Riwayat Pembayaran Supplier
              </h4>
              <span className="text-xs font-bold text-zinc-400">
                {paymentsList.length} Catatan
              </span>
            </div>

            <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-2 text-xs">
              {paymentsList.length > 0 ? (
                paymentsList.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-3 border border-zinc-200 rounded-xl flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-zinc-900 text-sm">
                        {formatRupiah(p.amount)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {p.date} • {p.method} • {p.notes || "-"}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {p.evidence && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              isOpen: true,
                              url: getImageUrl(p.evidence),
                              title: `Bukti Pembayaran Supplier PO #${po.poNumber} (${formatRupiah(p.amount)})`,
                            })
                          }
                          className="px-2 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all flex items-center space-x-1 cursor-pointer"
                          title="Lihat Bukti Pembayaran"
                        >
                          <Paperclip size={12} />
                          <span>Bukti Foto</span>
                        </button>
                      )}
                      <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                        Terbayar
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-zinc-400 italic py-6 text-xs">
                  Belum ada catatan pembayaran supplier.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Financial Summary */}
        <div className="space-y-6">
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 text-xs sticky top-6">
            <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider border-b pb-2">
              Ringkasan Tagihan PO
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal Barang:</span>
                <span className="font-mono font-bold">
                  {formatRupiah(
                    po.items?.reduce(
                      (sum, item) => sum + parseFloat(item.subtotal || 0),
                      0,
                    ) ||
                      parseFloat(po.subtotal || po.totalAmount || 0) +
                        parseFloat(po.metadata?.globalDiscountAmount || 0),
                  )}
                </span>
              </div>

              {po.metadata?.globalDiscountAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Diskon Total:</span>
                  <span className="font-mono font-bold">
                    -{formatRupiah(po.metadata.globalDiscountAmount)}
                  </span>
                </div>
              )}

              {parseFloat(po.taxAmount) > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Pajak (PPN):</span>
                  <span className="font-mono font-bold">
                    +{formatRupiah(po.taxAmount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-zinc-900 font-extrabold border-t pt-3 text-sm">
                <span>Total PO:</span>
                <span className="font-mono text-indigo-700">
                  {formatRupiah(total)}
                </span>
              </div>

              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Telah Dibayar:</span>
                <span className="font-mono">{formatRupiah(paid)}</span>
              </div>

              <div className="flex justify-between text-rose-600 font-extrabold border-t pt-3 text-sm">
                <span>Sisa Pembayaran Supplier:</span>
                <span className="font-mono">{formatRupiah(remaining)}</span>
              </div>
            </div>

            {remaining > 0 && canUpdate && (
              <button
                onClick={handleOpenPaymentModal}
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <CreditCard size={15} />
                <span>Bayar Supplier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative my-8">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Catat Pembayaran Supplier
                </h3>
                <p className="text-xs text-zinc-500 font-mono">{po.poNumber}</p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <form
              onSubmit={handleRecordPaymentSubmit}
              className="space-y-4 text-xs"
            >
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
                <div className="flex justify-between text-zinc-500">
                  <span>Total Tagihan PO:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {formatRupiah(total)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Sudah Dibayar:</span>
                  <span className="font-mono font-bold">
                    {formatRupiah(paid)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold border-t pt-1">
                  <span>Sisa Pembayaran:</span>
                  <span className="font-mono">{formatRupiah(remaining)}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-zinc-700 block">
                    Nominal Pembayaran (Rp)
                  </label>
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
                  max={remaining}
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMethod: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none cursor-pointer"
                >
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="BANK_TRANSFER">Transfer Bank</option>
                  <option value="GIRO">Bilyet Giro / Cek</option>
                  <option value="E_WALLET">E-Wallet / QRIS</option>
                  <option value="OTHERS">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  placeholder="Catatan pembayaran supplier..."
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Upload Foto Bukti Pembayaran / Transfer */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Foto Bukti Transfer / Kuitansi Supplier</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    (Opsional)
                  </span>
                </label>

                {paymentEvidencePreview ? (
                  <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img
                      src={paymentEvidencePreview}
                      alt="Preview Bukti"
                      className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">
                        {paymentEvidenceFile?.name || "Bukti Pembayaran"}
                      </p>
                      <button
                        type="button"
                        onClick={handleRemovePaymentEvidence}
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
                    <span className="text-xs font-semibold text-zinc-700">
                      Pilih Foto Bukti Transfer
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      JPG, PNG, JPEG (Maks. 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentEvidenceChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-emerald-400 shadow-md shadow-emerald-600/20"
                >
                  {actionLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>Simpan Pembayaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive PO Modal with Evidence Attachment */}
      {receiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full shadow-2xl p-6 relative my-8">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900">
                  Terima Stok Barang PO
                </h3>
                <p className="text-xs text-zinc-500 font-mono">{po.poNumber}</p>
              </div>
              <button
                onClick={() => setReceiveModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            <form
              onSubmit={handleReceiveStockSubmit}
              className="space-y-4 text-xs"
            >
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <PackageCheck size={14} className="text-indigo-600" />
                  Konfirmasi Penerimaan Fisik
                </p>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Stok barang yang ada di Purchase Order ini akan langsung
                  ditambahkan ke gudang <strong>{po.warehouse?.name}</strong>.
                </p>
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Tanggal Penerimaan
                </label>
                <input
                  type="date"
                  required
                  value={receiveForm.receiveDate}
                  onChange={(e) =>
                    setReceiveForm({
                      ...receiveForm,
                      receiveDate: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Catatan / Keterangan Masuk
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diterima utuh tanpa cacat..."
                  value={receiveForm.notes}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, notes: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs outline-none"
                />
              </div>

              {/* Upload Foto Barang Masuk / Surat Jalan Supplier */}
              <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                <label className="font-semibold text-zinc-700 flex items-center justify-between">
                  <span>Foto Fisik Barang / Surat Jalan Supplier</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    (Opsional)
                  </span>
                </label>

                {receiveEvidencePreview ? (
                  <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                    <img
                      src={receiveEvidencePreview}
                      alt="Preview Bukti Penerimaan"
                      className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 truncate">
                        {receiveEvidenceFile?.name || "Bukti Penerimaan"}
                      </p>
                      <button
                        type="button"
                        onClick={handleRemoveReceiveEvidence}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 mt-1 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Hapus Foto</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/20 rounded-xl p-3.5 cursor-pointer transition-all">
                    <Camera className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-700">
                      Pilih Foto Surat Jalan / Barang Masuk
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      JPG, PNG, JPEG (Maks. 5MB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiveEvidenceChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 cursor-pointer disabled:bg-indigo-400 shadow-md shadow-indigo-600/20"
                >
                  {actionLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>Konfirmasi Terima Barang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Evidence Preview */}
      {previewImage.isOpen && (
        <div
          onClick={() => setPreviewImage({ isOpen: false, url: "", title: "" })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in cursor-zoom-out print:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl cursor-default"
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <span className="text-sm font-bold text-zinc-900 flex items-center space-x-2 truncate">
                <Paperclip size={16} className="text-indigo-600" />
                <span className="truncate">
                  {previewImage.title || "Bukti Transaksi"}
                </span>
              </span>
              <button
                onClick={() =>
                  setPreviewImage({ isOpen: false, url: "", title: "" })
                }
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-lg cursor-pointer transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-zinc-950/5 min-h-[320px] max-h-[75vh] overflow-auto">
              <img
                src={previewImage.url}
                alt="Bukti Lampiran"
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
            <div className="p-3 border-t border-zinc-100 bg-white flex justify-between items-center text-xs text-zinc-500">
              <span>Klik luar gambar atau tombol silang untuk menutup.</span>
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-700 font-bold inline-flex items-center space-x-1"
              >
                <ZoomIn size={14} />
                <span>Buka Ukuran Asli</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderDetail;

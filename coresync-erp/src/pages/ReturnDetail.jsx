import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import ReturnFormPrintTemplate from '../components/transactions/ReturnFormPrintTemplate';
import { 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Truck,
  Clock,
  X,
  Check
} from 'lucide-react';

import { formatRupiah, formatQty } from '../utils/format';

const ReturnDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ret, setRet] = useState(null);
  const [warehouses, setWarehouses] = useState([]);

  // Process Surat Retur Modal state
  const [suratModalOpen, setSuratModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [suratForm, setSuratForm] = useState({
    suratNumber: '',
    suratDate: new Date().toISOString().split('T')[0],
    courierName: 'Armada Logistik Sales',
    warehouseId: '',
    notes: ''
  });
  const [modalError, setModalError] = useState('');

  // Print mode: 'FORM' or 'SURAT'
  const [printDocType, setPrintDocType] = useState('FORM');

  useEffect(() => {
    fetchReturnDetail();
    fetchWarehouses();
  }, [id]);

  const fetchReturnDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/returns/${id}`);
      const data = res.data.data;
      setRet(data);
      setSuratForm(prev => ({
        ...prev,
        suratNumber: `SR-${data.returnNumber}`,
        warehouseId: data.warehouseId || ''
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat detail Retur Barang.');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/warehouses');
      setWarehouses(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (docType) => {
    setPrintDocType(docType);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleProcessSuratSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setModalError('');

    try {
      await api.post(`/returns/${id}/process-surat`, suratForm);
      setSuratModalOpen(false);
      fetchReturnDetail();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Gagal menerbitkan Surat Retur.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold">Memuat detail Retur Barang...</span>
        </div>
      </div>
    );
  }

  if (error || !ret) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm space-y-4 max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Gagal Memuat Retur</h3>
          <p className="text-sm text-zinc-500 mt-1">{error || 'Retur Barang tidak ditemukan.'}</p>
        </div>
        <button
          onClick={() => navigate('/transactions?tab=RET')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
        >
          Kembali ke Daftar Transaksi
        </button>
      </div>
    );
  }

  const isCompleted = ret.status === 'COMPLETED';
  const metadata = ret.metadata || {};

  // Timeline Steps
  const steps = [
    { key: 'FORM_ISSUED', title: 'Form Retur Terbit', desc: 'Pengajuan bawaan Sales dilaporkan', done: true },
    { key: 'APPROVED', title: 'Verifikasi & Disetujui', desc: 'Disetujui untuk pengiriman selanjutnya', done: true },
    { key: 'SURAT_ISSUED', title: 'Surat Retur Terbit', desc: metadata.suratNumber ? `No: ${metadata.suratNumber}` : 'Siap dikirim/dijemput', done: isCompleted },
    { key: 'COMPLETED', title: 'Barang Diterima & Stok Update', desc: isCompleted ? 'Stok FIFO gudang telah bertambah' : 'Menunggu serah terima barang', done: isCompleted }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* PRINTABLE TEMPLATE (FORM BALIKAN & RETUR vs SURAT RETUR)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div id="print-area" className="hidden print:block p-4 sm:p-8 bg-white text-zinc-950 font-sans text-xs">
        {printDocType === 'FORM' ? (
          <ReturnFormPrintTemplate
            returItems={ret.items || []}
            returDate={ret.returnDate || ''}
            droppingName="Dropping"
            gudangName={ret.warehouse?.name || 'Gudang'}
            companyName="CoreSync ERP System"
          />
        ) : printDocType === 'BLANK' ? (
          <ReturnFormPrintTemplate
            companyName="CoreSync ERP System"
          />
        ) : (
          /* SURAT RETUR OFFICIAL PRINT TEMPLATE */
          <div className="space-y-6">
            <div className="flex justify-between border-b-2 border-zinc-900 pb-4">
              <div>
                <h1 className="text-2xl font-black tracking-wider uppercase text-indigo-950">SURAT RETUR RESMI</h1>
                <p className="text-zinc-900 font-mono font-bold text-sm">No Surat Retur: {metadata.suratNumber || `SR-${ret.returnNumber}`}</p>
                <p className="text-zinc-600 text-xs">No Form Acuan Sales: {ret.returnNumber}</p>
              </div>
              <div className="text-right">
                <h2 className="font-extrabold text-base">CoreSync ERP System</h2>
                <p className="text-zinc-600">Tanggal Pengiriman: {metadata.suratDate || ret.returnDate}</p>
                <p className="text-zinc-600">Kurir/Armada: {metadata.courierName || 'Armada Logistik'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 p-4 border border-zinc-300 rounded">
              <div>
                <p className="font-bold text-zinc-500 uppercase">Dokumen Faktur Penjualan:</p>
                <p className="font-bold text-sm text-zinc-900">{ret.invoice?.invoiceNumber || '-'}</p>
                <p className="text-zinc-600 mt-1">Jenis Dokumen: Surat Jalan & Retur Resmi</p>
              </div>
              <div>
                <p className="font-bold text-zinc-500 uppercase">Tujuan Gudang Penerima:</p>
                <p className="font-bold text-sm text-zinc-900">{ret.warehouse?.name || '-'}</p>
                <p className="text-zinc-600 mt-1">Catatan Pengiriman: {metadata.deliveryNotes || ret.notes || '-'}</p>
              </div>
            </div>

            <table className="w-full border-collapse my-4">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-100 font-bold">
                  <th className="py-2.5 text-left px-2">SKU</th>
                  <th className="py-2.5 text-left px-2">Deskripsi Barang Retur</th>
                  <th className="py-2.5 text-right px-2">Qty Fisik</th>
                  <th className="py-2.5 text-right px-2">Nilai Retur</th>
                  <th className="py-2.5 text-right px-2">Total Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {ret.items?.map(item => (
                  <tr key={item.id} className="border-b border-zinc-200">
                    <td className="py-2.5 px-2 font-mono">{item.product?.sku}</td>
                    <td className="py-2.5 px-2 font-bold">{item.product?.name}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-extrabold">{formatQty(item.qty)} {item.product?.unit || 'pcs'}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{formatRupiah(item.price)}</td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-end pt-12">
              <div className="text-center w-36 border-t border-zinc-900 pt-2 text-[10px]">
                <p className="font-bold">Pengirim / Kurir</p>
                <p className="text-zinc-400 mt-4">({metadata.courierName || 'Armada Logistik'})</p>
              </div>
              <div className="text-center w-36 border-t border-zinc-900 pt-2 text-[10px]">
                <p className="font-bold">Pelanggan / Customer</p>
                <p className="text-zinc-400 mt-4">(Tanda Tangan & Stempel)</p>
              </div>
              <div className="text-center w-36 border-t border-zinc-900 pt-2 text-[10px]">
                <p className="font-bold">Kepala Gudang Penerima</p>
                <p className="text-zinc-400 mt-4">({ret.warehouse?.name})</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SCREEN VIEW & NAVIGATION                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Retur #${ret.returnNumber}`}
        subtitle={`Faktur Ref: ${ret.invoice?.invoiceNumber || '-'} | Tanggal Retur: ${ret.returnDate}`}
        backUrl="/transactions?tab=RET"
        backText="Kembali ke Transactions"
        badge={
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
            ret.type === 'SALES_RETURN' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {ret.type === 'SALES_RETURN' ? 'Retur Penjualan' : 'Retur Pembelian'}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button
              onClick={() => handlePrint('FORM')}
              className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={14} className="text-indigo-600" /> Cetak Form Balikan & Retur
            </button>
            <button
              onClick={() => handlePrint('BLANK')}
              className="px-3.5 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={14} className="text-zinc-600" /> Cetak Form Kosong
            </button>

            {isCompleted && (
              <button
                onClick={() => handlePrint('SURAT')}
                className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={14} className="text-indigo-600" /> Cetak Surat Retur Resmi
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={() => {
                  setModalError('');
                  setSuratModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Truck size={16} />
                <span>Proses & Terbitkan Surat Retur</span>
              </button>
            )}
          </div>
        }
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VISUAL 4-STEP TIMELINE TRACKING                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 print:hidden">
        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <Clock size={16} className="text-indigo-600" /> Tracking Alur Retur Barang
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {steps.map((step, idx) => (
            <div key={step.key} className={`p-4 rounded-xl border relative flex flex-col justify-between transition-all ${
              step.done
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-zinc-50 border-zinc-200 text-zinc-400 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.done ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {step.done ? <Check size={14} /> : idx + 1}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Tahap {idx + 1}</span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm">{step.title}</h4>
                <p className="text-xs mt-1 text-zinc-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* METADATA & PRODUCT ITEMS CARDS                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-6 print:hidden">
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 text-xs">
          <h4 className="font-extrabold text-zinc-900 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
            <FileText size={15} className="text-indigo-600" /> Detail Informasi Dokumen Retur
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span className="text-zinc-500 block">Nomor Form Retur Sales:</span>
              <span className="font-bold font-mono text-zinc-900 text-sm">{ret.returnNumber}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Nomor Surat Retur Resmi:</span>
              <span className="font-bold font-mono text-indigo-600 text-sm">{metadata.suratNumber || 'Belum Diterbitkan'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Nomor Faktur Acuan:</span>
              <span className="font-bold font-mono text-zinc-900 text-sm">{ret.invoice?.invoiceNumber || '—'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Gudang Penyimpanan:</span>
              <span className="font-bold text-zinc-900 text-sm">{ret.warehouse?.name || '—'}</span>
            </div>
          </div>
          {metadata.courierName && (
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
              <div>
                <span className="text-zinc-400 font-bold text-[10px] uppercase block">Armada Pengiriman / Kurir:</span>
                <span className="font-bold text-zinc-800 text-xs">{metadata.courierName} ({metadata.suratDate || '-'})</span>
              </div>
              <span className="text-xs text-zinc-500 italic">{metadata.deliveryNotes || 'Pengiriman berjalan lancar'}</span>
            </div>
          )}
        </div>

        {/* Product Items */}
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4">
          <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">Item Barang Diretur & Quality Control</h4>
          <div className="border border-zinc-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600">
                <tr>
                  <th className="p-3">SKU & Produk</th>
                  <th className="p-3">Kondisi & Alokasi Gudang</th>
                  <th className="p-3 text-right">Kuantitas Diretur</th>
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
                      <td className="p-3 text-right font-mono font-bold text-zinc-900">{formatRupiah(item.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FIFO Status Confirmation */}
        {isCompleted ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold">Penyesuaian Stok FIFO Terverifikasi & Terpisah Sesuai Kondisi</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Surat Retur telah diproses. Barang dalam kondisi <strong>Layak Jual</strong> otomatis menambah stok siap jual di Gudang Utama, sedangkan barang <strong>Rusak/Cacat</strong> dialokasikan ke Gudang Retur/Karantina untuk pemusnahan atau klaim supplier.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-3">
            <Clock size={20} className="shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Menunggu Penerbitan Surat Retur & Pengiriman</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Ini adalah Form Pengajuan Retur Sales. Klik tombol <strong>"Proses & Terbitkan Surat Retur"</strong> di atas untuk memverifikasi penjemputan barang dan mengupdate stok FIFO di masing-masing gudang sesuai kondisinya.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: PROSES & TERBITKAN SURAT RETUR                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {suratModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Truck size={18} className="text-emerald-600" />
                <span>Terbitkan Surat Retur & Update Stok FIFO</span>
              </h3>
              <button onClick={() => setSuratModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleProcessSuratSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 uppercase tracking-wider block">Nomor Surat Retur Resmi</label>
                <input
                  type="text"
                  required
                  value={suratForm.suratNumber}
                  onChange={(e) => setSuratForm({ ...suratForm, suratNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-mono text-sm focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider block">Tanggal Pengiriman</label>
                  <input
                    type="date"
                    required
                    value={suratForm.suratDate}
                    onChange={(e) => setSuratForm({ ...suratForm, suratDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 uppercase tracking-wider block">Armada / Kurir Sales</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kurir Armada Sales A"
                    value={suratForm.courierName}
                    onChange={(e) => setSuratForm({ ...suratForm, courierName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 uppercase tracking-wider block">Target Gudang Penerima</label>
                <select
                  value={suratForm.warehouseId}
                  onChange={(e) => setSuratForm({ ...suratForm, warehouseId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none cursor-pointer"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 uppercase tracking-wider block">Catatan Pengiriman / Penerimaan</label>
                <textarea
                  rows="2"
                  placeholder="Catatan kondisi barang saat diterima kurir/gudang..."
                  value={suratForm.notes}
                  onChange={(e) => setSuratForm({ ...suratForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800">
                <p className="font-bold">Konfirmasi Eksekusi FIFO:</p>
                <p className="mt-0.5">Dengan menekan tombol di bawah, Surat Retur resmi diterbitkan dan stok FIFO di gudang terpilih akan bertambah secara otomatis.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSuratModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer disabled:bg-emerald-400"
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Terbitkan Surat Retur & Update Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnDetail;

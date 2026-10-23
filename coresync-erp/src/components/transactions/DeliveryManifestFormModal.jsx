import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Truck, 
  Calendar, 
  Building, 
  Search, 
  CheckSquare, 
  Square, 
  Loader2, 
  Save, 
  AlertCircle,
  FileText,
  DollarSign,
  Package,
  User,
  ArrowUpDown
} from 'lucide-react';
import api from '../../utils/api';
import SearchSelect from '../SearchSelect';
import { useToast } from '../../context/ToastContext';
import { formatRupiah } from '../../utils/format';

const DeliveryManifestFormModal = ({
  isOpen,
  onClose,
  manifestToEdit = null,
  onSuccess
}) => {
  const { toast } = useToast();
  const isEditing = !!manifestToEdit;

  const todayStr = new Date().toISOString().split('T')[0];

  const [manifestDate, setManifestDate] = useState(todayStr);
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('Gudang Utama');
  const [notes, setNotes] = useState('');

  const [driversList, setDriversList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  
  const [availableDeliveries, setAvailableDeliveries] = useState([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Populate data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (manifestToEdit) {
      setManifestDate(manifestToEdit.manifestDate || todayStr);
      setDriverName(manifestToEdit.driverName || '');
      setVehiclePlate(manifestToEdit.vehiclePlate || '');
      setWarehouseId(manifestToEdit.warehouseId || '');
      setWarehouseName(manifestToEdit.warehouseName || 'Gudang Utama');
      setNotes(manifestToEdit.notes || '');
      const existingIds = (manifestToEdit.deliveryIds || []).map(id => parseInt(id, 10)).filter(Boolean);
      setSelectedDeliveryIds(existingIds);
    } else {
      setManifestDate(todayStr);
      setDriverName('');
      setVehiclePlate('');
      setWarehouseId('');
      setWarehouseName('Gudang Utama');
      setNotes('');
      setSelectedDeliveryIds([]);
    }
  }, [isOpen, manifestToEdit]);

  // Load drivers & warehouses
  useEffect(() => {
    if (!isOpen) return;

    api.get('/drivers?isActive=true&limit=100')
      .then(res => setDriversList(res.data.data || []))
      .catch(err => console.error('Failed to load drivers:', err));

    api.get('/warehouses?isActive=true&limit=100')
      .then(res => {
        const whs = res.data.data || [];
        setWarehousesList(whs);
        if (whs.length > 0 && !manifestToEdit?.warehouseId) {
          setWarehouseId(whs[0].id);
          setWarehouseName(whs[0].name);
        }
      })
      .catch(err => console.error('Failed to load warehouses:', err));
  }, [isOpen]);

  // Fetch available deliveries
  useEffect(() => {
    if (!isOpen) return;

    const fetchAvailable = async () => {
      try {
        setLoadingDeliveries(true);
        const params = new URLSearchParams();
        if (isEditing && manifestToEdit?.id) {
          params.set('currentManifestId', manifestToEdit.id);
        }

        const res = await api.get(`/deliveries/available-manifest-deliveries?${params.toString()}`);
        const data = res.data.data || [];
        setAvailableDeliveries(data);

        // If creating new and no IDs selected yet, check if any belong to the chosen driver
        if (!isEditing && driverName && selectedDeliveryIds.length === 0) {
          const matching = data.filter(d => d.driverName === driverName).map(d => d.id);
          if (matching.length > 0) {
            setSelectedDeliveryIds(matching);
          }
        }
      } catch (err) {
        console.error('Failed to load available deliveries:', err);
      } finally {
        setLoadingDeliveries(false);
      }
    };

    fetchAvailable();
  }, [isOpen, isEditing, manifestToEdit?.id]);

  // Driver select options
  const driverOptions = useMemo(() => {
    return driversList.map(d => ({
      value: d.name,
      label: d.name,
      sublabel: `${d.vehicleType || 'Mobil'} • ${d.vehicleNumber || d.vehiclePlate || 'Tanpa Plat'}`,
      plate: d.vehicleNumber || d.vehiclePlate || ''
    }));
  }, [driversList]);

  // Handle driver change (extract value string from SearchSelect object)
  const handleDriverChange = (opt) => {
    const selectedName = typeof opt === 'object' && opt !== null ? opt.value : (typeof opt === 'string' ? opt : '');
    setDriverName(selectedName || '');

    const found = driversList.find(d => d.name === selectedName);
    const plate = opt?.plate || found?.vehicleNumber || found?.vehiclePlate || '';
    if (plate) {
      setVehiclePlate(plate);
    }
  };


  // Filtered deliveries for display in table
  const filteredDeliveries = useMemo(() => {
    if (!searchTerm) return availableDeliveries;
    const s = searchTerm.toLowerCase();
    return availableDeliveries.filter(d => 
      (d.deliveryNumber || '').toLowerCase().includes(s) ||
      (d.customerName || '').toLowerCase().includes(s) ||
      (d.customerDistrict || '').toLowerCase().includes(s) ||
      (d.customerAddress || '').toLowerCase().includes(s) ||
      (d.soNumber || '').toLowerCase().includes(s) ||
      (d.invoiceNumber || '').toLowerCase().includes(s)
    );
  }, [availableDeliveries, searchTerm]);

  // Toggle selection
  const handleToggleSelect = (id) => {
    setSelectedDeliveryIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredDeliveries.map(d => d.id);
    const allVisibleSelected = visibleIds.every(id => selectedDeliveryIds.includes(id));
    if (allVisibleSelected) {
      setSelectedDeliveryIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedDeliveryIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Selected Deliveries Calculation (Summary)
  const selectedSummary = useMemo(() => {
    const selectedRows = availableDeliveries.filter(d => selectedDeliveryIds.includes(d.id));
    let totalQty = 0;
    let grandTotalAmount = 0;
    let totalCashAmount = 0;
    let totalCreditAmount = 0;

    selectedRows.forEach(row => {
      totalQty += Number(row.totalQty || 0);
      const amt = parseFloat(row.totalAmount || 0);
      grandTotalAmount += amt;

      const term = (row.paymentTerm || '').toUpperCase();
      if (term.includes('CASH') || term.includes('COD') || term.includes('TUNAI') || term === 'LUNAS') {
        totalCashAmount += amt;
      } else {
        totalCreditAmount += amt;
      }
    });

    return {
      count: selectedRows.length,
      totalQty,
      grandTotalAmount,
      totalCashAmount,
      totalCreditAmount
    };
  }, [availableDeliveries, selectedDeliveryIds]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!driverName || driverName === '—') {
      toast({
        title: 'Validasi Gagal',
        description: 'Harap pilih Driver / Kurir pengirim.',
        type: 'error'
      });
      return;
    }

    if (selectedDeliveryIds.length === 0) {
      toast({
        title: 'Validasi Gagal',
        description: 'Pilih minimal 1 Surat Jalan / Faktur untuk dimuat dalam manifest.',
        type: 'error'
      });
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        manifestDate,
        driverName,
        vehiclePlate: vehiclePlate || '—',
        warehouseId: warehouseId ? parseInt(warehouseId, 10) : null,
        warehouseName: warehouseName || 'Gudang Utama',
        deliveryIds: selectedDeliveryIds,
        notes: notes || null
      };

      if (isEditing) {
        await api.put(`/deliveries/manifests/${manifestToEdit.id}`, payload);
        toast({
          title: 'Berhasil!',
          description: `Manifest #${manifestToEdit.manifestNumber} berhasil diperbarui.`,
          type: 'success'
        });
      } else {
        const res = await api.post('/deliveries/manifests', { ...payload, status: 'SCHEDULED' });
        toast({
          title: 'Berhasil!',
          description: `Manifest #${res.data.data?.manifestNumber || 'Baru'} berhasil dibuat.`,
          type: 'success'
        });
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Submit manifest error:', err);
      toast({
        title: 'Gagal Menyimpan Manifest',
        description: err.response?.data?.message || 'Terjadi kesalahan sistem saat menyimpan manifest.',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };


  if (!isOpen) return null;

  const isAllVisibleSelected = filteredDeliveries.length > 0 && filteredDeliveries.every(d => selectedDeliveryIds.includes(d.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 overflow-y-auto print:hidden">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {isEditing ? `Edit Manifest #${manifestToEdit.manifestNumber}` : 'Buat Manifest Pengiriman Baru (1 Mobil)'}
              </h3>
              <p className="text-xs text-zinc-500">
                Tentukan driver, armada kendaraan, dan pilih daftar invoice/surat jalan yang diangkut.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Top Configuration Grid */}
          <div className="p-6 bg-white border-b border-zinc-100 shrink-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Tanggal Pengiriman */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={14} className="text-zinc-500" />
                  <span>Tanggal Pengiriman *</span>
                </label>
                <input
                  type="date"
                  value={manifestDate}
                  onChange={(e) => setManifestDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden transition-all"
                  required
                />
              </div>

              {/* Driver Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-zinc-500" />
                  <span>Driver / Kurir *</span>
                </label>
                <SearchSelect
                  options={driverOptions}
                  value={driverName}
                  onChange={handleDriverChange}
                  placeholder="Pilih Driver..."
                  className="text-xs"
                />
              </div>

              {/* Plat Nomor / Kendaraan */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Truck size={14} className="text-zinc-500" />
                  <span>No. Polisi / Armada</span>
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Contoh: B 1234 ABC"
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden transition-all uppercase"
                />
              </div>

              {/* Gudang Asal */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <Building size={14} className="text-zinc-500" />
                  <span>Gudang Asal</span>
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => {
                    setWarehouseId(e.target.value);
                    const found = warehousesList.find(w => String(w.id) === e.target.value);
                    if (found) setWarehouseName(found.name);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden transition-all"
                >
                  {warehousesList.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes Field */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan rute / instruksi khusus muatan (opsional)..."
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Deliveries Selection Section Header */}
          <div className="px-6 py-2.5 bg-zinc-100/70 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2">
              <Package size={16} className="text-indigo-600" />
              <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Pilih Surat Jalan / Faktur yang Diangkut
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                {selectedDeliveryIds.length} Terpilih
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari customer, No. SJ, DO..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Exclusivity Guide Note */}
          <div className="mx-6 mt-1 mb-2 p-2.5 bg-sky-50/80 border border-sky-200 rounded-xl text-[11px] text-sky-800 flex items-center gap-2 shrink-0">
            <AlertCircle size={14} className="text-sky-600 shrink-0" />
            <span>
              <strong>Aturan Pengelompokan:</strong> Surat Jalan / Invoice yang sedang berada di manifest lain tidak ditampilkan di sini. Untuk memindahkan ke pengiriman lain, hapus (uncheck) terlebih dahulu dari manifest asalnya lalu simpan.
            </span>
          </div>

          {/* Table of Available Deliveries */}
          <div className="flex-1 overflow-y-auto min-h-64 p-6 pt-0">
            {loadingDeliveries ? (
              <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center space-y-2">
                <Loader2 size={28} className="animate-spin text-indigo-600" />
                <span className="text-xs font-semibold">Memuat daftar Surat Jalan siap kirim...</span>
              </div>
            ) : availableDeliveries.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center space-y-2 border-2 border-dashed border-zinc-200 rounded-xl my-4">
                <Package size={36} className="text-zinc-300" />
                <p className="text-xs font-bold text-zinc-600">Tidak ada Pesanan / Surat Jalan siap kirim.</p>
                <p className="text-[11px] text-zinc-400">Pastikan Sales Order telah dibuat dan berstatus Siap Kirim (Confirmed), serta belum dimuat di manifest aktif lain.</p>
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100/90 text-zinc-700 font-bold border-b border-zinc-200 uppercase text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-zinc-600 hover:text-indigo-600 cursor-pointer"
                          title={isAllVisibleSelected ? "Batal pilih semua" : "Pilih semua"}
                        >
                          {isAllVisibleSelected ? (
                            <CheckSquare size={16} className="text-indigo-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-3">No. SJ / Faktur</th>
                      <th className="py-2.5 px-3">Pelanggan & Wilayah</th>
                      <th className="py-2.5 px-3 text-center">Jml Qty</th>
                      <th className="py-2.5 px-3 text-right">Nilai Tagihan</th>
                      <th className="py-2.5 px-3 text-center">Tipe Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredDeliveries.map((d) => {
                      const isSelected = selectedDeliveryIds.includes(d.id);
                      const term = (d.paymentTerm || 'CASH').toUpperCase();
                      const isCash = term.includes('CASH') || term.includes('COD') || term.includes('TUNAI') || term === 'LUNAS';

                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleToggleSelect(d.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-zinc-50'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(d.id)}
                              className="text-zinc-500 hover:text-indigo-600 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={16} className="text-indigo-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-bold text-zinc-900">{d.deliveryNumber}</div>
                            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 flex-wrap">
                              <span>Ref: {d.invoiceNumber || d.soNumber}</span>
                              {d.soDate && (
                                <span className="text-zinc-400 font-medium">• Tgl SO: {d.soDate.split('-').reverse().join('/')}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-zinc-900">{d.customerName}</div>
                            <div className="text-[11px] text-zinc-500 truncate max-w-xs flex items-center gap-1.5 flex-wrap">
                              {d.salesman && d.salesman !== '-' && (
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold text-[10px] border border-indigo-200">
                                  Sales: {d.salesman}
                                </span>
                              )}
                              <span>{d.customerDistrict ? `Kec. ${d.customerDistrict} • ` : ''}{d.customerAddress}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-800">
                            {d.qtyFormatted || `${d.totalQty} Karton`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-900">
                            {formatRupiah(d.totalAmount || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCash 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isCash ? 'COD / TUNAI' : 'TEMPO'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Summary Bar & Submit Action */}
          <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            
            {/* Live Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block text-[10px]">Total Terpilih:</span>
                <strong className="text-zinc-900 font-bold">{selectedSummary.count} Faktur ({selectedSummary.totalQty} Karton)</strong>
              </div>
              <div className="h-7 w-px bg-zinc-200 hidden sm:block" />
              <div>
                <span className="text-zinc-500 block text-[10px]">Setoran COD Supir:</span>
                <strong className="text-emerald-700 font-mono font-bold">{formatRupiah(selectedSummary.totalCashAmount)}</strong>
              </div>
              <div className="h-7 w-px bg-zinc-200 hidden sm:block" />
              <div>
                <span className="text-zinc-500 block text-[10px]">Total Muatan Mobil:</span>
                <strong className="text-indigo-900 font-mono font-black text-sm">{formatRupiah(selectedSummary.grandTotalAmount)}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || selectedDeliveryIds.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>{isEditing ? 'Simpan Perubahan' : 'Terbitkan Manifest'}</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </form>

      </div>
    </div>
  );
};

export default DeliveryManifestFormModal;

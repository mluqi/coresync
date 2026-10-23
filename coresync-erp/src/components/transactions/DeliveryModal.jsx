import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Camera, Truck } from 'lucide-react';
import api from '../../utils/api';

const DeliveryModal = ({
  isOpen,
  onClose,
  sjForm,
  setSjForm,
  drivers = [],
  evidenceFile,
  setEvidenceFile,
  evidencePreview,
  setEvidencePreview,
  actionLoading,
  actionError,
  handleConfirmCreateSj
}) => {
  const [driversList, setDriversList] = useState([]);
  const [isManualDriver, setIsManualDriver] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // If drivers prop is empty or not provided, fetch from master drivers API
      if (!drivers || drivers.length === 0) {
        api.get('/drivers?isActive=true&limit=100')
          .then(res => setDriversList(res.data.data || []))
          .catch(err => console.error('Failed to load drivers:', err));
      }
    }
  }, [isOpen, drivers]);

  const availableDrivers = (drivers && drivers.length > 0) ? drivers : driversList;

  // Auto populate vehicle plate if driverName is already set but vehiclePlate is empty
  useEffect(() => {
    if (isOpen && sjForm?.driverName && availableDrivers.length > 0 && !sjForm.vehiclePlate) {
      const match = availableDrivers.find(d => d.name.toLowerCase() === sjForm.driverName.toLowerCase());
      if (match?.vehicleNumber) {
        setSjForm(prev => ({ ...prev, vehiclePlate: match.vehicleNumber }));
      }
    }
  }, [isOpen, sjForm?.driverName, availableDrivers]);

  if (!isOpen) return null;

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

  const handleSelectDriver = (driverName) => {
    const found = availableDrivers.find(d => d.name === driverName);
    if (found) {
      setSjForm({
        ...sjForm,
        driverName: found.name,
        vehiclePlate: found.vehicleNumber || sjForm.vehiclePlate || ''
      });
    } else {
      setSjForm({
        ...sjForm,
        driverName: driverName,
        vehiclePlate: driverName === '' ? '' : sjForm.vehiclePlate
      });
    }
  };

  // Check if current selected driver name is in available list
  const isCurrentDriverInList = availableDrivers.some(d => d.name === sjForm.driverName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative my-8">
        <div className="flex items-center space-x-2.5 mb-4 pb-3 border-b border-zinc-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">Proses Surat Jalan Pengiriman (Kirim Barang)</h3>
            <p className="text-xs text-zinc-500">Terbitkan dokumen surat jalan dan tugaskan driver pengiriman.</p>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
            {actionError}
          </div>
        )}
        <form onSubmit={handleConfirmCreateSj} className="space-y-4 text-xs">
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">
              Nomor Surat Jalan (SJ) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={sjForm.deliveryNumber}
              onChange={(e) => setSjForm({ ...sjForm, deliveryNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white outline-none font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Driver / Sopir <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsManualDriver(!isManualDriver)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  {isManualDriver ? '← Pilih Dropdown' : '+ Input Manual'}
                </button>
              </div>

              {!isManualDriver ? (
                <select
                  required
                  value={sjForm.driverName || ''}
                  onChange={(e) => handleSelectDriver(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 outline-none font-medium text-zinc-800 cursor-pointer"
                >
                  <option value="">-- Pilih Driver Tersedia --</option>
                  {/* If there's an existing driverName not in available list, preserve it */}
                  {sjForm.driverName && !isCurrentDriverInList && (
                    <option value={sjForm.driverName}>
                      {sjForm.driverName} (Terpilih dari SO)
                    </option>
                  )}
                  {availableDrivers.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name} {d.vehicleNumber ? `• [${d.vehicleNumber}]` : ''} {d.vehicleType ? `(${d.vehicleType})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Ketik nama driver manual..."
                  value={sjForm.driverName || ''}
                  onChange={(e) => setSjForm({ ...sjForm, driverName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:bg-white focus:border-indigo-500 outline-none font-medium"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-1">
                No. Polisi Kendaraan
              </label>
              <input
                type="text"
                placeholder="e.g. G 8920 ZA"
                value={sjForm.vehiclePlate || ''}
                onChange={(e) => setSjForm({ ...sjForm, vehiclePlate: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none font-mono font-bold uppercase"
              />
            </div>
          </div>

          {/* Upload Foto Muat Barang / Surat Jalan */}
          <div className="space-y-1.5 border-t border-zinc-100 pt-3">
            <label className="font-semibold text-zinc-700 flex items-center justify-between">
              <span>Foto Muat Barang / Surat Jalan Fisik</span>
              <span className="text-[10px] text-zinc-400 font-normal">(Opsional)</span>
            </label>

            {evidencePreview ? (
              <div className="rounded-xl border border-zinc-200 overflow-hidden bg-zinc-50 p-2 flex items-center space-x-3">
                <img 
                  src={evidencePreview} 
                  alt="Preview Bukti Pengiriman" 
                  className="w-14 h-14 object-cover rounded-lg border border-zinc-200 shrink-0" 
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 truncate">{evidenceFile?.name || 'Bukti Pengiriman'}</p>
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
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 hover:border-indigo-400 bg-zinc-50/50 hover:bg-indigo-50/20 rounded-xl p-3.5 cursor-pointer transition-all">
                <Camera className="w-5 h-5 text-zinc-400 mb-1" />
                <span className="text-xs font-semibold text-zinc-700">Pilih Foto Muat Barang / Armada</span>
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
              <span>Kirim Barang</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryModal;

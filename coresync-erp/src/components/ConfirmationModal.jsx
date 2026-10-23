import React, { useEffect } from 'react';
import { Loader2, AlertCircle, HelpCircle, CheckCircle, X } from 'lucide-react';

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  onClose,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'info',
  loading = false
}) => {
  const handleCancel = onCancel || onClose || (() => {});

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, handleCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200/80 ring-4 ring-rose-500/10"><AlertCircle className="w-6 h-6" /></div>;
      case 'warning':
        return <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200/80 ring-4 ring-amber-500/10"><AlertCircle className="w-6 h-6" /></div>;
      case 'success':
        return <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200/80 ring-4 ring-emerald-500/10"><CheckCircle className="w-6 h-6" /></div>;
      default:
        return <div className="p-3 bg-theme-light text-theme rounded-xl border border-theme-light ring-4 ring-indigo-500/10"><HelpCircle className="w-6 h-6" /></div>;
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/20 text-white';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/20 text-white';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20 text-white';
      default:
        return 'bg-theme bg-theme-hover text-white';
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          handleCancel();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm p-4 transition-all duration-200"
    >
      <div className="relative bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-xl max-w-sm w-full shadow-dropdown p-6 transform transition-all scale-100 animate-fadeIn">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="absolute right-3.5 top-3.5 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer disabled:opacity-50"
          title="Tutup"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          {getIcon()}
          
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-zinc-900 tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-500 leading-relaxed px-2 font-normal">{message}</p>
          </div>

          <div className="flex items-center space-x-3 w-full pt-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-zinc-100/80 border border-zinc-200 hover:bg-zinc-200/80 text-zinc-700 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50 ${getConfirmButtonClass()}`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toastFn = useCallback((messageOrObj, typeOrDuration = 'info', duration = 4000) => {
    let msg = messageOrObj;
    let toastType = typeof typeOrDuration === 'string' ? typeOrDuration : 'info';
    let dur = typeof typeOrDuration === 'number' ? typeOrDuration : duration;

    if (typeof messageOrObj === 'object' && messageOrObj !== null) {
      const { title, description, message, type } = messageOrObj;
      msg = title && description ? `${title}: ${description}` : (description || message || title || 'Pemberitahuan');
      if (type) toastType = type;
      if (messageOrObj.duration) dur = messageOrObj.duration;
    }

    showToast(msg, toastType, dur);
  }, [showToast]);

  toastFn.success = (msg, duration) => {
    if (typeof msg === 'object' && msg !== null) {
      return toastFn({ ...msg, type: 'success' }, duration);
    }
    return showToast(msg, 'success', duration);
  };
  toastFn.error = (msg, duration) => {
    if (typeof msg === 'object' && msg !== null) {
      return toastFn({ ...msg, type: 'error' }, duration);
    }
    return showToast(msg, 'error', duration);
  };
  toastFn.warning = (msg, duration) => {
    if (typeof msg === 'object' && msg !== null) {
      return toastFn({ ...msg, type: 'warning' }, duration);
    }
    return showToast(msg, 'warning', duration);
  };
  toastFn.info = (msg, duration) => {
    if (typeof msg === 'object' && msg !== null) {
      return toastFn({ ...msg, type: 'info' }, duration);
    }
    return showToast(msg, 'info', duration);
  };
  toastFn.loading = (msg, duration) => showToast(msg, 'info', duration || 5000);
  toastFn.dismiss = () => {};

  return (
    <ToastContext.Provider value={{ showToast, toast: toastFn, removeToast }}>
      {children}
      
      {/* Toast Notification Floating Container (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse space-y-reverse space-y-3 max-w-sm w-auto sm:w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 pr-5 rounded-2xl border flex items-center space-x-3 shadow-xl backdrop-blur-md transition-all transform duration-300 animate-slide-in ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-white ring-1 ring-emerald-500/20'
                : t.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-white ring-1 ring-rose-500/20'
                : t.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/30 text-white ring-1 ring-amber-500/20'
                : 'bg-zinc-950/90 border-theme-light text-white ring-1 ring-white/10'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle size={20} className="text-rose-400 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle size={20} className="text-amber-400 shrink-0" />}
            {t.type === 'info' && <Info size={20} className="text-theme shrink-0" />}

            <div className="flex-1 text-xs font-semibold leading-snug">{t.message}</div>

            <button
              onClick={() => removeToast(t.id)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
              title="Tutup"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

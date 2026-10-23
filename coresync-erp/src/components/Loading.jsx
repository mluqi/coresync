import React from 'react';
import { Layers } from 'lucide-react';

/**
 * Reusable Loading Spinner Component for CoreSync ERP
 * 
 * @param {string} text      - Optional loading text message (default: 'Memuat data...')
 * @param {string} size      - 'sm' | 'md' | 'lg' (default: 'md')
 * @param {boolean} fullPage - If true, renders a full-screen blurred overlay loading state
 * @param {string} className - Additional custom classes for wrapper
 */
const Loading = ({ 
  text = 'Memuat data...', 
  size = 'md', 
  fullPage = false,
  className = '' 
}) => {
  const spinnerSizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 26
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold'
  };

  const content = (
    <div className={`flex flex-col items-center justify-center p-6 space-y-3.5 ${className}`}>
      {/* Animated Spinner with CoreSync Branding */}
      <div className="relative flex items-center justify-center">
        {/* Glowing pulse ring */}
        <div className={`absolute rounded-full bg-theme-subtle animate-ping ${spinnerSizes[size]}`} />
        
        {/* Spinning Ring */}
        <div 
          className={`rounded-full border-zinc-200 border-t-theme border-l-transparent animate-spin ${spinnerSizes[size]}`} 
        />
        
        {/* CoreSync Center Icon */}
        <div className="absolute text-theme flex items-center justify-center">
          <Layers size={iconSizes[size]} className="animate-pulse" />
        </div>
      </div>

      {/* Loading Text */}
      {text && (
        <div className="text-center space-y-1">
          <p className={`text-zinc-800 font-bold tracking-tight ${textSizes[size]}`}>
            {text}
          </p>
          <p className="text-[11px] font-medium text-zinc-400">
            Harap tunggu sebentar...
          </p>
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/25 backdrop-blur-md transition-all animate-fadeIn">
        <div className="bg-white/95 backdrop-blur-lg border border-zinc-200/90 rounded-xl shadow-dropdown p-8 max-w-xs w-full text-center">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

export default Loading;

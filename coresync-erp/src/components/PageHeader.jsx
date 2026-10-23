import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Reusable PageHeader component for all ERP pages.
 * 
 * Props:
 * - title: Page header title (string or ReactNode)
 * - subtitle: Optional description/subtitle text under title
 * - icon: Optional Lucide Icon component to display next to title
 * - badge: Optional badge element (e.g. status tag)
 * - backUrl: Optional path to render a back navigation button
 * - backText: Optional text for back button tooltip/label
 * - onBack: Optional custom back handler function
 * - actions: Action buttons or controls rendered on the right side
 * - className: Optional container class overrides
 */
const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  backUrl,
  backText = 'Kembali',
  onBack,
  actions,
  className = ''
}) => {
  const navigate = useNavigate();

  const handleBack = (e) => {
    e.preventDefault();
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else if (backUrl) {
      navigate(backUrl);
    }
  };

  return (
    <div className={`sticky top-16 z-20 bg-zinc-50/90 backdrop-blur-md -mx-5 sm:-mx-6 md:-mx-8 px-5 sm:px-6 md:px-8 py-4 -mt-5 sm:-mt-6 md:-mt-8 mb-6 border-b border-zinc-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden ${className}`}>
      <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
        {(backUrl || onBack) && (
          <button
            type="button"
            onClick={handleBack}
            className="p-2 bg-white border border-zinc-200/90 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-600 hover:text-zinc-950 rounded-lg shadow-2xs transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title={backText}
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {Icon && (
          <div className="p-2.5 bg-theme-light border border-theme-light text-theme rounded-lg shrink-0 flex items-center justify-center shadow-2xs">
            <Icon size={20} />
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight truncate">
              {title}
            </h1>
            {badge && (
              <div className="shrink-0">
                {badge}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-500 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0 sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const TaxModeContext = createContext();

export const TaxModeProvider = ({ children }) => {
  const { user, tenant } = useAuth();

  const userTaxAccess = user?.metadata?.taxAccess || 'ALL';
  const isTaxAccessLocked = userTaxAccess === 'PKP' || userTaxAccess === 'NON_PKP';

  const [taxMode, setTaxModeState] = useState(() => {
    if (user?.metadata?.taxAccess === 'PKP') return 'PKP';
    if (user?.metadata?.taxAccess === 'NON_PKP') return 'NON_PKP';

    const saved = localStorage.getItem('coresync_tax_mode');
    if (saved && ['ALL', 'PKP', 'NON_PKP'].includes(saved)) {
      return saved;
    }
    const tenantDefault = tenant?.settings?.taxMode || tenant?.taxStatus;
    if (tenantDefault && ['PKP', 'NON_PKP'].includes(tenantDefault)) {
      return tenantDefault;
    }
    return 'ALL';
  });

  // Sync if user login or user metadata / tenant settings change
  useEffect(() => {
    if (user?.metadata?.taxAccess === 'PKP') {
      setTaxModeState('PKP');
    } else if (user?.metadata?.taxAccess === 'NON_PKP') {
      setTaxModeState('NON_PKP');
    } else {
      const saved = localStorage.getItem('coresync_tax_mode');
      if (saved && ['ALL', 'PKP', 'NON_PKP'].includes(saved)) {
        setTaxModeState(saved);
      } else if (tenant?.settings?.taxMode) {
        setTaxModeState(tenant.settings.taxMode);
      }
    }
  }, [user, tenant]);

  const setTaxMode = (mode) => {
    if (isTaxAccessLocked) {
      // Locked by user's assigned permission
      return;
    }
    const validMode = ['ALL', 'PKP', 'NON_PKP'].includes(mode) ? mode : 'ALL';
    setTaxModeState(validMode);
    localStorage.setItem('coresync_tax_mode', validMode);
  };

  const isAll = taxMode === 'ALL';
  const isPkp = taxMode === 'PKP';
  const isNonPkp = taxMode === 'NON_PKP';
  const taxStatusQuery = isAll ? '' : taxMode;

  const filterProductsByTaxMode = (products) => {
    if (!Array.isArray(products)) return [];
    if (isAll) return products;
    if (isPkp) {
      return products.filter(p => {
        if (p.taxId && p.tax && parseFloat(p.tax.rate) > 0) return true;
        if (p.taxId) return true;
        return false;
      });
    }
    if (isNonPkp) {
      return products.filter(p => !p.taxId || (p.tax && parseFloat(p.tax.rate) === 0));
    }
    return products;
  };

  return (
    <TaxModeContext.Provider value={{
      taxMode,
      setTaxMode,
      isAll,
      isPkp,
      isNonPkp,
      taxStatusQuery,
      filterProductsByTaxMode,
      userTaxAccess,
      isTaxAccessLocked
    }}>
      {children}
    </TaxModeContext.Provider>
  );
};

export const useTaxMode = () => {
  const context = useContext(TaxModeContext);
  if (!context) {
    throw new Error('useTaxMode must be used within a TaxModeProvider');
  }
  return context;
};

export default TaxModeContext;

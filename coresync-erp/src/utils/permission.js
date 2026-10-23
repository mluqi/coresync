/**
 * Checks if a user has a specific granular CRUD permission.
 * Supports OWNER/SUPERADMIN bypass, ADMIN/STAFF default fallbacks, and backward compatibility.
 * 
 * @param {Object} user - The logged-in user object
 * @param {string} module - Module name (e.g. 'customers', 'suppliers', 'sales_orders', 'purchase_orders', 'deliveries', 'invoices', 'products', 'stock_opname', 'stock_ledger', 'finance', 'reports')
 * @param {string} action - Action name (e.g. 'read', 'create', 'update', 'delete', or for reports: 'sales', 'purchase', 'inventory', 'finance')
 * @returns {boolean} True if permitted, otherwise false
 */
export const hasPermission = (user, module, action = 'read') => {
  if (!user) return false;
  
  // OWNER, SUPERADMIN, and MANAGER always have full permissions (including view_cost)
  if (user.role === 'OWNER' || user.role === 'SUPERADMIN' || user.role === 'MANAGER') return true;

  const permissions = user.metadata?.permissions;
  
  // If no granular permissions exist in metadata, fallback to defaults based on role
  if (!permissions) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'STAFF') {
      if (module === 'products' && action === 'view_cost') return false;
      return action === 'read' || action === 'sales' || action === 'inventory';
    }
    return false;
  }

  // 1. Check direct dotted flag (e.g. permissions['reports.sales'] === true or permissions['products.view_cost'] === true)
  if (permissions[`${module}.${action}`] === true) return true;
  if (permissions[`${module}.${action}`] === false) return false;

  // 2. Check granular object (e.g. permissions.products.view_cost === true)
  if (permissions[module] && typeof permissions[module] === 'object') {
    if (permissions[module][action] !== undefined) {
      return !!permissions[module][action];
    }
  }

  // 3. Backward compatibility for Granular Modules mapping to Legacy Groups
  if (module === 'customers' || module === 'suppliers' || module === 'salespersons') {
    if (permissions.contacts && typeof permissions.contacts === 'object') {
      if (permissions.contacts[action] !== undefined) return !!permissions.contacts[action];
    }
    if (typeof permissions.contacts === 'boolean') {
      return action === 'read' ? permissions.contacts : (user.role === 'ADMIN' && permissions.contacts);
    }
  }

  if (module === 'sales_orders' || module === 'deliveries' || module === 'invoices') {
    if (permissions.transactions && typeof permissions.transactions === 'object') {
      if (permissions.transactions[action] !== undefined) return !!permissions.transactions[action];
    }
    if (typeof permissions.transactions === 'boolean') {
      return action === 'read' ? permissions.transactions : (user.role === 'ADMIN' && permissions.transactions);
    }
    if (typeof permissions.sales === 'boolean') {
      return action === 'read' ? permissions.sales : (user.role === 'ADMIN' && permissions.sales);
    }
  }

  if (module === 'purchase_orders') {
    if (permissions.transactions && typeof permissions.transactions === 'object') {
      if (permissions.transactions[action] !== undefined) return !!permissions.transactions[action];
    }
    if (typeof permissions.purchase === 'boolean') {
      return action === 'read' ? permissions.purchase : (user.role === 'ADMIN' && permissions.purchase);
    }
  }

  if (module === 'transactions') {
    if (permissions.sales_orders && typeof permissions.sales_orders === 'object') {
      if (permissions.sales_orders[action] !== undefined) return !!permissions.sales_orders[action];
    }
    if (permissions.purchase_orders && typeof permissions.purchase_orders === 'object') {
      if (permissions.purchase_orders[action] !== undefined) return !!permissions.purchase_orders[action];
    }
    if (permissions.deliveries && typeof permissions.deliveries === 'object') {
      if (permissions.deliveries[action] !== undefined) return !!permissions.deliveries[action];
    }
    if (permissions.transactions && typeof permissions.transactions === 'object') {
      if (permissions.transactions[action] !== undefined) return !!permissions.transactions[action];
    }
  }

  if (module === 'products' || module === 'units' || module === 'categories' || module === 'stock_opname' || module === 'stock_ledger') {
    if (permissions.products && typeof permissions.products === 'object') {
      if (permissions.products[action] !== undefined) return !!permissions.products[action];
    }
    if (typeof permissions.inventory === 'boolean') {
      if (action === 'view_cost') return user.role === 'ADMIN' && permissions.inventory;
      return action === 'read' ? permissions.inventory : (user.role === 'ADMIN' && permissions.inventory);
    }
  }

  if (module === 'reports') {
    if (permissions.reports && typeof permissions.reports === 'object') {
      if (permissions.reports[action] !== undefined) return !!permissions.reports[action];
    }
    if (action === 'sales' && permissions.sales !== undefined) return !!permissions.sales;
    if (action === 'purchase' && permissions.purchase !== undefined) return !!permissions.purchase;
    if (action === 'inventory' && permissions.inventory !== undefined) return !!permissions.inventory;
    if (action === 'finance' && permissions.finance !== undefined) return !!permissions.finance;
    if (typeof permissions.reports === 'boolean') return permissions.reports;
  }

  // 4. Default fallbacks if not explicitly disabled
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STAFF') {
    if (action === 'view_cost') return false;
    return action === 'read';
  }

  return false;
};

/**
 * Granular Permission Middleware
 * Supports granular modules (e.g. 'customers.read', 'sales_orders.create', 'reports.finance')
 * with full backward compatibility for legacy module flags and role defaults.
 */
const permissionMiddleware = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User context missing.'
      });
    }

    // Full bypass for SUPERADMIN and OWNER
    if (req.user.role === 'SUPERADMIN' || req.user.role === 'OWNER') {
      return next();
    }

    const permissions = req.user.metadata?.permissions || {};

    const checkSinglePermission = (perm) => {
      // 1. Direct boolean match (e.g. permissions['reports.finance'] === true)
      if (permissions[perm] === true) return true;
      if (permissions[perm] === false) return false;

      // 2. Dotted syntax parsing: 'module.action' (e.g. 'customers.read' or 'reports.sales')
      if (typeof perm === 'string' && perm.includes('.')) {
        const parts = perm.split('.');
        const module = parts[0];
        const action = parts[1];

        // If permissions[module] is an object (e.g. { read: true, create: true })
        if (permissions[module] && typeof permissions[module] === 'object') {
          if (permissions[module][action] !== undefined) {
            return !!permissions[module][action];
          }
        }

        // Backward compatibility mappings
        if (module === 'customers' || module === 'suppliers' || module === 'salespersons') {
          if (permissions.contacts && typeof permissions.contacts === 'object') {
            return !!permissions.contacts[action];
          }
        }

        if (module === 'sales_orders' || module === 'deliveries' || module === 'invoices') {
          if (permissions.transactions && typeof permissions.transactions === 'object') {
            return !!permissions.transactions[action];
          }
          if (permissions.sales === true) return action === 'read' || req.user.role === 'ADMIN';
        }

        if (module === 'purchase_orders') {
          if (permissions.transactions && typeof permissions.transactions === 'object') {
            return !!permissions.transactions[action];
          }
          if (permissions.purchase === true) return action === 'read' || req.user.role === 'ADMIN';
        }

        if (module === 'products' || module === 'units' || module === 'categories' || module === 'stock_opname' || module === 'stock_ledger') {
          if (permissions.products && typeof permissions.products === 'object') {
            return !!permissions.products[action];
          }
          if (permissions.inventory === true) return action === 'read' || req.user.role === 'ADMIN';
        }

        if (module === 'reports') {
          if (permissions.reports && typeof permissions.reports === 'object') {
            if (permissions.reports[action] !== undefined) return !!permissions.reports[action];
          }
          if (action === 'sales' && permissions.sales === true) return true;
          if (action === 'purchase' && permissions.purchase === true) return true;
          if (action === 'inventory' && permissions.inventory === true) return true;
          if (action === 'finance' && permissions.finance === true) return true;
        }

        // Role-based fallbacks if not explicitly configured in user permissions
        if (req.user.role === 'ADMIN') return true;
        if (req.user.role === 'STAFF') return action === 'read';
      }

      // 3. Fallback for role defaults
      if (req.user.role === 'ADMIN') return true;
      if (req.user.role === 'STAFF') return perm.endsWith('.read');

      return false;
    };

    let hasAccess = false;
    if (Array.isArray(requiredPermission)) {
      hasAccess = requiredPermission.some(p => checkSinglePermission(p));
    } else {
      hasAccess = checkSinglePermission(requiredPermission);
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Anda tidak memiliki izin '${requiredPermission}' untuk mengakses data ini.`
      });
    }

    next();
  };
};

module.exports = permissionMiddleware;

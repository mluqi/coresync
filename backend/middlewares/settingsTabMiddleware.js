/**
 * Settings Tab Permission Middleware
 * Enforces tab-level granular access rights for backend Settings APIs:
 * - 'wh': Kelola Gudang
 * - 'tx': Master Pajak
 * - 'mod': Mode Operasional
 * - 'usr': Manajemen User
 * - 'sys': Profil & Modul ERP (Tenant)
 * - 'thm': Tema Aplikasi
 */
const settingsTabMiddleware = (tabKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User context missing.'
      });
    }

    // Owner and Superadmin always have unrestricted access
    if (req.user.role === 'SUPERADMIN' || req.user.role === 'OWNER') {
      return next();
    }

    const lowerKey = tabKey.toLowerCase();
    const userTabs = req.user.metadata?.settingsTabs;

    // 1. If settingsTabs is explicitly configured for this user
    if (userTabs && typeof userTabs === 'object' && userTabs[lowerKey] !== undefined) {
      if (userTabs[lowerKey] === true) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: `Forbidden. Akun Anda tidak memiliki izin untuk mengakses tab pengaturan '${tabKey.toUpperCase()}'.`
      });
    }

    // 2. Default fallback for ADMIN role when settingsTabs is not yet explicitly set
    if (req.user.role === 'ADMIN') {
      if (lowerKey === 'sys') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. Hanya Pemilik Akun (Owner) yang dapat mengubah profil dan konfigurasi modul tenant.'
        });
      }
      return next();
    }

    // 3. STAFF or others without explicit permission
    return res.status(403).json({
      success: false,
      message: `Forbidden. Akun Anda tidak memiliki hak akses ke tab pengaturan '${tabKey.toUpperCase()}'.`
    });
  };
};

module.exports = settingsTabMiddleware;

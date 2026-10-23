const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User context missing.'
      });
    }

    // SUPERADMIN and OWNER always bypass role checks
    if (req.user.role === 'SUPERADMIN' || req.user.role === 'OWNER') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access this resource.'
      });
    }

    next();
  };
};

module.exports = roleMiddleware;

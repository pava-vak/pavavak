// Session-based Authentication Middleware (not JWT!)

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({
    success: false,
    error: 'Authentication required'
  });
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.is_admin) {
    return next();
  }
  res.status(403).json({
    success: false,
    error: 'Admin access required'
  });
}

// Legacy alias for old routes
const authenticate = isAuthenticated;

module.exports = {
  isAuthenticated,
  isAdmin,
  authenticate
};
// Ensure the authenticated user is an admin
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin access only' });
};

// Alias for consistent naming in new routes
const isAdmin = admin;

module.exports = { admin, isAdmin };

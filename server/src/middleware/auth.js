const jwt = require('jsonwebtoken');
const env = require('../config/env');

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const cookies = (req.headers.cookie || '').split(';').map((item) => item.trim());
  const tokenCookie = cookies.find((item) => item.startsWith('unisphere_token='));
  const cookieToken = tokenCookie ? decodeURIComponent(tokenCookie.slice('unisphere_token='.length)) : null;
  const token = cookieToken || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = auth;

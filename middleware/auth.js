const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Not authorized' });
  }
};

exports.authorizeStartupOwner = async (req, res, next) => {
  const startup = await Startup.findById(req.params.id);
  if (startup.user.toString() !== req.user.id) {
    return res.status(403).json({ 
      success: false, 
      error: 'Not authorized to modify this resource' 
    });
  }
  next();
};


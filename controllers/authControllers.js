// controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Role-based access control
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        error: `User role ${req.user.role} is not authorized` 
      });
    }
    next();
  };
};

// Incubator registration
exports.registerIncubator = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.create({
      name,
      email,
      password,
      role: 'incubator',
      incubatorProfile: {
        focusAreas: req.body.focusAreas,
        website: req.body.website
      }
    });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// Startup registration
exports.registerStartup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.create({
      name,
      email,
      password,
      role: 'startup',
      startupProfile: {
        stage: req.body.stage,
        industry: req.body.industry
      }
    });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
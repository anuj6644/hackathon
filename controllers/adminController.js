// controllers/adminController.js
const User = require('../models/User');
const Startup = require('../models/Startup');

exports.getPlatformStats = async (req, res) => {
  const stats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'startup' }),
    User.countDocuments({ role: 'incubator' }),
    Startup.countDocuments(),
    Match.countDocuments({ status: 'accepted' })
  ]);
  
  res.json({
    totalUsers: stats[0],
    startups: stats[1],
    incubators: stats[2],
    startupsRegistered: stats[3],
    successfulMatches: stats[4]
  });
};

exports.moderateContent = async (req, res) => {
  const { contentId, action } = req.body;
  // Implementation for content moderation
};
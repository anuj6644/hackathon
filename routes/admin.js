const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Startup = require('../models/Startup');
const Match = require('../models/Match');
const Message = require('../models/Message');
const { protect, authorize } = require('../middleware/auth');
const mongoose = require('mongoose');
const moment = require('moment');

// Admin middleware (must be admin)
router.use(protect);
router.use(authorize('admin'));

// @desc    Get platform analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
router.get('/analytics', async (req, res) => {
  try {
    // User analytics
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({
      createdAt: { $gte: moment().startOf('month').toDate() }
    });
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Match analytics
    const totalMatches = await Match.countDocuments();
    const successfulMatches = await Match.countDocuments({ status: 'accepted' });
    const matchRate = totalMatches > 0 
      ? Math.round((successfulMatches / totalMatches) * 100) 
      : 0;

    // Message analytics
    const totalMessages = await Message.countDocuments();
    const activeConversations = await Message.distinct('$or', [
      { sender: { $exists: true } },
      { recipient: { $exists: true } }
    ]).count();

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newThisMonth: newUsers,
          growth: userGrowth,
          byRole: {
            startups: await User.countDocuments({ role: 'startup' }),
            incubators: await User.countDocuments({ role: 'incubator' }),
            admins: await User.countDocuments({ role: 'admin' })
          }
        },
        matches: {
          total: totalMatches,
          successful: successfulMatches,
          matchRate: `${matchRate}%`,
          byStatus: {
            pending: await Match.countDocuments({ status: 'pending' }),
            accepted: successfulMatches,
            rejected: await Match.countDocuments({ status: 'rejected' })
          }
        },
        engagement: {
          totalMessages,
          activeConversations,
          avgMessagesPerConversation: totalMessages > 0 
            ? Math.round(totalMessages / activeConversations) 
            : 0
        }
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Get all users with filtering
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const { role, verified, search } = req.query;
    
    // Build query
    const query = {};
    if (role) query.role = role;
    if (verified) query.isVerified = verified === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt');

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate({
        path: 'startupProfile.decks',
        select: 'name url'
      });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
router.put('/users/:id', async (req, res) => {
  try {
    // Prevent role escalation
    if (req.body.role === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized to assign admin role' 
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).select('-password');

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Delete associated data
    await Startup.deleteMany({ user: user._id });
    await Match.deleteMany({ 
      $or: [
        { startup: user._id },
        { incubator: user._id }
      ] 
    });
    await Message.deleteMany({
      $or: [
        { sender: user._id },
        { recipient: user._id }
      ]
    });

    await user.remove();

    res.json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Get flagged content
// @route   GET /api/admin/flagged
// @access  Private/Admin
router.get('/flagged', async (req, res) => {
  try {
    const flaggedContent = await Startup.find({ isFlagged: true })
      .populate('user', 'name email')
      .sort('-updatedAt');

    res.json({
      success: true,
      count: flaggedContent.length,
      data: flaggedContent
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Moderate content
// @route   PUT /api/admin/moderate/:id
// @access  Private/Admin
router.put('/moderate/:id', async (req, res) => {
  try {
    const { action, reason } = req.body;
    const startup = await Startup.findById(req.params.id);

    if (!startup) {
      return res.status(404).json({ 
        success: false, 
        error: 'Startup not found' 
      });
    }

    if (action === 'approve') {
      startup.isFlagged = false;
      startup.moderationNotes = 'Approved by admin';
    } else if (action === 'reject') {
      startup.isActive = false;
      startup.moderationNotes = reason || 'Removed by admin';
    }

    await startup.save();

    // Notify user via email or WebSocket if needed

    res.json({
      success: true,
      data: startup
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Get system logs
// @route   GET /api/admin/logs
// @access  Private/Admin
router.get('/logs', async (req, res) => {
  try {
    // In production, connect to your logging service (Winston, etc.)
    const logs = []; // Replace with actual log query
    
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;
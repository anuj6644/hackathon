const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { calculateCompatibility } = require('../services/aiService');
const mongoose = require('mongoose');

// @desc    Get all matches for current user
// @route   GET /api/matches
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [
        { startup: req.user.id },
        { incubator: req.user.id }
      ]
    })
    .populate('startup', 'name avatar industry')
    .populate('incubator', 'name avatar focusAreas');

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Get potential matches
// @route   GET /api/matches/suggestions
// @access  Private
router.get('/suggestions', protect, async (req, res) => {
  try {
    let suggestions;
    
    if (req.user.role === 'startup') {
      // Find incubators that match startup's industry
      suggestions = await User.find({
        role: 'incubator',
        'incubatorProfile.focusAreas': req.user.startupProfile.industry
      }).select('name avatar incubatorProfile');
      
      // Calculate compatibility scores
      suggestions = await Promise.all(suggestions.map(async incubator => {
        const score = await calculateCompatibility(req.user, incubator);
        return { ...incubator.toObject(), compatibilityScore: score };
      }));
      
      // Sort by highest compatibility
      suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      
    } else if (req.user.role === 'incubator') {
      // Find startups in incubator's focus areas
      suggestions = await User.find({
        role: 'startup',
        'startupProfile.industry': { $in: req.user.incubatorProfile.focusAreas }
      }).select('name avatar startupProfile');
      
      // Calculate compatibility scores
      suggestions = await Promise.all(suggestions.map(async startup => {
        const score = await calculateCompatibility(startup, req.user);
        return { ...startup.toObject(), compatibilityScore: score };
      }));
      
      // Sort by highest compatibility
      suggestions.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    }

    res.json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Create new match request
// @route   POST /api/matches
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(req.body.matchWith)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const matchWithUser = await User.findById(req.body.matchWith);
    if (!matchWithUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check for existing match
    const existingMatch = await Match.findOne({
      $or: [
        { startup: req.user.id, incubator: req.body.matchWith },
        { startup: req.body.matchWith, incubator: req.user.id }
      ]
    });

    if (existingMatch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Match already exists',
        data: existingMatch
      });
    }

    // Determine match roles based on current user
    let matchData;
    if (req.user.role === 'startup') {
      matchData = {
        startup: req.user.id,
        incubator: req.body.matchWith,
        status: 'pending'
      };
    } else if (req.user.role === 'incubator') {
      matchData = {
        startup: req.body.matchWith,
        incubator: req.user.id,
        status: 'pending'
      };
    } else {
      return res.status(403).json({ success: false, error: 'Invalid user role' });
    }

    // Calculate compatibility score
    matchData.compatibilityScore = await calculateCompatibility(
      await User.findById(matchData.startup),
      await User.findById(matchData.incubator)
    );

    const match = await Match.create(matchData);

    // Populate data for realtime emission
    const populatedMatch = await Match.populate(match, [
      { path: 'startup', select: 'name avatar' },
      { path: 'incubator', select: 'name avatar' }
    ]);

    // Emit match event to both parties
    req.io.to(match.startup.toString()).emit('newMatch', populatedMatch);
    req.io.to(match.incubator.toString()).emit('newMatch', populatedMatch);

    res.status(201).json({ success: true, data: populatedMatch });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Update match status
// @route   PUT /api/matches/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('startup', 'name avatar')
      .populate('incubator', 'name avatar');

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    // Verify user is part of this match
    if (!match.startup._id.equals(req.user.id) && !match.incubator._id.equals(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Only allow status updates
    if (req.body.status) {
      // Additional validation for status changes
      if (req.body.status === 'accepted' && !match.startup._id.equals(req.user.id)) {
        return res.status(403).json({ 
          success: false, 
          error: 'Only the startup can accept matches' 
        });
      }

      match.status = req.body.status;
      match.lastContacted = Date.now();
    }

    await match.save();

    // Emit update to both parties
    req.io.to(match.startup._id.toString()).emit('matchUpdate', match);
    req.io.to(match.incubator._id.toString()).emit('matchUpdate', match);

    res.json({ success: true, data: match });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @desc    Delete a match
// @route   DELETE /api/matches/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    // Verify user is part of this match
    if (!match.startup.equals(req.user.id) && !match.incubator.equals(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await match.remove();

    // Emit deletion to both parties
    req.io.to(match.startup.toString()).emit('matchDeleted', { id: match._id });
    req.io.to(match.incubator.toString()).emit('matchDeleted', { id: match._id });

    res.json({ success: true, data: {} });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;
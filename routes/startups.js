const express = require('express');
const Startup = require('../models/Startup');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Get all startups
router.get('/', async (req, res) => {
  try {
    const startups = await Startup.find();
    res.json({ success: true, data: startups });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// Create startup (protected route)
router.post('/', protect, async (req, res) => {
  try {
    req.body.user = req.user.id;
    const startup = await Startup.create(req.body);
    res.status(201).json({ success: true, data: startup });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
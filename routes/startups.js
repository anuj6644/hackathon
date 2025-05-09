const express = require('express');
const Startup = require('../models/Startup');
const { protect, authorizeStartupOwner } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });
const router = express.Router();

// Get all startups
// @desc    Get all startups with filtering, pagination
// @route   GET /api/startups
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    // 1. Filtering
    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // 2. Advanced filtering (gte, lte, etc)
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    let query = Startup.find(JSON.parse(queryStr)).populate('user', 'name email');

    // 3. Sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt'); // Default: newest first
    }

    // 4. Field limiting
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v'); // Exclude version field
    }

    // 5. Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    query = query.skip(skip).limit(limit);

    // Execute query
    const startups = await query;

    res.status(200).json({
      success: true,
      count: startups.length,
      page,
      pages: Math.ceil(await Startup.countDocuments() / limit),
      data: startups
    });
  } catch (err) {
    next(err);
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

// Add pitch deck to startup
router.post(
  '/:id/pitch-deck',
  protect,
  authorizeStartupOwner,
  upload.single('pitchDeck'),
  async (req, res) => {
    try {
      const startup = await Startup.findById(req.params.id);
      
      // Delete old file if exists
      if (startup.pitchDeck?.publicId) {
        await cloudinary.uploader.destroy(startup.pitchDeck.publicId);
      }

      startup.pitchDeck = {
        url: req.file.path,
        publicId: req.file.filename
      };
      
      await startup.save();
      res.json({ success: true, data: startup });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

// @desc    Search startups
// @route   GET /api/startups/search
// @access  Public
router.get('/search', async (req, res, next) => {
  try {
    if (!req.query.q) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query (q) is required' 
      });
    }

    const startups = await Startup.search(req.query.q);
    
    res.status(200).json({
      success: true,
      count: startups.length,
      data: startups
    });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
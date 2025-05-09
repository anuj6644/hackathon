const errorHandler = (err, req, res, next) => {
  console.error(err.stack.red);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ 
      success: false, 
      error: 'Resource not found' 
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false, 
      error: Object.values(err.errors).map(val => val.message) 
    });
  }

  res.status(500).json({ 
    success: false, 
    error: 'Server error' 
  });
};

module.exports = errorHandler;
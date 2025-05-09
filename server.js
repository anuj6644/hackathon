require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const http = require('http');
const { Server } = require('socket.io');
const chatService = require('./services/chatService');
const server = http.createServer(express());
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const app = express();
const PORT = process.env.PORT || 8000;
//chatService(io);

// Middleware
app.use(cors());
app.use(express.json());

// Database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/startups', require('./routes/startups'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/admin', require('./routes/admin'));
// Error handling middleware
app.use(errorHandler);

// Add after other route imports
const startupRoutes = require('./routes/startups');

// Add after other middleware
app.use('/api/startups', startupRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// services/chatService.js
const Message = require('../models/Message');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected');
    
    socket.on('joinRoom', ({ userId, matchId }) => {
      socket.join(matchId);
    });

    socket.on('sendMessage', async ({ sender, recipient, content, matchId }) => {
      try {
        const message = await Message.create({ sender, recipient, content });
        io.to(matchId).emit('newMessage', message);
      } catch (err) {
        socket.emit('error', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};
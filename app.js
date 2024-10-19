const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

server.listen(process.env.PORT || 3000, () => {
  console.log('Serwer nasłuchuje na porcie 3000');
});

function generateRoomID() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Użytkownik połączony:', socket.id);

  socket.on('createRoom', (data, callback) => {
    const roomID = generateRoomID();
    socket.join(roomID);
    socket.roomID = roomID;
    socket.gameOptions = data; // np. { rounds: 5, categories: ['A', 'B'], maxPlayers: 4 }
    socket.players = [socket.id];
    callback({ roomID });
  });

  socket.on('joinRoom', (roomID, callback) => {
    const room = io.sockets.adapter.rooms.get(roomID);
    if (room && room.size < socket.gameOptions.maxPlayers) {
      socket.join(roomID);
      socket.roomID = roomID;
      socket.players.push(socket.id);
      io.to(roomID).emit('playerJoined', { playerID: socket.id });

      if (room.size === socket.gameOptions.maxPlayers) {
        io.to(roomID).emit('startGame', { message: 'Gra się rozpoczyna!' });
      }
      callback({ success: true });
    } else {
      callback({ success: false, message: 'Pokój pełny lub nie istnieje.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Użytkownik rozłączony:', socket.id);
  });

  socket.on('gameAction', (action) => {
    const roomID = socket.roomID;
    io.to(roomID).emit('gameData', { /* dane gry */ });
  });
});

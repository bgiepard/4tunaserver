const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const GameController = require('./gameControler');

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server listening on port 3000');
});

function generateRoomID() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

const rooms = {};


io.on('connection', (socket) => {

  socket.on('createRoom', (options, callback) => {
    const roomID = generateRoomID();
    socket.join(roomID);
    socket.currentRoom = roomID;

    rooms[roomID] = {
      host: socket.id,
      gameOptions: {
        ...options,
        players: []
      }
    };
    callback({ roomID });
  });

  socket.on('joinRoom', ({roomID, name}, callback) => {
    const room = rooms[roomID];

    if (room) {
      if (room.gameOptions.players.length < room.gameOptions.maxPlayers) {
        socket.join(roomID);
        socket.currentRoom = roomID;
        room.gameOptions.players.push({
          id: socket.id,
          name: name,
          amount: 0,
          total: 0
        });
        io.to(roomID).emit('playerJoined', room);

        if(room.gameOptions.players.length == room.gameOptions.maxPlayers) {
          //on game start
          room.gameOptions.phrase = getRandomPhrase();
          room.gameOptions.mode = 'rotating';

          io.to(roomID).emit('startGame', { id: roomID });
        }

        callback({ success: true });
      } else {
        callback({ success: false, message: 'Room is full.' });
      }
    } else {
      callback({ success: false, message: 'Room does not exist.' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.currentRoom) {
      const roomID = socket.currentRoom;
      const room = rooms[roomID];

      if (room) {
        const playerIndex = room.gameOptions.players.findIndex(player => player.id === socket.id);

        if (playerIndex !== -1) {
          room.gameOptions.players.splice(playerIndex, 1);
          io.to(roomID).emit('playerDisconnect', room);

          if (room.gameOptions.players.length === 0) {
            delete rooms[roomID];
          }
        }
      }
    }
  });


  // get initial game details
  socket.on('getGameData', (gameID, callback) => {
    const game = rooms[gameID];

    if (game) {
        callback({ success: true, game });
      } else {
        callback({ success: false, message: 'GAME does not exist.' });
      }
  });


  socket.on('newGameEvent', ({gameID, name}, callback) => {
    const room = rooms[gameID];

    console.log('newGameEvent room', room)
    console.log('newGameEvent gameId', gameID)
    console.log('newGameEvent data', name)

    if (room) {
      io.to(gameID).emit('gameUpdate', 'pokaze ten komunikat');

      //
      // if (room.gameOptions.players.length < room.gameOptions.maxPlayers) {
      //   // socket.join(roomID);
      //   // socket.currentRoom = roomID;
      //   // room.gameOptions.players.push({
      //   //   id: socket.id,
      //   //   name: name,
      //   //   amount: 0,
      //   //   total: 0
      //   // });
      //   io.to(roomID).emit('playerJoined', room);
      //
      //   if(room.gameOptions.players.length == room.gameOptions.maxPlayers) {
      //     //on game start
      //     room.gameOptions.phrase = getRandomPhrase();
      //     room.gameOptions.mode = 'rotating';
      //
      //     io.to(roomID).emit('startGame', { id: roomID });
      //   }
      //
      //   callback({ success: true });
      // } else {
      //   callback({ success: false, message: 'Room is full.' });
      // }
    } else {
      callback({ success: false, message: 'Room does not exist.' });
    }
  });

});

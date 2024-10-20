const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


const initialPhrases = [
  'Z małej chmury duży deszcz',
  'Co nagle to po diable',
  'Lepszy wróbel w garści',
  'Kto pyta nie błądzi',
  'Czas leczy rany',
  'Bez pracy nie ma kołaczy',
  'Prawda w oczy kole',
  'Kto pod kim dołki kopie',
];

const getRandomPhrase = () => {
  const randomIndex = Math.floor(Math.random() * initialPhrases.length);
  return initialPhrases[randomIndex];
};


server.listen(process.env.PORT || 3000, () => {
  console.log('Server listening on port 3000');
});

function generateRoomID() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

const rooms = {};

const getGameInfo = () => {}

const updateGameInfo = () => {}

io.on('connection', (socket) => {

  socket.on('createRoom', (data, callback) => {
    const roomID = generateRoomID();
    socket.join(roomID);
    socket.currentRoom = roomID;

    rooms[roomID] = {
      host: socket.id,
      gameOptions: data,
      players: []
    };
    callback({ roomID });
  });

  socket.on('joinRoom', ({roomID, name}, callback) => {
    const room = rooms[roomID];
    if (room) {
      if (room.players.length < room.gameOptions.maxPlayers) {
        socket.join(roomID);
        socket.currentRoom = roomID;
        room.players.push({
          id: socket.id,
          name: name,
          amount: 0,
          total: 0
        });
        io.to(roomID).emit('playerJoined', { players: room.players});

        if(room.players.length == room.gameOptions.maxPlayers) {
          room.phrase = getRandomPhrase()
          io.to(roomID).emit('startGame', { room: {id: roomID, ...room}});
        }

        callback({ success: true });
      } else {
        callback({ success: false, message: 'Room is full.' });
      }
    } else {
      callback({ success: false, message: 'Room does not exist.' });
    }
  });

  socket.on('getGameData', (gameID, callback) => {
    const game = rooms[gameID];

    if (game) {
        callback({ success: true, game });
      } else {
        callback({ success: false, message: 'GAME does not exist.' });
      }
  });

  socket.on('disconnect', () => {
    if (socket.currentRoom) {
      const roomID = socket.currentRoom;
      const room = rooms[roomID];

      if (room) {
        const playerIndex = room.players.findIndex(player => player.id === socket.id);

        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          io.to(roomID).emit('playerDisconnect', { players: room.players });

          if (room.players.length === 0) {
            delete rooms[roomID];
          }
        }
      }
    }
  });

});

const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const GameController = require("./gameControler");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

server.listen(process.env.PORT || 5000, () => {
  console.log("Server listening on port 5000");
});

function generateRoomID() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

const rooms = {};

io.on("connection", (socket) => {
  socket.on("createRoom", (options, callback) => {
    const roomID = generateRoomID();
    socket.join(roomID);
    socket.currentRoom = roomID;

    rooms[roomID] = {
      host: socket.id,
      gameOptions: {
        ...options,
        players: [],
      },
      game: null,
    };
    callback({ roomID });
  });

  socket.on("joinRoom", ({ roomID, name }, callback) => {
    const room = rooms[roomID];

    if (room) {
      if (room.gameOptions.players.length < room.gameOptions.maxPlayers) {
        socket.join(roomID);
        socket.currentRoom = roomID;
        room.gameOptions.players.push({
          id: socket.id,
          name: name,
        });
        io.to(roomID).emit("playerJoined", room.gameOptions.players);

        if (room.gameOptions.players.length === room.gameOptions.maxPlayers) {
          const playersForGame = room.gameOptions.players.map((p) => ({
            name: p.name,
          }));
          room.game = new GameController(
            playersForGame,
            room.gameOptions.rounds,
            roomID,
          );

          // Emit 'startGame' with initial game data
          io.to(roomID).emit("startGame", { gameID: roomID });
        }

        callback({ success: true });
      } else {
        callback({ success: false, message: "Room is full." });
      }
    } else {
      callback({ success: false, message: "Room does not exist." });
    }
  });

  socket.on("disconnect", () => {
    if (socket.currentRoom) {
      const roomID = socket.currentRoom;
      const room = rooms[roomID];

      if (room) {
        const playerIndex = room.gameOptions.players.findIndex(
          (player) => player.id === socket.id,
        );

        if (playerIndex !== -1) {
          room.gameOptions.players.splice(playerIndex, 1);
          io.to(roomID).emit("playerDisconnect", room.gameOptions.players);

          if (room.gameOptions.players.length === 0) {
            delete rooms[roomID];
          }
        }
      }
    }
  });

  socket.on("getGameData", (gameID, callback) => {
    const game = rooms[gameID];

    if (game) {
      const gameData = rooms[gameID].game;
      callback({ success: true, gameData });
    } else {
      callback({ success: false, message: "GAME does not exist." });
    }
  });

  socket.on("newGameEvent", ({ gameID, name, payload }, callback) => {
    const room = rooms[gameID];

    if (room && room.game) {
      const gameController = room.game;

      switch (name) {
        case "rotate":
          gameController.rotateWheel();
          break;

        case "letterClick":
          const { letter } = payload;
          gameController.letterClick(letter);
          break;

        case "addPoints":
          const { letterCount } = payload;
          gameController.addPoints(letterCount);
          break;

        case "nextPlayer":
          gameController.nextPlayer();
          break;

        case "resetPoints":
          gameController.resetPoints();
          break;

        case "resetHalf":
          gameController.resetHalf();
          break;

        case "letMeGuess":
          gameController.letMeGuess();
          break;

        case "resetStake":
          gameController.resetStake();
          break;

        default:
          callback({ success: false, message: `Unknown event name: ${name}` });
          return;
      }

      // Emit the updated game state to all players in the room
      io.to(gameID).emit("gameUpdate", gameController.getGameState());

      if (name == "rotate") {
        setTimeout(() => {
          const selectedValue = gameController.determineSelectedValue();
          gameController.processSelectedValue(selectedValue);
          io.to(gameID).emit("gameUpdate", gameController.getGameState());
        }, 2000);
      }

      // Optionally return the updated game state as a response to the event
      callback({ success: true, gameData: gameController.getGameState() });
    } else {
      callback({ success: false, message: "Room or Game does not exist." });
    }
  });
});

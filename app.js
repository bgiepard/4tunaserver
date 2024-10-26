const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const GameController = require("./gameControler");

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
// const io = new Server(server, {
//   cors: {
//     origin: "https://4tuna.pl",
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
//   transports: ["websocket", "polling"],
// });

server.listen(5000, () => {
  console.log("Server listening on port 5000");
});

app.get("/", (req, res) => {
  res.send("Backend is running correctly");
});

function generateRoomID() {
  const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let roomID = "";
  do {
    roomID = "";
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      roomID += characters.charAt(randomIndex);
    }
  } while (rooms.hasOwnProperty(roomID));
  return roomID;
}

const rooms = {};

// Helper function to find a public room that isn't full
function findAvailableRooms() {
  const availableRooms = [];

  for (let roomID in rooms) {
    const room = rooms[roomID];
    if (
      room.public &&
      room.gameOptions.players.length < room.gameOptions.maxPlayers &&
      room.gameOptions.players.length > 0
    ) {
      availableRooms.push({
        roomID: roomID,
        players: room.gameOptions.players.length,
        maxPlayers: room.gameOptions.maxPlayers,
        maxRounds: room.maxRounds,
      });
    }

    // Stop once we have 5 rooms
    if (availableRooms.length === 5) {
      break;
    }
  }

  return availableRooms;
}

// Helper function to add a player to a room
function addPlayerToRoom(socket, roomID, name) {
  const room = rooms[roomID];
  if (room) {
    socket.join(roomID);
    socket.currentRoom = roomID;
    room.gameOptions.players.push({
      id: socket.id,
      name: name,
      connected: true,
    });
    io.to(roomID).emit("playerJoined", room.gameOptions);
    return true;
  }
  return false;
}

// Helper function to handle player disconnection
function handlePlayerDisconnect(socket) {
  const roomID = socket.currentRoom;
  const room = rooms[roomID];

  if (room) {
    const player = room.gameOptions.players.find(
      (player) => player.id === socket.id,
    );

    if (player) {
      player.connected = false;
    }

    if (room.game && room.game.gameInfo && room.game.gameInfo.players) {
      const playerInGame = room.game.gameInfo.players.find(
        (player) => player.id === socket.id,
      );
      if (playerInGame) {
        playerInGame.connected = false;
      }

      // Check if the disconnected player is the current player
      const currentPlayerIndex = room.game.gameInfo.currentPlayer;
      if (currentPlayerIndex >= 0) {
        const currentPlayer = room.game.gameInfo.players[currentPlayerIndex];
        if (currentPlayer.id === socket.id) {
          room.game.nextPlayer();
          const gameState = room.game.getGameState();
          io.to(roomID).emit("gameUpdate", gameState);
        }
      }
    }

    io.to(roomID).emit("playerDisconnect", room.gameOptions.players);

    // Remove room if no players are connected
    if (room.gameOptions.players.every((p) => !p.connected)) {
      delete rooms[roomID];
    }
  }
}

io.on("connection", (socket) => {
  console.log("connected");
  socket.on("createRoom", (options, callback) => {
    try {
      const roomID = generateRoomID();
      socket.join(roomID);
      socket.currentRoom = roomID;

      rooms[roomID] = {
        host: socket.id,
        gameOptions: {
          ...options,
          players: [],
        },
        maxRounds: options.rounds,
        public: options.public,
        game: null,
      };
      callback({ roomID });
    } catch (error) {
      callback({ success: false, message: "Error creating room." });
    }
  });

  socket.on("joinRoom", ({ roomID, name }, callback) => {
    const room = rooms[roomID];

    if (room) {
      if (room.gameOptions.players.length < room.gameOptions.maxPlayers) {
        addPlayerToRoom(socket, roomID, name);

        if (room.gameOptions.players.length === room.gameOptions.maxPlayers) {
          try {
            room.public = false;
            room.game = new GameController(
              room.gameOptions.players,
              room.gameOptions.rounds,
              roomID,
            );
            io.to(roomID).emit("gameStarting", { gameID: roomID });
          } catch (error) {
            callback({ success: false, message: "Error starting game." });
          }
        }

        callback({ success: true });
      } else {
        callback({ success: false, message: "Room is full." });
      }
    } else {
      callback({ success: false, message: "Room does not exist." });
    }
  });

  socket.on("findRoom", (options, callback) => {
    try {
      const foundRooms = findAvailableRooms();

      if (foundRooms?.length > 0) {
        callback({ success: true, rooms: foundRooms });
      } else {
        callback({ success: false, message: "No available rooms." });
      }
    } catch (error) {
      callback({ success: false, message: "Error finding room." });
    }
  });

  socket.on("disconnect", () => {
    if (socket.currentRoom) {
      handlePlayerDisconnect(socket);
    }
  });

  socket.on("getGameData", (gameID, callback) => {
    const game = rooms[gameID];

    if (game && game.game) {
      const gameData = game.game.getGameState();
      callback({ success: true, gameData });
    } else {
      callback({ success: false, message: "Game does not exist." });
    }
  });

  socket.on("newGameEvent", ({ gameID, name, payload }, callback) => {
    const room = rooms[gameID];

    if (room && room.game) {
      const gameController = room.game;

      try {
        switch (name) {
          case "rotate":
            gameController.rotateWheel();
            break;
          case "letterClick":
            gameController.letterClick(payload.letter);
            break;
          case "addPoints":
            gameController.addPoints(payload.letterCount);
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
            callback({
              success: false,
              message: `Unknown event name: ${name}`,
            });
            return;
        }

        const gameState = gameController.getGameState();
        io.to(gameID).emit("gameUpdate", gameState);

        if (name === "rotate") {
          setTimeout(() => {
            const selectedValue = gameController.determineSelectedValue();
            gameController.processSelectedValue(selectedValue);
            const updatedGameState = gameController.getGameState();
            io.to(gameID).emit("gameUpdate", updatedGameState);
            console.log(
              `Game state updated after rotate for game ${gameID}:`,
              updatedGameState.stake,
            );
          }, 2000);
        }

        callback({ success: true, gameData: gameController.getGameState() });
      } catch (error) {
        console.error(
          `Error handling newGameEvent: ${name} for game ${gameID}:`,
          error,
        );
        callback({ success: false, message: "Error processing game event." });
      }
    } else {
      console.log(`Room or Game does not exist for gameID: ${gameID}`);
      callback({ success: false, message: "Room or Game does not exist." });
    }
  });
});

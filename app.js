const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const GameController = require("./gameControler");

// Middleware do parsowania JSON, jeśli potrzebujesz
app.use(express.json());

// Inicjalizacja Socket.io z elastycznymi ustawieniami CORS dla testów
const io = new Server(server, {
  cors: {
    origin: "*", // Dla testów, zezwalamy na wszystkie źródła. Zmień na "https://4tuna.pl" w produkcji.
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // Preferowanie WebSocketów
});

// Uruchomienie serwera na porcie 3000
server.listen(3000, () => {
  console.log("Server listening on port 3000");
});

// Testowy endpoint
app.get("/", (req, res) => {
  res.send("Backend działa poprawnie");
});

// Funkcja do generowania unikalnych ID pokoi
function generateRoomID() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

const rooms = {};

// Obsługa połączeń Socket.io
io.on("connection", (socket) => {
  console.log(`Użytkownik połączony: ${socket.id}`);

  // Obsługa zdarzenia "createRoom"
  socket.on("createRoom", (options, callback) => {
    console.log(`createRoom event received from: ${socket.id}`);
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
        game: null,
      };
      console.log(`Room created: ${roomID} by ${socket.id}`);
      callback({ roomID });
    } catch (error) {
      console.error("Error creating room:", error);
      callback({ success: false, message: "Error creating room." });
    }
  });

  // Obsługa zdarzenia "joinRoom"
  socket.on("joinRoom", ({ roomID, name }, callback) => {
    console.log(
      `joinRoom event received from: ${socket.id} for room: ${roomID}`,
    );
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
        console.log(`Player ${name} joined room ${roomID}`);

        if (room.gameOptions.players.length === room.gameOptions.maxPlayers) {
          const playersForGame = room.gameOptions.players.map((p) => ({
            name: p.name,
          }));
          try {
            room.game = new GameController(
              playersForGame,
              room.gameOptions.rounds,
              roomID,
            );
            console.log(`GameController initialized for room ${roomID}`);
            io.to(roomID).emit("startGame", { gameID: roomID });
          } catch (error) {
            console.error("Error initializing GameController:", error);
            callback({ success: false, message: "Error starting game." });
          }
        }

        callback({ success: true });
      } else {
        console.log(`Room ${roomID} is full.`);
        callback({ success: false, message: "Room is full." });
      }
    } else {
      console.log(`Room ${roomID} does not exist.`);
      callback({ success: false, message: "Room does not exist." });
    }
  });

  // Obsługa zdarzenia "disconnect"
  socket.on("disconnect", () => {
    console.log(`Użytkownik rozłączony: ${socket.id}`);
    if (socket.currentRoom) {
      const roomID = socket.currentRoom;
      const room = rooms[roomID];

      if (room) {
        const playerIndex = room.gameOptions.players.findIndex(
          (player) => player.id === socket.id,
        );

        if (playerIndex !== -1) {
          const removedPlayer = room.gameOptions.players.splice(
            playerIndex,
            1,
          )[0];
          io.to(roomID).emit("playerDisconnect", room.gameOptions.players);
          console.log(`Player ${removedPlayer.name} left room ${roomID}`);

          if (room.gameOptions.players.length === 0) {
            delete rooms[roomID];
            console.log(`Room ${roomID} deleted because it became empty.`);
          }
        }
      }
    }
  });

  // Obsługa zdarzenia "getGameData"
  socket.on("getGameData", (gameID, callback) => {
    console.log(
      `getGameData event received from: ${socket.id} for game: ${gameID}`,
    );
    const game = rooms[gameID];

    if (game && game.game) {
      const gameData = game.game.getGameState();
      callback({ success: true, gameData });
      console.log(`Game data sent for game ${gameID}`);
    } else {
      console.log(`Game ${gameID} does not exist.`);
      callback({ success: false, message: "GAME does not exist." });
    }
  });

  // Obsługa zdarzenia "newGameEvent"
  socket.on("newGameEvent", ({ gameID, name, payload }, callback) => {
    console.log(
      `newGameEvent: ${name} received from: ${socket.id} for game: ${gameID}`,
    );
    const room = rooms[gameID];

    if (room && room.game) {
      const gameController = room.game;

      try {
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
            console.log(`Unknown event name: ${name}`);
            callback({
              success: false,
              message: `Unknown event name: ${name}`,
            });
            return;
        }

        // Emit the updated game state to all players in the room
        const gameState = gameController.getGameState();
        io.to(gameID).emit("gameUpdate", gameState);
        console.log(`Game state updated for game ${gameID}:`, gameState);

        if (name === "rotate") {
          setTimeout(() => {
            const selectedValue = gameController.determineSelectedValue();
            gameController.processSelectedValue(selectedValue);
            const updatedGameState = gameController.getGameState();
            io.to(gameID).emit("gameUpdate", updatedGameState);
            console.log(
              `Game state updated after rotate for game ${gameID}:`,
              updatedGameState,
            );
          }, 2000);
        }

        // Optionally return the updated game state as a response to the event
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

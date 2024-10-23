// minimal-server.js
const http = require("http");
const { Server } = require("socket.io");
const { io: Client } = require("socket.io-client");

// Tworzenie serwera HTTP
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Minimalny serwer Socket.io działa poprawnie\n");
});

// Inicjalizacja Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Dla testów, zezwalamy na wszystkie źródła
    methods: ["GET", "POST"],
  },
});

// Obsługa połączeń Socket.io
io.on("connection", (socket) => {
  console.log(`Użytkownik połączony: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Użytkownik rozłączony: ${socket.id}`);
  });
});

// Uruchomienie serwera na porcie 3000
server.listen(3000, () => {
  console.log("Minimalny serwer Socket.io nasłuchuje na porcie 3000");

  // Automatyczne połączenie testowe klienta po uruchomieniu serwera
  const socket = Client("http://localhost:3000", {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Testowy klient połączony z serwerem");
    socket.disconnect();
  });

  socket.on("connect_error", (err) => {
    console.error("Testowy klient napotkał błąd połączenia:", err);
  });

  socket.on("disconnect", () => {
    console.log("Testowy klient rozłączony");
  });
});

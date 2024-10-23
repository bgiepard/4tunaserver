// test-socket.js
const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", {
  path: "/socket.io",
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Połączono z serwerem");
});

socket.on("connect_error", (err) => {
  console.error("Błąd połączenia:", err);
});

socket.on("disconnect", () => {
  console.log("Rozłączono z serwerem");
});

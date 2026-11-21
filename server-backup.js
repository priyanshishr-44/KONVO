const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const httpserver = http.createServer(app);
const io = new Server(httpserver);

let count = 0;
const rooms = new Map();
io.on("connection", (socket) => {
  count++;
  console.log("Active user: ", count);

  // Send msg from server to client
  socket.emit("click", "Hello from socket.IO");

  // Send msg from server to client
  socket.broadcast.emit("join", "New User Joined");

  socket.on("fr", (cb) => {
    console.log(cb);
  });

  // CREATE ROOM
socket.on("create-room", ({ roomName, username }, callback) => {
    if (!roomName || !username) {
        return callback({
            success: false,
            message: "Room name and username are required."
        });
    }

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    rooms.set(roomCode, {
        name: roomName.trim(),
        members: new Map()
    });

    joinRoom(socket, roomCode, username);

    callback({
        success: true,
        roomCode,
        roomName: roomName.trim()
    });
});

// JOIN ROOM
socket.on("join-room", ({ roomCode, username }, callback) => {
    const code = roomCode?.trim().toUpperCase();

    if (!code || !username) {
        return callback({ success: false, message: "Details required." });
    }

    if (!rooms.has(code)) {
        return callback({ success: false, message: "Room not found." });
    }

    joinRoom(socket, code, username);

    callback({
        success: true,
        roomCode: code,
        roomName: rooms.get(code).name
    });
});

// SEND MESSAGE
socket.on("send-message", ({ message }) => {
    const roomCode = socket.data.roomCode;

    if (!roomCode || !rooms.has(roomCode)) return;
    if (typeof message !== "string" || !message.trim()) return;

    const messageData = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        username: socket.data.username,
        message: message.trim(),
        time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    };

    io.to(roomCode).emit("new-message", messageData);
});

// TYPING
socket.on("typing", () => {
    const roomCode = socket.data.roomCode;
    if (roomCode) {
        socket.to(roomCode).emit("user-typing", {
            username: socket.data.username
        });
    }
});

socket.on("stop-typing", () => {
    const roomCode = socket.data.roomCode;
    if (roomCode) {
        socket.to(roomCode).emit("user-stop-typing", {
            username: socket.data.username
        });
    }
});

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);

    count--;
    console.log("Active user: ", count);
});

  io.emit("announcement", "Today is last class");
});

// JOIN ROOM FUNCTION
function joinRoom(socket, roomCode, username) {
    leaveCurrentRoom(socket);

    const room = rooms.get(roomCode);
    if (!room) return;

    socket.join(roomCode);

    socket.data.roomCode = roomCode;
    socket.data.username = username.trim();

    room.members.set(socket.id, username.trim());

    updateRoomMembers(roomCode);

    console.log(`${username} joined room ${roomCode}`);
}


// LEAVE ROOM FUNCTION
function leaveCurrentRoom(socket) {
    const roomCode = socket.data.roomCode;

    if (!roomCode || !rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);

    room.members.delete(socket.id);

    socket.leave(roomCode);

    socket.to(roomCode).emit("user-left", {
        username: socket.data.username
    });

    if (room.members.size === 0) {
        rooms.delete(roomCode);
    } else {
        updateRoomMembers(roomCode);
    }

    socket.data.roomCode = null;
}


// UPDATE ROOM MEMBERS
function updateRoomMembers(roomCode) {
    const room = rooms.get(roomCode);

    if (!room) return;

    const members = Array.from(room.members.entries()).map(
        ([id, username]) => ({
            id,
            username
        })
    );

    io.to(roomCode).emit("room-members", members);
}

httpserver.listen(8080, () => {
    console.log("KONVO server running on port 8080");
});

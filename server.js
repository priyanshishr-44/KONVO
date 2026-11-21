// ==========================================
// KONVO - MAIN SERVER
// ==========================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");
const Room = require("./models/Room");

const connectDB = require("./config/db");

const authMiddleware = require("./middleware/authMiddleware");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");


// ==========================================
// EXPRESS SETUP
// ==========================================

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer);


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));


// ==========================================
// API ROUTES
// ==========================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);


// ==========================================
// PAGE ROUTES
// ==========================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );

});


app.get("/login", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "login.html")
    );

});


app.get("/signup", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "signup.html")
    );

});


// ==========================================
// PROTECTED DASHBOARD
// ==========================================

app.get("/dashboard", (req, res) => {

    const token = req.cookies.konvoToken;

    if (!token) {
        return res.redirect("/login");
    }

    try {

        jwt.verify(token, process.env.JWT_SECRET);

        res.sendFile(
            path.join(__dirname, "private", "index.html")
        );

    } catch (error) {

        res.clearCookie("konvoToken");

        return res.redirect("/login");

    }

});


// ==========================================
// AUTHENTICATION CHECK
// ==========================================

app.get(
    "/api/auth/check",
    authMiddleware,
    (req, res) => {

        res.json({
            success: true,
            authenticated: true
        });

    }
);


// ==========================================
// ACTIVE ROOMS (IN-MEMORY)
// ==========================================

const rooms = new Map();


// ==========================================
// SOCKET AUTHENTICATION
// ==========================================

io.use(async (socket, next) => {

    try {

        const cookieHeader = socket.handshake.headers.cookie || "";

        const tokenMatch = cookieHeader.match(
            /(?:^|;\s*)konvoToken=([^;]+)/
        );

        if (!tokenMatch) {
            return next(new Error("Authentication required"));
        }

        const token = decodeURIComponent(tokenMatch[1]);

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.id)
            .select("-password");

        if (!user) {
            return next(new Error("User not found"));
        }

        socket.data.user = user;

        socket.data.username = user.username;

        socket.data.roomCode = null;

        next();

    } catch (error) {

        console.error(
            "Socket Authentication Error:",
            error.message
        );

        next(new Error("Authentication failed"));

    }

});


// ==========================================
// SOCKET CONNECTION
// ==========================================

io.on("connection", (socket) => {

    console.log(
        "User connected:",
        socket.data.username
    );


    // ======================================
    // CREATE ROOM - MONGODB PERSISTENCE
    // ======================================

    socket.on("create-room", async ({ roomName } = {}, callback) => {

        try {

            if (
                typeof roomName !== "string" ||
                !roomName.trim()
            ) {

                if (typeof callback === "function") {
                    callback({
                        success: false,
                        message: "Please enter a room name."
                    });
                }

                return;
            }

            if (roomName.trim().length > 50) {

                if (typeof callback === "function") {
                    callback({
                        success: false,
                        message: "Room name is too long."
                    });
                }

                return;
            }


            let roomCode;

            // Generate a unique room code
            while (true) {

                roomCode = Math.random()
                    .toString(36)
                    .substring(2, 8)
                    .toUpperCase();

                const existingRoom = await Room.exists({
                    roomCode: roomCode
                });

                if (!rooms.has(roomCode) && !existingRoom) {
                    break;
                }

            }


            // Save room permanently in MongoDB
            const savedRoom = await Room.create({
    roomCode,
    name: roomName.trim(),
    createdBy: socket.data.user._id,
    members: [socket.data.user._id]
});


            // Add active room to memory
            rooms.set(roomCode, {

                name: savedRoom.name,

                members: new Map()

            });

await Room.updateOne(
    { roomCode },
    { $addToSet: { members: socket.data.user._id } }
);
            joinRoom(socket, roomCode);


            console.log(
                "Room created:",
                roomCode
            );


            if (typeof callback === "function") {

                callback({

                    success: true,

                    roomCode: roomCode,

                    roomName: savedRoom.name

                });

            }

        } catch (error) {

            console.error(
                "Create Room Error:",
                error.message
            );

            if (typeof callback === "function") {

                callback({

                    success: false,

                    message: "Room could not be created. Please try again."

                });

            }

        }

    });


    // ======================================
    // JOIN ROOM - MONGODB PERSISTENCE
    // ======================================

    socket.on("join-room", async ({ roomCode } = {}, callback) => {

        try {

            if (typeof roomCode !== "string") {

                if (typeof callback === "function") {
                    callback({
                        success: false,
                        message: "Invalid room code."
                    });
                }

                return;
            }

            roomCode = roomCode.trim().toUpperCase();


            // Check active room first
            let room = rooms.get(roomCode);


            // If room is not active, check MongoDB
            if (!room) {

                const savedRoom = await Room.findOne({
                    roomCode: roomCode
                });

                if (!savedRoom) {

                    if (typeof callback === "function") {
                        callback({
                            success: false,
                            message: "Room not found."
                        });
                    }

                    return;
                }


                // Restore room in memory
                room = {

                    name: savedRoom.name,

                    members: new Map()

                };

                rooms.set(roomCode, room);

            }


            joinRoom(socket, roomCode);


            if (typeof callback === "function") {

                callback({

                    success: true,

                    roomCode: roomCode,

                    roomName: room.name

                });

            }

        } catch (error) {

            console.error(
                "Join Room Error:",
                error.message
            );

            if (typeof callback === "function") {

                callback({

                    success: false,

                    message: "Could not join room. Please try again."

                });

            }

        }

    });


    // ======================================
    // LOAD MESSAGE HISTORY
    // ======================================

    socket.on("get-message-history", async () => {

        try {

            const roomCode = socket.data.roomCode;

            if (!roomCode || !rooms.has(roomCode)) {
                return;
            }


            const messages = await Message.find({

                roomCode: roomCode

            })
                .sort({ createdAt: 1 })
                .limit(100)
                .lean();


            const messageHistory = messages.map((msg) => ({

                id: msg._id.toString(),

                username: msg.senderName,

                message: msg.message,

                time: msg.createdAt.toLocaleTimeString([], {

                    hour: "2-digit",

                    minute: "2-digit"

                })

            }));


            socket.emit(
                "message-history",
                messageHistory
            );


        } catch (error) {

            console.error(
                "Message History Error:",
                error.message
            );

        }

    });


    // ======================================
    // SEND MESSAGE - MONGODB PERSISTENCE
    // ======================================

    socket.on("send-message", async ({ message } = {}) => {

        try {

            const roomCode = socket.data.roomCode;

            if (!roomCode || !rooms.has(roomCode)) {
                return;
            }

            if (
                typeof message !== "string" ||
                !message.trim()
            ) {
                return;
            }


            const cleanMessage = message
                .trim()
                .slice(0, 2000);


            const savedMessage = await Message.create({

                roomCode: roomCode,

                sender: socket.data.user._id,

                senderName: socket.data.username,

                message: cleanMessage

            });


            const messageData = {

                id: savedMessage._id.toString(),

                username: savedMessage.senderName,

                message: savedMessage.message,

                time: savedMessage.createdAt.toLocaleTimeString([], {

                    hour: "2-digit",

                    minute: "2-digit"

                })

            };


            io.to(roomCode).emit(
                "new-message",
                messageData
            );


        } catch (error) {

            console.error(
                "Message Save Error:",
                error.message
            );

            socket.emit("message-error", {

                message: "Message could not be saved. Please try again."

            });

        }

    });


    // ======================================
    // TYPING
    // ======================================

    socket.on("typing", () => {

        const roomCode = socket.data.roomCode;

        if (!roomCode || !rooms.has(roomCode)) return;

        socket.to(roomCode).emit("user-typing", {

            username: socket.data.username

        });

    });


    // ======================================
    // STOP TYPING
    // ======================================

    socket.on("stop-typing", () => {

        const roomCode = socket.data.roomCode;

        if (!roomCode || !rooms.has(roomCode)) return;

        socket.to(roomCode).emit("user-stop-typing", {

            username: socket.data.username

        });

    });


    // ======================================
    // DISCONNECT
    // ======================================

    socket.on("disconnect", () => {

        leaveCurrentRoom(socket);

        console.log(
            "User disconnected:",
            socket.data.username
        );

    });

});


// ==========================================
// JOIN ROOM FUNCTION
// ==========================================

function joinRoom(socket, roomCode) {

    leaveCurrentRoom(socket);

    const room = rooms.get(roomCode);

    if (!room) return;


    socket.join(roomCode);

    socket.data.roomCode = roomCode;


    room.members.set(
        socket.id,
        socket.data.username
    );


    updateRoomMembers(roomCode);


    console.log(
        `${socket.data.username} joined room ${roomCode}`
    );

}


// ==========================================
// LEAVE ROOM FUNCTION
// ==========================================

function leaveCurrentRoom(socket) {

    const roomCode = socket.data.roomCode;

    if (!roomCode || !rooms.has(roomCode)) return;


    const room = rooms.get(roomCode);


    room.members.delete(socket.id);

    socket.leave(roomCode);


    socket.to(roomCode).emit("user-left", {

        username: socket.data.username

    });


    // Remove only from active memory.
    // MongoDB room record remains saved.

    if (room.members.size === 0) {

        rooms.delete(roomCode);

    } else {

        updateRoomMembers(roomCode);

    }


    socket.data.roomCode = null;

}


// ==========================================
// UPDATE ROOM MEMBERS
// ==========================================

function updateRoomMembers(roomCode) {

    const room = rooms.get(roomCode);

    if (!room) return;


    const members = Array.from(
        room.members.entries()
    ).map(([id, username]) => ({

        id,

        username

    }));


    io.to(roomCode).emit(
        "room-members",
        members
    );

}


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 8080;


connectDB()

    .then(() => {

        httpServer.listen(PORT, () => {

            console.log(
                `KONVO server running on port ${PORT}`
            );

        });

    })

    .catch((error) => {

        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);

    });
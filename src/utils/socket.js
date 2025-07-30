import { Server } from "socket.io";
import http from "http";
import { app } from "../app.js";
import { Message } from "../models/Message.model.js";

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
    },
});

const onlineUsers = new Map(); // {userId: socketId}

export function getReceiverSocketId(userId) {
    return onlineUsers.get(userId);
}

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
        onlineUsers.set(userId, socket.id);
        console.log("✅ Connected:", userId);

        // Immediately notify all clients
        io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));
    }

    // Optional: client can also manually ask for list
    socket.on("getOnlineUsers", () => {
        socket.emit("getOnlineUsers", Array.from(onlineUsers.keys()));
    });

    socket.on("disconnect", () => {
        for (let [id, sId] of onlineUsers.entries()) {
            if (sId === socket.id) {
                onlineUsers.delete(id);
                break;
            }
        }

        console.log("❌ Disconnected:", userId);
        io.emit("getOnlineUsers", Array.from(onlineUsers.keys()));
    });
});

export { io, server };
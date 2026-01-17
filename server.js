const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "[https://ocean-central.pages.dev](https://ocean-central.pages.dev)" }
});

let queue = [];

io.on('connection', (socket) => {
    socket.on('join-queue', (username) => {
        const player = { id: socket.id, name: username };
        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `room_${Date.now()}`;
            socket.join(roomId);
            opponent.socket.join(roomId);
            io.to(roomId).emit('match-found', { room: roomId, opponent: opponent.name });
        } else {
            queue.push({ ...player, socket });
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
    });
});

server.listen(process.env.PORT || 3000);

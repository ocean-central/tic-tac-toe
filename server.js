const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        // REMOVED brackets: make sure this matches your frontend URL exactly
        origin: "https://ocean-central.pages.dev", 
        methods: ["GET", "POST"],
        credentials: true
    }
});

let queue = [];

io.on('connection', (socket) => {
    console.log('user connected:', socket.id);

    socket.on('join-queue', (username) => {
        const safeName = username ? username.replace(/[^\w\s]/gi, '').substring(0, 20) : "guest";
        const player = { id: socket.id, name: safeName, socket };
        
        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `room_${socket.id}_${opponent.id}`;
            
            socket.join(roomId);
            opponent.socket.join(roomId);

            io.to(socket.id).emit('match-found', { 
                opponent: opponent.name, 
                room: roomId,
                symbol: 'x' 
            });
            io.to(opponent.id).emit('match-found', { 
                opponent: player.name, 
                room: roomId,
                symbol: 'o'
            });
            
            console.log(`match started: ${player.name} vs ${opponent.name}`);
        } else {
            queue.push(player);
            console.log(`${safeName} joined queue`);
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
        console.log('user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});

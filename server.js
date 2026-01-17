const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: "[https://ocean-central.pages.dev](https://ocean-central.pages.dev)",
        methods: ["GET", "POST"]
    }
});

// player queue management
let queue = [];

io.on('connection', (socket) => {
    console.log('user connected:', socket.id);

    socket.on('join-queue', (username) => {
        // basic safety check for username
        const safeName = username.replace(/[^\w\s]/gi, '').substring(0, 20);
        
        const player = { id: socket.id, name: safeName, socket };
        
        if (queue.length > 0) {
            // match found!
            const opponent = queue.shift();
            const roomId = `room_${socket.id}_${opponent.id}`;
            
            socket.join(roomId);
            opponent.socket.join(roomId);

            // notify both players
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
            // add to queue
            queue.push(player);
            console.log(`${safeName} joined queue`);
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
        console.log('user disconnected');
    });
});

// use render's assigned port or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});

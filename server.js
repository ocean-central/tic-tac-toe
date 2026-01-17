const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// State management
let queue = [];
let rooms = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Update global player count for everyone
    io.emit('player-count', io.engine.clientsCount);

    // Join Matchmaking Queue
    socket.on('join-queue', (username) => {
        // Remove from queue if already in it to prevent duplicates
        queue = queue.filter(player => player.id !== socket.id);
        
        const newPlayer = { id: socket.id, username };
        
        if (queue.length > 0) {
            // Match found!
            const opponent = queue.shift();
            const roomId = `room-${Date.now()}-${socket.id}`;
            
            // Join both to the socket room
            socket.join(roomId);
            const opponentSocket = io.sockets.sockets.get(opponent.id);
            if (opponentSocket) opponentSocket.join(roomId);

            // Notify both players
            // Symbol 'x' always goes first
            socket.emit('match-found', {
                room: roomId,
                opponent: opponent.username,
                symbol: 'x'
            });

            if (opponentSocket) {
                opponentSocket.emit('match-found', {
                    room: roomId,
                    opponent: username,
                    symbol: 'o'
                });
            }

            console.log(`Match started in ${roomId}: ${username} vs ${opponent.username}`);
        } else {
            // Add to queue
            queue.push(newPlayer);
            console.log(`${username} joined queue`);
        }
    });

    // Handle Game Moves
    socket.on('make-move', (data) => {
        // Broadcast to everyone in the room except the sender
        socket.to(data.room).emit('move-made', {
            index: data.index,
            symbol: data.symbol
        });
    });

    // Handle Ability Usage
    socket.on('ability-used', (data) => {
        // Relay ability info to the opponent
        socket.to(data.room).emit('ability-used', {
            abilityId: data.abilityId,
            abilityName: data.abilityName
        });
    });

    // Leave Queue manually
    socket.on('leave-queue', () => {
        queue = queue.filter(player => player.id !== socket.id);
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
        queue = queue.filter(player => player.id !== socket.id);
        io.emit('player-count', io.engine.clientsCount);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

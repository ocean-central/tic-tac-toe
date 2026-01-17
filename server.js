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

// Helper to broadcast player count to everyone connected
const broadcastPlayerCount = () => {
    io.emit('player-count', io.engine.clientsCount);
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    broadcastPlayerCount();

    // Matchmaking Logic
    socket.on('join-queue', (username) => {
        // Prevent duplicate queue entries
        queue = queue.filter(player => player.id !== socket.id);
        
        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `game-${socket.id}-${opponent.id}`;
            
            // Join both players to the room
            socket.join(roomId);
            const opponentSocket = io.sockets.sockets.get(opponent.id);
            if (opponentSocket) {
                opponentSocket.join(roomId);

                // Initialize Game: 'x' always goes first
                socket.emit('match-found', {
                    room: roomId,
                    opponent: opponent.username,
                    symbol: 'x'
                });

                opponentSocket.emit('match-found', {
                    room: roomId,
                    opponent: username,
                    symbol: 'o'
                });
                
                console.log(`Match Started: ${username} vs ${opponent.username}`);
            }
        } else {
            queue.push({ id: socket.id, username });
            console.log(`${username} added to queue`);
        }
    });

    // Enhanced Move Synchronization
    // We broadcast the entire board state to ensure complex ability effects
    // like "Supernova" or "Scramble" reflect perfectly on both ends.
    socket.on('make-move', (data) => {
        if (!data.room) return;
        
        socket.to(data.room).emit('move-made', {
            index: data.index,
            symbol: data.symbol,
            newBoard: data.newBoard // Synchronizes full board state
        });
    });

    // Ability Relay
    socket.on('ability-used', (data) => {
        if (!data.room) return;
        
        socket.to(data.room).emit('ability-used', {
            abilityId: data.abilityId,
            abilityName: data.abilityName
        });
    });

    // Manual Queue Exit
    socket.on('leave-queue', () => {
        queue = queue.filter(p => p.id !== socket.id);
    });

    // Connection Cleanup
    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
        broadcastPlayerCount();
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

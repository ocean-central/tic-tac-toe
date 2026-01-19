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

let queue = [];

// Clean player counting that updates every single client
const updateGlobalCount = () => {
    // We use the room length for accuracy
    const count = io.engine.clientsCount;
    io.emit('player-count', count);
};

io.on('connection', (socket) => {
    updateGlobalCount();

    socket.on('join-queue', (username) => {
        // Clear any previous queue entries for this socket
        queue = queue.filter(p => p.id !== socket.id);
        
        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `room_${socket.id}_${opponent.id}`;
            
            socket.join(roomId);
            const opponentSocket = io.sockets.sockets.get(opponent.id);
            
            if (opponentSocket) {
                opponentSocket.join(roomId);

                // Start game for both
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
            }
        } else {
            queue.push({ id: socket.id, username });
        }
    });

    socket.on('make-move', (data) => {
        if (data.room) {
            // Relays the entire board state and visual effects
            // Broadcast ensures everyone in the room except the sender gets the update
            socket.to(data.room).emit('move-made', {
                newBoard: data.newBoard,
                effect: data.effect
            });
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
        updateGlobalCount();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

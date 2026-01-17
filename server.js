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

const broadcastPlayerCount = () => {
    io.emit('player-count', io.engine.clientsCount);
};

io.on('connection', (socket) => {
    broadcastPlayerCount();

    socket.on('join-queue', (username) => {
        queue = queue.filter(player => player.id !== socket.id);
        
        if (queue.length > 0) {
            const opponent = queue.shift();
            const roomId = `game-${socket.id}-${opponent.id}`;
            
            socket.join(roomId);
            const opponentSocket = io.sockets.sockets.get(opponent.id);
            if (opponentSocket) {
                opponentSocket.join(roomId);

                // Sending BOTH players the opponent's name correctly
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
            socket.to(data.room).emit('move-made', {
                index: data.index,
                symbol: data.symbol,
                newBoard: data.newBoard
            });
        }
    });

    socket.on('disconnect', () => {
        queue = queue.filter(p => p.id !== socket.id);
        broadcastPlayerCount();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

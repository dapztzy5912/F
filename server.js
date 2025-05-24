const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms
const rooms = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

io.on('connection', (socket) => {
    console.log('New user connected');

    socket.on('createRoom', (username) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            players: [{
                id: socket.id,
                username: username || 'Player 1',
                position: 50,
                score: 0,
                fishing: false
            }],
            fishes: generateFishes()
        };
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`Room ${roomId} created by ${socket.id}`);
    });

    socket.on('joinRoom', (data) => {
        const { roomId, username } = data;
        if (rooms[roomId] && rooms[roomId].players.length < 2) {
            rooms[roomId].players.push({
                id: socket.id,
                username: username || 'Player 2',
                position: 50,
                score: 0,
                fishing: false
            });
            socket.join(roomId);
            io.to(roomId).emit('gameStart', rooms[roomId]);
            console.log(`Player ${socket.id} joined room ${roomId}`);
        } else {
            socket.emit('joinError', 'Room is full or does not exist');
        }
    });

    socket.on('moveBoat', (data) => {
        const { roomId, direction } = data;
        if (rooms[roomId]) {
            const playerIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                // Update position (limit between 0 and 100)
                rooms[roomId].players[playerIndex].position = 
                    Math.max(0, Math.min(100, rooms[roomId].players[playerIndex].position + (direction === 'left' ? -5 : 5)));
                
                io.to(roomId).emit('boatMoved', {
                    playerIndex,
                    position: rooms[roomId].players[playerIndex].position
                });
            }
        }
    });

    socket.on('startFishing', (roomId) => {
        if (rooms[roomId]) {
            const playerIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1 && !rooms[roomId].players[playerIndex].fishing) {
                rooms[roomId].players[playerIndex].fishing = true;
                
                // Random time between 2-5 seconds to catch a fish
                const fishingTime = 2000 + Math.random() * 3000;
                
                setTimeout(() => {
                    if (rooms[roomId] && rooms[roomId].players[playerIndex].fishing) {
                        // Check if caught a fish
                        const fishIndex = rooms[roomId].fishes.findIndex(f => 
                            Math.abs(f.position - rooms[roomId].players[playerIndex].position) < 10
                        );
                        
                        if (fishIndex !== -1) {
                            // Caught a fish!
                            const caughtFish = rooms[roomId].fishes[fishIndex];
                            rooms[roomId].players[playerIndex].score += caughtFish.points;
                            rooms[roomId].fishes.splice(fishIndex, 1);
                            
                            // Add new fish
                            rooms[roomId].fishes.push(generateFish());
                            
                            io.to(roomId).emit('fishCaught', {
                                playerIndex,
                                score: rooms[roomId].players[playerIndex].score,
                                fish: caughtFish
                            });
                        }
                        
                        rooms[roomId].players[playerIndex].fishing = false;
                        io.to(roomId).emit('fishingEnded', { playerIndex });
                    }
                }, fishingTime);
                
                io.to(roomId).emit('fishingStarted', { playerIndex });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Clean up rooms if empty
        for (const roomId in rooms) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateFishes() {
    const fishes = [];
    for (let i = 0; i < 5; i++) {
        fishes.push(generateFish());
    }
    return fishes;
}

function generateFish() {
    const types = ['small', 'medium', 'large'];
    const type = types[Math.floor(Math.random() * types.length)];
    const points = type === 'small' ? 10 : type === 'medium' ? 20 : 30;
    
    return {
        position: Math.random() * 100,
        type,
        points
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
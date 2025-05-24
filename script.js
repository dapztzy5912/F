// Lobby Page Logic
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Check if we're on the lobby page
    if (document.getElementById('create-room-btn')) {
        // Lobby page elements
        const createRoomBtn = document.getElementById('create-room-btn');
        const joinRoomBtn = document.getElementById('join-room-btn');
        const roomCreatedDiv = document.getElementById('room-created');
        const roomCodeSpan = document.getElementById('room-code');
        const joinError = document.getElementById('join-error');
        
        // Create room
        createRoomBtn.addEventListener('click', () => {
            const username = document.getElementById('username-create').value || 'Player 1';
            socket.emit('createRoom', username);
        });
        
        // Join room
        joinRoomBtn.addEventListener('click', () => {
            const username = document.getElementById('username-join').value || 'Player 2';
            const roomId = document.getElementById('room-id').value.toUpperCase();
            
            if (roomId.length === 6) {
                socket.emit('joinRoom', { roomId, username });
            } else {
                showJoinError('Room code must be 6 characters');
            }
        });
        
        // Room created successfully
        socket.on('roomCreated', (roomId) => {
            roomCodeSpan.textContent = roomId;
            roomCreatedDiv.classList.remove('hidden');
        });
        
        // Game is starting (for both players)
        socket.on('gameStart', (roomData) => {
            // Store room data in session storage
            sessionStorage.setItem('roomData', JSON.stringify(roomData));
            sessionStorage.setItem('playerId', socket.id);
            
            // Redirect to game page
            window.location.href = '/game';
        });
        
        // Join error
        socket.on('joinError', (message) => {
            showJoinError(message);
        });
        
        function showJoinError(message) {
            joinError.textContent = message;
            joinError.classList.remove('hidden');
            setTimeout(() => joinError.classList.add('hidden'), 3000);
        }
    }
    
    // Game Page Logic
    if (document.getElementById('game-area')) {
        const roomData = JSON.parse(sessionStorage.getItem('roomData'));
        const playerId = sessionStorage.getItem('playerId');
        
        if (!roomData || !playerId) {
            window.location.href = '/';
            return;
        }
        
        // Find player index (0 or 1)
        const playerIndex = roomData.players.findIndex(p => p.id === playerId);
        const otherPlayerIndex = playerIndex === 0 ? 1 : 0;
        
        // Set player names
        document.getElementById(`player${playerIndex+1}-name`).textContent = roomData.players[playerIndex].username;
        document.getElementById(`player${otherPlayerIndex+1}-name`).textContent = roomData.players[otherPlayerIndex].username;
        
        // Initialize boats
        const boat1 = document.getElementById('boat1');
        const boat2 = document.getElementById('boat2');
        const line1 = document.getElementById('line1');
        const line2 = document.getElementById('line2');
        
        // Update boat positions
        function updateBoats() {
            boat1.style.left = `${roomData.players[0].position}%`;
            boat2.style.left = `${roomData.players[1].position}%`;
        }
        
        // Update fishing lines
        function updateLines() {
            line1.style.display = roomData.players[0].fishing ? 'block' : 'none';
            line2.style.display = roomData.players[1].fishing ? 'block' : 'none';
            
            if (roomData.players[0].fishing) {
                line1.style.height = `${200 - (roomData.players[0].position * 1.5)}px`;
                line1.style.left = `${roomData.players[0].position}%`;
            }
            
            if (roomData.players[1].fishing) {
                line2.style.height = `${200 - (roomData.players[1].position * 1.5)}px`;
                line2.style.left = `${roomData.players[1].position}%`;
            }
        }
        
        // Render fishes
        function renderFishes() {
            const water = document.querySelector('.water');
            water.querySelectorAll('.fish').forEach(fish => fish.remove());
            
            roomData.fishes.forEach(fish => {
                const fishElement = document.createElement('div');
                fishElement.className = `fish ${fish.type}`;
                fishElement.style.left = `${fish.position}%`;
                fishElement.style.bottom = `${20 + Math.random() * 50}%`;
                water.appendChild(fishElement);
            });
        }
        
        // Update scores
        function updateScores() {
            document.getElementById(`player1-score`).textContent = roomData.players[0].score;
            document.getElementById(`player2-score`).textContent = roomData.players[1].score;
        }
        
        // Initialize game state
        updateBoats();
        updateLines();
        renderFishes();
        updateScores();
        
        // Handle boat movement
        document.getElementById('move-left').addEventListener('click', () => {
            socket.emit('moveBoat', { roomId: Object.keys(rooms)[0], direction: 'left' });
        });
        
        document.getElementById('move-right').addEventListener('click', () => {
            socket.emit('moveBoat', { roomId: Object.keys(rooms)[0], direction: 'right' });
        });
        
        // Handle fishing
        document.getElementById('fish-btn').addEventListener('click', () => {
            if (!roomData.players[playerIndex].fishing) {
                socket.emit('startFishing', Object.keys(rooms)[0]);
            }
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                socket.emit('moveBoat', { roomId: Object.keys(rooms)[0], direction: 'left' });
            } else if (e.key === 'ArrowRight') {
                socket.emit('moveBoat', { roomId: Object.keys(rooms)[0], direction: 'right' });
            } else if (e.key === ' ') {
                if (!roomData.players[playerIndex].fishing) {
                    socket.emit('startFishing', Object.keys(rooms)[0]);
                }
            }
        });
        
        // Socket event listeners
        socket.on('boatMoved', (data) => {
            roomData.players[data.playerIndex].position = data.position;
            updateBoats();
        });
        
        socket.on('fishingStarted', (data) => {
            roomData.players[data.playerIndex].fishing = true;
            updateLines();
        });
        
        socket.on('fishingEnded', (data) => {
            roomData.players[data.playerIndex].fishing = false;
            updateLines();
        });
        
        socket.on('fishCaught', (data) => {
            roomData.players[data.playerIndex].score = data.score;
            updateScores();
            
            // Show caught fish animation
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = `Caught a ${data.fish.type} fish (+${data.fish.points} points)!`;
            document.querySelector('.game-container').appendChild(notification);
            
            setTimeout(() => notification.remove(), 2000);
        });
    }
});
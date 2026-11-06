const roomCodeElement = document.getElementById('room-code');
const playerList = document.getElementById('player-list');
const logElement = document.getElementById('log');
const nameInput = document.getElementById('name');

let socket = null;
let roomCode = '';
let playerId = '';

function logMessage(message) {
  const line = document.createElement('div');
  line.textContent = message;
  logElement.prepend(line);
}

function renderPlayers(players) {
  playerList.innerHTML = '';
  if (!players || !players.length) {
    playerList.innerHTML = '<span class="pill">Waiting for players…</span>';
    return;
  }

  for (const player of players) {
    const pill = document.createElement('span');
    pill.className = `pill ${player.team === 'orange' ? 'orange' : 'blue'}`;
    pill.textContent = `${player.name} (${player.team})`;
    playerList.appendChild(pill);
  }
}

function connectToRoom(code) {
  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}`);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'join-room',
      room: code,
      playerId,
      name: nameInput.value || 'Driver',
      team: 'blue',
    }));
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === 'room-joined') {
      roomCode = payload.room;
      playerId = payload.playerId;
      roomCodeElement.textContent = roomCode;
      logMessage(`Joined room ${roomCode}`);
      renderPlayers(payload.players || []);
      return;
    }

    if (payload.type === 'room-update') {
      renderPlayers(payload.players || []);
      logMessage(`Players in room: ${(payload.players || []).map((p) => p.name).join(', ') || 'none'}`);
      return;
    }

    if (payload.type === 'chat') {
      logMessage(`${payload.playerId}: ${payload.message}`);
    }
  });

  socket.addEventListener('close', () => {
    logMessage('Connection closed');
  });

  socket.addEventListener('error', () => {
    logMessage('Connection failed. Check the server is running.');
  });
}

document.getElementById('create-room').addEventListener('click', async () => {
  const response = await fetch('/api/create-room');
  const data = await response.json();
  roomCode = data.room;
  roomCodeElement.textContent = roomCode;
  connectToRoom(roomCode);
});

document.getElementById('join-room').addEventListener('click', () => {
  const code = prompt('Enter room code', roomCode || '').trim();
  if (!code) {
    return;
  }
  roomCode = code.toUpperCase();
  roomCodeElement.textContent = roomCode;
  connectToRoom(roomCode);
});

renderPlayers([]);
roomCodeElement.textContent = '—';
logMessage('Turball multiplayer lobby ready.');

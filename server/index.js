import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  FIELD, PLAYER_PROPS, BALL_PROPS,
  TICK_RATE, stepPhysics,
} from './src/physics.js';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5174';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN.split(',').map(s => s.trim()),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --- Constants ---
const MATCH_DURATION = 180;
const GOAL_PAUSE_TICKS = 3 * TICK_RATE;
const GOAL_Y_MIN = (FIELD.height - FIELD.goalHeight) / 2;
const GOAL_Y_MAX = (FIELD.height + FIELD.goalHeight) / 2;
const MAX_PLAYERS = 6;

const RED_SPAWNS = [
  { x: 250, y: 240 },
  { x: 250, y: 340 },
  { x: 250, y: 440 },
];
const BLUE_SPAWNS = [
  { x: 800, y: 240 },
  { x: 800, y: 340 },
  { x: 800, y: 440 },
];
const BALL_SPAWN = { x: 525, y: 340 };

// --- Rooms ---
const rooms = new Map();      // roomId -> room object
const socketRoom = new Map(); // socketId -> roomId

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function createNewRoom(name) {
  let id;
  do { id = generateId(); } while (rooms.has(id));

  const room = {
    id,
    name: name || 'Unnamed Room',
    maxPlayers: MAX_PLAYERS,
    players: new Map(),
    ball: createBall(),
    score: { red: 0, blue: 0 },
    phase: 'waiting',
    matchTime: MATCH_DURATION,
    tickCount: 0,
    goalPauseTicks: 0,
    loopInterval: null,
    restartTimeout: null,
  };
  rooms.set(id, room);
  return room;
}

function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.loopInterval) { clearInterval(room.loopInterval); room.loopInterval = null; }
  if (room.restartTimeout) { clearTimeout(room.restartTimeout); room.restartTimeout = null; }
  rooms.delete(roomId);
  console.log(`[${roomId}] Room deleted (empty)`);
}

// --- Disc factories ---

function createBall() {
  return {
    x: BALL_SPAWN.x, y: BALL_SPAWN.y, vx: 0, vy: 0,
    radius: BALL_PROPS.radius,
    invMass: BALL_PROPS.invMass,
    damping: BALL_PROPS.damping,
    bCoef: BALL_PROPS.bCoef,
  };
}

function createPlayerDisc(spawn) {
  return {
    x: spawn.x, y: spawn.y, vx: 0, vy: 0,
    radius: PLAYER_PROPS.radius,
    invMass: PLAYER_PROPS.invMass,
    damping: PLAYER_PROPS.damping,
    bCoef: PLAYER_PROPS.bCoef,
    input: { up: false, down: false, left: false, right: false, kick: false, sprintActive: false },
  };
}

// --- Team assignment (within a room) ---

function assignTeam(room) {
  let redCount = 0, blueCount = 0;
  for (const p of room.players.values()) {
    if (p.team === 'red') redCount++; else blueCount++;
  }
  if (redCount <= blueCount && redCount < 3) return { team: 'red', index: redCount };
  if (blueCount < 3) return { team: 'blue', index: blueCount };
  return null;
}

function getSpawn(team, index) {
  return team === 'red' ? RED_SPAWNS[index] : BLUE_SPAWNS[index];
}

// --- Room operations ---

function resetPositions(room) {
  for (const p of room.players.values()) {
    const spawn = getSpawn(p.team, p.spawnIndex);
    p.disc.x = spawn.x; p.disc.y = spawn.y;
    p.disc.vx = 0; p.disc.vy = 0;
  }
  room.ball.x = BALL_SPAWN.x; room.ball.y = BALL_SPAWN.y;
  room.ball.vx = 0; room.ball.vy = 0;
}

function checkGoal(room) {
  const b = room.ball;
  if (b.y >= GOAL_Y_MIN && b.y <= GOAL_Y_MAX) {
    if (b.x <= 0) { room.score.blue++; return 'blue'; }
    if (b.x >= FIELD.width) { room.score.red++; return 'red'; }
  }
  return null;
}

// --- Broadcasting ---

function round1(n) { return Math.round(n * 10) / 10; }

function buildGameState(room) {
  const players = [];
  for (const [id, p] of room.players) {
    players.push({ id, x: round1(p.disc.x), y: round1(p.disc.y), team: p.team, name: p.name, kick: p.input.kick, stamina: Math.round(p.stamina) });
  }
  return {
    players,
    ball: { x: round1(room.ball.x), y: round1(room.ball.y) },
    score: { red: room.score.red, blue: room.score.blue },
    time: room.matchTime,
    phase: room.phase,
  };
}

function broadcastGameState(room) {
  io.to(room.id).emit('state', buildGameState(room));
}

function getRoomsList() {
  const list = [];
  for (const [, room] of rooms) {
    let redCount = 0, blueCount = 0;
    for (const p of room.players.values()) {
      if (p.team === 'red') redCount++; else blueCount++;
    }
    list.push({
      id: room.id,
      name: room.name,
      playerCount: room.players.size,
      maxPlayers: room.maxPlayers,
      phase: room.phase,
      redCount,
      blueCount,
    });
  }
  return list;
}

function broadcastRoomsList() {
  io.emit('roomsUpdated', { rooms: getRoomsList(), totalPlayers: io.engine.clientsCount });
}

// --- Match lifecycle (per room) ---

function startMatch(room) {
  if (room.loopInterval) return;
  room.phase = 'playing';
  room.score = { red: 0, blue: 0 };
  room.matchTime = MATCH_DURATION;
  room.tickCount = 0;
  room.goalPauseTicks = 0;
  room.ball = createBall();
  resetPositions(room);

  room.loopInterval = setInterval(() => gameTick(room), 1000 / TICK_RATE);
  broadcastRoomsList();
  console.log(`[${room.id}] Match started!`);
}

function stopMatch(room) {
  if (room.loopInterval) { clearInterval(room.loopInterval); room.loopInterval = null; }
  room.phase = 'ended';
  broadcastGameState(room);
  broadcastRoomsList();
  console.log(`[${room.id}] Match ended! Red ${room.score.red} - ${room.score.blue} Blue`);

  room.restartTimeout = setTimeout(() => {
    room.restartTimeout = null;
    if (!rooms.has(room.id)) return;
    room.phase = 'waiting';
    room.ball = createBall();
    resetPositions(room);
    if (room.players.size >= 2) {
      startMatch(room);
    } else {
      broadcastGameState(room);
      broadcastRoomsList();
    }
  }, 5000);
}

function gameTick(room) {
  if (room.phase !== 'playing') return;

  if (room.goalPauseTicks > 0) {
    room.goalPauseTicks--;
    room.tickCount++;
    if (room.tickCount % TICK_RATE === 0) {
      room.matchTime--;
      if (room.matchTime <= 0) { stopMatch(room); return; }
    }
    broadcastGameState(room);
    return;
  }

  for (const p of room.players.values()) {
    const isMoving = p.input.up || p.input.down || p.input.left || p.input.right;
    const wantsSprint = p.input.sprint && isMoving;

    if (wantsSprint && !p.sprintLocked) {
      p.stamina = Math.max(0, p.stamina - 15 / TICK_RATE);
      if (p.stamina <= 0) { p.stamina = 0; p.sprintLocked = true; }
    } else {
      p.stamina = Math.min(100, p.stamina + 8 / TICK_RATE);
      if (p.sprintLocked && p.stamina >= 20) p.sprintLocked = false;
    }

    const sprintActive = wantsSprint && !p.sprintLocked && p.stamina > 0;

    p.disc.input.up    = p.input.up;
    p.disc.input.down  = p.input.down;
    p.disc.input.left  = p.input.left;
    p.disc.input.right = p.input.right;
    p.disc.input.kick  = p.input.kick;
    p.disc.input.sprintActive = sprintActive;
  }

  const physicsPlayers = [];
  for (const p of room.players.values()) physicsPlayers.push(p.disc);
  stepPhysics({ players: physicsPlayers, ball: room.ball });

  const scoringTeam = checkGoal(room);
  if (scoringTeam) {
    resetPositions(room);
    room.goalPauseTicks = GOAL_PAUSE_TICKS;
    io.to(room.id).emit('goalScored', { team: scoringTeam, score: { ...room.score } });
  }

  room.tickCount++;
  if (room.tickCount % TICK_RATE === 0) {
    room.matchTime--;
    if (room.matchTime <= 0) { stopMatch(room); return; }
  }

  broadcastGameState(room);
}

// --- Add / remove player ---

function addPlayerToRoom(socket, room, playerName) {
  const assignment = assignTeam(room);
  if (!assignment) return { error: 'Room is full' };

  const { team, index } = assignment;
  const spawn = getSpawn(team, index);

  room.players.set(socket.id, {
    disc: createPlayerDisc(spawn),
    name: playerName || 'Player',
    team,
    spawnIndex: index,
    input: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
    stamina: 100,
    sprintLocked: false,
  });

  socket.join(room.id);
  socketRoom.set(socket.id, room.id);

  console.log(`[${room.id}] ${playerName} joined ${team} (${room.players.size}/${room.maxPlayers})`);

  if (room.players.size >= 2 && room.phase === 'waiting') {
    startMatch(room);
  } else {
    broadcastGameState(room);
  }
  broadcastRoomsList();
  return { roomId: room.id, team };
}

function removePlayerFromRoom(socket) {
  const roomId = socketRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  socketRoom.delete(socket.id);
  socket.leave(roomId);

  if (!room) return;

  const player = room.players.get(socket.id);
  if (player) {
    console.log(`[${roomId}] ${player.name} left (${room.players.size - 1} remaining)`);
    room.players.delete(socket.id);
  }

  if (room.players.size === 0) {
    deleteRoom(roomId);
  } else if (room.players.size < 2 && room.phase === 'playing') {
    if (room.loopInterval) { clearInterval(room.loopInterval); room.loopInterval = null; }
    room.phase = 'waiting';
    broadcastGameState(room);
  }
  broadcastRoomsList();
}

// --- HTTP ---

app.get('/', (_req, res) => {
  res.json({ status: 'ok', game: 'KickRush' });
});

// --- Socket.io ---

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('getRooms', (cb) => {
    if (typeof cb === 'function') cb({ rooms: getRoomsList(), totalPlayers: io.engine.clientsCount });
  });

  socket.on('createRoom', ({ roomName, playerName }, cb) => {
    removePlayerFromRoom(socket);
    const room = createNewRoom(roomName);
    const result = addPlayerToRoom(socket, room, playerName);
    if (typeof cb === 'function') {
      cb(result.error ? { error: result.error } : { roomId: room.id });
    }
  });

  socket.on('joinRoom', ({ roomId, playerName }, cb) => {
    removePlayerFromRoom(socket);
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof cb === 'function') cb({ error: 'Room not found' });
      return;
    }
    if (room.players.size >= room.maxPlayers) {
      if (typeof cb === 'function') cb({ error: 'Room is full' });
      return;
    }
    const result = addPlayerToRoom(socket, room, playerName);
    if (typeof cb === 'function') {
      cb(result.error ? { error: result.error } : { roomId: room.id });
    }
  });

  socket.on('leaveRoom', () => {
    removePlayerFromRoom(socket);
  });

  socket.on('getState', (cb) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (typeof cb === 'function') cb(buildGameState(room));
  });

  socket.on('input', (data) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    player.input.up     = !!data.up;
    player.input.down   = !!data.down;
    player.input.left   = !!data.left;
    player.input.right  = !!data.right;
    player.input.kick   = !!data.kick;
    player.input.sprint = !!data.sprint;
  });

  socket.on('restartRoom', () => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'ended') return;
    if (room.restartTimeout) { clearTimeout(room.restartTimeout); room.restartTimeout = null; }
    room.score = { red: 0, blue: 0 };
    room.matchTime = MATCH_DURATION;
    room.phase = 'waiting';
    room.ball = createBall();
    resetPositions(room);
    if (room.players.size >= 2) {
      startMatch(room);
    } else {
      broadcastGameState(room);
      broadcastRoomsList();
    }
  });

  socket.on('disconnect', () => {
    removePlayerFromRoom(socket);
    console.log('Disconnected:', socket.id);
  });
});

// --- Start ---

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`KickRush server listening on port ${PORT}`);
});

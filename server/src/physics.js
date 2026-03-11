// KickRush Physics Engine — Pure JS, no DOM dependencies
// Can run in both browser and Node.js

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// --- Field ---
export const FIELD = {
  width: 1050,
  height: 680,
  goalHeight: 120,
  goalDepth: 30,
};

// --- Disc properties ---
export const PLAYER_PROPS = {
  radius: 15,
  invMass: 0.5,
  damping: 0.96,
  bCoef: 0.5,
  accel: 0.1,
  kickingAccel: 0.07,
  kickStrength: 5,
};

export const BALL_PROPS = {
  radius: 10,
  invMass: 1,
  damping: 0.99,
  bCoef: 0.5,
};

// --- Derived constants ---
const GOAL_Y_MIN = (FIELD.height - FIELD.goalHeight) / 2; // 280
const GOAL_Y_MAX = (FIELD.height + FIELD.goalHeight) / 2; // 400

// Wall segments: line segments the discs bounce off
// Defined as {x1, y1, x2, y2}
const WALLS = [
  // Top wall
  { x1: 0, y1: 0, x2: FIELD.width, y2: 0 },
  // Bottom wall
  { x1: 0, y1: FIELD.height, x2: FIELD.width, y2: FIELD.height },

  // Left side (with goal opening between GOAL_Y_MIN and GOAL_Y_MAX)
  { x1: 0, y1: 0, x2: 0, y2: GOAL_Y_MIN },
  { x1: 0, y1: GOAL_Y_MAX, x2: 0, y2: FIELD.height },

  // Right side (with goal opening)
  { x1: FIELD.width, y1: 0, x2: FIELD.width, y2: GOAL_Y_MIN },
  { x1: FIELD.width, y1: GOAL_Y_MAX, x2: FIELD.width, y2: FIELD.height },

  // Left goal box
  { x1: -FIELD.goalDepth, y1: GOAL_Y_MIN, x2: 0, y2: GOAL_Y_MIN },              // top
  { x1: -FIELD.goalDepth, y1: GOAL_Y_MAX, x2: 0, y2: GOAL_Y_MAX },              // bottom
  { x1: -FIELD.goalDepth, y1: GOAL_Y_MIN, x2: -FIELD.goalDepth, y2: GOAL_Y_MAX }, // back

  // Right goal box
  { x1: FIELD.width, y1: GOAL_Y_MIN, x2: FIELD.width + FIELD.goalDepth, y2: GOAL_Y_MIN },              // top
  { x1: FIELD.width, y1: GOAL_Y_MAX, x2: FIELD.width + FIELD.goalDepth, y2: GOAL_Y_MAX },              // bottom
  { x1: FIELD.width + FIELD.goalDepth, y1: GOAL_Y_MIN, x2: FIELD.width + FIELD.goalDepth, y2: GOAL_Y_MAX }, // back
];

// --- Factory functions ---

function createDisc(x, y, props) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    radius: props.radius,
    invMass: props.invMass,
    damping: props.damping,
    bCoef: props.bCoef,
  };
}

export function createGameState(playerName) {
  const player = {
    ...createDisc(FIELD.width * 0.25, FIELD.height / 2, PLAYER_PROPS),
    name: playerName,
    team: 'red',
    input: { up: false, down: false, left: false, right: false, kick: false },
  };

  const ball = createDisc(FIELD.width / 2, FIELD.height / 2, BALL_PROPS);

  return {
    players: [player],
    ball,
  };
}

// --- Collision helpers ---

function closestPointOnSegment(cx, cy, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1 };
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

function resolveDiscWall(disc, wall) {
  const cp = closestPointOnSegment(disc.x, disc.y, wall.x1, wall.y1, wall.x2, wall.y2);
  const dx = disc.x - cp.x;
  const dy = disc.y - cp.y;
  const distSq = dx * dx + dy * dy;
  const r = disc.radius;

  if (distSq === 0 || distSq >= r * r) return;

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;

  // Separate disc from wall
  disc.x += nx * (r - dist);
  disc.y += ny * (r - dist);

  // Bounce: reflect velocity along normal, scaled by bCoef
  const vn = disc.vx * nx + disc.vy * ny;
  if (vn < 0) {
    disc.vx -= (1 + disc.bCoef) * vn * nx;
    disc.vy -= (1 + disc.bCoef) * vn * ny;
  }
}

function resolveDiscDisc(a, b, kick) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.radius + b.radius;

  if (distSq === 0 || distSq >= minDist * minDist) return;

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  // Separate proportionally by inverse mass
  const totalInvMass = a.invMass + b.invMass;
  a.x -= nx * overlap * (a.invMass / totalInvMass);
  a.y -= ny * overlap * (a.invMass / totalInvMass);
  b.x += nx * overlap * (b.invMass / totalInvMass);
  b.y += ny * overlap * (b.invMass / totalInvMass);

  // Relative velocity along collision normal
  const relVn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;

  if (relVn < 0) {
    // Combined bounce coefficient (average of both)
    const bCoef = (a.bCoef + b.bCoef) / 2;
    const impulse = -(1 + bCoef) * relVn / totalInvMass;

    a.vx -= impulse * a.invMass * nx;
    a.vy -= impulse * a.invMass * ny;
    b.vx += impulse * b.invMass * nx;
    b.vy += impulse * b.invMass * ny;
  }

  // Kick impulse: extra push applied to ball when player is kicking
  if (kick) {
    b.vx += nx * PLAYER_PROPS.kickStrength * b.invMass;
    b.vy += ny * PLAYER_PROPS.kickStrength * b.invMass;
  }
}

// --- Main physics step ---

export function stepPhysics(state) {
  const { players, ball } = state;

  // 1. Apply player input acceleration
  for (const p of players) {
    const baseAccel = p.input.kick ? PLAYER_PROPS.kickingAccel : PLAYER_PROPS.accel;
    const accel = p.input.sprintActive ? baseAccel * 1.4 : baseAccel;
    if (p.input.up) p.vy -= accel;
    if (p.input.down) p.vy += accel;
    if (p.input.left) p.vx -= accel;
    if (p.input.right) p.vx += accel;
  }

  // 2. Apply damping
  for (const p of players) {
    p.vx *= p.damping;
    p.vy *= p.damping;
  }
  ball.vx *= ball.damping;
  ball.vy *= ball.damping;

  // 3. Integrate positions
  for (const p of players) {
    p.x += p.vx;
    p.y += p.vy;
  }
  ball.x += ball.vx;
  ball.y += ball.vy;

  // 4. Resolve disc–disc collisions
  for (const p of players) {
    resolveDiscDisc(p, ball, p.input.kick);
  }
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      resolveDiscDisc(players[i], players[j], false);
    }
  }

  // 5. Resolve disc–wall collisions
  for (const p of players) {
    for (const w of WALLS) {
      resolveDiscWall(p, w);
    }
  }
  for (const w of WALLS) {
    resolveDiscWall(ball, w);
  }
}

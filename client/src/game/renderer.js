import { FIELD, PLAYER_PROPS, BALL_PROPS } from './physics.js';

const GOAL_Y_MIN = (FIELD.height - FIELD.goalHeight) / 2;
const GOAL_Y_MAX = (FIELD.height + FIELD.goalHeight) / 2;
const CENTER_CIRCLE_R = 80;
const CORNER_ARC_R = 30;

const COLORS = {
  bg: '#0f0f0f',
  grassA: '#2a5225',
  grassB: '#2d5a27',
  lines: '#4a8f42',
  goalFill: 'rgba(255, 255, 255, 0.06)',
  goalLine: '#ffffff',
  ball: '#ffffff',
  ballOutline: '#888888',
  red: '#e74c3c',
  blue: '#3498db',
  playerBorder: '#ffffff',
  text: '#ffffff',
  amber: '#f59e0b',
};

const PAD = 40;
const VIEW_X = -FIELD.goalDepth - PAD;
const VIEW_Y = -PAD;
const VIEW_W = FIELD.width + 2 * FIELD.goalDepth + 2 * PAD;
const VIEW_H = FIELD.height + 2 * PAD;

const FONT = 'Inter, system-ui, sans-serif';
const STRIPE_WIDTH = 70;

// Goal post positions (4 posts)
const GOAL_POSTS = [
  { x: 0, y: GOAL_Y_MIN },
  { x: 0, y: GOAL_Y_MAX },
  { x: FIELD.width, y: GOAL_Y_MIN },
  { x: FIELD.width, y: GOAL_Y_MAX },
];

export function createRenderer() {

  // opts: { localPlayerId, celebration, muted }
  function render(ctx, state, canvasW, canvasH, opts = {}) {
    const { localPlayerId, celebration } = opts;
    const scale = Math.min(canvasW / VIEW_W, canvasH / VIEW_H);
    const offsetX = (canvasW - VIEW_W * scale) / 2 - VIEW_X * scale;
    const offsetY = (canvasH - VIEW_H * scale) / 2 - VIEW_Y * scale;

    ctx.save();

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Transform into game-world coordinates
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // --- Grass stripes ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();
    for (let sx = 0; sx < FIELD.width; sx += STRIPE_WIDTH) {
      const stripeIndex = Math.floor(sx / STRIPE_WIDTH);
      ctx.fillStyle = stripeIndex % 2 === 0 ? COLORS.grassA : COLORS.grassB;
      ctx.fillRect(sx, 0, STRIPE_WIDTH, FIELD.height);
    }
    ctx.restore();

    ctx.strokeStyle = COLORS.lines;
    ctx.lineWidth = 2;

    // Pitch outline
    ctx.strokeRect(0, 0, FIELD.width, FIELD.height);

    // Centre line
    ctx.beginPath();
    ctx.moveTo(FIELD.width / 2, 0);
    ctx.lineTo(FIELD.width / 2, FIELD.height);
    ctx.stroke();

    // Centre circle
    ctx.beginPath();
    ctx.arc(FIELD.width / 2, FIELD.height / 2, CENTER_CIRCLE_R, 0, Math.PI * 2);
    ctx.stroke();

    // Centre dot
    ctx.fillStyle = COLORS.lines;
    ctx.beginPath();
    ctx.arc(FIELD.width / 2, FIELD.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // --- Corner arcs ---
    ctx.beginPath();
    ctx.arc(0, 0, CORNER_ARC_R, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD.width, 0, CORNER_ARC_R, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(FIELD.width, FIELD.height, CORNER_ARC_R, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, FIELD.height, CORNER_ARC_R, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();

    // --- Penalty spots ---
    ctx.fillStyle = COLORS.lines;
    ctx.beginPath();
    ctx.arc(150, 340, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(900, 340, 3, 0, Math.PI * 2);
    ctx.fill();

    // --- Goals ---
    drawGoal(ctx, -FIELD.goalDepth, GOAL_Y_MIN, FIELD.goalDepth, FIELD.goalHeight, 'left');
    drawGoal(ctx, FIELD.width, GOAL_Y_MIN, FIELD.goalDepth, FIELD.goalHeight, 'right');

    // --- Goal posts ---
    for (const post of GOAL_POSTS) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(post.x, post.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Ball ---
    const ball = state.ball;
    const ballR = ball.radius || BALL_PROPS.radius;
    ctx.fillStyle = COLORS.ball;
    ctx.strokeStyle = COLORS.ballOutline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // --- Players ---
    for (const p of state.players) {
      const pR = p.radius || PLAYER_PROPS.radius;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + pR * 0.6, pR * 0.9, pR * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Kick ring (amber, when kick is active)
      if (p.kick) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Player disc
      ctx.fillStyle = p.team === 'red' ? COLORS.red : COLORS.blue;
      ctx.strokeStyle = COLORS.playerBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Name label with pill background
      const name = p.name || '';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const nameW = ctx.measureText(name).width;
      const pillW = nameW + 10;
      const pillH = 15;
      const pillX = p.x - pillW / 2;
      const pillY = p.y - pR - 8 - pillH;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      roundRect(ctx, pillX, pillY, pillW, pillH, 4);
      ctx.fill();

      ctx.fillStyle = COLORS.text;
      ctx.fillText(name, p.x, p.y - pR - 9);

      // Local player indicator (amber dot below) + stamina bar
      if (localPlayerId && p.id === localPlayerId) {
        ctx.fillStyle = COLORS.amber;
        ctx.beginPath();
        ctx.arc(p.x, p.y + pR + 8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Stamina bar (only when below 100)
        if (p.stamina != null && p.stamina < 100) {
          const barW = 30;
          const barH = 4;
          const barX = p.x - barW / 2;
          const barY = p.y + pR + 14;
          const fill = p.stamina / 100;

          // Dark background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(barX, barY, barW, barH);

          // Fill: amber when healthy, red below 25%
          ctx.fillStyle = p.stamina < 25 ? '#ef4444' : COLORS.amber;
          ctx.fillRect(barX, barY, barW * fill, barH);
        }
      }
    }

    ctx.restore();
    // ── Everything below is drawn in screen (pixel) coordinates ──

    // --- HUD bar ---
    if (state.score !== undefined) {
      drawHUD(ctx, state, canvasW, opts);
    }

    // --- Phase overlay messages (waiting only — ended handled by React PostMatch) ---
    if (state.phase === 'waiting') {
      drawPhaseMessage(ctx, canvasW, canvasH);
    }

    // --- Goal celebration overlay ---
    if (celebration) {
      drawGoalCelebration(ctx, celebration, canvasW, canvasH);
    }
  }

  // ── HUD ──

  function drawHUD(ctx, state, canvasW, opts = {}) {
    const barH = 44;
    const cx = canvasW / 2;
    const midY = barH / 2;

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvasW, barH);

    // Team colour accent bars (4px)
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(0, barH - 4, canvasW / 2, 4);
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(canvasW / 2, barH - 4, canvasW / 2, 4);

    // Player avatar circles (small team-coloured dots)
    const redPlayers = state.players.filter(p => p.team === 'red');
    const bluePlayers = state.players.filter(p => p.team === 'blue');

    for (let i = 0; i < redPlayers.length; i++) {
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(cx - 90 - i * 18, midY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < bluePlayers.length; i++) {
      ctx.fillStyle = COLORS.blue;
      ctx.beginPath();
      ctx.arc(cx + 90 + i * 18, midY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red score (left of centre)
    ctx.fillStyle = COLORS.red;
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(state.score.red), cx - 50, midY);

    // Divider dash
    ctx.fillStyle = '#666666';
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('\u2013', cx, midY);

    // Blue score (right of centre)
    ctx.fillStyle = COLORS.blue;
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(String(state.score.blue), cx + 50, midY);

    // Timer (right edge of bar)
    const time = state.time != null ? state.time : 0;
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

    // Timer colour: amber under 30s, red under 10s
    if (time <= 10) {
      ctx.fillStyle = COLORS.red;
    } else if (time <= 30) {
      ctx.fillStyle = COLORS.amber;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, canvasW - 20, midY);

    // ESC hint (left edge of bar)
    ctx.fillStyle = '#666666';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('ESC to leave', 20, midY);
  }

  // ── Phase messages (waiting only) ──

  function drawPhaseMessage(ctx, canvasW, canvasH) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 36px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for players\u2026', canvasW / 2, canvasH / 2);
  }

  // ── Goal celebration overlay ──

  function drawGoalCelebration(ctx, celebration, canvasW, canvasH) {
    const elapsed = (performance.now() - celebration.startTime) / 1000;
    const pulse = 1 + 0.08 * Math.sin(elapsed * 6);

    // Semi-transparent dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(pulse, pulse);

    // Team text
    const teamName = celebration.team === 'red' ? 'RED' : 'BLUE';
    const teamColor = celebration.team === 'red' ? COLORS.red : COLORS.blue;

    ctx.fillStyle = teamColor;
    ctx.font = `bold 52px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${teamName} SCORES!`, 0, -20);

    // Score below
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 32px ${FONT}`;
    ctx.fillText(`${celebration.score.red} \u2013 ${celebration.score.blue}`, 0, 30);

    ctx.restore();
  }

  // ── Goal drawing helper ──

  function drawGoal(ctx, x, y, w, h, side) {
    ctx.fillStyle = COLORS.goalFill;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = COLORS.goalLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (side === 'left') {
      ctx.moveTo(0, GOAL_Y_MIN);
      ctx.lineTo(x, GOAL_Y_MIN);
      ctx.lineTo(x, GOAL_Y_MAX);
      ctx.lineTo(0, GOAL_Y_MAX);
    } else {
      ctx.moveTo(FIELD.width, GOAL_Y_MIN);
      ctx.lineTo(x + w, GOAL_Y_MIN);
      ctx.lineTo(x + w, GOAL_Y_MAX);
      ctx.lineTo(FIELD.width, GOAL_Y_MAX);
    }
    ctx.stroke();
  }

  // ── Rounded rect helper ──

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return { render };
}

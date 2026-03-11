# Phase 4 Implementation Plan — Polish & Feel

## Overview
Phase 4 is a visual/audio polish pass. No new gameplay mechanics. We touch 8 files (rewrite 2, create 2, update 4).

---

## Step 1 — Server: new events + data enrichment

**File: `server/index.js`**

Changes:
1. **Emit `goalScored` event** — In `gameTick()`, when `checkGoal()` returns true, emit a new `goalScored` event to the room BEFORE resetting positions. Payload: `{ team: 'red'|'blue', score: { red, blue } }`. This gives clients a reliable signal for the celebration overlay.

2. **Add `restartRoom` socket event** — New handler: resets `room.score` to 0-0, `room.matchTime` to `MATCH_DURATION`, `room.phase` to `'waiting'`, clears any `restartTimeout`, resets ball and player positions. If 2+ players, calls `startMatch()`. Broadcasts state + rooms list immediately.

3. **Enrich `buildGameState`** — Add `kick: !!p.input.kick` to each player in the broadcast state so the client knows who is currently kicking (for the amber kick ring).

4. **Enrich `getRoomsList`** — Add `redCount` and `blueCount` per room, and add a `totalPlayers` field to the `roomsUpdated` emission (total connected sockets across all rooms).

5. **Cancel auto-restart timeout** — When `restartRoom` is received, clear the existing 5-second `restartTimeout` so the manual restart takes priority.

---

## Step 2 — New file: `client/src/game/audio.js`

Create a synthesized sound module using Web Audio API:

- `createAudioManager()` factory returning `{ wallHit(), kick(), goal(), tick(), setMuted(bool), isMuted(), init() }`
- **Lazy AudioContext**: created on first call to `init()`, which is triggered by the first user click/keypress (a one-time global listener)
- **wallHit()**: 440Hz sine oscillator, 30ms, quick gain decay
- **kick()**: 180Hz sine oscillator, 50ms, quick gain decay
- **goal()**: Three ascending notes 220→330→440Hz, 120ms each, sine wave, sequenced with setTimeout
- **tick()**: 880Hz sine oscillator, 20ms, very short blip
- **Mute state**: When muted, all play functions return immediately without creating oscillators

---

## Step 3 — Full rewrite: `client/src/game/renderer.js`

This is the biggest file change. Rewrite `createRenderer()` to accept config and expose a richer API:

### Pitch improvements:
- **Grass stripes**: Before drawing the solid green fill, draw alternating vertical stripes (70 game-units wide) alternating between `#2a5225` and `#2d5a27`
- **Corner arcs**: Quarter circles at all 4 corners, radius 30, same `COLORS.lines` stroke
- **Center circle**: Change radius from 80 → 70
- **Penalty spots**: Filled white circles (radius 3) at (150, 340) and (900, 340)
- **Goal posts**: Thick white filled circles (radius 6) at the 4 goal post positions:
  - Left goal: (0, GOAL_Y_MIN) and (0, GOAL_Y_MAX)
  - Right goal: (FIELD.width, GOAL_Y_MIN) and (FIELD.width, GOAL_Y_MAX)

### Player rendering:
- **Drop shadow**: Draw a slightly larger (radius + 3) dark circle (rgba 0,0,0,0.3) offset by (2, 3) behind each player
- **Thicker border**: lineWidth 3 (was 2)
- **Kick ring**: When `player.kick === true`, draw an amber ring (`rgba(245, 158, 11, 0.7)`) at radius 20, 2px stroke
- **Name pill**: Instead of raw text, measure text width, draw a rounded rect background (`rgba(0,0,0,0.5)`) behind the name, 11px font
- **Local player indicator**: If `player.id === localPlayerId`, draw a small amber dot (radius 3) below the player circle

### Goal celebration overlay:
- `render()` now accepts additional params: `goalCelebration` object `{ team, score, startTime }` or null
- When active: draw full-screen overlay (rgba 0,0,0,0.6), team-colored "RED SCORES!" / "BLUE SCORES!" text with pulsing scale (sine wave on `Date.now() - startTime`), score below in white
- Drawn in screen coordinates after ctx.restore()

### HUD improvements:
- Bar height stays 44px, backdrop slightly darker (rgba 0,0,0,0.8)
- **Team accent bars**: 4px vertical red stripe on far left, 4px blue stripe on far right of the HUD bar
- **Score font**: 24px bold (was 22px)
- **Player avatars**: Small colored circles (radius 8) with first letter of name, positioned on the HUD bar — red team avatars cluster left of center score, blue team right of center score
- **Timer color**: white normally, amber (#f59e0b) when ≤30s, red (#ef4444) when ≤10s
- **Mute button**: Draw a small speaker icon (simple lines) in the top-right area of the HUD, clickable area tracked for toggle
- **ESC hint**: Keep existing "ESC to leave" on the left

### API change:
```js
createRenderer() returns {
  render(ctx, state, canvasW, canvasH, { localPlayerId, goalCelebration, muted }),
  getMuteButtonBounds() // returns { x, y, w, h } for click detection
}
```

---

## Step 4 — New file: `client/src/components/PostMatch.jsx`

React component overlaid on the canvas:

```jsx
<PostMatch
  score={score}
  players={players}
  onPlayAgain={() => socket.emit('restartRoom')}
  onBackToLobby={onLeave}
/>
```

- Absolutely positioned over the canvas (position: absolute, inset: 0)
- Dark background (#0f0f0f with 95% opacity)
- CSS fade-in: opacity 0→1 over 400ms using CSS transition (triggered by mounting with a useEffect to flip a `visible` state)
- Final score in large text (48px bold)
- "Red Wins" / "Blue Wins" / "Draw" in team color
- Player list grouped by team (red players on left, blue on right)
- "Play Again" button (amber, prominent)
- "Back to Lobby" button (muted/outline style)

---

## Step 5 — Rewrite: `client/src/components/Game.jsx`

Major changes:

1. **Wrapper div**: Canvas now inside a `<div style={{ position: 'relative', width: '100vw', height: '100vh' }}>` so PostMatch can overlay
2. **Goal celebration state**: Listen for `goalScored` socket event → set `goalCelebration = { team, score, startTime: Date.now() }`. Clear it when next `state` event has `phase === 'playing'` and `goalPauseTicks` has expired (or simply when phase transitions back to playing)
3. **Post-match state**: When `serverState.phase === 'ended'`, show the `<PostMatch>` component overlaid on canvas
4. **Audio integration**: Create audio manager, init on first keypress/click, trigger sounds based on state changes:
   - `wallHit`: detect from velocity changes in ball state (heuristic: ball velocity direction reversed between frames)
   - `kick`: detect when any player's kick becomes true
   - `goal`: triggered by `goalScored` event
   - `tick`: triggered when `state.time <= 10` and time decrements
5. **Mute toggle**: Track muted state, pass to renderer, handle canvas click on mute button bounds
6. **Local player ID**: Pass `socket.id` to renderer as `localPlayerId`
7. **Restart handling**: Listen for `restartRoom` ack or phase change from `ended` → `waiting`/`playing` to clear post-match overlay

---

## Step 6 — Update: `client/src/components/RoomBrowser.jsx`

1. **Total player count**: Accept `totalPlayers` from `roomsUpdated` events, show "X players online" badge in top-right corner
2. **Empty state SVG**: Replace the plain text "No rooms yet" with a simple inline SVG football icon + richer muted text
3. **Team counts on room cards**: Show small red/blue circles with counts instead of just "3/6"
4. **Auto-focus**: Already implemented ✓

---

## Step 7 — Update: `client/src/App.jsx`

1. Track `totalPlayers` count from roomsUpdated events (listen at App level, pass down to RoomBrowser)
2. Pass `onPlayAgain` callback that emits `restartRoom` and keeps the game screen

---

## Execution Order

1. Server changes (Step 1) — foundation for everything
2. Audio module (Step 2) — standalone, no deps
3. Renderer rewrite (Step 3) — biggest file, all canvas work
4. PostMatch component (Step 4) — standalone React component
5. Game.jsx rewrite (Step 5) — integrates renderer, audio, PostMatch, server events
6. RoomBrowser update (Step 6) — UI polish
7. App.jsx update (Step 7) — wire up new props
8. Verify end-to-end

## Files touched:
- `server/index.js` — modify
- `client/src/game/audio.js` — **create**
- `client/src/game/renderer.js` — **full rewrite**
- `client/src/components/PostMatch.jsx` — **create**
- `client/src/components/Game.jsx` — **full rewrite**
- `client/src/components/RoomBrowser.jsx` — modify
- `client/src/App.jsx` — modify

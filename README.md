# KickRush

Haxball-style multiplayer browser football game.

## Project Structure

```
kickrush/
  server/    — Node.js + Express + Socket.io (authoritative game server)
  client/    — React + Vite + Tailwind (renderer + lobby)
```

## Local Development

Run both the server and client simultaneously in **two terminals**:

### Terminal 1 — Server

```bash
cd server
npm install
npm run dev
```

The server runs on **http://localhost:3001** and hosts the authoritative physics
simulation at 60 Hz. Uses nodemon for auto-restart on file changes.

### Terminal 2 — Client

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5174** in two (or more) browser tabs, enter different
names, and click **Play**. The match starts automatically when 2+ players join.

## Deployment

### Step 1 — Push to GitHub

Push the full monorepo to GitHub under **OddSlice**:

```bash
git remote add origin https://github.com/OddSlice/kickrush.git
git push -u origin main
```

### Step 2 — Deploy the Server to Railway

1. Go to [Railway](https://railway.app) and create a new project.
2. Select the GitHub repo (`OddSlice/kickrush`).
3. Set the **Root Directory** to `server/`.
4. Add the environment variable:
   - `CLIENT_ORIGIN` = `https://your-vercel-app.vercel.app` (fill in after Vercel deploy in Step 3)
5. Railway will detect the `railway.json` config and deploy automatically.
6. Copy the Railway public URL (e.g. `https://kickrush-production.up.railway.app`).

### Step 3 — Deploy the Client to Vercel

1. Go to [Vercel](https://vercel.com) and import the same GitHub repo.
2. Set the **Root Directory** to `client/`.
3. Add the environment variable:
   - `VITE_SERVER_URL` = the Railway URL from Step 2 (e.g. `https://kickrush-production.up.railway.app`)
4. Vercel will build the Vite app and deploy it. Copy the Vercel URL.

### Step 4 — Update Environment Variables

Now that both URLs are known:

1. **Railway**: Set `CLIENT_ORIGIN` to the Vercel URL from Step 3.
2. **Vercel**: Confirm `VITE_SERVER_URL` is set to the Railway URL from Step 2.
3. Redeploy both services so the CORS and connection variables take effect.

## How It Works

| Layer | Responsibility |
| --- | --- |
| **Server** | Runs physics at 60 Hz, owns all game state, broadcasts to clients |
| **Client** | Sends keyboard input, renders the state it receives — no local physics |

The physics engine (`client/src/game/physics.js` = `server/src/physics.js`) is a
pure JS module with zero browser dependencies, shared between both sides.

## Controls

| Key | Action |
| --- | --- |
| W / Arrow Up | Move up |
| A / Arrow Left | Move left |
| S / Arrow Down | Move down |
| D / Arrow Right | Move right |
| Space (hold) | Kick mode — slightly slower movement, kicks ball on contact |
| Shift (hold) | Sprint — 40% faster, drains stamina bar |

## Match Rules

- **3 v 3** (up to 6 players, auto-assigned red / blue in join order)
- **3-minute** matches
- **Goal** = ball centre crosses the goal line within the goal mouth
- **3-second pause** after each goal, then positions reset
- Match auto-restarts 5 seconds after the timer expires

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` (server) | `3001` | Server listen port |
| `CLIENT_ORIGIN` (server) | `http://localhost:5174` | Allowed CORS origin(s), comma-separated |
| `VITE_SERVER_URL` (client) | `http://localhost:3001` | Socket.io server URL |

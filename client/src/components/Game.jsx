import { useEffect, useRef, useState, useCallback } from 'react';
import { createRenderer } from '../game/renderer.js';
import { createInputHandler } from '../game/input.js';
import { createAudioManager } from '../game/audio.js';
import PostMatch from './PostMatch.jsx';

export default function Game({ socket, playerName, roomId, onLeave, onPlayAgain }) {
  const canvasRef = useRef(null);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const onPlayAgainRef = useRef(onPlayAgain);
  onPlayAgainRef.current = onPlayAgain;

  const [muted, setMuted] = useState(false);
  const [postMatchState, setPostMatchState] = useState(null);

  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudioManager();

  const handleToggleMute = useCallback(() => {
    const nowMuted = audioRef.current.toggleMute();
    setMuted(nowMuted);
  }, []);

  const handlePlayAgain = useCallback(() => {
    socket.emit('restartRoom');
    setPostMatchState(null);
  }, [socket]);

  const handleLeave = useCallback(() => {
    onLeaveRef.current();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const audio = audioRef.current;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Unlock AudioContext on first interaction
    function unlockAudio() {
      audio.initOnInteraction();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    }
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    const renderer = createRenderer();
    const input = createInputHandler();

    let serverState = null;
    let lastSentInput = null;
    let celebration = null;
    let prevBall = null;
    let prevTime = null;
    let kickSoundCooldown = 0;

    function onState(state) {
      const prev = serverState;
      serverState = state;

      // Detect wall hits (ball near boundary when it wasn't before)
      if (prev && state.phase === 'playing' && !celebration) {
        const b = state.ball;
        const pb = prev.ball;
        const r = 11; // ball radius + 1
        const nearWall = b.y <= r || b.y >= 680 - r || b.x <= r || b.x >= 1050 - r;
        const wasNearWall = pb.y <= r || pb.y >= 680 - r || pb.x <= r || pb.x >= 1050 - r;
        if (nearWall && !wasNearWall) {
          audio.wallHit();
        }
      }

      // Detect kick sounds
      if (state.phase === 'playing' && kickSoundCooldown <= 0) {
        for (const p of state.players) {
          if (p.kick) {
            const dx = state.ball.x - p.x;
            const dy = state.ball.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 30) {
              audio.kick();
              kickSoundCooldown = 10; // frames cooldown
              break;
            }
          }
        }
      }
      if (kickSoundCooldown > 0) kickSoundCooldown--;

      // Timer tick sound (under 10 seconds, on each new second)
      if (state.time != null && state.time <= 10 && state.time > 0) {
        if (prevTime !== null && state.time < prevTime) {
          audio.tick();
        }
      }
      prevTime = state.time;

      // Show post-match overlay when phase becomes ended
      if (state.phase === 'ended') {
        setPostMatchState(state);
      } else if (state.phase === 'playing' || state.phase === 'waiting') {
        setPostMatchState(null);
      }
    }
    socket.on('state', onState);

    function onGoalScored({ team, score }) {
      celebration = { team, score, startTime: performance.now() };
      audio.goal();
      setTimeout(() => { celebration = null; }, 3000);
    }
    socket.on('goalScored', onGoalScored);

    // Request initial state
    socket.emit('getState', (state) => {
      if (state) {
        serverState = state;
        if (state.phase === 'ended') setPostMatchState(state);
      }
    });

    // Escape to leave
    function onKeyDown(e) {
      if (e.key === 'Escape') onLeaveRef.current();
    }
    window.addEventListener('keydown', onKeyDown);

    // --- Render loop ---
    let rafId = 0;

    function loop() {
      const keys = input.getState();
      if (
        !lastSentInput ||
        keys.up !== lastSentInput.up ||
        keys.down !== lastSentInput.down ||
        keys.left !== lastSentInput.left ||
        keys.right !== lastSentInput.right ||
        keys.kick !== lastSentInput.kick ||
        keys.sprint !== lastSentInput.sprint
      ) {
        socket.emit('input', {
          up: keys.up, down: keys.down,
          left: keys.left, right: keys.right,
          kick: keys.kick, sprint: keys.sprint,
        });
        lastSentInput = { ...keys };
      }

      if (serverState) {
        renderer.render(ctx, serverState, canvas.width, canvas.height, {
          localPlayerId: socket.id,
          celebration,
        });
      }

      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      input.destroy();
      socket.off('state', onState);
      socket.off('goalScored', onGoalScored);
    };
  }, [socket, roomId]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }} className="flex flex-col">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', flex: '1 1 0%', minHeight: 0 }}
      />

      {/* Powerup legend */}
      <div
        className="flex items-center justify-center gap-8 px-5 py-2.5 select-none shrink-0"
        style={{ background: '#1a1a1a', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
          <span className="text-[11px] font-bold text-white/85">Sprint Boost</span>
          <span className="text-[11px] text-slate-400">· Double speed for 6s</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
          <span className="text-[11px] font-bold text-white/85">Power Shot</span>
          <span className="text-[11px] text-slate-400">· Next kick is 3× stronger</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#3b82f6' }} />
          <span className="text-[11px] font-bold text-white/85">Shield</span>
          <span className="text-[11px] text-slate-400">· Absorbs one player collision</span>
        </div>
      </div>

      {/* Mute toggle button */}
      <button
        onClick={handleToggleMute}
        className="absolute top-[52px] right-3 bg-black/60 hover:bg-black/80
                   text-white/70 hover:text-white w-9 h-9 rounded-lg flex items-center
                   justify-center cursor-pointer transition-colors duration-200 select-none
                   border border-white/10"
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {/* Post-match overlay */}
      {postMatchState && (
        <PostMatch
          state={postMatchState}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

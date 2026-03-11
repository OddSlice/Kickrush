import { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';

export default function RoomBrowser({ socket, playerName, onJoinRoom, onChangeName, totalPlayers }) {
  const [rooms, setRooms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const modalInputRef = useRef(null);

  // Fetch initial list + subscribe to live updates
  useEffect(() => {
    socket.emit('getRooms', (data) => setRooms(data.rooms || []));

    function onRoomsUpdated(data) { setRooms(data.rooms || []); }
    socket.on('roomsUpdated', onRoomsUpdated);
    return () => socket.off('roomsUpdated', onRoomsUpdated);
  }, [socket]);

  // Auto-focus modal input
  useEffect(() => {
    if (showModal && modalInputRef.current) modalInputRef.current.focus();
  }, [showModal]);

  // Escape closes modal
  useEffect(() => {
    if (!showModal) return;
    function onKey(e) { if (e.key === 'Escape') setShowModal(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  function handleCreate(e) {
    e.preventDefault();
    const name = newRoomName.trim() || `${playerName}'s Room`;
    socket.emit('createRoom', { roomName: name, playerName }, (res) => {
      if (res?.roomId) {
        setShowModal(false);
        setNewRoomName('');
        onJoinRoom(res.roomId);
      }
    });
  }

  function handleJoin(roomId) {
    socket.emit('joinRoom', { roomId, playerName }, (res) => {
      if (!res?.error && res?.roomId) onJoinRoom(res.roomId);
    });
  }

  function isJoinable(room) {
    return room.playerCount < room.maxPlayers && room.phase !== 'ended';
  }

  function badgeFor(room) {
    if (room.playerCount >= room.maxPlayers) return { text: 'Full', cls: 'bg-gray-600/40 text-gray-400' };
    if (room.phase === 'ended') return { text: 'Ended', cls: 'bg-gray-600/40 text-gray-400' };
    if (room.phase === 'playing') return { text: 'Playing', cls: 'bg-amber-500/20 text-amber-400' };
    return { text: 'Waiting', cls: 'bg-green-500/20 text-green-400' };
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center select-none">
      {/* Header */}
      <div className="w-full max-w-lg px-4 pt-8 pb-2 flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Playing as <span className="text-white font-medium">{playerName}</span>
          <button
            type="button"
            onClick={onChangeName}
            className="ml-2 text-amber-500 hover:text-amber-400 cursor-pointer
                       transition-colors duration-200 underline underline-offset-2"
          >
            Change name
          </button>
        </p>
        {totalPlayers > 0 && (
          <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full tabular-nums">
            {totalPlayers} online
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mt-4 mb-8 tracking-tight">KickRush</h1>

      {/* Actions */}
      <div className="w-full max-w-lg px-4 flex flex-col gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold
                     px-4 py-3.5 rounded-lg cursor-pointer
                     transition-colors duration-200 text-center"
        >
          Create Room
        </button>

        <button
          disabled
          className="flex items-center justify-center gap-2
                     bg-slate-800/60 text-slate-500 font-medium
                     px-4 py-3.5 rounded-lg opacity-50 cursor-default"
        >
          <Lock size={16} />
          Ranked Queue &mdash; Coming Soon
        </button>
      </div>

      {/* Room list */}
      <div className="w-full max-w-lg px-4 mt-8">
        <h2 className="text-gray-500 text-xs uppercase tracking-widest mb-3 font-medium">
          Open Rooms
        </h2>

        {rooms.length === 0 && (
          <div className="flex flex-col items-center py-10 gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-gray-700">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2"/>
              <path d="M24 4a20 20 0 0 1 0 40M24 4a20 20 0 0 0 0 40M4 24h40M24 4c5.5 5.5 8 12 8 20s-2.5 14.5-8 20M24 4c-5.5 5.5-8 12-8 20s2.5 14.5 8 20" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            </svg>
            <p className="text-gray-600 text-sm">No rooms yet. Create one to get started.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {rooms.map((room) => {
            const joinable = isJoinable(room);
            const badge = badgeFor(room);
            return (
              <button
                key={room.id}
                onClick={() => joinable && handleJoin(room.id)}
                disabled={!joinable}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg
                           border text-left transition-all duration-200
                           ${joinable
                             ? 'border-white/10 hover:border-white/20 hover:bg-white/5 cursor-pointer'
                             : 'border-white/5 opacity-40 cursor-default'
                           }`}
              >
                <span className="text-white font-medium truncate mr-4">{room.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: room.redCount || 0 }).map((_, i) => (
                      <span key={`r${i}`} className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#e74c3c' }} />
                    ))}
                    {Array.from({ length: room.blueCount || 0 }).map((_, i) => (
                      <span key={`b${i}`} className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3498db' }} />
                    ))}
                  </div>
                  <span className="text-gray-500 text-sm tabular-nums">
                    {room.playerCount} / {room.maxPlayers}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-4">Create Room</h3>
            <form onSubmit={handleCreate}>
              <input
                ref={modalInputRef}
                type="text"
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                maxLength={32}
                className="w-full bg-white/5 text-white placeholder-gray-600 px-4 py-3 rounded-lg
                           border border-white/10 focus:border-amber-500 focus:outline-none
                           transition-colors duration-200 mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-gray-400
                             hover:bg-white/5 cursor-pointer transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold
                             px-4 py-2.5 rounded-lg cursor-pointer transition-colors duration-200"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

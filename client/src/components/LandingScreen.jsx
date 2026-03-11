import { useState } from 'react';

export default function LandingScreen({ onPlay, error }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onPlay(name.trim() || 'Player');
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center select-none">
      <h1 className="text-6xl font-bold text-white mb-1 tracking-tight">
        KickRush
      </h1>
      <p className="text-gray-500 text-sm mb-10">
        Haxball-style multiplayer football
      </p>

      {error && (
        <p className="text-red-400 text-sm mb-4 px-4 py-2 bg-red-500/10 rounded-lg border border-red-500/20">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-72">
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          autoFocus
          className="bg-white/5 text-white placeholder-gray-600 px-4 py-3 rounded-lg
                     border border-white/10 focus:border-amber-500 focus:outline-none
                     transition-colors duration-200"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold
                     px-4 py-3 rounded-lg cursor-pointer
                     transition-colors duration-200"
        >
          Play
        </button>
      </form>

      <p className="text-gray-600 text-xs mt-8">
        WASD to move &middot; Space to kick
      </p>
    </div>
  );
}

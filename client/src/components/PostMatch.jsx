export default function PostMatch({ state, onPlayAgain, onLeave }) {
  const { red, blue } = state.score;
  let winnerText, winnerColor;
  if (red > blue) {
    winnerText = 'Red Wins!';
    winnerColor = '#e74c3c';
  } else if (blue > red) {
    winnerText = 'Blue Wins!';
    winnerColor = '#3498db';
  } else {
    winnerText = 'Draw!';
    winnerColor = '#ffffff';
  }

  const redPlayers = state.players.filter(p => p.team === 'red');
  const bluePlayers = state.players.filter(p => p.team === 'blue');

  return (
    <div
      style={{ position: 'absolute', inset: 0 }}
      className="flex items-center justify-center bg-black/70 z-10 select-none"
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-80 shadow-2xl text-center">
        {/* Winner */}
        <h2
          className="text-3xl font-bold mb-2"
          style={{ color: winnerColor }}
        >
          {winnerText}
        </h2>

        {/* Final score */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-4xl font-bold" style={{ color: '#e74c3c' }}>{red}</span>
          <span className="text-2xl text-gray-500">&ndash;</span>
          <span className="text-4xl font-bold" style={{ color: '#3498db' }}>{blue}</span>
        </div>

        {/* Player lists */}
        <div className="flex gap-6 justify-center mb-6 text-sm">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2 font-medium">Red</h3>
            {redPlayers.map(p => (
              <div key={p.id} className="text-white/80 py-0.5">{p.name}</div>
            ))}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-2 font-medium">Blue</h3>
            {bluePlayers.map(p => (
              <div key={p.id} className="text-white/80 py-0.5">{p.name}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onPlayAgain}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold
                       px-4 py-3 rounded-lg cursor-pointer transition-colors duration-200"
          >
            Play Again
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-gray-400
                       hover:bg-white/5 cursor-pointer transition-colors duration-200"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

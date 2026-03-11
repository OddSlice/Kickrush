import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import LandingScreen from './components/LandingScreen';
import RoomBrowser from './components/RoomBrowser';
import Game from './components/Game';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function getUrlRoomId() {
  return new URLSearchParams(window.location.search).get('room') || null;
}

export default function App() {
  const [screen, setScreen] = useState('name');   // 'name' | 'lobby' | 'game'
  const [playerName, setPlayerName] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const socketRef = useRef(null);
  const pendingRoomRef = useRef(getUrlRoomId());

  // Create a single socket.io connection on mount
  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    function onRoomsUpdated(data) {
      if (data && typeof data.totalPlayers === 'number') {
        setTotalPlayers(data.totalPlayers);
      }
    }
    socket.on('roomsUpdated', onRoomsUpdated);

    // Fetch initial player count
    socket.on('connect', () => {
      console.log('[KickRush] Connected to server');
      socket.emit('getRooms', (data) => {
        if (data && typeof data.totalPlayers === 'number') {
          setTotalPlayers(data.totalPlayers);
        }
      });
    });

    socket.on('connect_error', (err) => {
      console.error('[KickRush] Connection error:', err.message);
    });

    return () => {
      socket.off('roomsUpdated', onRoomsUpdated);
      socket.disconnect();
    };
  }, []);

  // Handle name submission (+ direct room join if URL has ?room=)
  function handleNameSubmit(name) {
    setPlayerName(name);
    setJoinError(null);

    const pendingRoom = pendingRoomRef.current;
    if (pendingRoom) {
      pendingRoomRef.current = null;
      const socket = socketRef.current;
      socket.emit('joinRoom', { roomId: pendingRoom, playerName: name }, (res) => {
        if (res?.error) {
          setJoinError(res.error);
          setScreen('lobby');
        } else {
          setRoomId(res.roomId);
          window.history.pushState(null, '', `/?room=${res.roomId}`);
          setScreen('game');
        }
      });
    } else {
      setScreen('lobby');
    }
  }

  // Transition to game after create/join from lobby
  const handleJoinRoom = useCallback((id) => {
    setRoomId(id);
    window.history.pushState(null, '', `/?room=${id}`);
    setScreen('game');
  }, []);

  // Leave game → back to lobby
  const handleLeaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket) socket.emit('leaveRoom');
    setRoomId(null);
    window.history.pushState(null, '', '/');
    setScreen('lobby');
  }, []);

  // Back to name entry
  const handleChangeName = useCallback(() => {
    const socket = socketRef.current;
    if (socket) socket.emit('leaveRoom');
    setPlayerName(null);
    setRoomId(null);
    window.history.pushState(null, '', '/');
    setScreen('name');
  }, []);

  const socket = socketRef.current;

  // --- Screens ---

  if (screen === 'name' || !playerName) {
    return <LandingScreen onPlay={handleNameSubmit} error={joinError} />;
  }

  if (screen === 'game' && roomId && socket) {
    return (
      <Game
        socket={socket}
        playerName={playerName}
        roomId={roomId}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (socket) {
    return (
      <RoomBrowser
        socket={socket}
        playerName={playerName}
        onJoinRoom={handleJoinRoom}
        onChangeName={handleChangeName}
        totalPlayers={totalPlayers}
      />
    );
  }

  return null;
}

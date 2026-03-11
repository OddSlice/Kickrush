export function createInputHandler() {
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    kick: false,
    sprint: false,
  };

  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = true; break;
      case 'KeyS': case 'ArrowDown':  keys.down = true; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'Space': keys.kick = true; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = true; break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = false; break;
      case 'KeyS': case 'ArrowDown':  keys.down = false; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'Space': keys.kick = false; break;
      case 'ShiftLeft': case 'ShiftRight': keys.sprint = false; break;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    getState() { return keys; },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}

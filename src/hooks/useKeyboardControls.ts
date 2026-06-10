import { useState, useEffect } from 'react';

export interface KeyboardInputs {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steering: number; // -1 to 1
  respawn: boolean;
}

export function useKeyboardControls(): KeyboardInputs {
  const [inputs, setInputs] = useState<KeyboardInputs>({
    throttle: 0,
    brake: 0,
    steering: 0,
    respawn: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setInputs((prev) => ({ ...prev, throttle: 1 }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setInputs((prev) => ({ ...prev, brake: 1 }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setInputs((prev) => ({ ...prev, steering: -1 }));
          break;
        case 'KeyD':
        case 'ArrowRight':
          setInputs((prev) => ({ ...prev, steering: 1 }));
          break;
        case 'KeyR':
          setInputs((prev) => ({ ...prev, respawn: true }));
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          setInputs((prev) => ({ ...prev, throttle: 0 }));
          break;
        case 'KeyS':
        case 'ArrowDown':
          setInputs((prev) => ({ ...prev, brake: 0 }));
          break;
        case 'KeyR':
          setInputs((prev) => ({ ...prev, respawn: false }));
          break;
        case 'KeyA':
        case 'ArrowLeft':
        case 'KeyD':
        case 'ArrowRight':
          // We only reset steering to 0 if the released key matches the current steering direction roughly.
          // This prevents stopping steering if you're pressing A and D together and release one.
          setInputs((prev) => {
            if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && prev.steering === -1) {
              return { ...prev, steering: 0 };
            }
            if ((e.code === 'KeyD' || e.code === 'ArrowRight') && prev.steering === 1) {
              return { ...prev, steering: 0 };
            }
            return prev;
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return inputs;
}

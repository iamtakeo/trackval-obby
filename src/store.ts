type Listener = () => void;

class GameStore {
  private speed = 0;
  private listeners = new Set<Listener>();

  setSpeed(newSpeed: number) {
    if (Math.abs(this.speed - newSpeed) > 1) { // Only update if changed by at least 1 unit to save renders
      this.speed = newSpeed;
      this.emit();
    }
  }

  getSpeed = () => this.speed;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const gameStore = new GameStore();

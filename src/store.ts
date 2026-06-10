import { generateTrackCurve } from './utils/trackGenerator';
import type { TrackData } from './utils/trackGenerator';

type Listener = () => void;

class GameStore {
  private speed = 0;
  private trackData: TrackData | null = null;
  private isMenuOpen = false;
  private listeners = new Set<Listener>();

  constructor() {
    // Generate the initial track
    this.trackData = generateTrackCurve({});
  }

  setSpeed(newSpeed: number) {
    if (Math.abs(this.speed - newSpeed) > 1) { 
      this.speed = newSpeed;
      this.emit();
    }
  }

  getSpeed = () => this.speed;

  setTrackData(data: TrackData) {
    this.trackData = data;
    this.emit();
  }

  getTrackData = () => this.trackData;

  setMenuOpen(isOpen: boolean) {
    if (this.isMenuOpen !== isOpen) {
      this.isMenuOpen = isOpen;
      this.emit();
    }
  }

  getMenuOpen = () => this.isMenuOpen;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

export const gameStore = new GameStore();

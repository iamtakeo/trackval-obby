import * as THREE from 'three';
import { generateTrackCurve } from './utils/trackGenerator';

type Listener = () => void;

class GameStore {
  private speed = 0;
  private trackCurve: THREE.CatmullRomCurve3 | null = null;
  private isMenuOpen = false;
  private listeners = new Set<Listener>();

  constructor() {
    // Generate the initial track
    const result = generateTrackCurve({});
    this.trackCurve = result.curve;
  }

  setSpeed(newSpeed: number) {
    if (Math.abs(this.speed - newSpeed) > 1) { 
      this.speed = newSpeed;
      this.emit();
    }
  }

  getSpeed = () => this.speed;

  setTrackCurve(curve: THREE.CatmullRomCurve3) {
    this.trackCurve = curve;
    this.emit();
  }

  getTrackCurve = () => this.trackCurve;

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

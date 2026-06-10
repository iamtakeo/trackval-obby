import { generateTrackCurve } from './utils/trackGenerator';
import type { TrackData } from './utils/trackGenerator';
import type { CartesianCapabilities } from './engine/CartesianPhysics';

type Listener = () => void;

export const defaultCarCapabilities: CartesianCapabilities = {
  maxAcceleration: 25,
  maxBraking: 60,
  maxVelocity: 70,
  maxLateralG: 40,
  steeringSensitivity: 0.015,
  gravity: 50
};

class GameStore {
  private speed = 0;
  private trackData: TrackData | null = null;
  private isMenuOpen = false;
  private carParameters: CartesianCapabilities = { ...defaultCarCapabilities };
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

  setCarParameters(params: Partial<CartesianCapabilities>) {
    this.carParameters = { ...this.carParameters, ...params };
    this.emit();
  }

  getCarParameters = () => this.carParameters;

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

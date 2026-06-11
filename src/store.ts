import type { TrackData } from './utils/trackGenerator';
import type { CartesianCapabilities } from './engine/CartesianPhysics';
import { defaultRamps, type RampData } from './utils/rampData';

export interface CarAppearance {
  bodyStyle: 'speedster' | 'brute' | 'interceptor';
  primaryColor: string;
  secondaryColor: string;
  thrusterColor: string;
  decalStyle: 'none' | 'racing-stripes' | 'hazard' | 'checkered';
  spoiler: 'none' | 'ducktail' | 'gt-wing' | 'cyber';
  underglow: boolean;
  underglowColor: string;
  accessory: 'none' | 'antenna' | 'spikes' | 'police-sirens';
}

type Listener = () => void;

export const defaultCarCapabilities: CartesianCapabilities = {
  maxAcceleration: 25,
  maxBraking: 60,
  maxVelocity: 70,
  maxLateralG: 40,
  steeringSensitivity: 0.015,
  gravity: 50
};

export interface BotStats {
  active: number;
  success: number;
  fail: number;
}

export interface BotTelemetry {
  id: string;
  position: { x: number, y: number, z: number };
  reason: 'FellOff' | 'Stuck' | 'Success';
}

class GameStore {
  private speed = 0;
  private trackData: TrackData | null = null;
  private isMenuOpen = false;
  private carParameters: CartesianCapabilities = { ...defaultCarCapabilities };
  private playerName: string = "Guest";
  private carAppearance: CarAppearance = {
    bodyStyle: 'speedster',
    primaryColor: '#00e5ff',
    secondaryColor: '#ffffff',
    thrusterColor: '#ff0055',
    decalStyle: 'none',
    spoiler: 'none',
    underglow: false,
    underglowColor: '#00e5ff',
    accessory: 'none'
  };
  private isSpectating = false;
  
  // Bot Validation State
  private botSimulationActive = false;
  private botCount = 5;
  private showHeatmap = false;
  private botStats: BotStats = { active: 0, success: 0, fail: 0 };
  private telemetry: BotTelemetry[] = [];
  
  private connectedPlayers: Record<string, any> = {};
  private ramps: RampData[] = defaultRamps;
  private listeners = new Set<Listener>();

  constructor() {
    // Track will be generated or synced via the multiplayer network
    this.trackData = null;
  }

  setCarAppearance(appearance: Partial<CarAppearance>) {
    this.carAppearance = { ...this.carAppearance, ...appearance };
    this.emit();
  }

  getCarAppearance = () => this.carAppearance;

  setPlayerName(name: string) {
    if (this.playerName !== name) {
      this.playerName = name;
      this.emit();
    }
  }

  getPlayerName = () => this.playerName;

  setConnectedPlayers(players: Record<string, any>) {
    this.connectedPlayers = players;
    this.emit();
  }

  getConnectedPlayers = () => this.connectedPlayers;

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

  setRamps(ramps: RampData[]) {
    this.ramps = ramps;
    this.emit();
  }

  getRamps = () => this.ramps;

  setMenuOpen(isOpen: boolean) {
    if (this.isMenuOpen !== isOpen) {
      this.isMenuOpen = isOpen;
      this.emit();
    }
  }

  getMenuOpen = () => this.isMenuOpen;

  setIsSpectating(isSpectating: boolean) {
    if (this.isSpectating !== isSpectating) {
      this.isSpectating = isSpectating;
      this.emit();
    }
  }

  getIsSpectating = () => this.isSpectating;

  setBotSimulationActive(active: boolean) {
    if (this.botSimulationActive !== active) {
      this.botSimulationActive = active;
      this.emit();
    }
  }
  getBotSimulationActive = () => this.botSimulationActive;

  setBotCount(count: number) {
    if (this.botCount !== count) {
      this.botCount = count;
      this.emit();
    }
  }
  getBotCount = () => this.botCount;

  setShowHeatmap(show: boolean) {
    if (this.showHeatmap !== show) {
      this.showHeatmap = show;
      this.emit();
    }
  }
  getShowHeatmap = () => this.showHeatmap;

  setBotStats(stats: Partial<BotStats>) {
    this.botStats = { ...this.botStats, ...stats };
    this.emit();
  }
  getBotStats = () => this.botStats;
  
  addTelemetry(t: BotTelemetry) {
    this.telemetry.push(t);
    this.emit();
  }
  getTelemetry = () => this.telemetry;
  clearTelemetry() {
    this.telemetry = [];
    this.botStats = { active: 0, success: 0, fail: 0 };
    this.emit();
  }

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

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOVEMENT_THRESHOLD = 100; // meters
const CHECK_INTERVAL = 30000; // 30 seconds
const STORAGE_KEY_PREFIX = 'moto-tracker-last-pos-';

export type MovementCallback = (motorcycleId: string, distance: number) => void;

export class GPSDetectionService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private lastPosition: { lat: number; lon: number } | null = null;
  private motorcycleId: string;
  private callback: MovementCallback | null = null;
  private isRunning = false;

  constructor(motorcycleId: string) {
    this.motorcycleId = motorcycleId;
  }

  async start(callback: MovementCallback): Promise<void> {
    if (this.isRunning) return;

    this.callback = callback;

    // Load last saved position
    await this.loadLastPosition();

    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[GPS] Permission denied for motorcycle:', this.motorcycleId);
      return;
    }

    // Start watching position
    this.watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Update every 10 meters
        timeInterval: CHECK_INTERVAL,
      },
      (location) => this.handleLocationUpdate(location)
    );

    this.isRunning = true;
    console.log('[GPS] Started watching motorcycle:', this.motorcycleId);
  }

  stop(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    this.isRunning = false;
    this.callback = null;
    console.log('[GPS] Stopped watching motorcycle:', this.motorcycleId);
  }

  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    const currentLat = location.coords.latitude;
    const currentLon = location.coords.longitude;

    if (this.lastPosition) {
      const distance = this.calculateDistance(
        this.lastPosition.lat,
        this.lastPosition.lon,
        currentLat,
        currentLon
      );

      console.log(`[GPS] Movement detected: ${distance.toFixed(0)}m for motorcycle: ${this.motorcycleId}`);

      if (distance > MOVEMENT_THRESHOLD && this.callback) {
        this.callback(this.motorcycleId, distance);
      }
    }

    // Save current position
    await this.saveLastPosition(currentLat, currentLon);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getStorageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.motorcycleId}`;
  }

  async saveLastPosition(lat: number, lon: number): Promise<void> {
    this.lastPosition = { lat, lon };
    await AsyncStorage.setItem(this.getStorageKey(), JSON.stringify({ lat, lon }));
  }

  private async loadLastPosition(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.getStorageKey());
      if (stored) {
        this.lastPosition = JSON.parse(stored);
        console.log('[GPS] Loaded last position for motorcycle:', this.motorcycleId);
      }
    } catch (e) {
      console.log('[GPS] Error loading last position:', e);
    }
  }

  getLastPosition(): { lat: number; lon: number } | null {
    return this.lastPosition;
  }
}

// Singleton instances per motorcycle
const instances = new Map<string, GPSDetectionService>();

export function getGPSDetectionService(motorcycleId: string): GPSDetectionService {
  if (!instances.has(motorcycleId)) {
    instances.set(motorcycleId, new GPSDetectionService(motorcycleId));
  }
  return instances.get(motorcycleId)!;
}

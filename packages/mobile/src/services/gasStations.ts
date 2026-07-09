import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { detectCountry, getStoredCountry, getGasPriceMessage } from './countryDetection';

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  brandLogo?: string;
  distance: number;
  latitude: number;
  longitude: number;
  address: string;
  comuna: string;
  region: string;
  price93?: number;
  price95?: number;
  price97?: number;
  priceDiesel?: number;
  priceKerosene?: number;
  lastUpdate?: string;
}

// Cache keys
const CACHE_KEY_GAS_STATIONS = 'moto-tracker-gas-stations';
const CACHE_KEY_LAST_UPDATE = 'moto-tracker-gas-update-time';

// Cache functions
async function saveStationsCache(stations: GasStation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY_GAS_STATIONS, JSON.stringify(stations));
    await AsyncStorage.setItem(CACHE_KEY_LAST_UPDATE, new Date().toISOString());
  } catch (e) {
    console.log('[CACHE] Error saving stations:', e);
  }
}

async function loadStationsCache(): Promise<GasStation[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY_GAS_STATIONS);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.log('[CACHE] Error loading stations:', e);
  }
  return [];
}

async function getLastUpdateTime(): Promise<Date | null> {
  try {
    const lastUpdate = await AsyncStorage.getItem(CACHE_KEY_LAST_UPDATE);
    if (lastUpdate) {
      return new Date(lastUpdate);
    }
  } catch (e) {
    console.log('[CACHE] Error loading last update time:', e);
  }
  return null;
}

// Check if we should refresh data
async function shouldRefreshData(): Promise<boolean> {
  const lastUpdate = await getLastUpdateTime();
  if (!lastUpdate) return true; // Never updated
  
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 4 = Thursday
  const lastDay = lastUpdate.getDay();
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  // 1. If today is Thursday and we haven't updated today → refresh
  if (today === 4) {
    const lastUpdateDay = lastUpdate.toDateString();
    const todayDate = now.toDateString();
    if (lastUpdateDay !== todayDate) return true;
  }
  
  // 2. If last update was before this Thursday and today is Thursday or later → refresh
  if (today >= 4 && lastDay < 4) return true;
  
  // 3. If data is older than 3 days → refresh
  if (hoursSinceUpdate > 72) return true;
  
  return false;
}

// Get human-readable time since last update
export async function getLastUpdateLabel(): Promise<string | null> {
  const lastUpdate = await getLastUpdateTime();
  if (!lastUpdate) return null;
  
  // Get country and return appropriate message
  const country = await getStoredCountry();
  return getGasPriceMessage(country);
}

// CNE API credentials
const CNE_EMAIL = 'jdevlabs.cl@gmail.com';
const CNE_PASSWORD = 'L&anna1925';

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Login to CNE API and get Bearer token
async function getCNEToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  console.log('[CNE] Requesting new token...');
  const response = await fetch('https://api.cne.cl/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MotoTracker/1.0',
    },
    body: JSON.stringify({ email: CNE_EMAIL, password: CNE_PASSWORD }),
  });

  if (!response.ok) throw new Error('CNE login failed');

  const data = await response.json();
  cachedToken = data.token;
  // Token expires in 1 hour (JWT exp claim)
  tokenExpiry = Date.now() + 3500 * 1000; // 58 min to be safe
  console.log('[CNE] Token obtained');
  return cachedToken!;
}

// Fetch all gas stations from CNE API
async function fetchAllStations(): Promise<any[]> {
  const token = await getCNEToken();

  const response = await fetch('https://api.cne.cl/api/v4/estaciones', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MotoTracker/1.0',
    },
  });

  if (!response.ok) throw new Error('Failed to fetch CNE stations');

  const data = await response.json();
  console.log('[CNE] Response type:', Array.isArray(data) ? 'array' : typeof data, 'keys:', Object.keys(data).slice(0, 5).join(','));
  // API returns array directly OR { data: [...] } OR { estaciones: [...] }
  if (Array.isArray(data)) return data;
  return data.data || data.estaciones || Object.values(data).find(Array.isArray) || [];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Parse price string like "1560.000" to number 1560
function parsePrice(priceStr: string | undefined): number | undefined {
  if (!priceStr) return undefined;
  const parsed = parseFloat(priceStr);
  return isNaN(parsed) ? undefined : Math.round(parsed);
}

export async function getNearbyGasStations(
  lat: number,
  lon: number,
  radiusKm = 50,
  forceRefresh = false
): Promise<GasStation[]> {
  // Check if we should refresh
  const shouldRefresh = forceRefresh || await shouldRefreshData();
  
  if (!shouldRefresh) {
    // Use cached data
    const cached = await loadStationsCache();
    if (cached.length > 0) {
      console.log('[CACHE] Using cached stations:', cached.length);
      // Recalculate distance from current location
      const withDistance = cached.map(station => ({
        ...station,
        distance: haversineDistance(lat, lon, station.latitude, station.longitude)
      }));
      withDistance.sort((a, b) => a.distance - b.distance);
      return withDistance.slice(0, 15);
    }
  }

  console.log('[CNE] Fetching fresh data...');
  try {
    console.log('[CNE] Fetching all stations...');
    const allStations = await fetchAllStations();
    console.log('[CNE] Total stations:', allStations.length);
    console.log('[CNE] Sample station:', JSON.stringify(allStations[0]?.ubicacion || 'none').substring(0, 200));

    // Filter and map nearby stations
    const nearby: GasStation[] = [];

    for (const station of allStations) {
      const stationLat = parseFloat(station.ubicacion?.latitud);
      const stationLon = parseFloat(station.ubicacion?.longitud);

      if (isNaN(stationLat) || isNaN(stationLon)) {
        console.log('[CNE] Skipping station without coords:', station.codigo);
        continue;
      }

      const distance = haversineDistance(lat, lon, stationLat, stationLon);
      if (distance > radiusKm) continue;

      nearby.push({
        id: station.codigo,
        name: station.razon_social || station.distribuidor?.marca || 'Estación',
        brand: station.distribuidor?.marca || '',
        brandLogo: station.distribuidor?.logo,
        distance,
        latitude: stationLat,
        longitude: stationLon,
        address: station.ubicacion?.direccion || '',
        comuna: station.ubicacion?.nombre_comuna || '',
        region: station.ubicacion?.nombre_region || '',
        price93: parsePrice(station.precios?.['93']?.precio),
        price95: parsePrice(station.precios?.['95']?.precio),
        price97: parsePrice(station.precios?.['97']?.precio),
        priceDiesel: parsePrice(station.precios?.['DI']?.precio),
        priceKerosene: parsePrice(station.precios?.['KE']?.precio),
        lastUpdate: station.precios?.['93']?.fecha_actualizacion,
      });
    }

    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);
    
    const result = nearby.slice(0, 15);
    
    // Cache the result
    await saveStationsCache(result);
    console.log('[CACHE] Saved', result.length, 'stations to cache');
    
    console.log('[CNE] Nearby stations within', radiusKm, 'km:', result.length);
    return result;
  } catch (error) {
    console.log('[CNE] Error fetching fresh data:', error);
    // Fallback to cache on error
    const cached = await loadStationsCache();
    if (cached.length > 0) {
      console.log('[CACHE] Falling back to cached stations:', cached.length);
      const withDistance = cached.map(station => ({
        ...station,
        distance: haversineDistance(lat, lon, station.latitude, station.longitude)
      }));
      withDistance.sort((a, b) => a.distance - b.distance);
      return withDistance.slice(0, 15);
    }
    throw error;
  }
}

export async function getCachedGasStations(): Promise<GasStation[]> {
  return await loadStationsCache();
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({});
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}

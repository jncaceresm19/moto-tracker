import * as Location from 'expo-location';

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
  return data.data || data.estaciones || [];
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
  radiusKm = 10
): Promise<GasStation[]> {
  console.log('[CNE] Fetching all stations...');
  const allStations = await fetchAllStations();
  console.log('[CNE] Total stations:', allStations.length);

  // Filter and map nearby stations
  const nearby: GasStation[] = [];

  for (const station of allStations) {
    const stationLat = parseFloat(station.ubicacion?.latitud);
    const stationLon = parseFloat(station.ubicacion?.longitud);

    if (isNaN(stationLat) || isNaN(stationLon)) continue;

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

  console.log('[CNE] Nearby stations:', nearby.length);
  return nearby.slice(0, 15);
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({});
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}

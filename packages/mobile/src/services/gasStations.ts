import * as Location from 'expo-location';

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  distance: number; // km
  latitude: number;
  longitude: number;
  fuelPrices?: { type: string; price: number }[];
}

// Overpass API query for fuel stations near a location
function buildOverpassQuery(lat: number, lon: number, radiusMeters = 5000): string {
  return `[out:json][timeout:10];(node["amenity"="fuel"](around:${radiusMeters},${lat},${lon}););out body;`;
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

export async function getNearbyGasStations(
  lat: number,
  lon: number,
  radiusMeters = 5000
): Promise<GasStation[]> {
  const query = buildOverpassQuery(lat, lon, radiusMeters);

  console.log('[GAS] Query:', query);
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  console.log('[GAS] Response status:', response.status);
  if (!response.ok) throw new Error('Failed to fetch gas stations');

  const data = await response.json();
  const elements: any[] = data.elements || [];
  console.log('[GAS] Raw elements:', elements.length);

  const stations: GasStation[] = elements
    .filter((el) => el.tags?.name)
    .map((el) => ({
      id: String(el.id),
      name: el.tags.name || 'Gas station',
      brand: el.tags.brand || el.tags.operator || '',
      distance: haversineDistance(lat, lon, el.lat, el.lon),
      latitude: el.lat,
      longitude: el.lon,
      fuelPrices: [], // Overpass doesn't provide prices
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  console.log('[GAS] Processed stations:', stations.length);
  return stations;
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number }> {
  console.log('[GAS] Requesting location permission...');
  const { status } = await Location.requestForegroundPermissionsAsync();
  console.log('[GAS] Permission status:', status);
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({});
  console.log('[GAS] Location obtained:', location.coords.latitude, location.coords.longitude);
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}

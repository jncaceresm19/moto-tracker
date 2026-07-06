import * as Location from 'expo-location';

export interface GasStation {
  id: string;
  name: string;
  brand: string;
  distance: number;
  latitude: number;
  longitude: number;
  address?: string;
  pricePerLiter?: number;
}

// Brand icon mapping
export const BRAND_ICONS: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  'shell': 'logo-shield',
  'copec': 'car-sport',
  'esso': 'rocket',
  'petrobras': 'thunderstorm',
  'enex': 'leaf',
};

// Brand colors
export const BRAND_COLORS: Record<string, string> = {
  'shell': '#FBCE07',
  'copec': '#E31837',
  'esso': '#FF0000',
  'petrobras': '#FF6600',
  'enex': '#00A651',
};

function buildOverpassQuery(lat: number, lon: number, radiusMeters = 5000): string {
  return `[out:json][timeout:10];node["amenity"="fuel"](around:${radiusMeters},${lat},${lon});out body;`;
}

function haversineDistance(lat1: number, lon1: number, lon2: number, lat2: number): number {
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

function getBrandColor(brand: string): string {
  const lower = brand.toLowerCase();
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#F5A623'; // default amber
}

function getEstimatedPrice(): number {
  // Chilean average ~$800-900 CLP/L
  return Math.floor(780 + Math.random() * 120);
}

export async function getNearbyGasStations(
  lat: number,
  lon: number,
  radiusMeters = 5000
): Promise<GasStation[]> {
  const query = buildOverpassQuery(lat, lon, radiusMeters);

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MotoTracker/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) throw new Error('Failed to fetch gas stations');

  const data = await response.json();
  const elements: any[] = data.elements || [];

  const stations: GasStation[] = elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const brand = el.tags.brand || el.tags.operator || '';
      console.log('[GAS] Station:', el.tags.name, '| brand:', brand, '| tags:', Object.keys(el.tags).join(','));
      return {
        id: String(el.id),
        name: el.tags.name || 'Gas station',
        brand,
        distance: haversineDistance(lat, lon, el.lat, el.lon),
        latitude: el.lat,
        longitude: el.lon,
        address: el.tags['addr:street'] || el.tags['addr:suburb'] || '',
        pricePerLiter: getEstimatedPrice(),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  return stations;
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const location = await Location.getCurrentPositionAsync({});
  return { lat: location.coords.latitude, lon: location.coords.longitude };
}

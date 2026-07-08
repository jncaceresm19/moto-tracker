import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NearbyPlace {
  id: string;
  name: string;
  category: 'taller' | 'vulcanizacion' | 'medico' | 'carabineros';
  latitude: number;
  longitude: number;
  address: string;
  distance: number;
  phone?: string;
  rating?: number;
  openNow?: boolean;
}

const GOOGLE_API_KEY = 'AIzaSyAhtFaikZpXvYPWiZVItv12D520Nno_xqk';
const CACHE_KEY = 'moto-tracker-nearby-places';
const CACHE_KEY_TIME = 'moto-tracker-nearby-places-time';
const CACHE_TTL = 30 * 60 * 1000;

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

// Google Places Nearby Search
async function searchGooglePlaces(
  lat: number,
  lon: number,
  type: string,
  keyword: string,
  radius: number
): Promise<any[]> {
  const url =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
    '?location=' + lat + ',' + lon +
    '&radius=' + radius +
    '&type=' + type +
    '&keyword=' + encodeURIComponent(keyword) +
    '&key=' + GOOGLE_API_KEY;

  console.log('[NEARBY] Google search:', keyword, '| type:', type);
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('[NEARBY] Google status:', data.status);
    if (data.error_message) {
      console.log('[NEARBY] Google ERROR:', data.error_message);
    }
    if (data.results) {
      console.log('[NEARBY] Google results:', data.results.length);
    }
    return data.results || [];
  } catch (e) {
    console.log('[NEARBY] Google fetch error:', (e as Error).message);
    return [];
  }
}

export async function getNearbyPlaces(
  lat: number,
  lon: number,
  radiusKm = 5
): Promise<NearbyPlace[]> {
  console.log('[NEARBY] === Google Places Search ===');

  // Check cache
  try {
    const cachedTime = await AsyncStorage.getItem(CACHE_KEY_TIME);
    if (cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const places: NearbyPlace[] = JSON.parse(cached);
        console.log('[NEARBY] Using cached places:', places.length);
        return places
          .map((p) => ({ ...p, distance: haversineDistance(lat, lon, p.latitude, p.longitude) }))
          .sort((a, b) => a.distance - b.distance);
      }
    }
  } catch {}

  const radiusMeters = radiusKm * 1000;

  // Search queries - Google Places API by type + keyword
  const searches: { category: NearbyPlace['category']; type: string; keyword: string }[] = [
    // TALLERES - main focus
    { category: 'taller', type: 'motorcycle_repair', keyword: 'taller mecánico motos' },
    { category: 'taller', type: 'repair', keyword: 'taller motos' },
    // VULCANIZACIÓN - main focus
    { category: 'vulcanizacion', type: 'tire_repair', keyword: 'vulcanización' },
    { category: 'vulcanizacion', type: 'store', keyword: 'neumáticos' },
    // HOSPITALES - secondary
    { category: 'medico', type: 'hospital', keyword: '' },
    // COMISARÍAS - secondary
    { category: 'carabineros', type: 'police', keyword: 'comisaría' },
  ];

  const allPlaces: NearbyPlace[] = [];
  const seenIds = new Set<string>();

  for (const { category, type, keyword } of searches) {
    const results = await searchGooglePlaces(lat, lon, type, keyword, radiusMeters);

    for (const r of results) {
      if (seenIds.has(r.place_id)) continue;
      seenIds.add(r.place_id);

      const placeLat = r.geometry?.location?.lat;
      const placeLon = r.geometry?.location?.lng;
      if (!placeLat || !placeLon) continue;

      const dist = haversineDistance(lat, lon, placeLat, placeLon);

      // Filter by relevance
      const name = (r.name || '').toLowerCase();
      const vic = (r.vicinity || '').toLowerCase();
      const combined = name + ' ' + vic;

      let accepted = false;

      if (category === 'taller') {
        accepted = combined.includes('taller') || combined.includes('mecánico') || combined.includes('mecanico') || combined.includes('moto') || combined.includes('repair') || combined.includes('reparación');
        if (!accepted) console.log('[NEARBY] ✗ Skip taller:', r.name);
      }

      if (category === 'vulcanizacion') {
        accepted = combined.includes('vulcanización') || combined.includes('vulcanizacion') || combined.includes('neumáticos') || combined.includes('neumaticos') || combined.includes('gomería') || combined.includes('gomeria') || combined.includes('tire') || combined.includes('llanta') || combined.includes('pinchaz');
        if (!accepted) console.log('[NEARBY] ✗ Skip vulca:', r.name);
      }

      if (category === 'medico') {
        const isDental = combined.includes('dental') || combined.includes('odontol') || combined.includes('dentist');
        const isFarmacia = combined.includes('farmacia');
        const isVet = combined.includes('veterinari');
        accepted = !isDental && !isFarmacia && !isVet;
        if (!accepted) console.log('[NEARBY] ✗ Skip medico:', r.name);
      }

      if (category === 'carabineros') {
        accepted = !combined.includes('escuela') && !combined.includes('academia');
        if (!accepted) console.log('[NEARBY] ✗ Skip carabineros:', r.name);
      }

      if (accepted) {
        console.log('[NEARBY] ✓', r.name, '|', category, '|', dist.toFixed(1), 'km');
        allPlaces.push({
          id: `${category}-${r.place_id}`,
          name: r.name,
          category,
          latitude: placeLat,
          longitude: placeLon,
          address: r.vicinity || '',
          distance: dist,
          phone: r.international_phone || r.formatted_phone_number || undefined,
          rating: r.rating || undefined,
          openNow: r.opening_hours?.open_now || undefined,
        });
      }
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Group by category with limits (taller/vulca prioritized)
  const limits: Record<string, number> = { taller: 4, vulcanizacion: 4, medico: 2, carabineros: 2 };
  const grouped: Record<string, NearbyPlace[]> = {};
  for (const place of allPlaces) {
    if (!grouped[place.category]) grouped[place.category] = [];
    if (grouped[place.category].length < (limits[place.category] || 3)) {
      grouped[place.category].push(place);
    }
  }

  const result = Object.values(grouped).flat().sort((a, b) => a.distance - b.distance);
  console.log('[NEARBY] === FINAL:', result.length, 'places ===');
  for (const p of result) {
    console.log('[NEARBY]   →', p.name, '|', p.category, '|', p.distance.toFixed(1), 'km');
  }

  // Cache
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
    await AsyncStorage.setItem(CACHE_KEY_TIME, Date.now().toString());
  } catch {}

  return result;
}

export function getCategoryIcon(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return 'build';
    case 'vulcanizacion': return 'ellipse';
    case 'medico': return 'medkit';
    case 'carabineros': return 'shield-checkmark';
  }
}

export function getCategoryLabel(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return 'Taller';
    case 'vulcanizacion': return 'Vulcanización';
    case 'medico': return 'Médico';
    case 'carabineros': return 'Carabineros';
  }
}

export function getCategoryColor(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return '#F59E0B';
    case 'vulcanizacion': return '#8B5CF6';
    case 'medico': return '#EF4444';
    case 'carabineros': return '#1E40AF';
  }
}

export function openInGoogleMaps(place: NearbyPlace): string {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + place.latitude + ',' + place.longitude + '&travelmode=driving';
}

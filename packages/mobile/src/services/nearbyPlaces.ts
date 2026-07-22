import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NearbyPlace {
  id: string;
  name: string;
  category: 'taller' | 'vulcanizacion' | 'medico' | 'carabineros' | 'grua';
  latitude: number;
  longitude: number;
  address: string;
  distance: number;
  phone?: string;
  placeId?: string;
}

const API_URL = 'http://192.168.100.9:3001';
const CACHE_KEY = 'moto-tracker-nearby-places';
const CACHE_KEY_TIME = 'moto-tracker-nearby-places-time';
const CACHE_KEY_LAT = 'moto-tracker-nearby-places-lat';
const CACHE_KEY_LON = 'moto-tracker-nearby-places-lon';
const CACHE_TTL = 30 * 60 * 1000;
const RADIUS_KM = 5;

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

// Location persistence helpers
async function saveLastQueriedLocation(lat: number, lon: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY_LAT, lat.toString());
    await AsyncStorage.setItem(CACHE_KEY_LON, lon.toString());
  } catch {}
}

async function getLastQueriedLocation(): Promise<{ lat: number; lon: number } | null> {
  try {
    const latStr = await AsyncStorage.getItem(CACHE_KEY_LAT);
    const lonStr = await AsyncStorage.getItem(CACHE_KEY_LON);
    if (!latStr || !lonStr) return null;
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// Backend Places API proxy
async function searchGooglePlaces(
  lat: number,
  lon: number,
  type: string,
  keyword: string,
  radius: number
): Promise<any[]> {
  let url = `${API_URL}/api/google/places?lat=${lat}&lon=${lon}&radius=${radius}`;
  
  if (type) url += `&type=${type}`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;

  console.log('[NEARBY] Google:', keyword || type, '|', radius + 'm');
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('[NEARBY] Status:', data.status, '| results:', data.results?.length || 0);
    if (data.error_message) {
      console.log('[NEARBY] ERROR:', data.error_message);
    }
    return data.results || [];
  } catch (e) {
    console.log('[NEARBY] Fetch error:', (e as Error).message);
    return [];
  }
}

export async function getNearbyPlaces(
  lat: number,
  lon: number,
  radiusKm = 3
): Promise<NearbyPlace[]> {
  console.log('[NEARBY] === Google Places Search ===');

  // Check if we're within the radius of the last query location
  const lastLocation = await getLastQueriedLocation();
  if (lastLocation) {
    const distance = haversineDistance(lat, lon, lastLocation.lat, lastLocation.lon);
    if (distance <= RADIUS_KM) {
      // Check cache validity
      try {
        const cachedTime = await AsyncStorage.getItem(CACHE_KEY_TIME);
        if (cachedTime && Date.now() - parseInt(cachedTime) < CACHE_TTL) {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            const places: NearbyPlace[] = JSON.parse(cached);
            console.log('[NEARBY] Within 5km radius, using cache:', places.length, 'places');
            return places
              .map((p) => ({ ...p, distance: haversineDistance(lat, lon, p.latitude, p.longitude) }))
              .sort((a, b) => a.distance - b.distance);
          }
        }
      } catch {}
    }
  }

  const radiusMeters = radiusKm * 1000;

  // Search queries - NO TYPE RESTRICTION, filter by name keywords only
  const searches: { category: NearbyPlace['category']; type: string; keyword: string }[] = [
    // TALLERES - keyword-only searches (no type filter)
    { category: 'taller', type: '', keyword: 'taller motos' },
    { category: 'taller', type: '', keyword: 'reparación motos' },
    { category: 'taller', type: '', keyword: 'mecánico motos' },
    { category: 'taller', type: '', keyword: 'taller mecánico' },
    { category: 'taller', type: '', keyword: 'reparación' },
    { category: 'taller', type: '', keyword: 'dilan motos' },
    { category: 'taller', type: '', keyword: 'HMR multiservicios' },
    // VULCANIZACIÓN - keyword-only searches
    { category: 'vulcanizacion', type: '', keyword: 'vulcanización' },
    { category: 'vulcanizacion', type: '', keyword: 'neumáticos' },
    { category: 'vulcanizacion', type: '', keyword: 'llantas' },
    { category: 'vulcanizacion', type: '', keyword: 'gomería' },
    // HOSPITALES
    { category: 'medico', type: 'hospital', keyword: '' },
    // COMISARÍAS
    { category: 'carabineros', type: 'police', keyword: '' },
    // GRÚAS
    { category: 'grua', type: '', keyword: 'grúa' },
    { category: 'grua', type: '', keyword: 'motogrúa' },
    { category: 'grua', type: '', keyword: 'auxilio mecánico' },
    { category: 'grua', type: '', keyword: 'remolque' },
    { category: 'grua', type: '', keyword: 'auxilio vehicular' },
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

      // Filter by distance (max 10km for results)
      if (dist > 10) {
        console.log('[NEARBY] ✗ Too far:', r.name, dist.toFixed(1), 'km');
        continue;
      }

      let accepted = false;

      if (category === 'taller') {
        // Only accept places related to motorcycle/mechanical repair
        const isTaller = combined.includes('taller') || combined.includes('mecánico') || combined.includes('mecanico');
        const isMoto = combined.includes('moto') || combined.includes('motocicleta');
        const isRepair = combined.includes('repair') || combined.includes('reparación') || combined.includes('reparacion');
        const isRepuesto = combined.includes('repuesto') || combined.includes('accesorio');
        const isMultiservicio = combined.includes('multiservicio');
        accepted = isTaller || isMoto || isRepair || isRepuesto || isMultiservicio;
        console.log('[NEARBY] ' + (accepted ? '✓' : '✗') + ' taller:', r.name, '|', 'moto:' + isMoto, 'taller:' + isTaller);
      }

      if (category === 'vulcanizacion') {
        // Only accept tire/vulcanization related places
        const isVulca = combined.includes('vulcanización') || combined.includes('vulcanizacion');
        const isNeumatico = combined.includes('neumático') || combined.includes('neumatico') || combined.includes('neumáticos');
        const isLlanta = combined.includes('llanta');
        const isGomeria = combined.includes('gomería') || combined.includes('gomeria');
        const isTire = combined.includes('tire');
        accepted = isVulca || isNeumatico || isLlanta || isGomeria || isTire;
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

      if (category === 'grua') {
        const isGrua = combined.includes('grúa') || combined.includes('grua') || combined.includes('motogrúa') || combined.includes('motogrua');
        const isRemolque = combined.includes('remolque') || combined.includes('arrastra');
        const isAuxilio = combined.includes('auxilio mecánico') || combined.includes('auxilio mecanico') || combined.includes('auxilio vehicular');
        accepted = isGrua || isRemolque || isAuxilio;
        if (!accepted) console.log('[NEARBY] ✗ Skip grua:', r.name);
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
          placeId: r.place_id,
        });
      }
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Group by category with limits (taller/vulca prioritized)
  const limits: Record<string, number> = { taller: 6, vulcanizacion: 6, medico: 2, carabineros: 2, grua: 4 };
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
    await saveLastQueriedLocation(lat, lon);
  } catch {}

  // Fetch phone numbers for grua places (Place Details API)
  const gruaWithPlaceId = result.filter(p => p.category === 'grua' && p.placeId);
  if (gruaWithPlaceId.length > 0) {
    console.log('[NEARBY] Fetching phone for', gruaWithPlaceId.length, 'grua places');
    for (const place of gruaWithPlaceId) {
      try {
        const resp = await fetch(`${API_URL}/api/google/places/${place.placeId}/details`);
        const data = await resp.json();
        if (data.result?.formatted_phone_number) {
          place.phone = data.result.formatted_phone_number;
          console.log('[NEARBY] Phone for', place.name, ':', place.phone);
        }
      } catch (e) {
        console.log('[NEARBY] Phone fetch error for', place.name, e);
      }
    }
    // Re-cache with phone numbers
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch {}
  }

  return result;
}

export function getCategoryIcon(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return 'build';
    case 'vulcanizacion': return 'ellipse';
    case 'medico': return 'medkit';
    case 'carabineros': return 'shield-checkmark';
    case 'grua': return 'car';
  }
}

export function getCategoryLabel(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return 'Taller';
    case 'vulcanizacion': return 'Vulcanización';
    case 'medico': return 'Médico';
    case 'carabineros': return 'Carabineros';
    case 'grua': return 'Motogrúa';
  }
}

export function getCategoryColor(category: NearbyPlace['category']): string {
  switch (category) {
    case 'taller': return '#F59E0B';
    case 'vulcanizacion': return '#8B5CF6';
    case 'medico': return '#EF4444';
    case 'carabineros': return '#1E40AF';
    case 'grua': return '#059669';
  }
}

export function openInGoogleMaps(place: NearbyPlace): string {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + place.latitude + ',' + place.longitude + '&travelmode=driving';
}

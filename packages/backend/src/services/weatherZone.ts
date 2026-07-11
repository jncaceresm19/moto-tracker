import { CHILE_COMUNAS, ComunaZone } from '../data/chileComunas';

const MAX_DISTANCE_KM = 50;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function resolveZone(lat: number, lon: number): ComunaZone | null {
  let closest: ComunaZone | null = null;
  let minDist = Infinity;

  for (const comuna of CHILE_COMUNAS) {
    const dist = haversineDistance(lat, lon, comuna.latitude, comuna.longitude);
    if (dist < minDist) {
      minDist = dist;
      closest = comuna;
    }
  }

  return minDist <= MAX_DISTANCE_KM ? closest : null;
}

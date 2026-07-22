import { Router, Request, Response } from 'express';

const router = Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyAhtFaikZpXvYPWiZVItv12D520Nno_xqk';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Simple in-memory cache
interface CacheEntry {
  data: any;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Get from cache
function getCache(key: string): any | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    console.log('[CACHE] Hit:', key.substring(0, 50));
    return entry.data;
  }
  if (entry) {
    cache.delete(key); // Remove expired
  }
  return null;
}

// Set cache
function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
  console.log('[CACHE] Set:', key.substring(0, 50));
}

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour

// Proxy to Google Places API (Basic tier - free 10,000 requests/month)
router.get('/places', async (req: Request, res: Response) => {
  try {
    const { lat, lon, keyword, radius, type } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // Create cache key
    const cacheKey = `places:${lat}:${lon}:${keyword || ''}:${type || ''}:${radius || 3000}`;
    
    // Check cache first
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Request only basic fields to stay in free tier
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius || 3000}&key=${GOOGLE_API_KEY}&fields=place_id,name,geometry,vicinity,types`;
    
    if (type) url += `&type=${type}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword as string)}`;

    console.log('[GOOGLE-API] Places request:', keyword || type, `| ${radius || 3000}m`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('[GOOGLE-API] Places status:', data.status, '| results:', data.results?.length || 0);
    
    // Cache successful responses
    if (data.status === 'OK') {
      setCache(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Places error:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
});

// Proxy to Google Place Details API (for phone numbers, etc.)
router.get('/places/:placeId/details', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      return res.status(400).json({ error: 'placeId is required' });
    }

    const cacheKey = `place-details:${placeId}`;

    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,international_phone_number&key=${GOOGLE_API_KEY}`;

    console.log('[GOOGLE-API] Place Details request:', placeId);

    const response = await fetch(url);
    const data = await response.json();

    console.log('[GOOGLE-API] Place Details status:', data.status);

    if (data.status === 'OK') {
      setCache(cacheKey, data);
    }

    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Place Details error:', error);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

// Proxy to Google Geocoding API
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // Create cache key (round to 4 decimal places for similar locations)
    const roundedLat = parseFloat(lat as string).toFixed(4);
    const roundedLon = parseFloat(lon as string).toFixed(4);
    const cacheKey = `geocode:${roundedLat}:${roundedLon}`;
    
    // Check cache first
    const cached = getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;
    
    console.log('[GOOGLE-API] Geocode request:', lat, lon);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('[GOOGLE-API] Geocode status:', data.status);
    
    // Cache successful responses
    if (data.status === 'OK') {
      setCache(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode' });
  }
});

export default router;

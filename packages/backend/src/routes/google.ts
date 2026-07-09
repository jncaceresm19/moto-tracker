import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyAhtFaikZpXvYPWiZVItv12D520Nno_xqk';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Initialize cache table
async function initCacheTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS google_cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  } catch (error) {
    console.error('[CACHE] Error creating table:', error);
  }
}

// Get from cache
async function getCache(key: string): Promise<any | null> {
  try {
    const result = await db.execute(sql`
      SELECT data FROM google_cache 
      WHERE key = ${key} AND expires_at > ${Date.now()}
    `);
    const row = (result as any).rows?.[0];
    if (row) {
      console.log('[CACHE] Hit:', key.substring(0, 50));
      return JSON.parse(row.data);
    }
  } catch (error) {
    console.error('[CACHE] Get error:', error);
  }
  return null;
}

// Set cache
async function setCache(key: string, data: any): Promise<void> {
  try {
    await db.execute(sql`
      INSERT OR REPLACE INTO google_cache (key, data, expires_at)
      VALUES (${key}, ${JSON.stringify(data)}, ${Date.now() + CACHE_TTL})
    `);
    console.log('[CACHE] Set:', key.substring(0, 50));
  } catch (error) {
    console.error('[CACHE] Set error:', error);
  }
}

// Clean expired cache entries (run periodically)
async function cleanExpiredCache() {
  try {
    await db.execute(sql`
      DELETE FROM google_cache WHERE expires_at < ${Date.now()}
    `);
  } catch (error) {
    console.error('[CACHE] Clean error:', error);
  }
}

// Initialize on module load
initCacheTable();
setInterval(cleanExpiredCache, 60 * 60 * 1000); // Clean every hour

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
    const cached = await getCache(cacheKey);
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
      await setCache(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Places error:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
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
    const cached = await getCache(cacheKey);
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
      await setCache(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode' });
  }
});

export default router;

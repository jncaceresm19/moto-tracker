import { Router, Request, Response } from 'express';

const router = Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyAhtFaikZpXvYPWiZVItv12D520Nno_xqk';

// Proxy to Google Places API
router.get('/places', async (req: Request, res: Response) => {
  try {
    const { lat, lon, keyword, radius, type } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius || 3000}&key=${GOOGLE_API_KEY}`;
    
    if (type) url += `&type=${type}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword as string)}`;

    console.log('[GOOGLE-API] Places request:', keyword || type, `| ${radius || 3000}m`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('[GOOGLE-API] Places status:', data.status, '| results:', data.results?.length || 0);
    
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

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}`;
    
    console.log('[GOOGLE-API] Geocode request:', lat, lon);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('[GOOGLE-API] Geocode status:', data.status);
    
    res.json(data);
  } catch (error) {
    console.error('[GOOGLE-API] Geocode error:', error);
    res.status(500).json({ error: 'Failed to geocode' });
  }
});

export default router;

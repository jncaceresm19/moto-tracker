import { eq } from 'drizzle-orm';
import { db } from '../db';
import { weatherCache } from '../db/schema';
import { ComunaZone } from '../data/chileComunas';
import { fetchOpenWeatherMap, OpenWeatherResponse } from './openWeatherMap';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getWeatherForZone(zone: ComunaZone): Promise<OpenWeatherResponse> {
  const cached = await db.select().from(weatherCache)
    .where(eq(weatherCache.zoneId, zone.id))
    .get();

  const now = new Date();

  // Return fresh cache if within TTL
  if (cached && (now.getTime() - cached.lastFetchedAt.getTime()) < CACHE_TTL_MS) {
    return JSON.parse(cached.data);
  }

  // Fetch fresh data from OpenWeatherMap
  const freshData = await fetchOpenWeatherMap(zone.latitude, zone.longitude);

  if (cached) {
    // Update existing cache entry
    await db.update(weatherCache)
      .set({
        data: JSON.stringify(freshData),
        lastFetchedAt: now,
        updatedAt: now,
      })
      .where(eq(weatherCache.zoneId, zone.id));
  } else {
    // Insert new cache entry
    await db.insert(weatherCache).values({
      zoneId: zone.id,
      zoneName: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      data: JSON.stringify(freshData),
      lastFetchedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return freshData;
}

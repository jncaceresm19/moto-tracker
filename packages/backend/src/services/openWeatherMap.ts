const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/4.0/onecall';

interface TimelineEntry {
  dt: number;
  precipitation: number;
}

interface OneCall4Response {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  data: TimelineEntry[];
}

export interface RainAlertResult {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
}

export async function fetchOpenWeatherMap(lat: number, lon: number): Promise<OneCall4Response> {
  if (!API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  // Use 1-minute timeline endpoint (returns up to 60 records)
  const url = `${BASE_URL}/timeline/1min?lat=${lat}&lon=${lon}&appid=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`);
  }

  return response.json();
}

export function extractRainAlert(data: OneCall4Response): RainAlertResult {
  const now = Date.now();
  const THRESHOLD_MM = 0.1; // 0.1 mm/h threshold for rain

  // Check 1-minute timeline data (next 60 min)
  if (data.data) {
    for (const entry of data.data) {
      const minutesAhead = (entry.dt * 1000 - now) / 60000;
      if (minutesAhead > 0 && minutesAhead <= 60 && entry.precipitation > THRESHOLD_MM) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(minutesAhead),
          probability: Math.min(100, Math.round((entry.precipitation / 5) * 100)), // rough probability estimate
        };
      }
    }
  }

  return { shouldShow: false, minutesUntilRain: null, probability: 0 };
}

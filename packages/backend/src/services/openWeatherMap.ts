const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';

interface MinutelyEntry {
  dt: number;
  precipitation: number;
  probability: number;
}

interface HourlyEntry {
  dt: number;
  pop: number;
  rain?: { '1h': number };
}

interface OpenWeatherResponse {
  minutely?: MinutelyEntry[];
  hourly?: HourlyEntry[];
}

export interface RainAlertResult {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
}

export async function fetchOpenWeatherMap(lat: number, lon: number): Promise<OpenWeatherResponse> {
  if (!API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&exclude=current,daily,alerts`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`);
  }

  return response.json();
}

export function extractRainAlert(data: OpenWeatherResponse): RainAlertResult {
  const now = Date.now();
  const THRESHOLD = 60; // 60% probability threshold

  // Check minutely data (next 60 min, most precise)
  if (data.minutely) {
    for (const minute of data.minutely) {
      const minutesAhead = (minute.dt * 1000 - now) / 60000;
      if (minutesAhead > 0 && minutesAhead <= 60 && minute.probability > THRESHOLD) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(minutesAhead),
          probability: minute.probability,
        };
      }
    }
  }

  // Check hourly data (next 2 hours)
  if (data.hourly) {
    for (const hour of data.hourly) {
      const hoursAhead = (hour.dt * 1000 - now) / 3600000;
      if (hoursAhead > 0 && hoursAhead <= 2 && hour.pop * 100 > THRESHOLD) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(hoursAhead * 60),
          probability: Math.round(hour.pop * 100),
        };
      }
    }
  }

  return { shouldShow: false, minutesUntilRain: null, probability: 0 };
}

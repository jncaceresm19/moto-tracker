const API_KEY = process.env.OPENWEATHER_API_KEY;

// Free tier endpoints (no subscription needed)
const CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

interface CurrentWeatherResponse {
  weather: { id: number; main: string; description: string }[];
  main: { temp: number; humidity: number };
  rain?: { '1h': number };
  snow?: { '1h': number };
}

interface ForecastResponse {
  list: Array<{
    dt: number;
    pop: number; // probability of precipitation (0-1)
    rain?: { '3h': number };
    snow?: { '3h': number };
    weather: { id: number; main: string }[];
  }>;
}

export interface RainAlertResult {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
}

export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeatherResponse> {
  if (!API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  const url = `${CURRENT_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse> {
  if (!API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  const url = `${FORECAST_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenWeatherMap API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchRainAlert(lat: number, lon: number): Promise<RainAlertResult> {
  const [current, forecast] = await Promise.all([
    fetchCurrentWeather(lat, lon),
    fetchForecast(lat, lon),
  ]);

  const now = Date.now();

  // Check current weather for rain
  if (current.rain && current.rain['1h'] > 0.1) {
    return { shouldShow: true, minutesUntilRain: 0, probability: 100 };
  }
  if (current.snow && current.snow['1h'] > 0.1) {
    return { shouldShow: true, minutesUntilRain: 0, probability: 100 };
  }

  // Check forecast (3-hour intervals for next 24 hours)
  for (const entry of forecast.list) {
    const hoursAhead = (entry.dt * 1000 - now) / 3600000;
    if (hoursAhead > 0 && hoursAhead <= 24) {
      const prob = entry.pop * 100;
      if (prob > 60 || (entry.rain && entry.rain['3h'] > 0.5)) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(hoursAhead * 60),
          probability: Math.round(prob),
        };
      }
    }
  }

  return { shouldShow: false, minutesUntilRain: null, probability: 0 };
}

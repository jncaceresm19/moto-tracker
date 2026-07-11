// Open-Meteo API — free, no key required
// https://open-meteo.com/en/docs

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  current: {
    time: string;
    precipitation: number;
    rain: number;
    showers: number;
    weather_code: number;
  };
  minutely_15: {
    time: string[];
    precipitation_probability: number[];
    precipitation: number[];
  };
}

export interface RainAlertResult {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
}

export async function fetchRainAlert(lat: number, lon: number): Promise<RainAlertResult> {
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=precipitation,rain,showers,weather_code` +
    `&minutely_15=precipitation_probability,precipitation` +
    `&forecast_days=1` +
    `&timezone=America%2FSantiago`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();

  // Check current conditions
  const current = data.current;
  if (current.precipitation > 0.1 || current.rain > 0.1 || current.showers > 0.1) {
    return { shouldShow: true, minutesUntilRain: 0, probability: 100 };
  }

  // Check 15-minute forecast for next 2 hours
  const now = new Date();
  const times = data.minutely_15.time;
  const probs = data.minutely_15.precipitation_probability;
  const precip = data.minutely_15.precipitation;

  for (let i = 0; i < times.length; i++) {
    const forecastTime = new Date(times[i]);
    const minutesAhead = (forecastTime.getTime() - now.getTime()) / 60000;

    if (minutesAhead > 0 && minutesAhead <= 120) {
      const prob = probs[i];
      const mm = precip[i];

      if (prob > 60 || mm > 0.5) {
        return {
          shouldShow: true,
          minutesUntilRain: Math.round(minutesAhead),
          probability: prob,
        };
      }
    }
  }

  return { shouldShow: false, minutesUntilRain: null, probability: 0 };
}

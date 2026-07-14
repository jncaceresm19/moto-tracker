import { api } from '../api';

export interface RainAlertData {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
  message: string | null;
  suggestion: string | null;
  zoneName: string | null;
  currentTemp: number | null;
  weatherCondition: string;
}

export async function fetchRainAlert(lat: number, lon: number): Promise<RainAlertData> {
  return api(`/api/weather/rain-alert?lat=${lat}&lon=${lon}`);
}

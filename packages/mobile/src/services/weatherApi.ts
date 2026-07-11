import { api } from '../api';

export interface RainAlertData {
  shouldShow: boolean;
  minutesUntilRain: number | null;
  probability: number;
  message: string | null;
  suggestion: string | null;
  zoneName: string | null;
}

export async function fetchRainAlert(lat: number, lon: number): Promise<RainAlertData> {
  return api(`/weather/rain-alert?lat=${lat}&lon=${lon}`);
}

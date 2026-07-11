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
  const response = await api.get(`/weather/rain-alert?lat=${lat}&lon=${lon}`);
  return response.data.data;
}

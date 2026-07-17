import { api } from '../api';

export interface GpsTracker {
  id: string;
  imei: string;
  name: string;
  motorcycleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getGpsTrackers(): Promise<GpsTracker[]> {
  return api('/api/gps-trackers');
}

export async function addGpsTracker(imei: string, name: string, motorcycleId?: string): Promise<GpsTracker> {
  return api('/api/gps-trackers', {
    method: 'POST',
    body: { imei, name, motorcycleId },
  });
}

export async function updateGpsTracker(id: string, data: { name?: string; motorcycleId?: string }): Promise<GpsTracker> {
  return api(`/api/gps-trackers/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function removeGpsTracker(id: string): Promise<void> {
  await api(`/api/gps-trackers/${id}`, { method: 'DELETE' });
}

import { api } from '../api';

export interface TheftAlert {
  id: string;
  motorcycleId: string;
  userId: string;
  brand: string;
  model: string;
  licensePlate: string;
  photoUrl?: string;
  lastLatitude: number;
  lastLongitude: number;
  lastLocationName?: string;
  status: 'active' | 'closed' | 'recovered';
  createdAt: Date;
  closedAt?: Date;
  recoveredAt?: Date; // when owner marked as found (card stays green until end of day)
  responseCount?: number;
  ownerPhone?: string; // owner's phone for WhatsApp contact
}

export interface TheftAlertResponse {
  id: string;
  theftAlertId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Date;
}

export interface TheftAlertDetail extends TheftAlert {
  responses: TheftAlertResponse[];
}

// Create theft alert (automatic - with GPS)
export async function createTheftAlert(data: {
  motorcycleId: string;
  lastLatitude: number;
  lastLongitude: number;
  lastLocationName?: string;
}): Promise<TheftAlert> {
  return api<TheftAlert>('/api/theft-alerts', {
    method: 'POST',
    body: data,
  });
}

// Create manual theft alert (without GPS - for emergencies)
export async function createManualPublication(data: {
  motorcycleId: string;
  lastLatitude?: number;
  lastLongitude?: number;
  lastLocationName?: string;
}): Promise<TheftAlert> {
  return api<TheftAlert>('/api/theft-alerts', {
    method: 'POST',
    body: data,
  });
}

// Get active theft alerts
export async function getTheftAlerts(): Promise<TheftAlert[]> {
  return api<TheftAlert[]>('/api/theft-alerts');
}

// Get theft alert detail
export async function getTheftAlertById(id: string): Promise<TheftAlertDetail> {
  return api<TheftAlertDetail>(`/api/theft-alerts/${id}`);
}

// Respond to theft alert
export async function respondToAlert(
  alertId: string,
  text: string
): Promise<TheftAlertResponse> {
  return api<TheftAlertResponse>(`/api/theft-alerts/${alertId}/respond`, {
    method: 'POST',
    body: { text },
  });
}

// Close or recover theft alert
export async function closeAlert(
  alertId: string,
  status: 'closed' | 'recovered'
): Promise<TheftAlert> {
  return api<TheftAlert>(`/api/theft-alerts/${alertId}/close`, {
    method: 'PATCH',
    body: { status },
  });
}

// Get user's publications
export async function getMyPublications(): Promise<TheftAlert[]> {
  return api<TheftAlert[]>('/api/theft-alerts/my');
}

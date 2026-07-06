import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.9:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body }: ApiOptions = {}
): Promise<T> {
  const headers = await getAuthHeaders();

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Request failed');
  }

  return data.data ?? data;
}

// Auth
export async function login(email: string, password: string) {
  const data = await api<{ user: { id: string; email: string }; accessToken: string }>(
    '/api/auth/login',
    { method: 'POST', body: { email, password } }
  );
  await AsyncStorage.setItem('accessToken', data.accessToken);
  return data;
}

export async function register(email: string, password: string, name: string) {
  const data = await api<{ user: { id: string; email: string }; accessToken: string }>(
    '/api/auth/register',
    { method: 'POST', body: { email, password, name } }
  );
  await AsyncStorage.setItem('accessToken', data.accessToken);
  return data;
}

export async function logout() {
  await AsyncStorage.removeItem('accessToken');
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

// Motorcycles
export interface Motorcycle {
  id: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  currentKilometers: number;
  imageUrl?: string;
}

export async function listMotorcycles(): Promise<Motorcycle[]> {
  return api<Motorcycle[]>('/api/motorcycles');
}

export async function getMotorcycle(id: string): Promise<Motorcycle> {
  return api<Motorcycle>(`/api/motorcycles/${id}`);
}

export async function createMotorcycle(data: {
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  currentKilometers?: number;
  gpsTracker?: string;
}): Promise<Motorcycle> {
  return api<Motorcycle>('/api/motorcycles', { method: 'POST', body: data });
}

export async function updateMotorcycle(
  id: string,
  data: { brand?: string; model?: string; year?: number; licensePlate?: string; currentKilometers?: number; imageUrl?: string; gpsTracker?: string }
): Promise<Motorcycle> {
  return api<Motorcycle>(`/api/motorcycles/${id}`, { method: 'PUT', body: data });
}

export async function deleteMotorcycle(id: string): Promise<void> {
  await api(`/api/motorcycles/${id}`, { method: 'DELETE' });
}

// Maintenance Records
export interface MaintenanceRecord {
  id: string;
  motorcycleId: string;
  type: string;
  description: string;
  kilometersAtService: number;
  serviceDate: string;
  cost?: number;
  notes?: string;
}

export async function listMaintenance(motorcycleId: string): Promise<MaintenanceRecord[]> {
  return api<MaintenanceRecord[]>(`/api/motorcycles/${motorcycleId}/maintenance`);
}

export async function createMaintenance(
  motorcycleId: string,
  data: { type: string; description: string; kilometersAtService: number; serviceDate: string; cost?: number; notes?: string }
): Promise<MaintenanceRecord> {
  return api<MaintenanceRecord>(`/api/motorcycles/${motorcycleId}/maintenance`, { method: 'POST', body: data });
}

export async function updateMaintenance(
  motorcycleId: string,
  recordId: string,
  data: { type?: string; description?: string; kilometersAtService?: number; serviceDate?: string; cost?: number | null; notes?: string | null }
): Promise<MaintenanceRecord> {
  return api<MaintenanceRecord>(`/api/motorcycles/${motorcycleId}/maintenance/${recordId}`, { method: 'PUT', body: data });
}

export async function deleteMaintenance(motorcycleId: string, recordId: string): Promise<void> {
  await api(`/api/motorcycles/${motorcycleId}/maintenance/${recordId}`, { method: 'DELETE' });
}

// Documents
export interface Document {
  id: string;
  motorcycleId: string;
  type: string;
  title: string;
  fileUrl: string;
  issueDate?: string;
  expiryDate?: string;
  status: string;
}

export async function listDocuments(motorcycleId: string): Promise<Document[]> {
  return api<Document[]>(`/api/motorcycles/${motorcycleId}/documents`);
}

export async function createDocument(
  motorcycleId: string,
  data: { type: string; title: string; fileUrl: string; issueDate?: string; expiryDate?: string }
): Promise<Document> {
  return api<Document>(`/api/motorcycles/${motorcycleId}/documents`, { method: 'POST', body: data });
}

export async function updateDocument(
  motorcycleId: string,
  docId: string,
  data: { type?: string; title?: string; fileUrl?: string; issueDate?: string | null; expiryDate?: string | null; notes?: string | null; status?: string | null }
): Promise<Document> {
  return api<Document>(`/api/motorcycles/${motorcycleId}/documents/${docId}`, { method: 'PUT', body: data });
}

export async function deleteDocument(motorcycleId: string, docId: string): Promise<void> {
  await api(`/api/motorcycles/${motorcycleId}/documents/${docId}`, { method: 'DELETE' });
}

// Kilometer History
export interface KilometerEntry {
  id: string;
  motorcycleId: string;
  readingKm: number;
  recordedAt: string;
  notes?: string;
}

export async function listKilometers(motorcycleId: string): Promise<KilometerEntry[]> {
  return api<KilometerEntry[]>(`/api/motorcycles/${motorcycleId}/kilometers`);
}

export async function createKilometer(
  motorcycleId: string,
  data: { readingKm: number; recordedAt: string; notes?: string }
): Promise<KilometerEntry> {
  return api<KilometerEntry>(`/api/motorcycles/${motorcycleId}/kilometers`, { method: 'POST', body: data });
}

export async function updateKilometer(
  motorcycleId: string,
  entryId: string,
  data: { readingKm?: number; recordedAt?: string; notes?: string | null }
): Promise<KilometerEntry> {
  return api<KilometerEntry>(`/api/motorcycles/${motorcycleId}/kilometers/${entryId}`, { method: 'PUT', body: data });
}

export async function deleteKilometer(motorcycleId: string, entryId: string): Promise<void> {
  await api(`/api/motorcycles/${motorcycleId}/kilometers/${entryId}`, { method: 'DELETE' });
}

// Profile
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getProfile(): Promise<UserProfile> {
  return api<UserProfile>('/api/profile');
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  avatarUrl?: string;
}): Promise<UserProfile> {
  return api<UserProfile>('/api/profile', { method: 'PUT', body: data });
}

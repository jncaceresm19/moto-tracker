import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:3001';

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
}): Promise<Motorcycle> {
  return api<Motorcycle>('/api/motorcycles', { method: 'POST', body: data });
}

export async function deleteMotorcycle(id: string): Promise<void> {
  await api(`/api/motorcycles/${id}`, { method: 'DELETE' });
}

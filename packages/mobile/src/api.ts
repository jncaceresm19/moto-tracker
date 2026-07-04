import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, token }: ApiOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('accessToken');
}

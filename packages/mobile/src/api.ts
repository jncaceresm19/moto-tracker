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

// Refresh token helper
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    // Refresh token also expired → force logout
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    throw new Error('Session expired');
  }

  const data = await res.json();
  const tokens = data.data || data;
  await AsyncStorage.setItem('accessToken', tokens.accessToken);
  await AsyncStorage.setItem('refreshToken', tokens.refreshToken);
  return tokens.accessToken;
}

export async function api<T = unknown>(
  path: string,
  { method = 'GET', body }: ApiOptions = {}
): Promise<T> {
  const headers = await getAuthHeaders();

  let res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401, try refresh token (skip for auth endpoints — they return 401 for bad credentials)
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) {
      // No refresh token stored → user logged in with old code, force re-login
      await AsyncStorage.removeItem('accessToken');
      throw new Error('SESSION_EXPIRED');
    }

    try {
      // Deduplicate concurrent refresh calls
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }
      const newToken = await refreshPromise!;
      isRefreshing = false;
      refreshPromise = null;

      // Retry original request with new token
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (refreshError) {
      isRefreshing = false;
      refreshPromise = null;
      // If refresh failed with SESSION_EXPIRED, propagate it
      if (refreshError instanceof Error && refreshError.message === 'Session expired') {
        throw new Error('SESSION_EXPIRED');
      }
      throw new Error('SESSION_EXPIRED');
    }
  }

  const data = await res.json();

  if (!res.ok) {
    const details = data.error?.details;
    const msg = data.error?.message || 'Request failed';
    throw new Error(details ? `${msg}: ${JSON.stringify(details)}` : msg);
  }

  return data.data ?? data;
}

// Auth
export async function login(email: string, password: string) {
  const data = await api<{ user: { id: string; email: string; name?: string; phone?: string; avatarUrl?: string; role?: string; createdAt?: string }; accessToken: string; refreshToken: string }>(
    '/api/auth/login',
    { method: 'POST', body: { email, password } }
  );
  await AsyncStorage.setItem('accessToken', data.accessToken);
  await AsyncStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

export async function register(email: string, password: string, name: string, phone?: string, rut?: string, birthDate?: string) {
  // Step 1: Save pending user + send OTP (no tokens yet)
  await api<{ message: string }>(
    '/api/auth/register',
    { method: 'POST', body: { email, password, name, phone, rut, birthDate } }
  );
}

export async function verifyRegistration(email: string, code: string) {
  // Step 2: Verify OTP + create user + get tokens
  const data = await api<{ user: { id: string; email: string }; accessToken: string; refreshToken: string }>(
    '/api/auth/register/verify',
    { method: 'POST', body: { email, code } }
  );
  await AsyncStorage.setItem('accessToken', data.accessToken);
  await AsyncStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

export async function resendRegistrationOtp(email: string, tipo: 'email' | 'phone' = 'email') {
  return api<{ message: string }>('/api/auth/register/resend', {
    method: 'POST',
    body: { email, tipo },
  });
}

export async function logout() {
  await AsyncStorage.removeItem('accessToken');
  await AsyncStorage.removeItem('refreshToken');
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api<{ message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function deleteAccount() {
  await api<{ message: string }>('/api/profile', { method: 'DELETE' });
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
}

// Forgot Password
export async function forgotPassword(email: string) {
  return api<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  return api<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { email, code, newPassword },
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
  gpsTracker?: string;
  color?: string;
  engineNumber?: string;
  chassisNumber?: string;
  serialNumber?: string;
  permitMunicipalityId?: string;
  verificada?: boolean;
  verificadaEn?: string;
  verificadaPor?: string;
  fotoConPatente?: string;
  rtVigente?: boolean;
  encargoRobo?: boolean;
  desvinculada?: boolean;
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
  imageUrl?: string;
  gpsTracker?: string;
  color?: string;
  engineNumber?: string;
  chassisNumber?: string;
  serialNumber?: string;
  permitMunicipalityId?: string | null;
}): Promise<Motorcycle> {
  return api<Motorcycle>('/api/motorcycles', { method: 'POST', body: data });
}

export async function updateMotorcycle(
  id: string,
  data: { brand?: string; model?: string; year?: number; licensePlate?: string; currentKilometers?: number; imageUrl?: string; gpsTracker?: string; color?: string; engineNumber?: string; chassisNumber?: string; serialNumber?: string; permitMunicipalityId?: string | null }
): Promise<Motorcycle> {
  return api<Motorcycle>(`/api/motorcycles/${id}`, { method: 'PUT', body: data });
}

export async function deleteMotorcycle(id: string): Promise<void> {
  await api(`/api/motorcycles/${id}`, { method: 'DELETE' });
}

// Municipalities
export interface Municipality {
  id: string;
  name: string;
  commune: string;
  region: string;
  paymentUrl: string;
  appointmentUrl: string;
  active: boolean;
}

export async function listMunicipalities(search?: string): Promise<Municipality[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return api<Municipality[]>(`/api/municipalities${query}`);
}

export async function getMunicipality(id: string): Promise<Municipality> {
  return api<Municipality>(`/api/municipalities/${id}`);
}

export async function setPermitMunicipality(motorcycleId: string, municipalityId: string | null): Promise<Motorcycle> {
  return api<Motorcycle>(`/api/motorcycles/${motorcycleId}/permit-municipality`, {
    method: 'PUT',
    body: { permitMunicipalityId: municipalityId },
  });
}

export interface PermitPaymentResult {
  url: string;
  municipality: { id: string; name: string; commune: string; region: string };
}

export async function getPermitPaymentUrl(motorcycleId: string): Promise<PermitPaymentResult | null> {
  return api<PermitPaymentResult | null>(`/api/motorcycles/${motorcycleId}/permit-payment-url`);
}

export async function getPermitAppointmentUrl(motorcycleId: string): Promise<PermitPaymentResult | null> {
  return api<PermitPaymentResult | null>(`/api/motorcycles/${motorcycleId}/permit-appointment-url`);
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
  photoUrl?: string;
}

export async function listMaintenance(motorcycleId: string): Promise<MaintenanceRecord[]> {
  return api<MaintenanceRecord[]>(`/api/motorcycles/${motorcycleId}/maintenance`);
}

export async function createMaintenance(
  motorcycleId: string,
  data: { type: string; description: string; kilometersAtService: number; serviceDate: string; cost?: number; notes?: string; photoUrl?: string }
): Promise<MaintenanceRecord> {
  return api<MaintenanceRecord>(`/api/motorcycles/${motorcycleId}/maintenance`, { method: 'POST', body: data });
}

export async function updateMaintenance(
  motorcycleId: string,
  recordId: string,
  data: { type?: string; description?: string; kilometersAtService?: number; serviceDate?: string; cost?: number | null; notes?: string | null; photoUrl?: string | null }
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
  fileUrlBack?: string;
  issueDate?: string;
  expiryDate?: string;
  status: string;
}

export async function listDocuments(motorcycleId: string): Promise<Document[]> {
  return api<Document[]>(`/api/motorcycles/${motorcycleId}/documents`);
}

export async function createDocument(
  motorcycleId: string,
  data: { type: string; title: string; fileUrl: string; fileUrlBack?: string; issueDate?: string; expiryDate?: string }
): Promise<Document> {
  return api<Document>(`/api/motorcycles/${motorcycleId}/documents`, { method: 'POST', body: data });
}

export async function updateDocument(
  motorcycleId: string,
  docId: string,
  data: { type?: string; title?: string; fileUrl?: string; fileUrlBack?: string | null; issueDate?: string | null; expiryDate?: string | null; notes?: string | null; status?: string | null }
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

// Fuel Records
export interface FuelRecord {
  id: string;
  motorcycleId: string;
  stationName?: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  location?: string;
  octane?: string;
  kilometersAtFill?: number;
  recordedAt: string;
  createdAt: string;
}

export async function listFuelRecords(motorcycleId: string): Promise<FuelRecord[]> {
  return api<FuelRecord[]>(`/api/motorcycles/${motorcycleId}/fuel`);
}

export async function createFuelRecord(
  motorcycleId: string,
  data: { stationName?: string; liters: number; pricePerLiter: number; location?: string; octane?: string; kilometersAtFill?: number; recordedAt: string }
): Promise<FuelRecord> {
  return api<FuelRecord>(`/api/motorcycles/${motorcycleId}/fuel`, { method: 'POST', body: data });
}

export async function updateFuelRecord(
  motorcycleId: string,
  entryId: string,
  data: { stationName?: string | null; liters?: number; pricePerLiter?: number; location?: string | null; octane?: string | null; kilometersAtFill?: number | null; recordedAt?: string }
): Promise<FuelRecord> {
  return api<FuelRecord>(`/api/motorcycles/${motorcycleId}/fuel/${entryId}`, { method: 'PUT', body: data });
}

export async function deleteFuelRecord(motorcycleId: string, entryId: string): Promise<void> {
  await api(`/api/motorcycles/${motorcycleId}/fuel/${entryId}`, { method: 'DELETE' });
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
  phone?: string;
  avatarUrl?: string;
}): Promise<UserProfile> {
  return api<UserProfile>('/api/profile', { method: 'PUT', body: data });
}

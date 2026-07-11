import { api } from '../api';

export interface VerificationStatus {
  verificada: boolean;
  verificadaEn: string | null;
  verificadaPor: string | null;
  rtVigente: boolean | null;
  encargoRobo: boolean;
  pendingFiles: Array<{
    id: string;
    tipo: string;
    estado: string;
    createdAt: string;
  }>;
}

export interface VerifyResult {
  verificada: boolean;
  verificadaPor: string;
  rtVigente: boolean;
  encargoRobo: boolean;
  warnings: string[];
}

export async function getVerificationStatus(motorcycleId: string): Promise<{ data: VerificationStatus }> {
  return api(`/api/motorcycles/${motorcycleId}/verification-status`);
}

export async function verifyMotorcycle(
  motorcycleId: string,
  padronUrl: string,
  carnetFrontUrl?: string,
  carnetBackUrl?: string,
  selfieUrl?: string
): Promise<{ data: VerifyResult }> {
  return api(`/api/motorcycles/${motorcycleId}/verify`, {
    method: 'POST',
    body: { padronUrl, carnetFrontUrl, carnetBackUrl, selfieUrl },
  });
}

export async function unlinkMotorcycle(motorcycleId: string): Promise<void> {
  await api(`/api/motorcycles/${motorcycleId}/unlink`, { method: 'POST' });
}

export async function sendOtp(email: string): Promise<void> {
  await api('/api/otp/send', { method: 'POST', body: { email } });
}

export async function verifyOtpCode(code: string): Promise<void> {
  await api('/api/otp/verify', { method: 'POST', body: { code } });
}

export async function getClaveUnicaAuthUrl(): Promise<string> {
  const response = await api<{ authUrl: string }>('/api/auth/claveunica');
  return response.authUrl;
}

export async function claveUnicaCallback(code: string): Promise<{ user: any; accessToken: string; refreshToken: string }> {
  return api('/api/auth/claveunica/callback', { method: 'POST', body: { code } });
}

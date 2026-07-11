import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { users, otps } from '../db/schema';

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(
  userId: string,
  email: string,
  sendEmailFn: (to: string, subject: string, body: string) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { success: false, error: 'USER_NOT_FOUND' };

  if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
    return { success: false, error: 'ACCOUNT_LOCKED' };
  }

  const recentOtp = await db.select().from(otps)
    .where(eq(otps.userId, userId))
    .orderBy(desc(otps.createdAt))
    .get();

  if (recentOtp && (Date.now() - recentOtp.createdAt.getTime()) < RESEND_COOLDOWN_MS) {
    return { success: false, error: 'RESEND_COOLDOWN' };
  }

  const code = generateOtp();
  const now = new Date();

  await db.insert(otps).values({
    id: crypto.randomUUID(),
    userId,
    code,
    tipo: 'email',
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
  });

  await sendEmailFn(email, 'Tu código de verificación - Moto Tracker', `Tu código de verificación es: ${code}. Expira en 5 minutos.`);

  return { success: true };
}

export async function verifyOtp(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return { success: false, error: 'USER_NOT_FOUND' };

  if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
    return { success: false, error: 'ACCOUNT_LOCKED' };
  }

  const otp = await db.select().from(otps)
    .where(and(
      eq(otps.userId, userId),
      eq(otps.code, code),
      eq(otps.used, false),
    ))
    .orderBy(desc(otps.createdAt))
    .get();

  if (!otp) {
    const attempts = (user.otpAttempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db.update(users).set({
        otpAttempts: attempts,
        otpLockedUntil: new Date(Date.now() + LOCKOUT_MS),
      }).where(eq(users.id, userId));
      return { success: false, error: 'ACCOUNT_LOCKED' };
    }
    await db.update(users).set({ otpAttempts: attempts }).where(eq(users.id, userId));
    return { success: false, error: 'INVALID_CODE' };
  }

  if (otp.expiresAt < new Date()) {
    return { success: false, error: 'CODE_EXPIRED' };
  }

  await db.update(otps).set({ used: true }).where(eq(otps.id, otp.id));
  await db.update(users).set({ otpAttempts: 0, otpLockedUntil: null }).where(eq(users.id, userId));

  return { success: true };
}

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, pendingUsers, pendingOtps } from '../db/schema';
import { signTokens, authenticate, JWT_SECRET } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';
import { validateRut, normalizeRut } from '../services/rutValidation';
import { getClaveUnicaAuthUrl, exchangeCodeForToken, getUserInfo } from '../services/claveUnica';
import { sendEmailOtp } from '../services/email';
import { sendSmsOtp } from '../services/sms';

const router = Router();

// --- Zod Schemas ---

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().optional(),
  rut: z.string().min(1, 'RUT is required'),
  birthDate: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const claveUnicaCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

const registerVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

const registerResendSchema = z.object({
  email: z.string().email('Invalid email format'),
  tipo: z.enum(['email', 'phone']).optional().default('email'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// --- Helper: generate OTP code ---
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Helper: send OTP for registration ---
async function sendRegistrationOtp(pendingUserId: string, email: string, phone: string | null, tipo: 'email' | 'phone'): Promise<{ success: boolean; error?: string }> {
  const OTP_EXPIRY_MS = 5 * 60 * 1000;
  const RESEND_COOLDOWN_MS = 30 * 1000;

  // Check cooldown
  const recentOtp = await db.select().from(pendingOtps)
    .where(eq(pendingOtps.pendingUserId, pendingUserId))
    .orderBy(desc(pendingOtps.createdAt))
    .get();

  if (recentOtp && (Date.now() - recentOtp.createdAt.getTime()) < RESEND_COOLDOWN_MS) {
    return { success: false, error: 'RESEND_COOLDOWN' };
  }

  const code = generateOtpCode();
  const now = new Date();

  await db.insert(pendingOtps).values({
    id: crypto.randomUUID(),
    pendingUserId,
    code,
    tipo,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
  });

  const destination = tipo === 'phone' && phone ? phone : email;
  let sent = false;

  if (tipo === 'phone') {
    sent = await sendSmsOtp(destination, code);
  } else {
    sent = await sendEmailOtp(destination, code);
  }

  if (!sent) {
    console.log(`[OTP] Code for ${destination}: ${code}`);
  }

  return { success: true };
}

// --- POST /api/auth/register --- (Step 1: save pending + send OTP)
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, rut, birthDate } = req.body;

    // Validate RUT
    if (!validateRut(rut)) {
      const error = createErrorResponse('BAD_REQUEST', 'Invalid RUT');
      res.status(400).json(error);
      return;
    }

    // Validate age >=18 if birthDate provided
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) {
        const error = createErrorResponse('BAD_REQUEST', 'Debes ser mayor de 18 años para registrarte');
        res.status(400).json(error);
        return;
      }
    }

    const normalizedRut = normalizeRut(rut);

    // Check if email already exists (confirmed user OR pending)
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      const error = createErrorResponse('CONFLICT', 'Email already registered');
      res.status(409).json(error);
      return;
    }

    const existingPending = await db.select().from(pendingUsers).where(eq(pendingUsers.email, email)).get();
    if (existingPending) {
      // Resend OTP for existing pending registration
      const tipo: 'email' | 'phone' = phone ? 'email' : 'email';
      const otpResult = await sendRegistrationOtp(existingPending.id, email, phone || existingPending.phone, tipo);
      if (!otpResult.success) {
        const error = createErrorResponse('RATE_LIMITED', 'Too many requests. Wait a moment and try again.');
        res.status(429).json(error);
        return;
      }
      res.status(200).json({ success: true, data: { message: 'Verification code resent' } });
      return;
    }

    // Check if RUT already exists
    const existingByRut = await db.select().from(users).where(eq(users.rut, normalizedRut)).get();
    if (existingByRut) {
      const error = createErrorResponse('CONFLICT', 'RUT already registered');
      res.status(409).json(error);
      return;
    }

    // Hash password
    const saltRounds = process.env.NODE_ENV === 'test' ? 4 : 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save pending user (NOT confirmed yet)
    const now = new Date();
    const pendingUserId = crypto.randomUUID();

    await db.insert(pendingUsers).values({
      id: pendingUserId,
      email,
      passwordHash,
      name,
      phone: phone || null,
      rut: normalizedRut,
      birthDate: birthDate || null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 min to verify
    });

    // Don't send OTP here — user chooses method in the app first
    res.status(200).json({
      success: true,
      data: { message: 'Pending registration saved. Choose verification method.' },
    });
  } catch (err) {
    console.error('[REGISTER] Unhandled error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to register user');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/register/verify --- (Step 2: verify OTP + create user)
router.post('/register/verify', validateBody(registerVerifySchema), async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    // Find pending user
    const pendingUser = await db.select().from(pendingUsers).where(eq(pendingUsers.email, email)).get();
    if (!pendingUser) {
      const error = createErrorResponse('NOT_FOUND', 'No pending registration found. Please register again.');
      res.status(404).json(error);
      return;
    }

    // Check expiry
    if (pendingUser.expiresAt < new Date()) {
      await db.delete(pendingUsers).where(eq(pendingUsers.id, pendingUser.id));
      const error = createErrorResponse('EXPIRED', 'Registration expired. Please register again.');
      res.status(410).json(error);
      return;
    }

    // Find OTP
    const otp = await db.select().from(pendingOtps)
      .where(and(
        eq(pendingOtps.pendingUserId, pendingUser.id),
        eq(pendingOtps.code, code),
        eq(pendingOtps.used, false),
      ))
      .orderBy(desc(pendingOtps.createdAt))
      .get();

    if (!otp) {
      // Increment attempts
      const allOtps = await db.select().from(pendingOtps)
        .where(eq(pendingOtps.pendingUserId, pendingUser.id))
        .all();
      const usedAttempts = allOtps.length;

      if (usedAttempts >= 5) {
        await db.delete(pendingUsers).where(eq(pendingUsers.id, pendingUser.id));
        const error = createErrorResponse('LOCKED', 'Too many failed attempts. Please register again.');
        res.status(429).json(error);
        return;
      }

      const error = createErrorResponse('INVALID_CODE', 'Invalid verification code.');
      res.status(400).json(error);
      return;
    }

    // Check OTP expiry
    if (otp.expiresAt < new Date()) {
      const error = createErrorResponse('EXPIRED', 'Verification code expired. Request a new one.');
      res.status(410).json(error);
      return;
    }

    // Mark OTP as used
    await db.update(pendingOtps).set({ used: true }).where(eq(pendingOtps.id, otp.id));

    // Create actual user
    const now = new Date();
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email: pendingUser.email,
      passwordHash: pendingUser.passwordHash,
      name: pendingUser.name,
      phone: pendingUser.phone,
      rut: pendingUser.rut,
      birthDate: (pendingUser as any).birthDate || null,
      createdAt: now,
      updatedAt: now,
    });

    // Clean up pending data
    await db.delete(pendingOtps).where(eq(pendingOtps.pendingUserId, pendingUser.id));
    await db.delete(pendingUsers).where(eq(pendingUsers.id, pendingUser.id));

    // Generate tokens
    const tokens = signTokens({ userId, email: pendingUser.email });

    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, email: pendingUser.email, name: pendingUser.name, phone: pendingUser.phone, rut: pendingUser.rut, birthDate: (pendingUser as any).birthDate || null, role: 'user', createdAt: now, updatedAt: now },
        ...tokens,
      },
    });
  } catch (err) {
    console.error('[REGISTER VERIFY] Error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to verify registration');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/register/resend --- (Resend OTP)
router.post('/register/resend', validateBody(registerResendSchema), async (req: Request, res: Response) => {
  try {
    const { email, tipo } = req.body;

    const pendingUser = await db.select().from(pendingUsers).where(eq(pendingUsers.email, email)).get();
    if (!pendingUser) {
      const error = createErrorResponse('NOT_FOUND', 'No pending registration found. Please register again.');
      res.status(404).json(error);
      return;
    }

    const otpResult = await sendRegistrationOtp(pendingUser.id, email, pendingUser.phone || null, tipo);
    if (!otpResult.success) {
      // Cooldown active — tell user to wait, don't fail hard
      res.json({ success: true, data: { message: 'Wait a moment before requesting a new code' } });
      return;
    }

    res.json({ success: true, data: { message: 'Verification code sent' } });
  } catch (err) {
    console.error('[REGISTER RESEND] Error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to resend code');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/login ---
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      const error = createErrorResponse('UNAUTHORIZED', 'Invalid email or password');
      res.status(401).json(error);
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      const error = createErrorResponse('UNAUTHORIZED', 'Invalid email or password');
      res.status(401).json(error);
      return;
    }

    // Generate tokens
    const tokens = signTokens({ userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          birthDate: user.birthDate,
          role: user.role,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
        ...tokens,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to login');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/google ---
router.post('/google', validateBody(googleAuthSchema), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Verify Google ID token by calling Google's tokeninfo endpoint
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!googleResponse.ok) {
      const error = createErrorResponse('UNAUTHORIZED', 'Invalid Google token');
      res.status(401).json(error);
      return;
    }

    const googleUser = await googleResponse.json();
    const { email, name, sub: googleId } = googleUser;

    if (!email) {
      const error = createErrorResponse('UNAUTHORIZED', 'Email not available from Google');
      res.status(401).json(error);
      return;
    }

    // Check if user exists
    let user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      // Create new user
      const now = new Date();
      const userId = crypto.randomUUID();

      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: '', // No password for Google users
        name: name || email.split('@')[0],
        createdAt: now,
        updatedAt: now,
      });

      user = await db.select().from(users).where(eq(users.email, email)).get();
    }

    // Generate tokens
    const tokens = signTokens({ userId: user!.id, email: user!.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user!.id,
          email: user!.email,
          name: user!.name,
          avatarUrl: user!.avatarUrl,
          createdAt: new Date(user!.createdAt),
          updatedAt: new Date(user!.updatedAt),
        },
        ...tokens,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to authenticate with Google');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/change-password ---
router.post('/change-password', authenticate, validateBody(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    // Find user
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      const error = createErrorResponse('NOT_FOUND', 'User not found');
      res.status(404).json(error);
      return;
    }

    // Google users don't have a password
    if (!user.passwordHash) {
      const error = createErrorResponse('BAD_REQUEST', 'Cannot change password for Google accounts');
      res.status(400).json(error);
      return;
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      const error = createErrorResponse('UNAUTHORIZED', 'Current password is incorrect');
      res.status(401).json(error);
      return;
    }

    // Hash new password
    const saltRounds = process.env.NODE_ENV === 'test' ? 4 : 12;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, userId));

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (err) {
    console.error('Change password error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to change password');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/refresh ---
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      const error = createErrorResponse('UNAUTHORIZED', 'Refresh token required');
      res.status(401).json(error);
      return;
    }

    // Verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; email: string };
    } catch {
      const error = createErrorResponse('UNAUTHORIZED', 'Invalid or expired refresh token');
      res.status(401).json(error);
      return;
    }

    // Check user still exists
    const user = await db.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user) {
      const error = createErrorResponse('UNAUTHORIZED', 'User not found');
      res.status(401).json(error);
      return;
    }

    // Generate new tokens
    const tokens = signTokens({ userId: user.id, email: user.email });

    res.json({
      success: true,
      data: tokens,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to refresh token');
    res.status(500).json(error);
  }
});

// --- GET /api/auth/claveunica ---
router.get('/claveunica', (req: Request, res: Response) => {
  try {
    const authUrl = getClaveUnicaAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    console.error('ClaveÚnica auth URL error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to generate ClaveÚnica URL');
    res.status(500).json(error);
  }
});

// --- GET /api/auth/claveunica/callback ---
// ClaveÚnica redirects here with ?code=xxx via GET
router.get('/claveunica/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send('<html><body><h1>Error: No code provided</h1></body></html>');
      return;
    }

    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(code);
    const userInfo = await getUserInfo(tokenResponse.access_token);

    if (!userInfo.run || !userInfo.email) {
      res.status(401).send('<html><body><h1>Error: Incomplete data from ClaveÚnica</h1></body></html>');
      return;
    }

    const normalizedRut = normalizeRut(userInfo.run);

    // Check if user exists by email
    let user = await db.select().from(users).where(eq(users.email, userInfo.email)).get();

    if (user) {
      // User exists — update ClaveÚnica verification status
      if (!user.verificadoClaveunica) {
        await db.update(users).set({
          verificadoClaveunica: true,
          rut: user.rut || normalizedRut,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      }
    } else {
      // Check if user exists by RUT
      user = await db.select().from(users).where(eq(users.rut, normalizedRut)).get();

      if (user) {
        // Link ClaveÚnica to existing account
        await db.update(users).set({
          verificadoClaveunica: true,
          email: userInfo.email,
          name: userInfo.name || user.name,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      } else {
        // Create new user
        const now = new Date();
        const userId = crypto.randomUUID();

        await db.insert(users).values({
          id: userId,
          email: userInfo.email,
          passwordHash: '',
          name: userInfo.name || userInfo.email.split('@')[0],
          rut: normalizedRut,
          verificadoClaveunica: true,
          createdAt: now,
          updatedAt: now,
        });

        user = await db.select().from(users).where(eq(users.id, userId)).get();
      }
    }

    // Generate tokens
    const tokens = signTokens({ userId: user!.id, email: user!.email });

    // Redirect back to the app via deep link with tokens
    const deepLinkUrl = `moto-tracker://claveunica-callback?accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>ClaveÚnica</title></head>
      <body>
        <p>Redirigiendo a la app...</p>
        <script>window.location.href = '${deepLinkUrl}';</script>
        <noscript>
          <meta http-equiv="refresh" content="0;url=${deepLinkUrl}">
        </noscript>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('ClaveÚnica callback error:', err);
    res.status(500).send('<html><body><h1>Error al autenticar con ClaveÚnica</h1></body></html>');
  }
});

// --- POST /api/auth/claveunica/callback (for frontend-initiated flows) ---
router.post('/claveunica/callback', validateBody(claveUnicaCallbackSchema), async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(code);
    const userInfo = await getUserInfo(tokenResponse.access_token);

    if (!userInfo.run || !userInfo.email) {
      const error = createErrorResponse('UNAUTHORIZED', 'Incomplete data from ClaveÚnica');
      res.status(401).json(error);
      return;
    }

    const normalizedRut = normalizeRut(userInfo.run);

    // Check if user exists by email
    let user = await db.select().from(users).where(eq(users.email, userInfo.email)).get();

    if (user) {
      // User exists — update ClaveÚnica verification status
      if (!user.verificadoClaveunica) {
        await db.update(users).set({
          verificadoClaveunica: true,
          rut: user.rut || normalizedRut,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      }
    } else {
      // Check if user exists by RUT
      user = await db.select().from(users).where(eq(users.rut, normalizedRut)).get();

      if (user) {
        // Link ClaveÚnica to existing account
        await db.update(users).set({
          verificadoClaveunica: true,
          email: userInfo.email,
          name: userInfo.name || user.name,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      } else {
        // Create new user
        const now = new Date();
        const userId = crypto.randomUUID();

        await db.insert(users).values({
          id: userId,
          email: userInfo.email,
          passwordHash: '',
          name: userInfo.name || userInfo.email.split('@')[0],
          rut: normalizedRut,
          verificadoClaveunica: true,
          createdAt: now,
          updatedAt: now,
        });

        user = await db.select().from(users).where(eq(users.id, userId)).get();
      }
    }

    // Generate tokens
    const tokens = signTokens({ userId: user!.id, email: user!.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user!.id,
          email: user!.email,
          name: user!.name,
          avatarUrl: user!.avatarUrl,
          rut: user!.rut,
          verificadoClaveunica: user!.verificadoClaveunica,
          createdAt: new Date(user!.createdAt),
          updatedAt: new Date(user!.updatedAt),
        },
        ...tokens,
      },
    });
  } catch (err) {
    console.error('ClaveÚnica callback error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to authenticate with ClaveÚnica');
    res.status(500).json(error);
  }
});

// --- POST /api/auth/forgot-password --- (Send OTP for password reset)
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Always return success to avoid email enumeration
    const successResponse = { success: true, data: { message: 'If the email exists, a code has been sent' } };

    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      res.json(successResponse);
      return;
    }

    // Check cooldown (30s)
    const recentOtp = await db.select().from(pendingOtps)
      .where(eq(pendingOtps.pendingUserId, user.id))
      .orderBy(desc(pendingOtps.createdAt))
      .get();

    if (recentOtp && (Date.now() - recentOtp.createdAt.getTime()) < 30000) {
      res.json(successResponse);
      return;
    }

    // Generate OTP
    const code = generateOtpCode();
    const now = new Date();

    // Use pendingUsers as a temp holder (id = user.id, email = user.email)
    // Clean any previous reset pending for this user
    await db.delete(pendingUsers).where(eq(pendingUsers.id, user.id));

    await db.insert(pendingUsers).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash, // preserve original hash
      name: user.name,
      phone: user.phone,
      rut: user.rut || '',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 min
    });

    // Store OTP linked to the pending user
    await db.insert(pendingOtps).values({
      id: crypto.randomUUID(),
      pendingUserId: user.id,
      code,
      tipo: 'email',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    });

    // Send email
    await sendEmailOtp(user.email, code);

    console.log(`[FORGOT-PASSWORD] OTP sent to ${user.email}`);
    res.json(successResponse);
  } catch (err) {
    console.error('[FORGOT-PASSWORD] Error:', err);
    // Still return success to avoid leaking info
    res.json({ success: true, data: { message: 'If the email exists, a code has been sent' } });
  }
});

// --- POST /api/auth/reset-password --- (Verify OTP + set new password)
router.post('/reset-password', validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await db.select().from(users).where(eq(users.email, email)).get();
    if (!user) {
      const error = createErrorResponse('NOT_FOUND', 'User not found');
      res.status(404).json(error);
      return;
    }

    // Find pending reset entry
    const pending = await db.select().from(pendingUsers)
      .where(eq(pendingUsers.id, user.id))
      .get();

    if (!pending) {
      const error = createErrorResponse('BAD_REQUEST', 'No password reset in progress. Request a new code.');
      res.status(400).json(error);
      return;
    }

    if (pending.expiresAt < new Date()) {
      await db.delete(pendingUsers).where(eq(pendingUsers.id, user.id));
      await db.delete(pendingOtps).where(eq(pendingOtps.pendingUserId, user.id));
      const error = createErrorResponse('EXPIRED', 'Reset code expired. Request a new one.');
      res.status(410).json(error);
      return;
    }

    // Find OTP
    const otp = await db.select().from(pendingOtps)
      .where(and(
        eq(pendingOtps.pendingUserId, user.id),
        eq(pendingOtps.code, code),
        eq(pendingOtps.used, false),
      ))
      .orderBy(desc(pendingOtps.createdAt))
      .get();

    if (!otp) {
      const error = createErrorResponse('INVALID_CODE', 'Invalid verification code');
      res.status(400).json(error);
      return;
    }

    if (otp.expiresAt < new Date()) {
      const error = createErrorResponse('EXPIRED', 'Verification code expired. Request a new one.');
      res.status(410).json(error);
      return;
    }

    // Mark OTP as used
    await db.update(pendingOtps).set({ used: true }).where(eq(pendingOtps.id, otp.id));

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({
      passwordHash: newHash,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    // Clean up
    await db.delete(pendingOtps).where(eq(pendingOtps.pendingUserId, user.id));
    await db.delete(pendingUsers).where(eq(pendingUsers.id, user.id));

    console.log(`[RESET-PASSWORD] Password updated for ${user.email}`);
    res.json({ success: true, data: { message: 'Password updated' } });
  } catch (err) {
    console.error('[RESET-PASSWORD] Error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to reset password');
    res.status(500).json(error);
  }
});

export default router;

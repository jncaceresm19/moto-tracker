import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { signTokens, authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// --- Zod Schemas ---

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
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

// --- POST /api/auth/register ---
router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      const error = createErrorResponse('CONFLICT', 'Email already registered');
      res.status(409).json(error);
      return;
    }

    // Hash password — lower rounds in test for speed
    const saltRounds = process.env.NODE_ENV === 'test' ? 4 : 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const now = new Date();
    const userId = crypto.randomUUID();

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name,
      createdAt: now,
      updatedAt: now,
    });

    // Generate tokens
    const tokens = signTokens({ userId, email });

    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, email, name, createdAt: now, updatedAt: now },
        ...tokens,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to register user');
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

export default router;

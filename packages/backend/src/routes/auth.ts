import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { signTokens } from '../middleware/auth';
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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

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

export default router;

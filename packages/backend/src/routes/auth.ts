import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { users, refreshTokens } from '../db/schema';
import { validateBody } from '../middleware/validate';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  googleAuthSchema,
} from '../validation/auth';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const BCRYPT_SALT_ROUNDS = 12;

// Generate access token
function generateAccessToken(user: { id: string; email: string }, secret: string): string {
  return jwt.sign({ userId: user.id, email: user.email }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

// Generate refresh token
function generateRefreshToken(
  user: { id: string },
  secret: string,
  family?: string
): { token: string; expiresAt: Date; family: string } {
  const tokenFamily = family || uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const token = jwt.sign(
    { userId: user.id, family: tokenFamily },
    secret,
    { expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`, jwtid: uuidv4() }
  );
  return { token, expiresAt, family: tokenFamily };
}

export function createAuthRouter(db: BetterSQLite3Database, jwtSecret: string) {
  const refreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;
  const router = Router();

  // POST /api/auth/register
  router.post('/register', validateBody(registerSchema), async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      // Check if email already exists
      const existing = db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        res.status(409).json(createErrorResponse('CONFLICT', 'Email already registered'));
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

      // Create user
      const now = new Date();
      const userId = uuidv4();
      db.insert(users)
        .values({
          id: userId,
          email,
          passwordHash,
          name,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Generate tokens
      const accessToken = generateAccessToken({ id: userId, email }, jwtSecret);
      const refresh = generateRefreshToken({ id: userId }, refreshSecret);

      // Store refresh token
      db.insert(refreshTokens)
        .values({
          id: uuidv4(),
          userId,
          token: refresh.token,
          family: refresh.family,
          expiresAt: refresh.expiresAt,
          createdAt: now,
        })
        .run();

      res.status(201).json({
        user: {
          id: userId,
          email,
          name,
          createdAt: now,
          updatedAt: now,
        },
        accessToken,
        refreshToken: refresh.token,
      });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // POST /api/auth/login
  router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Find user
      const user = db.select().from(users).where(eq(users.email, email)).get();
      if (!user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid email or password'));
        return;
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid email or password'));
        return;
      }

      // Generate tokens
      const accessToken = generateAccessToken({ id: user.id, email: user.email }, jwtSecret);
      const refresh = generateRefreshToken({ id: user.id }, refreshSecret);

      // Store refresh token
      const now = new Date();
      db.insert(refreshTokens)
        .values({
          id: uuidv4(),
          userId: user.id,
          token: refresh.token,
          family: refresh.family,
          expiresAt: refresh.expiresAt,
          createdAt: now,
        })
        .run();

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken,
        refreshToken: refresh.token,
      });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // POST /api/auth/refresh
  router.post('/refresh', validateBody(refreshTokenSchema), async (req: Request, res: Response) => {
    try {
      const { refreshToken: token } = req.body;

      // Decode token to get family (without verifying expiry — we check DB)
      let decoded: { userId: string; family: string };
      try {
        decoded = jwt.decode(token) as { userId: string; family: string };
        if (!decoded || !decoded.userId || !decoded.family) {
          res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid refresh token'));
          return;
        }
      } catch {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid refresh token'));
        return;
      }

      // Find the refresh token in DB
      const storedToken = db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.token, token))
        .get();

      if (!storedToken) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid refresh token'));
        return;
      }

      // Check if token is revoked
      if (storedToken.revokedAt) {
        // Token family breach detected — revoke entire family
        db.update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.family, storedToken.family))
          .run();

        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Refresh token revoked — possible token theft'));
        return;
      }

      // Check if token is expired (with 30s grace window for rotation)
      const graceWindow = 30 * 1000;
      if (storedToken.expiresAt.getTime() < Date.now() - graceWindow) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Refresh token expired'));
        return;
      }

      // Verify the JWT signature
      try {
        jwt.verify(token, refreshSecret);
      } catch {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Invalid refresh token'));
        return;
      }

      // Issue new tokens (rotate)
      const newRefresh = generateRefreshToken({ id: decoded.userId }, refreshSecret, storedToken.family);
      const now = new Date();

      // Revoke old token (with grace window — it stays valid for 30s)
      db.update(refreshTokens)
        .set({ revokedAt: now })
        .where(eq(refreshTokens.id, storedToken.id))
        .run();

      // Store new refresh token
      db.insert(refreshTokens)
        .values({
          id: uuidv4(),
          userId: decoded.userId,
          token: newRefresh.token,
          family: newRefresh.family,
          expiresAt: newRefresh.expiresAt,
          createdAt: now,
        })
        .run();

      // Generate new access token
      const user = db.select().from(users).where(eq(users.id, decoded.userId)).get();
      if (!user) {
        res.status(401).json(createErrorResponse('UNAUTHORIZED', 'User not found'));
        return;
      }

      const accessToken = generateAccessToken({ id: user.id, email: user.email }, jwtSecret);

      res.json({
        accessToken,
        refreshToken: newRefresh.token,
      });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // GET /api/auth/me
  router.get('/me', createAuthenticate(jwtSecret), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const user = db.select().from(users).where(eq(users.id, authPayload.userId)).get();

      if (!user) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found'));
        return;
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // POST /api/auth/google
  router.post('/google', validateBody(googleAuthSchema), async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;

      // Verify Google ID token
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch {
        res.status(401).json(createErrorResponse('GOOGLE_TOKEN_INVALID', 'Invalid Google token'));
        return;
      }

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        res.status(401).json(createErrorResponse('GOOGLE_TOKEN_INVALID', 'Invalid Google token payload'));
        return;
      }

      const { sub: googleId, email, name, picture } = payload;

      // Check if user exists by google_id or email
      let user = db
        .select()
        .from(users)
        .where(eq(users.googleId, googleId))
        .get();

      if (!user) {
        // Check by email
        user = db.select().from(users).where(eq(users.email, email)).get();

        if (user) {
          // Link Google account to existing email user
          db.update(users)
            .set({ googleId, avatarUrl: picture || user.avatarUrl, updatedAt: new Date() })
            .where(eq(users.id, user.id))
            .run();
          user = { ...user, googleId, avatarUrl: picture || user.avatarUrl };
        } else {
          // Create new user
          const now = new Date();
          const userId = uuidv4();
          db.insert(users)
            .values({
              id: userId,
              email,
              passwordHash: '', // No password for OAuth users
              name: name || email.split('@')[0],
              googleId,
              avatarUrl: picture || undefined,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          user = {
            id: userId,
            email,
            passwordHash: '',
            name: name || email.split('@')[0],
            googleId,
            avatarUrl: picture || undefined,
            createdAt: now,
            updatedAt: now,
          };
        }
      }

      // Generate tokens
      const accessToken = generateAccessToken({ id: user.id, email: user.email }, jwtSecret);
      const refresh = generateRefreshToken({ id: user.id }, refreshSecret);

      // Store refresh token
      const now = new Date();
      db.insert(refreshTokens)
        .values({
          id: uuidv4(),
          userId: user.id,
          token: refresh.token,
          family: refresh.family,
          expiresAt: refresh.expiresAt,
          createdAt: now,
        })
        .run();

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken,
        refreshToken: refresh.token,
      });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createAuthRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

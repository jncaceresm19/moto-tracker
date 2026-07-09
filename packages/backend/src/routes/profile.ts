import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// --- Zod Schemas ---

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().max(10000000).optional(), // Base64 data URI (up to ~10MB)
});

// --- PUT /api/profile ---
router.put('/', authenticate, validateBody(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, avatarUrl } = req.body;

    // Check if user exists
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      const error = createErrorResponse('NOT_FOUND', 'User not found');
      res.status(404).json(error);
      return;
    }

    // If changing email, check if it's already taken
    if (email && email !== user.email) {
      const existing = await db.select().from(users).where(eq(users.email, email)).get();
      if (existing) {
        const error = createErrorResponse('CONFLICT', 'Email already in use');
        res.status(409).json(error);
        return;
      }
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    // Update user
    await db.update(users).set(updates).where(eq(users.id, userId));

    // Return updated user
    const updated = await db.select().from(users).where(eq(users.id, userId)).get();

    res.json({
      success: true,
      data: {
        id: updated!.id,
        email: updated!.email,
        name: updated!.name,
        phone: updated!.phone,
        avatarUrl: updated!.avatarUrl,
        createdAt: new Date(updated!.createdAt),
        updatedAt: new Date(updated!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update profile');
    res.status(500).json(error);
  }
});

// --- GET /api/profile ---
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      const error = createErrorResponse('NOT_FOUND', 'User not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to get profile');
    res.status(500).json(error);
  }
});

export default router;

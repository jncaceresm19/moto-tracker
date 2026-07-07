import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { motorcycles } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// All motorcycle routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const createMotorcycleSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  year: z.number().int().min(1900).max(2100),
  licensePlate: z.string().min(1, 'License plate is required').max(20),
  brandId: z.string().uuid().optional(),
  modelId: z.string().uuid().optional(),
  currentKilometers: z.number().min(0).optional().default(0),
  imageUrl: z.string().refine((v) => v.startsWith('data:image/') || /^https?:\/\//.test(v), 'Invalid image').optional(),
  gpsTracker: z.string().max(100).nullable().optional(),
});

const updateMotorcycleSchema = z.object({
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  licensePlate: z.string().min(1).max(20).optional(),
  brandId: z.string().uuid().nullable().optional(),
  modelId: z.string().uuid().nullable().optional(),
  currentKilometers: z.number().min(0).optional(),
  imageUrl: z.string().refine((v) => v.startsWith('data:image/') || /^https?:\/\//.test(v), 'Invalid image').nullable().optional(),
  gpsTracker: z.string().max(100).nullable().optional(),
});

const motorcycleIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
});

interface MotorcycleParams {
  id: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as MotorcycleParams).id;
}

// --- GET /api/motorcycles ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userMotorcycles = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.userId, userId));

    res.json({
      success: true,
      data: userMotorcycles.map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      })),
    });
  } catch (err) {
    console.error('List motorcycles error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch motorcycles');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id ---
router.get('/:id', validateParams(motorcycleIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...motorcycle,
        createdAt: new Date(motorcycle.createdAt),
        updatedAt: new Date(motorcycle.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch motorcycle');
    res.status(500).json(error);
  }
});

// --- POST /api/motorcycles ---
router.post('/', validateBody(createMotorcycleSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { brand, model, year, licensePlate, brandId, modelId, currentKilometers, imageUrl, gpsTracker } = req.body;

    // Check for duplicate license plate
    const existing = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.licensePlate, licensePlate))
      .get();

    if (existing) {
      const error = createErrorResponse('CONFLICT', 'A motorcycle with this license plate already exists');
      res.status(409).json(error);
      return;
    }

    const now = new Date();
    const motorcycleId = crypto.randomUUID();

    await db.insert(motorcycles).values({
      id: motorcycleId,
      userId,
      brand,
      model,
      year,
      licensePlate,
      brandId: brandId ?? null,
      modelId: modelId ?? null,
      currentKilometers: currentKilometers ?? 0,
      imageUrl: imageUrl ?? null,
      gpsTracker: gpsTracker ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.id, motorcycleId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        createdAt: new Date(created!.createdAt),
        updatedAt: new Date(created!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Create motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create motorcycle');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id ---
router.put('/:id', validateParams(motorcycleIdParam), validateBody(updateMotorcycleSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    // Verify ownership
    const existing = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    // Check license plate conflict if changing
    if (req.body.licensePlate && req.body.licensePlate !== existing.licensePlate) {
      const plateConflict = await db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.licensePlate, req.body.licensePlate))
        .get();

      if (plateConflict) {
        const error = createErrorResponse('CONFLICT', 'A motorcycle with this license plate already exists');
        res.status(409).json(error);
        return;
      }
    }

    const now = new Date();

    await db
      .update(motorcycles)
      .set({
        ...req.body,
        updatedAt: now,
      })
      .where(eq(motorcycles.id, id));

    const updated = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.id, id))
      .get();

    res.json({
      success: true,
      data: {
        ...updated!,
        createdAt: new Date(updated!.createdAt),
        updatedAt: new Date(updated!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Update motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update motorcycle');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id ---
router.delete('/:id', validateParams(motorcycleIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    const existing = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    await db.delete(motorcycles).where(eq(motorcycles.id, id));

    res.json({ success: true, message: 'Motorcycle deleted' });
  } catch (err) {
    console.error('Delete motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete motorcycle');
    res.status(500).json(error);
  }
});

export default router;

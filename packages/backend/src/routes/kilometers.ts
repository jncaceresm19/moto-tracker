import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { kilometerHistory, motorcycles } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router({ mergeParams: true });

// All kilometer routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const createKilometerSchema = z.object({
  readingKm: z.number().min(0, 'Kilometers must be non-negative'),
  recordedAt: z.string().datetime('Invalid recorded date'),
  notes: z.string().max(500).optional(),
});

const updateKilometerSchema = z.object({
  readingKm: z.number().min(0).optional(),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const motorcycleIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
});

const entryIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
  entryId: z.string().uuid('Invalid entry ID'),
});

interface KilometerParams {
  id: string;
  entryId?: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as KilometerParams).id;
}

function getEntryId(req: Request): string {
  return (req.params as unknown as KilometerParams).entryId!;
}

// --- POST /api/motorcycles/:id/kilometers ---
router.post('/', validateBody(createKilometerSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);

    // Verify motorcycle belongs to user
    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    const { readingKm, recordedAt, notes } = req.body;
    const now = new Date();
    const entryId = crypto.randomUUID();

    await db.insert(kilometerHistory).values({
      id: entryId,
      motorcycleId,
      readingKm,
      recordedAt: new Date(recordedAt),
      notes: notes ?? null,
      createdAt: now,
    });

    // Auto-update motorcycle currentKilometers if new reading is higher
    if (readingKm > (motorcycle.currentKilometers ?? 0)) {
      await db
        .update(motorcycles)
        .set({ currentKilometers: readingKm, updatedAt: now })
        .where(eq(motorcycles.id, motorcycleId));
    }

    const created = await db
      .select()
      .from(kilometerHistory)
      .where(eq(kilometerHistory.id, entryId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        recordedAt: new Date(created!.recordedAt),
        createdAt: new Date(created!.createdAt),
      },
    });
  } catch (err) {
    console.error('Create kilometer entry error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create kilometer entry');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/kilometers ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);

    // Verify motorcycle belongs to user
    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    const entries = await db
      .select()
      .from(kilometerHistory)
      .where(eq(kilometerHistory.motorcycleId, motorcycleId))
      .orderBy(desc(kilometerHistory.recordedAt));

    res.json({
      success: true,
      data: entries.map((e) => ({
        ...e,
        recordedAt: new Date(e.recordedAt),
        createdAt: new Date(e.createdAt),
      })),
    });
  } catch (err) {
    console.error('List kilometer entries error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch kilometer entries');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/kilometers/:entryId ---
router.get('/:entryId', validateParams(entryIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const entryId = getEntryId(req);

    // Verify motorcycle belongs to user
    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    const entry = await db
      .select()
      .from(kilometerHistory)
      .where(and(eq(kilometerHistory.id, entryId), eq(kilometerHistory.motorcycleId, motorcycleId)))
      .get();

    if (!entry) {
      const error = createErrorResponse('NOT_FOUND', 'Kilometer entry not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...entry,
        recordedAt: new Date(entry.recordedAt),
        createdAt: new Date(entry.createdAt),
      },
    });
  } catch (err) {
    console.error('Get kilometer entry error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch kilometer entry');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id/kilometers/:entryId ---
router.put('/:entryId', validateParams(entryIdParam), validateBody(updateKilometerSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const entryId = getEntryId(req);

    // Verify motorcycle belongs to user
    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    // Verify entry belongs to motorcycle
    const existing = await db
      .select()
      .from(kilometerHistory)
      .where(and(eq(kilometerHistory.id, entryId), eq(kilometerHistory.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Kilometer entry not found');
      res.status(404).json(error);
      return;
    }

    const now = new Date();
    const updates: Record<string, unknown> = {};

    if (req.body.readingKm !== undefined) updates.readingKm = req.body.readingKm;
    if (req.body.recordedAt !== undefined) updates.recordedAt = new Date(req.body.recordedAt);
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    if (Object.keys(updates).length > 0) {
      await db
        .update(kilometerHistory)
        .set(updates)
        .where(eq(kilometerHistory.id, entryId));
    }

    // Auto-update motorcycle currentKilometers if reading changed and is higher
    const newReadingKm = req.body.readingKm ?? existing.readingKm;
    if (newReadingKm > (motorcycle.currentKilometers ?? 0)) {
      await db
        .update(motorcycles)
        .set({ currentKilometers: newReadingKm, updatedAt: now })
        .where(eq(motorcycles.id, motorcycleId));
    }

    const updated = await db
      .select()
      .from(kilometerHistory)
      .where(eq(kilometerHistory.id, entryId))
      .get();

    res.json({
      success: true,
      data: {
        ...updated!,
        recordedAt: new Date(updated!.recordedAt),
        createdAt: new Date(updated!.createdAt),
      },
    });
  } catch (err) {
    console.error('Update kilometer entry error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update kilometer entry');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id/kilometers/:entryId ---
router.delete('/:entryId', validateParams(entryIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const entryId = getEntryId(req);

    // Verify motorcycle belongs to user
    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    // Verify entry belongs to motorcycle
    const existing = await db
      .select()
      .from(kilometerHistory)
      .where(and(eq(kilometerHistory.id, entryId), eq(kilometerHistory.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Kilometer entry not found');
      res.status(404).json(error);
      return;
    }

    await db.delete(kilometerHistory).where(eq(kilometerHistory.id, entryId));

    res.json({ success: true, message: 'Kilometer entry deleted' });
  } catch (err) {
    console.error('Delete kilometer entry error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete kilometer entry');
    res.status(500).json(error);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { fuelRecords, motorcycles } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router({ mergeParams: true });

// All fuel routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const createFuelRecordSchema = z.object({
  stationName: z.string().max(200).optional(),
  liters: z.number().positive('Liters must be positive'),
  pricePerLiter: z.number().positive('Price per liter must be positive'),
  location: z.string().max(500).optional(),
  octane: z.enum(['93', '95', '97']).optional(),
  kilometersAtFill: z.number().positive('Kilometers must be positive').optional(),
  recordedAt: z.string().datetime('Invalid recorded date'),
  notes: z.string().max(500).optional(),
});

const updateFuelRecordSchema = z.object({
  stationName: z.string().max(200).nullable().optional(),
  liters: z.number().positive().optional(),
  pricePerLiter: z.number().positive().optional(),
  location: z.string().max(500).nullable().optional(),
  octane: z.enum(['93', '95', '97']).nullable().optional(),
  kilometersAtFill: z.number().positive().nullable().optional(),
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

interface FuelParams {
  id: string;
  entryId?: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as FuelParams).id;
}

function getEntryId(req: Request): string {
  return (req.params as unknown as FuelParams).entryId!;
}

// --- POST /api/motorcycles/:id/fuel ---
router.post('/', validateBody(createFuelRecordSchema), async (req: Request, res: Response) => {
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

    const { stationName, liters, pricePerLiter, location, octane, kilometersAtFill, recordedAt, notes } = req.body;
    const totalCost = liters * pricePerLiter;
    const now = new Date();
    const entryId = crypto.randomUUID();

    await db.insert(fuelRecords).values({
      id: entryId,
      motorcycleId,
      stationName: stationName ?? null,
      liters,
      pricePerLiter,
      totalCost,
      location: location ?? null,
      octane: octane ?? null,
      kilometersAtFill: kilometersAtFill ?? null,
      recordedAt: new Date(recordedAt),
      notes: notes ?? null,
      createdAt: now,
    });

    const created = await db
      .select()
      .from(fuelRecords)
      .where(eq(fuelRecords.id, entryId))
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
    console.error('Create fuel record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create fuel record');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/fuel ---
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
      .from(fuelRecords)
      .where(eq(fuelRecords.motorcycleId, motorcycleId))
      .orderBy(desc(fuelRecords.recordedAt));

    res.json({
      success: true,
      data: entries.map((e) => ({
        ...e,
        recordedAt: new Date(e.recordedAt),
        createdAt: new Date(e.createdAt),
      })),
    });
  } catch (err) {
    console.error('List fuel records error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch fuel records');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/fuel/:entryId ---
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
      .from(fuelRecords)
      .where(and(eq(fuelRecords.id, entryId), eq(fuelRecords.motorcycleId, motorcycleId)))
      .get();

    if (!entry) {
      const error = createErrorResponse('NOT_FOUND', 'Fuel record not found');
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
    console.error('Get fuel record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch fuel record');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id/fuel/:entryId ---
router.put('/:entryId', validateParams(entryIdParam), validateBody(updateFuelRecordSchema), async (req: Request, res: Response) => {
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
      .from(fuelRecords)
      .where(and(eq(fuelRecords.id, entryId), eq(fuelRecords.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Fuel record not found');
      res.status(404).json(error);
      return;
    }

    const now = new Date();
    const updates: Record<string, unknown> = {};

    if (req.body.stationName !== undefined) updates.stationName = req.body.stationName;
    if (req.body.liters !== undefined) updates.liters = req.body.liters;
    if (req.body.pricePerLiter !== undefined) updates.pricePerLiter = req.body.pricePerLiter;
    if (req.body.location !== undefined) updates.location = req.body.location;
    if (req.body.octane !== undefined) updates.octane = req.body.octane;
    if (req.body.kilometersAtFill !== undefined) updates.kilometersAtFill = req.body.kilometersAtFill;
    if (req.body.recordedAt !== undefined) updates.recordedAt = new Date(req.body.recordedAt);
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    // Recalculate total cost if liters or price changed
    if (req.body.liters !== undefined || req.body.pricePerLiter !== undefined) {
      const liters = req.body.liters ?? existing.liters;
      const pricePerLiter = req.body.pricePerLiter ?? existing.pricePerLiter;
      updates.totalCost = liters * pricePerLiter;
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(fuelRecords)
        .set(updates)
        .where(eq(fuelRecords.id, entryId));
    }

    const updated = await db
      .select()
      .from(fuelRecords)
      .where(eq(fuelRecords.id, entryId))
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
    console.error('Update fuel record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update fuel record');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id/fuel/:entryId ---
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
      .from(fuelRecords)
      .where(and(eq(fuelRecords.id, entryId), eq(fuelRecords.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Fuel record not found');
      res.status(404).json(error);
      return;
    }

    await db.delete(fuelRecords).where(eq(fuelRecords.id, entryId));

    res.json({ success: true, message: 'Fuel record deleted' });
  } catch (err) {
    console.error('Delete fuel record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete fuel record');
    res.status(500).json(error);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { maintenanceRecords, motorcycles, notifications } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';
import { createNotification } from './notifications';

const router = Router({ mergeParams: true });

// All maintenance routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const maintenanceTypes = [
  'oil_change',
  'tire_change',
  'brake_check',
  'spark_plugs',
  'technical_review',
  'circulation_permit',
  'motor_oil',
  'air_filter',
  'drive_chain',
  'brakes',
  'battery',
  'tires',
  'coolant',
  'valve_adjustment',
  'other',
] as const;

const createMaintenanceSchema = z.object({
  type: z.string().min(1, 'Type is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  kilometersAtService: z.number().min(0, 'Kilometers must be non-negative'),
  serviceDate: z.string().datetime('Invalid service date'),
  cost: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().max(1000000).optional(), // Base64 image
  nextServiceKilometers: z.number().min(0).optional(),
  nextServiceDate: z.string().datetime().optional(),
  oilTypeId: z.string().uuid().optional(),
});

const updateMaintenanceSchema = z.object({
  type: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  kilometersAtService: z.number().min(0).optional(),
  serviceDate: z.string().datetime().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  photoUrl: z.string().max(1000000).nullable().optional(), // Base64 image
  nextServiceKilometers: z.number().min(0).nullable().optional(),
  nextServiceDate: z.string().datetime().nullable().optional(),
  oilTypeId: z.string().uuid().nullable().optional(),
});

const motorcycleIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
});

const recordIdParam = z.object({
  recordId: z.string().uuid('Invalid record ID'),
});

// ── Notification helpers ───────────────────────────────────────────
async function scheduleMaintenanceNotifications(
  userId: string,
  motorcycleId: string,
  description: string,
  nextDate: Date,
) {
  const now = new Date();
  const intervals = [
    { days: 14, label: '2 semanas' },
    { days: 7, label: '1 semana' },
    { days: 1, label: '1 día' },
  ];

  for (const interval of intervals) {
    const showAt = new Date(nextDate);
    showAt.setDate(showAt.getDate() - interval.days);
    if (showAt > now) {
      await createNotification({
        userId,
        motorcycleId,
        type: 'maintenance_due',
        title: `Mantención en ${interval.label}`,
        message: `"${description}" — programada para el ${nextDate.toLocaleDateString('es-CL')}`,
        showAt,
      });
    }
  }
}

async function clearMaintenanceNotifications(
  userId: string,
  motorcycleId: string,
  recordId: string,
) {
  // Delete existing scheduled notifications for this record
  await db.delete(notifications).where(
    and(
      eq(notifications.userId, userId),
      eq(notifications.motorcycleId, motorcycleId),
      eq(notifications.type, 'maintenance_due'),
      sql`${notifications.message} LIKE ${'%' + recordId + '%'}`,
    )
  );
}

// ── Helper types & fns ────────────────────────────────────────────
interface MaintenanceParams {
  id: string;
  recordId?: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as MaintenanceParams).id;
}

function getRecordId(req: Request): string {
  return (req.params as unknown as MaintenanceParams).recordId!;
}

// --- POST /api/motorcycles/:id/maintenance ---
router.post('/', validateBody(createMaintenanceSchema), async (req: Request, res: Response) => {
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

    const { type, description, kilometersAtService, serviceDate, cost, notes, photoUrl, nextServiceKilometers, nextServiceDate, oilTypeId } = req.body;
    const now = new Date();
    const recordId = crypto.randomUUID();

    await db.insert(maintenanceRecords).values({
      id: recordId,
      motorcycleId,
      type,
      description,
      kilometersAtService,
      serviceDate: new Date(serviceDate),
      cost: cost ?? null,
      notes: notes ?? null,
      photoUrl: photoUrl ?? null,
      nextServiceKilometers: nextServiceKilometers ?? null,
      nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
      oilTypeId: oilTypeId ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.id, recordId))
      .get();

    // Schedule maintenance notifications
    if (nextServiceDate) {
      scheduleMaintenanceNotifications(userId, motorcycleId, description, new Date(nextServiceDate))
        .catch(err => console.error('Error scheduling maintenance notifications:', err));
    }

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        serviceDate: new Date(created!.serviceDate),
        nextServiceDate: created!.nextServiceDate ? new Date(created!.nextServiceDate) : null,
        createdAt: new Date(created!.createdAt),
        updatedAt: new Date(created!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Create maintenance record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create maintenance record');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/maintenance ---
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

    const records = await db
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.motorcycleId, motorcycleId));

    res.json({
      success: true,
      data: records.map((r) => ({
        ...r,
        serviceDate: new Date(r.serviceDate),
        nextServiceDate: r.nextServiceDate ? new Date(r.nextServiceDate) : null,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      })),
    });
  } catch (err) {
    console.error('List maintenance records error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch maintenance records');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/maintenance/:recordId ---
router.get('/:recordId', validateParams(recordIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const recordId = getRecordId(req);

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

    const record = await db
      .select()
      .from(maintenanceRecords)
      .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.motorcycleId, motorcycleId)))
      .get();

    if (!record) {
      const error = createErrorResponse('NOT_FOUND', 'Maintenance record not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...record,
        serviceDate: new Date(record.serviceDate),
        nextServiceDate: record.nextServiceDate ? new Date(record.nextServiceDate) : null,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get maintenance record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch maintenance record');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id/maintenance/:recordId ---
router.put('/:recordId', validateParams(recordIdParam), validateBody(updateMaintenanceSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const recordId = getRecordId(req);

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

    // Verify record belongs to motorcycle
    const existing = await db
      .select()
      .from(maintenanceRecords)
      .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Maintenance record not found');
      res.status(404).json(error);
      return;
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.kilometersAtService !== undefined) updates.kilometersAtService = req.body.kilometersAtService;
    if (req.body.serviceDate !== undefined) updates.serviceDate = new Date(req.body.serviceDate);
    if (req.body.cost !== undefined) updates.cost = req.body.cost;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.photoUrl !== undefined) updates.photoUrl = req.body.photoUrl;
    if (req.body.nextServiceKilometers !== undefined) updates.nextServiceKilometers = req.body.nextServiceKilometers;
    if (req.body.nextServiceDate !== undefined) updates.nextServiceDate = req.body.nextServiceDate ? new Date(req.body.nextServiceDate) : null;
    if (req.body.oilTypeId !== undefined) updates.oilTypeId = req.body.oilTypeId;

    await db
      .update(maintenanceRecords)
      .set(updates)
      .where(eq(maintenanceRecords.id, recordId));

    const updated = await db
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.id, recordId))
      .get();

    // Re-schedule notifications if nextServiceDate changed
    if (req.body.nextServiceDate !== undefined) {
      clearMaintenanceNotifications(userId, motorcycleId, recordId)
        .catch(() => {});
      if (req.body.nextServiceDate) {
        const desc = (updates.description as string) || existing.description;
        scheduleMaintenanceNotifications(userId, motorcycleId, desc, new Date(req.body.nextServiceDate))
          .catch(err => console.error('Error scheduling maintenance notifications:', err));
      }
    }

    res.json({
      success: true,
      data: {
        ...updated!,
        serviceDate: new Date(updated!.serviceDate),
        nextServiceDate: updated!.nextServiceDate ? new Date(updated!.nextServiceDate) : null,
        createdAt: new Date(updated!.createdAt),
        updatedAt: new Date(updated!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Update maintenance record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update maintenance record');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id/maintenance/:recordId ---
router.delete('/:recordId', validateParams(recordIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const recordId = getRecordId(req);

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

    // Verify record belongs to motorcycle
    const existing = await db
      .select()
      .from(maintenanceRecords)
      .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Maintenance record not found');
      res.status(404).json(error);
      return;
    }

    await db.delete(maintenanceRecords).where(eq(maintenanceRecords.id, recordId));

    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (err) {
    console.error('Delete maintenance record error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete maintenance record');
    res.status(500).json(error);
  }
});

export default router;

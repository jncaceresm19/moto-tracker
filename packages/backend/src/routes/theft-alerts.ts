import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count, or, gte } from 'drizzle-orm';
import { db } from '../db';
import { theftAlerts, theftAlertResponses, motorcycles, users } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// All theft alert routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const createTheftAlertSchema = z.object({
  motorcycleId: z.string().uuid('Invalid motorcycle ID'),
  lastLatitude: z.number().min(-90).max(90).optional(),
  lastLongitude: z.number().min(-180).max(180).optional(),
  lastLocationName: z.string().max(200).optional(),
});

const respondSchema = z.object({
  text: z.string().min(1, 'Response text is required').max(500, 'Response too long'),
});

const closeSchema = z.object({
  status: z.enum(['closed', 'recovered']),
});

const alertIdParam = z.object({
  id: z.string().uuid('Invalid alert ID'),
});

// --- POST /api/theft-alerts ---
router.post('/', validateBody(createTheftAlertSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { motorcycleId, lastLatitude, lastLongitude, lastLocationName } = req.body;

    // For manual publications without GPS, use null coordinates
    const latitude = lastLatitude ?? null;
    const longitude = lastLongitude ?? null;

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

    // Check for existing active alert for this motorcycle
    const existingAlert = await db
      .select()
      .from(theftAlerts)
      .where(
        and(
          eq(theftAlerts.motorcycleId, motorcycleId),
          eq(theftAlerts.status, 'active')
        )
      )
      .get();

    if (existingAlert) {
      const error = createErrorResponse('CONFLICT', 'Active theft alert already exists for this motorcycle');
      res.status(409).json(error);
      return;
    }

    const now = new Date();
    const alertId = crypto.randomUUID();

    // Create theft alert with denormalized motorcycle data
    await db.insert(theftAlerts).values({
      id: alertId,
      motorcycleId,
      userId,
      brand: motorcycle.brand,
      model: motorcycle.model,
      licensePlate: motorcycle.licensePlate,
      photoUrl: motorcycle.imageUrl,
      lastLatitude: latitude,
      lastLongitude: longitude,
      lastLocationName: lastLocationName ?? null,
      status: 'active',
      createdAt: now,
    });

    const created = await db
      .select()
      .from(theftAlerts)
      .where(eq(theftAlerts.id, alertId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        createdAt: new Date(created!.createdAt),
      },
    });
  } catch (err) {
    console.error('Create theft alert error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create theft alert');
    res.status(500).json(error);
  }
});

// --- GET /api/theft-alerts ---
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get active alerts + recovered today (keep green card on home until end of day)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const alerts = await db
      .select({
        id: theftAlerts.id,
        motorcycleId: theftAlerts.motorcycleId,
        userId: theftAlerts.userId,
        brand: theftAlerts.brand,
        model: theftAlerts.model,
        licensePlate: theftAlerts.licensePlate,
        photoUrl: theftAlerts.photoUrl,
        lastLatitude: theftAlerts.lastLatitude,
        lastLongitude: theftAlerts.lastLongitude,
        lastLocationName: theftAlerts.lastLocationName,
        status: theftAlerts.status,
        createdAt: theftAlerts.createdAt,
        closedAt: theftAlerts.closedAt,
        recoveredAt: theftAlerts.recoveredAt,
        responseCount: count(theftAlertResponses.id),
      })
      .from(theftAlerts)
      .leftJoin(theftAlertResponses, eq(theftAlerts.id, theftAlertResponses.theftAlertId))
      .where(
        or(
          eq(theftAlerts.status, 'active'),
          and(
            eq(theftAlerts.status, 'recovered'),
            gte(theftAlerts.recoveredAt, startOfDay)
          )
        )
      )
      .groupBy(theftAlerts.id)
      .orderBy(desc(theftAlerts.createdAt))
      .limit(20);

    res.json({
      success: true,
      data: alerts.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        closedAt: a.closedAt ? new Date(a.closedAt) : null,
        recoveredAt: a.recoveredAt ? new Date(a.recoveredAt) : null,
      })),
    });
  } catch (err) {
    console.error('List theft alerts error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch theft alerts');
    res.status(500).json(error);
  }
});

// --- GET /api/theft-alerts/:id ---
router.get('/:id', validateParams(alertIdParam), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = await db
      .select()
      .from(theftAlerts)
      .where(eq(theftAlerts.id, id))
      .get();

    if (!alert) {
      const error = createErrorResponse('NOT_FOUND', 'Theft alert not found');
      res.status(404).json(error);
      return;
    }

    // Get responses with user names
    const responses = await db
      .select({
        id: theftAlertResponses.id,
        userId: theftAlertResponses.userId,
        userName: users.name,
        text: theftAlertResponses.text,
        createdAt: theftAlertResponses.createdAt,
      })
      .from(theftAlertResponses)
      .innerJoin(users, eq(theftAlertResponses.userId, users.id))
      .where(eq(theftAlertResponses.theftAlertId, id))
      .orderBy(desc(theftAlertResponses.createdAt));

    res.json({
      success: true,
      data: {
        ...alert,
        createdAt: new Date(alert.createdAt),
        closedAt: alert.closedAt ? new Date(alert.closedAt) : null,
        responses: responses.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })),
      },
    });
  } catch (err) {
    console.error('Get theft alert error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch theft alert');
    res.status(500).json(error);
  }
});

// --- POST /api/theft-alerts/:id/respond ---
router.post('/:id/respond', validateParams(alertIdParam), validateBody(respondSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { text } = req.body;

    // Verify alert exists and is active
    const alert = await db
      .select()
      .from(theftAlerts)
      .where(eq(theftAlerts.id, id))
      .get();

    if (!alert) {
      const error = createErrorResponse('NOT_FOUND', 'Theft alert not found');
      res.status(404).json(error);
      return;
    }

    if (alert.status !== 'active') {
      const error = createErrorResponse('BAD_REQUEST', 'This theft alert is no longer active');
      res.status(400).json(error);
      return;
    }

    const now = new Date();
    const responseId = crypto.randomUUID();

    await db.insert(theftAlertResponses).values({
      id: responseId,
      theftAlertId: id,
      userId,
      text: text.trim(),
      createdAt: now,
    });

    const created = await db
      .select()
      .from(theftAlertResponses)
      .where(eq(theftAlertResponses.id, responseId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        createdAt: new Date(created!.createdAt),
      },
    });
  } catch (err) {
    console.error('Respond to theft alert error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to add response');
    res.status(500).json(error);
  }
});

// --- PATCH /api/theft-alerts/:id/close ---
router.patch('/:id/close', validateParams(alertIdParam), validateBody(closeSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = req.body;

    // Verify ownership
    const alert = await db
      .select()
      .from(theftAlerts)
      .where(and(eq(theftAlerts.id, id), eq(theftAlerts.userId, userId)))
      .get();

    if (!alert) {
      const error = createErrorResponse('NOT_FOUND', 'Theft alert not found or not owned by you');
      res.status(404).json(error);
      return;
    }

    const now = new Date();

    // If marking as recovered, set recoveredAt so it stays green on home until end of day
    const updateData: Record<string, any> = {
      status,
      closedAt: now,
    };
    if (status === 'recovered') {
      updateData.recoveredAt = now;
    }

    await db
      .update(theftAlerts)
      .set(updateData)
      .where(eq(theftAlerts.id, id));

    const updated = await db
      .select()
      .from(theftAlerts)
      .where(eq(theftAlerts.id, id))
      .get();

    res.json({
      success: true,
      data: {
        ...updated!,
        createdAt: new Date(updated!.createdAt),
        closedAt: updated!.closedAt ? new Date(updated!.closedAt) : null,
        recoveredAt: updated!.recoveredAt ? new Date(updated!.recoveredAt) : null,
      },
    });
  } catch (err) {
    console.error('Close theft alert error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to close theft alert');
    res.status(500).json(error);
  }
});

// --- GET /api/my-theft-alerts ---
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const alerts = await db
      .select({
        id: theftAlerts.id,
        motorcycleId: theftAlerts.motorcycleId,
        brand: theftAlerts.brand,
        model: theftAlerts.model,
        licensePlate: theftAlerts.licensePlate,
        photoUrl: theftAlerts.photoUrl,
        status: theftAlerts.status,
        createdAt: theftAlerts.createdAt,
        closedAt: theftAlerts.closedAt,
        responseCount: count(theftAlertResponses.id),
      })
      .from(theftAlerts)
      .leftJoin(theftAlertResponses, eq(theftAlerts.id, theftAlertResponses.theftAlertId))
      .where(eq(theftAlerts.userId, userId))
      .groupBy(theftAlerts.id)
      .orderBy(desc(theftAlerts.createdAt));

    res.json({
      success: true,
      data: alerts.map((a) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        closedAt: a.closedAt ? new Date(a.closedAt) : null,
      })),
    });
  } catch (err) {
    console.error('List my theft alerts error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch your theft alerts');
    res.status(500).json(error);
  }
});

export default router;

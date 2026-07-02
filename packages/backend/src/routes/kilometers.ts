import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  kilometerHistory,
  motorcycles,
} from '../db/schema';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import {
  createKilometerSchema,
  motorcycleIdParamSchema,
} from '../validation/kilometer';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export function createKilometerRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All kilometer routes require authentication
  router.use(authenticate);

  // GET /api/motorcycles/:motorcycleId/kilometers — list kilometer entries
  router.get('/:motorcycleId/kilometers', validateParams(motorcycleIdParamSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const motorcycleId = req.params.motorcycleId as string;

      // Verify motorcycle ownership
      const motorcycle = db
        .select()
        .from(motorcycles)
        .where(
          and(
            eq(motorcycles.id, motorcycleId),
            eq(motorcycles.userId, authPayload.userId)
          )
        )
        .get();

      if (!motorcycle) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
        return;
      }

      const entries = db
        .select()
        .from(kilometerHistory)
        .where(eq(kilometerHistory.motorcycleId, motorcycleId))
        .orderBy(desc(kilometerHistory.recordedAt))
        .all();

      res.json({ entries });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // POST /api/motorcycles/:motorcycleId/kilometers — log kilometer reading
  router.post('/:motorcycleId/kilometers', validateParams(motorcycleIdParamSchema), validateBody(createKilometerSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const motorcycleId = req.params.motorcycleId as string;

      // Verify motorcycle ownership
      const motorcycle = db
        .select()
        .from(motorcycles)
        .where(
          and(
            eq(motorcycles.id, motorcycleId),
            eq(motorcycles.userId, authPayload.userId)
          )
        )
        .get();

      if (!motorcycle) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
        return;
      }

      const { readingKm, recordedAt, notes } = req.body;

      const entryId = uuidv4();
      const now = new Date();
      const entryRecordedAt = recordedAt ? new Date(recordedAt) : now;

      db.insert(kilometerHistory)
        .values({
          id: entryId,
          motorcycleId,
          readingKm,
          recordedAt: entryRecordedAt,
          notes: notes || null,
          createdAt: now,
        })
        .run();

      // Update motorcycle's current kilometers if this reading is higher
      if (readingKm > (motorcycle.currentKilometers || 0)) {
        db.update(motorcycles)
          .set({ currentKilometers: readingKm, updatedAt: now })
          .where(eq(motorcycles.id, motorcycleId))
          .run();
      }

      const created = db
        .select()
        .from(kilometerHistory)
        .where(eq(kilometerHistory.id, entryId))
        .get();

      res.status(201).json({ entry: created });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createKilometerRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

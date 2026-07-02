import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  maintenanceRecords,
  motorcycles,
} from '../db/schema';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  motorcycleIdParamSchema,
  maintenanceFilterSchema,
} from '../validation/maintenance';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export function createMaintenanceRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All maintenance routes require authentication
  router.use(authenticate);

  // GET /api/motorcycles/:motorcycleId/maintenance — list maintenance records
  router.get(
    '/:motorcycleId/maintenance',
    validateParams(motorcycleIdParamSchema),
    (req: Request, res: Response) => {
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

        const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;

        let records;
        if (typeFilter) {
          records = db
            .select()
            .from(maintenanceRecords)
            .where(
              and(
                eq(maintenanceRecords.motorcycleId, motorcycleId),
                eq(maintenanceRecords.type, typeFilter)
              )
            )
            .orderBy(desc(maintenanceRecords.serviceDate))
            .all();
        } else {
          records = db
            .select()
            .from(maintenanceRecords)
            .where(eq(maintenanceRecords.motorcycleId, motorcycleId))
            .orderBy(desc(maintenanceRecords.serviceDate))
            .all();
        }

        res.json({ records });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // POST /api/motorcycles/:motorcycleId/maintenance — create maintenance record
  router.post(
    '/:motorcycleId/maintenance',
    validateParams(motorcycleIdParamSchema),
    validateBody(createMaintenanceSchema),
    (req: Request, res: Response) => {
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

        const {
          type,
          description,
          kilometersAtService,
          serviceDate,
          cost,
          notes,
          nextServiceKilometers,
          nextServiceDate,
          oilTypeId,
        } = req.body;

        const recordId = uuidv4();
        const now = new Date();

        db.insert(maintenanceRecords)
          .values({
            id: recordId,
            motorcycleId,
            type,
            description,
            kilometersAtService,
            serviceDate: new Date(serviceDate),
            cost: cost ?? null,
            notes: notes ?? null,
            nextServiceKilometers: nextServiceKilometers ?? null,
            nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
            oilTypeId: oilTypeId ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        const created = db
          .select()
          .from(maintenanceRecords)
          .where(eq(maintenanceRecords.id, recordId))
          .get();

        res.status(201).json({ record: created });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // PUT /api/maintenance/:id — update maintenance record
  router.put(
    '/:id',
    validateParams(z.object({ id: z.string().min(1) })),
    validateBody(updateMaintenanceSchema),
    (req: Request, res: Response) => {
      try {
        const authPayload = req.user as AuthPayload;
        const recordId = req.params.id as string;

        // Verify ownership via motorcycle
        const existing = db
          .select()
          .from(maintenanceRecords)
          .where(eq(maintenanceRecords.id, recordId))
          .get();

        if (!existing) {
          res.status(404).json(createErrorResponse('NOT_FOUND', 'Maintenance record not found'));
          return;
        }

        // Verify the motorcycle belongs to the user
        const motorcycle = db
          .select()
          .from(motorcycles)
          .where(
            and(
              eq(motorcycles.id, existing.motorcycleId),
              eq(motorcycles.userId, authPayload.userId)
            )
          )
          .get();

        if (!motorcycle) {
          res.status(403).json(createErrorResponse('FORBIDDEN', 'Not your motorcycle'));
          return;
        }

        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (req.body.type !== undefined) updateData.type = req.body.type;
        if (req.body.description !== undefined) updateData.description = req.body.description;
        if (req.body.kilometersAtService !== undefined) updateData.kilometersAtService = req.body.kilometersAtService;
        if (req.body.serviceDate !== undefined) updateData.serviceDate = new Date(req.body.serviceDate);
        if (req.body.cost !== undefined) updateData.cost = req.body.cost;
        if (req.body.notes !== undefined) updateData.notes = req.body.notes;
        if (req.body.nextServiceKilometers !== undefined) updateData.nextServiceKilometers = req.body.nextServiceKilometers;
        if (req.body.nextServiceDate !== undefined) updateData.nextServiceDate = req.body.nextServiceDate ? new Date(req.body.nextServiceDate) : null;
        if (req.body.oilTypeId !== undefined) updateData.oilTypeId = req.body.oilTypeId;

        db.update(maintenanceRecords)
          .set(updateData)
          .where(eq(maintenanceRecords.id, recordId))
          .run();

        const updated = db
          .select()
          .from(maintenanceRecords)
          .where(eq(maintenanceRecords.id, recordId))
          .get();

        res.json({ record: updated });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // DELETE /api/maintenance/:id — delete maintenance record
  router.delete(
    '/:id',
    validateParams(z.object({ id: z.string().min(1) })),
    (req: Request, res: Response) => {
      try {
        const authPayload = req.user as AuthPayload;
        const recordId = req.params.id as string;

        // Verify ownership via motorcycle
        const existing = db
          .select()
          .from(maintenanceRecords)
          .where(eq(maintenanceRecords.id, recordId))
          .get();

        if (!existing) {
          res.status(404).json(createErrorResponse('NOT_FOUND', 'Maintenance record not found'));
          return;
        }

        // Verify the motorcycle belongs to the user
        const motorcycle = db
          .select()
          .from(motorcycles)
          .where(
            and(
              eq(motorcycles.id, existing.motorcycleId),
              eq(motorcycles.userId, authPayload.userId)
            )
          )
          .get();

        if (!motorcycle) {
          res.status(403).json(createErrorResponse('FORBIDDEN', 'Not your motorcycle'));
          return;
        }

        db.delete(maintenanceRecords)
          .where(eq(maintenanceRecords.id, recordId))
          .run();

        res.status(204).send();
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createMaintenanceRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

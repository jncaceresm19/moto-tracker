import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  motorcycles,
  motorcycleCatalogModels,
} from '../db/schema';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import {
  createMotorcycleSchema,
  updateMotorcycleSchema,
  motorcycleIdSchema,
} from '../validation/motorcycle';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export function createMotorcycleRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All motorcycle routes require authentication
  router.use(authenticate);

  // GET /api/motorcycles — list user's motorcycles
  router.get('/', (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const userMotorcycles = db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.userId, authPayload.userId))
        .all();

      res.json({ motorcycles: userMotorcycles });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // POST /api/motorcycles — create motorcycle (inherits image_url from catalog)
  router.post('/', validateBody(createMotorcycleSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const { brandId, modelId, brand, model, year, licensePlate, currentKilometers, imageUrl } = req.body;

      // Check for duplicate license plate
      const existing = db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.licensePlate, licensePlate))
        .get();

      if (existing) {
        res.status(409).json(createErrorResponse('CONFLICT', 'License plate already registered'));
        return;
      }

      // If modelId provided, inherit image_url from catalog
      let finalImageUrl = imageUrl || null;
      if (modelId) {
        const catalogModel = db
          .select()
          .from(motorcycleCatalogModels)
          .where(eq(motorcycleCatalogModels.id, modelId))
          .get();

        if (catalogModel?.imageUrl) {
          finalImageUrl = catalogModel.imageUrl;
        }
      }

      const now = new Date();
      const motorcycleId = uuidv4();

      db.insert(motorcycles)
        .values({
          id: motorcycleId,
          userId: authPayload.userId,
          brandId: brandId || null,
          modelId: modelId || null,
          brand,
          model,
          year,
          licensePlate,
          currentKilometers: currentKilometers || 0,
          imageUrl: finalImageUrl,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const created = db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.id, motorcycleId))
        .get();

      res.status(201).json({ motorcycle: created });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // GET /api/motorcycles/:id — get motorcycle detail
  router.get('/:id', validateParams(motorcycleIdSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const motorcycleId = req.params.id as string;

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

      res.json({ motorcycle });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // PUT /api/motorcycles/:id — update motorcycle
  router.put('/:id', validateParams(motorcycleIdSchema), validateBody(updateMotorcycleSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const motorcycleId = req.params.id as string;

      // Verify ownership
      const existing = db
        .select()
        .from(motorcycles)
        .where(
          and(
            eq(motorcycles.id, motorcycleId),
            eq(motorcycles.userId, authPayload.userId)
          )
        )
        .get();

      if (!existing) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
        return;
      }

      // Check license plate uniqueness if changing
      if (req.body.licensePlate && req.body.licensePlate !== existing.licensePlate) {
        const plateExists = db
          .select()
          .from(motorcycles)
          .where(eq(motorcycles.licensePlate, req.body.licensePlate))
          .get();

        if (plateExists) {
          res.status(409).json(createErrorResponse('CONFLICT', 'License plate already registered'));
          return;
        }
      }

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (req.body.brand !== undefined) updateData.brand = req.body.brand;
      if (req.body.model !== undefined) updateData.model = req.body.model;
      if (req.body.year !== undefined) updateData.year = req.body.year;
      if (req.body.licensePlate !== undefined) updateData.licensePlate = req.body.licensePlate;
      if (req.body.currentKilometers !== undefined) updateData.currentKilometers = req.body.currentKilometers;
      if (req.body.imageUrl !== undefined) updateData.imageUrl = req.body.imageUrl;
      if (req.body.brandId !== undefined) updateData.brandId = req.body.brandId;
      if (req.body.modelId !== undefined) updateData.modelId = req.body.modelId;

      db.update(motorcycles)
        .set(updateData)
        .where(eq(motorcycles.id, motorcycleId))
        .run();

      const updated = db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.id, motorcycleId))
        .get();

      res.json({ motorcycle: updated });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // DELETE /api/motorcycles/:id — delete motorcycle
  router.delete('/:id', validateParams(motorcycleIdSchema), (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;
      const motorcycleId = req.params.id as string;

      // Verify ownership
      const existing = db
        .select()
        .from(motorcycles)
        .where(
          and(
            eq(motorcycles.id, motorcycleId),
            eq(motorcycles.userId, authPayload.userId)
          )
        )
        .get();

      if (!existing) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
        return;
      }

      db.delete(motorcycles)
        .where(eq(motorcycles.id, motorcycleId))
        .run();

      res.status(204).send();
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createMotorcycleRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

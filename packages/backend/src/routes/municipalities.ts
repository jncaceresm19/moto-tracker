import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, like, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { municipalities } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// All municipality routes require authentication
router.use(authenticate);

const municipalityIdParam = z.object({
  id: z.string().uuid('Invalid municipality ID'),
});

interface MunicipalityParams {
  id: string;
}

function getId(req: Request): string {
  return (req.params as unknown as MunicipalityParams).id;
}

// --- GET /api/municipalities ---
// List active municipalities, optionally search by name or commune
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string)?.trim();

    let query = db
      .select()
      .from(municipalities)
      .where(eq(municipalities.active, true))
      .orderBy(municipalities.order, municipalities.commune);

    if (search) {
      query = db
        .select()
        .from(municipalities)
        .where(
          and(
            eq(municipalities.active, true),
            like(municipalities.commune, `%${search}%`)
          )
        )
        .orderBy(municipalities.order, municipalities.commune);
    }

    const rows = await query;

    res.json({
      success: true,
      data: rows.map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      })),
    });
  } catch (err) {
    console.error('List municipalities error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch municipalities');
    res.status(500).json(error);
  }
});

// --- GET /api/municipalities/:id ---
router.get('/:id', validateParams(municipalityIdParam), async (req: Request, res: Response) => {
  try {
    const id = getId(req);

    const municipality = await db
      .select()
      .from(municipalities)
      .where(eq(municipalities.id, id))
      .get();

    if (!municipality) {
      const error = createErrorResponse('NOT_FOUND', 'Municipality not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...municipality,
        createdAt: new Date(municipality.createdAt),
        updatedAt: new Date(municipality.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get municipality error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch municipality');
    res.status(500).json(error);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { maintenanceTypes } from '../db/schema';
import { createAuthenticate } from '../middleware/auth';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export function createMaintenanceTypesRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All maintenance types routes require authentication
  router.use(authenticate);

  // GET /api/maintenance-types
  router.get('/', (_req: Request, res: Response) => {
    try {
      const types = db.select().from(maintenanceTypes).all();
      res.json({ types });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createMaintenanceTypesRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;
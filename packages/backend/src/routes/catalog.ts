import { Router, Request, Response } from 'express';
import { eq, like, sql, and } from 'drizzle-orm';
import {
  motorcycleCatalogBrands,
  motorcycleCatalogModels,
  oilCatalogBrands,
  oilCatalogProducts,
} from '../db/schema';
import { createAuthenticate } from '../middleware/auth';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

export function createCatalogRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All catalog routes require authentication
  router.use(authenticate);

  // GET /api/catalog/brands
  router.get('/brands', (req: Request, res: Response) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      let brands;

      if (search) {
        brands = db
          .select()
          .from(motorcycleCatalogBrands)
          .where(like(motorcycleCatalogBrands.name, `%${search}%`))
          .all();
      } else {
        brands = db.select().from(motorcycleCatalogBrands).all();
      }

      res.json({ brands });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // GET /api/catalog/brands/:id/models
  router.get('/brands/:id/models', (req: Request, res: Response) => {
    try {
      const brandId = req.params.id as string;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      // Verify brand exists
      const brand = db
        .select()
        .from(motorcycleCatalogBrands)
        .where(eq(motorcycleCatalogBrands.id, brandId))
        .get();

      if (!brand) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Brand not found'));
        return;
      }

      let models;
      if (search) {
        models = db
          .select()
          .from(motorcycleCatalogModels)
          .where(
            and(
              eq(motorcycleCatalogModels.brandId, brandId),
              like(motorcycleCatalogModels.name, `%${search}%`)
            )
          )
          .all();
      } else {
        models = db
          .select()
          .from(motorcycleCatalogModels)
          .where(eq(motorcycleCatalogModels.brandId, brandId))
          .all();
      }

      res.json({ brand, models });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // GET /api/catalog/oil-brands
  router.get('/oil-brands', (req: Request, res: Response) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      let brands;

      if (search) {
        brands = db
          .select()
          .from(oilCatalogBrands)
          .where(like(oilCatalogBrands.name, `%${search}%`))
          .all();
      } else {
        brands = db.select().from(oilCatalogBrands).all();
      }

      res.json({ brands });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // GET /api/catalog/oil-brands/:id/products
  router.get('/oil-brands/:id/products', (req: Request, res: Response) => {
    try {
      const brandId = req.params.id as string;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const viscosity = typeof req.query.viscosity === 'string' ? req.query.viscosity : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;

      // Verify brand exists
      const brand = db
        .select()
        .from(oilCatalogBrands)
        .where(eq(oilCatalogBrands.id, brandId))
        .get();

      if (!brand) {
        res.status(404).json(createErrorResponse('NOT_FOUND', 'Oil brand not found'));
        return;
      }

      // Build query conditions
      const conditions = [eq(oilCatalogProducts.brandId, brandId)];

      if (search) {
        conditions.push(like(oilCatalogProducts.name, `%${search}%`));
      }
      if (viscosity) {
        conditions.push(eq(oilCatalogProducts.viscosity, viscosity));
      }
      if (type) {
        conditions.push(eq(oilCatalogProducts.type, type));
      }

      const whereClause = and(...conditions);

      const products = db
        .select()
        .from(oilCatalogProducts)
        .where(whereClause)
        .all();

      res.json({ brand, products });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createCatalogRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

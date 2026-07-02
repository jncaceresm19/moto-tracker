import { Router, Request, Response } from 'express';
import multer from 'multer';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { documents, motorcycles } from '../db/schema';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import {
  createDocumentSchema,
  updateDocumentSchema,
  motorcycleIdParamSchema,
  documentIdParamSchema,
} from '../validation/document';
import { createErrorResponse } from '@moto-tracker/shared';
import { processDocumentImage } from '../services/ocr';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

// Multer memory storage for multipart uploads (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
});

export function createDocumentRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All document routes require authentication
  router.use(authenticate);

  // GET /api/motorcycles/:motorcycleId/documents — list documents
  router.get(
    '/:motorcycleId/documents',
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

        const docs = db
          .select()
          .from(documents)
          .where(eq(documents.motorcycleId, motorcycleId))
          .orderBy(desc(documents.createdAt))
          .all();

        res.json({ documents: docs });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // POST /api/motorcycles/:motorcycleId/documents — create document
  router.post(
    '/:motorcycleId/documents',
    validateParams(motorcycleIdParamSchema),
    validateBody(createDocumentSchema),
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

        const { type, title, fileUrl, expiryDate, notes, imagePath, ocrRawText, ocrConfidence } = req.body;

        // Check UNIQUE constraint: one document type per motorcycle
        const existingDoc = db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.motorcycleId, motorcycleId),
              eq(documents.type, type)
            )
          )
          .get();

        if (existingDoc) {
          res.status(409).json(createErrorResponse('CONFLICT', `Document of type '${type}' already exists for this motorcycle`));
          return;
        }

        // Compute status from expiry date
        let status: 'valid' | 'expiring' | 'expired' = 'valid';
        if (expiryDate) {
          const expiry = new Date(expiryDate);
          const now = new Date();
          const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiry < 0) {
            status = 'expired';
          } else if (daysUntilExpiry < 30) {
            status = 'expiring';
          }
        }

        const docId = uuidv4();
        const now = new Date();

        db.insert(documents)
          .values({
            id: docId,
            motorcycleId,
            type,
            title,
            fileUrl: fileUrl || '',
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            notes: notes ?? null,
            imagePath: imagePath ?? null,
            ocrRawText: ocrRawText ?? null,
            ocrConfidence: ocrConfidence ?? null,
            status,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        const created = db
          .select()
          .from(documents)
          .where(eq(documents.id, docId))
          .get();

        res.status(201).json({ document: created });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // POST /api/documents/capture — upload image + OCR extraction
  router.post(
    '/capture',
    upload.single('image'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Image file is required'));
          return;
        }

        const apiKey = process.env.GOOGLE_VISION_API_KEY;
        if (!apiKey) {
          res.status(503).json(createErrorResponse('SERVICE_UNAVAILABLE', 'OCR service is not configured. GOOGLE_VISION_API_KEY is missing.'));
          return;
        }

        const result = await processDocumentImage(req.file.buffer);

        res.json({
          date: result.date ?? null,
          confidence: result.confidence,
          rawText: result.rawText,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OCR processing failed';
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', message));
      }
    }
  );

  // PUT /api/documents/:id — update document
  router.put(
    '/:id',
    validateParams(documentIdParamSchema),
    validateBody(updateDocumentSchema),
    (req: Request, res: Response) => {
      try {
        const authPayload = req.user as AuthPayload;
        const docId = req.params.id as string;

        // Verify document exists
        const existing = db
          .select()
          .from(documents)
          .where(eq(documents.id, docId))
          .get();

        if (!existing) {
          res.status(404).json(createErrorResponse('NOT_FOUND', 'Document not found'));
          return;
        }

        // Verify ownership via motorcycle
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
        if (req.body.title !== undefined) updateData.title = req.body.title;
        if (req.body.expiryDate !== undefined) updateData.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
        if (req.body.notes !== undefined) updateData.notes = req.body.notes;
        if (req.body.imagePath !== undefined) updateData.imagePath = req.body.imagePath;
        if (req.body.ocrRawText !== undefined) updateData.ocrRawText = req.body.ocrRawText;
        if (req.body.ocrConfidence !== undefined) updateData.ocrConfidence = req.body.ocrConfidence;
        if (req.body.status !== undefined) updateData.status = req.body.status;

        // Recompute status if expiryDate changed
        if (req.body.expiryDate !== undefined) {
          const expiry = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
          const now = new Date();
          if (expiry) {
            const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            if (daysUntilExpiry < 0) {
              updateData.status = 'expired';
            } else if (daysUntilExpiry < 30) {
              updateData.status = 'expiring';
            } else {
              updateData.status = 'valid';
            }
          } else {
            updateData.status = 'valid';
          }
        }

        db.update(documents)
          .set(updateData)
          .where(eq(documents.id, docId))
          .run();

        const updated = db
          .select()
          .from(documents)
          .where(eq(documents.id, docId))
          .get();

        res.json({ document: updated });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // DELETE /api/documents/:id — delete document
  router.delete(
    '/:id',
    validateParams(documentIdParamSchema),
    (req: Request, res: Response) => {
      try {
        const authPayload = req.user as AuthPayload;
        const docId = req.params.id as string;

        // Verify document exists
        const existing = db
          .select()
          .from(documents)
          .where(eq(documents.id, docId))
          .get();

        if (!existing) {
          res.status(404).json(createErrorResponse('NOT_FOUND', 'Document not found'));
          return;
        }

        // Verify ownership via motorcycle
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

        db.delete(documents)
          .where(eq(documents.id, docId))
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
const defaultRouter = createDocumentRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

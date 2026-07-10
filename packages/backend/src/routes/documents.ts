import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { documents, motorcycles, notifications } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';
import { createNotification } from './notifications';

const router = Router({ mergeParams: true });

// All document routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const documentTypes = [
  'circulation_permit',
  'technical_review',
  'insurance',
  'padron',
  'drivers_license',
  'fines',
] as const;

const documentStatuses = ['valid', 'expiring', 'expired'] as const;

const imageRefine = (v: string) => v.startsWith('data:image/') || /^https?:\/\//.test(v);

const createDocumentSchema = z.object({
  type: z.enum(documentTypes),
  title: z.string().min(1, 'Title is required').max(200),
  fileUrl: z.string().refine(imageRefine, 'Invalid image'),
  fileUrlBack: z.string().refine(imageRefine, 'Invalid image').optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  imagePath: z.string().max(500).optional(),
  ocrConfidence: z.number().min(0).max(1).optional(),
  status: z.enum(documentStatuses).optional().default('valid'),
});

const updateDocumentSchema = z.object({
  type: z.enum(documentTypes).optional(),
  title: z.string().min(1).max(200).optional(),
  fileUrl: z.string().refine(imageRefine, 'Invalid image').optional(),
  fileUrlBack: z.string().refine(imageRefine, 'Invalid image').nullable().optional(),
  issueDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  ocrConfidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(documentStatuses).nullable().optional(),
});

const motorcycleIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
});

const docIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
  docId: z.string().uuid('Invalid document ID'),
});

interface DocumentParams {
  id: string;
  docId?: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as DocumentParams).id;
}

function getDocId(req: Request): string {
  return (req.params as unknown as DocumentParams).docId!;
}

// Create scheduled notifications for document expiry (30, 14, 1 day before)
async function scheduleExpiryNotifications(
  userId: string,
  motorcycleId: string,
  documentTitle: string,
  expiryDate: Date
) {
  const now = new Date();
  const intervals = [
    { days: 30, label: '30 días' },
    { days: 14, label: '2 semanas' },
    { days: 1, label: '1 día' },
  ];

  for (const interval of intervals) {
    const showAt = new Date(expiryDate);
    showAt.setDate(showAt.getDate() - interval.days);

    // Only create if showAt is in the future
    if (showAt > now) {
      await createNotification({
        userId,
        motorcycleId,
        type: 'document_expiring',
        title: `Documento vence en ${interval.label}`,
        message: `"${documentTitle}" vence el ${expiryDate.toLocaleDateString('es-CL')}. ¡No olvides renovarlo!`,
        showAt,
      });
    }
  }
}

// --- POST /api/motorcycles/:id/documents ---
router.post('/', validateBody(createDocumentSchema), async (req: Request, res: Response) => {
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

    const { type, title, fileUrl, fileUrlBack, issueDate, expiryDate, notes, imagePath, ocrConfidence, status } = req.body;
    const now = new Date();
    const docId = crypto.randomUUID();

    await db.insert(documents).values({
      id: docId,
      motorcycleId,
      type,
      title,
      fileUrl,
      fileUrlBack: fileUrlBack ?? null,
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes: notes ?? null,
      imagePath: imagePath ?? null,
      ocrConfidence: ocrConfidence ?? null,
      status: status ?? 'valid',
      createdAt: now,
      updatedAt: now,
    });

    // Schedule expiry notifications if expiryDate is set
    if (expiryDate) {
      await scheduleExpiryNotifications(userId, motorcycleId, title, new Date(expiryDate));
    }

    const created = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        expiryDate: created!.expiryDate ? new Date(created!.expiryDate) : null,
        createdAt: new Date(created!.createdAt),
        updatedAt: new Date(created!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Create document error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create document');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/documents ---
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

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.motorcycleId, motorcycleId));

    res.json({
      success: true,
      data: docs.map((d) => ({
        ...d,
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      })),
    });
  } catch (err) {
    console.error('List documents error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch documents');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id/documents/:docId ---
router.get('/:docId', validateParams(docIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const docId = getDocId(req);

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

    const doc = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.motorcycleId, motorcycleId)))
      .get();

    if (!doc) {
      const error = createErrorResponse('NOT_FOUND', 'Document not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...doc,
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get document error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch document');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id/documents/:docId ---
router.put('/:docId', validateParams(docIdParam), validateBody(updateDocumentSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const docId = getDocId(req);

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

    // Verify document belongs to motorcycle
    const existing = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Document not found');
      res.status(404).json(error);
      return;
    }

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.fileUrl !== undefined) updates.fileUrl = req.body.fileUrl;
    if (req.body.fileUrlBack !== undefined) updates.fileUrlBack = req.body.fileUrlBack;
    if (req.body.issueDate !== undefined) updates.issueDate = req.body.issueDate ? new Date(req.body.issueDate) : null;
    if (req.body.expiryDate !== undefined) updates.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.imagePath !== undefined) updates.imagePath = req.body.imagePath;
    if (req.body.ocrConfidence !== undefined) updates.ocrConfidence = req.body.ocrConfidence;
    if (req.body.status !== undefined) updates.status = req.body.status;

    await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, docId));

    // Handle expiry notifications if expiryDate changed
    if (req.body.expiryDate !== undefined) {
      // Delete old scheduled notifications for this document
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.motorcycleId, motorcycleId),
            eq(notifications.type, 'document_expiring'),
            sql`${notifications.title} LIKE ${'%' + existing.title + '%'}`
          )
        );

      // Create new notifications if expiryDate is set
      if (req.body.expiryDate) {
        const docTitle = req.body.title || existing.title;
        await scheduleExpiryNotifications(userId, motorcycleId, docTitle, new Date(req.body.expiryDate));
      }
    }

    const updated = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .get();

    res.json({
      success: true,
      data: {
        ...updated!,
        expiryDate: updated!.expiryDate ? new Date(updated!.expiryDate) : null,
        createdAt: new Date(updated!.createdAt),
        updatedAt: new Date(updated!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Update document error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update document');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id/documents/:docId ---
router.delete('/:docId', validateParams(docIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const docId = getDocId(req);

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

    // Verify document belongs to motorcycle
    const existing = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.motorcycleId, motorcycleId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Document not found');
      res.status(404).json(error);
      return;
    }

    // Delete scheduled notifications for this document
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.motorcycleId, motorcycleId),
          eq(notifications.type, 'document_expiring'),
          sql`${notifications.title} LIKE ${'%' + existing.title + '%'}`
        )
      );

    await db.delete(documents).where(eq(documents.id, docId));

    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error('Delete document error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete document');
    res.status(500).json(error);
  }
});

export default router;

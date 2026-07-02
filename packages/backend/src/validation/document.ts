import { z } from 'zod';

export const documentTypeEnum = z.enum([
  'permiso_circulacion',
  'revision_tecnica',
  'seguro',
  'libre_deuda',
]);

export const createDocumentSchema = z.object({
  type: documentTypeEnum,
  title: z.string().min(1, 'Title is required').max(200),
  fileUrl: z.string().url().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  imagePath: z.string().nullable().optional(),
  ocrRawText: z.string().nullable().optional(),
  ocrConfidence: z.number().min(0).max(1).nullable().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  imagePath: z.string().nullable().optional(),
  ocrRawText: z.string().nullable().optional(),
  ocrConfidence: z.number().min(0).max(1).nullable().optional(),
  status: z.enum(['valid', 'expiring', 'expired']).optional(),
});

export const motorcycleIdParamSchema = z.object({
  motorcycleId: z.string().min(1),
});

export const documentIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentIdInput = z.infer<typeof documentIdParamSchema>;

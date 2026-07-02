import { z } from 'zod';

export const createKilometerSchema = z.object({
  readingKm: z.number().min(0, 'Kilometer reading must be non-negative'),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const kilometerIdSchema = z.object({
  id: z.string().min(1),
});

export const motorcycleIdParamSchema = z.object({
  motorcycleId: z.string().min(1),
});

export type CreateKilometerInput = z.infer<typeof createKilometerSchema>;
export type KilometerIdInput = z.infer<typeof kilometerIdSchema>;
export type MotorcycleIdParamInput = z.infer<typeof motorcycleIdParamSchema>;

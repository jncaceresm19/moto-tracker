import { z } from 'zod';

export const createMotorcycleSchema = z.object({
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  licensePlate: z.string().min(1, 'License plate is required').max(20),
  currentKilometers: z.number().min(0).optional().default(0),
  imageUrl: z.string().url().nullable().optional(),
});

export const updateMotorcycleSchema = z.object({
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  licensePlate: z.string().min(1).max(20).optional(),
  currentKilometers: z.number().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export const motorcycleIdSchema = z.object({
  id: z.string().min(1),
});

export type CreateMotorcycleInput = z.infer<typeof createMotorcycleSchema>;
export type UpdateMotorcycleInput = z.infer<typeof updateMotorcycleSchema>;
export type MotorcycleIdInput = z.infer<typeof motorcycleIdSchema>;

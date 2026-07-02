import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  type: z.enum([
    'oil_change',
    'tire_change',
    'brake_check',
    'chain_adjustment',
    'valve_adjustment',
    'coolant_flush',
    'air_filter',
    'spark_plugs',
    'technical_review',
    'circulation_permit',
    'other',
  ]),
  description: z.string().min(1, 'Description is required').max(500),
  kilometersAtService: z.number().min(0, 'Kilometers must be non-negative'),
  serviceDate: z.string().datetime(),
  cost: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  nextServiceKilometers: z.number().min(0).optional(),
  nextServiceDate: z.string().datetime().optional(),
  oilTypeId: z.string().optional(),
});

export const updateMaintenanceSchema = z.object({
  type: z.enum([
    'oil_change',
    'tire_change',
    'brake_check',
    'chain_adjustment',
    'valve_adjustment',
    'coolant_flush',
    'air_filter',
    'spark_plugs',
    'technical_review',
    'circulation_permit',
    'other',
  ]).optional(),
  description: z.string().min(1).max(500).optional(),
  kilometersAtService: z.number().min(0).optional(),
  serviceDate: z.string().datetime().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  nextServiceKilometers: z.number().min(0).nullable().optional(),
  nextServiceDate: z.string().datetime().nullable().optional(),
  oilTypeId: z.string().nullable().optional(),
});

export const maintenanceIdSchema = z.object({
  id: z.string().min(1),
});

export const motorcycleIdParamSchema = z.object({
  motorcycleId: z.string().min(1),
});

export const maintenanceFilterSchema = z.object({
  type: z.string().optional(),
});

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
export type MaintenanceIdInput = z.infer<typeof maintenanceIdSchema>;
export type MotorcycleIdParamInput = z.infer<typeof motorcycleIdParamSchema>;
export type MaintenanceFilterInput = z.infer<typeof maintenanceFilterSchema>;

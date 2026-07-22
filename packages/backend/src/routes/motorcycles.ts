import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { motorcycles, users, verificacionesPendientes } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { createErrorResponse } from '@moto-tracker/shared';
import { validatePlate } from '../services/plateValidation';
import { checkTechnicalReview, checkTheftHistory } from '../services/vehicleCheck';

const router = Router();

// All motorcycle routes require authentication
router.use(authenticate);

// --- Zod Schemas ---

const createMotorcycleSchema = z.object({
  brand: z.string().min(1, 'Brand is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  year: z.number().int().min(1900).max(2100),
  licensePlate: z.string().min(1, 'License plate is required').max(20),
  brandId: z.string().uuid().optional(),
  modelId: z.string().uuid().optional(),
  currentKilometers: z.number().min(0).optional().default(0),
  imageUrl: z.string().refine((v) => v.startsWith('data:image/') || /^https?:\/\//.test(v), 'Invalid image').optional(),
  gpsTracker: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  engineNumber: z.string().min(1, 'Engine number is required').max(100),
  chassisNumber: z.string().min(1, 'Chassis number is required').max(100),
  serialNumber: z.string().max(100).nullable().optional(),
});

const updateMotorcycleSchema = z.object({
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  licensePlate: z.string().min(1).max(20).optional(),
  brandId: z.string().uuid().nullable().optional(),
  modelId: z.string().uuid().nullable().optional(),
  currentKilometers: z.number().min(0).optional(),
  imageUrl: z.string().refine((v) => v.startsWith('data:image/') || /^https?:\/\//.test(v), 'Invalid image').nullable().optional(),
  gpsTracker: z.string().max(100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  engineNumber: z.string().min(1).max(100).optional(),
  chassisNumber: z.string().min(1).max(100).optional(),
  serialNumber: z.string().max(100).nullable().optional(),
});

const motorcycleIdParam = z.object({
  id: z.string().uuid('Invalid motorcycle ID'),
});

interface MotorcycleParams {
  id: string;
}

function getMotorcycleId(req: Request): string {
  return (req.params as unknown as MotorcycleParams).id;
}

// --- GET /api/motorcycles ---
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userMotorcycles = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.userId, userId));

    res.json({
      success: true,
      data: userMotorcycles.map((m) => ({
        ...m,
        createdAt: new Date(m.createdAt),
        updatedAt: new Date(m.updatedAt),
      })),
    });
  } catch (err) {
    console.error('List motorcycles error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch motorcycles');
    res.status(500).json(error);
  }
});

// --- GET /api/motorcycles/:id ---
router.get('/:id', validateParams(motorcycleIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    const motorcycle = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!motorcycle) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    res.json({
      success: true,
      data: {
        ...motorcycle,
        createdAt: new Date(motorcycle.createdAt),
        updatedAt: new Date(motorcycle.updatedAt),
      },
    });
  } catch (err) {
    console.error('Get motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to fetch motorcycle');
    res.status(500).json(error);
  }
});

// --- POST /api/motorcycles ---
router.post('/', validateBody(createMotorcycleSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { brand, model, year, licensePlate, brandId, modelId, currentKilometers, imageUrl, gpsTracker, color, engineNumber, chassisNumber, serialNumber } = req.body;

    // Check for duplicate license plate
    const existing = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.licensePlate, licensePlate))
      .get();

    if (existing) {
      const error = createErrorResponse('CONFLICT', 'A motorcycle with this license plate already exists');
      res.status(409).json(error);
      return;
    }

    const now = new Date();
    const motorcycleId = crypto.randomUUID();

    await db.insert(motorcycles).values({
      id: motorcycleId,
      userId,
      brand,
      model,
      year,
      licensePlate,
      brandId: brandId ?? null,
      modelId: modelId ?? null,
      currentKilometers: currentKilometers ?? 0,
      imageUrl: imageUrl ?? null,
      gpsTracker: gpsTracker ?? null,
      color: color ?? null,
      engineNumber: engineNumber ?? null,
      chassisNumber: chassisNumber ?? null,
      serialNumber: serialNumber ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.id, motorcycleId))
      .get();

    res.status(201).json({
      success: true,
      data: {
        ...created!,
        createdAt: new Date(created!.createdAt),
        updatedAt: new Date(created!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Create motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to create motorcycle');
    res.status(500).json(error);
  }
});

// --- PUT /api/motorcycles/:id ---
router.put('/:id', validateParams(motorcycleIdParam), validateBody(updateMotorcycleSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    // Verify ownership
    const existing = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    // Check license plate conflict if changing
    if (req.body.licensePlate && req.body.licensePlate !== existing.licensePlate) {
      const plateConflict = await db
        .select()
        .from(motorcycles)
        .where(eq(motorcycles.licensePlate, req.body.licensePlate))
        .get();

      if (plateConflict) {
        const error = createErrorResponse('CONFLICT', 'A motorcycle with this license plate already exists');
        res.status(409).json(error);
        return;
      }
    }

    const now = new Date();

    await db
      .update(motorcycles)
      .set({
        ...req.body,
        updatedAt: now,
      })
      .where(eq(motorcycles.id, id));

    const updated = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.id, id))
      .get();

    res.json({
      success: true,
      data: {
        ...updated!,
        createdAt: new Date(updated!.createdAt),
        updatedAt: new Date(updated!.updatedAt),
      },
    });
  } catch (err) {
    console.error('Update motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to update motorcycle');
    res.status(500).json(error);
  }
});

// --- DELETE /api/motorcycles/:id ---
router.delete('/:id', validateParams(motorcycleIdParam), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = getMotorcycleId(req);

    const existing = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, id), eq(motorcycles.userId, userId)))
      .get();

    if (!existing) {
      const error = createErrorResponse('NOT_FOUND', 'Motorcycle not found');
      res.status(404).json(error);
      return;
    }

    await db.delete(motorcycles).where(eq(motorcycles.id, id));

    res.json({ success: true, message: 'Motorcycle deleted' });
  } catch (err) {
    console.error('Delete motorcycle error:', err);
    const error = createErrorResponse('INTERNAL_ERROR', 'Failed to delete motorcycle');
    res.status(500).json(error);
  }
});

// --- Verification Schemas ---

const verifyMotorcycleSchema = z.object({
  padronUrl: z.string().min(1, 'Padrón photo is required'),
  carnetFrontUrl: z.string().optional(),
  carnetBackUrl: z.string().optional(),
  selfieUrl: z.string().optional(),
  padronBackUrl: z.string().optional(),
  extractedPatente: z.string().optional(),
  extractedRut: z.string().optional(),
});

// --- GET /api/motorcycles/:id/verification-status ---
router.get('/:id/verification-status', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);

    const moto = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!moto) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
      return;
    }

    const pending = await db
      .select()
      .from(verificacionesPendientes)
      .where(eq(verificacionesPendientes.motorcycleId, motorcycleId))
      .orderBy(desc(verificacionesPendientes.createdAt))
      .all();

    res.json({
      success: true,
      data: {
        verificada: moto.verificada,
        verificadaEn: moto.verificadaEn,
        verificadaPor: moto.verificadaPor,
        rtVigente: moto.rtVigente,
        encargoRobo: moto.encargoRobo,
        pendingFiles: pending.filter(p => p.estado === 'pendiente').map(p => ({
          id: p.id,
          tipo: p.tipo,
          estado: p.estado,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error('Get verification status error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to get verification status'));
  }
});

// --- POST /api/motorcycles/:id/verify ---
router.post('/:id/verify', validateBody(verifyMotorcycleSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);
    const { padronUrl, carnetFrontUrl, carnetBackUrl, selfieUrl, padronBackUrl, extractedPatente, extractedRut } = req.body;

    console.log('[VERIFY] Request for motorcycle:', motorcycleId);

    // Get motorcycle
    const moto = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!moto) {
      console.log('[VERIFY] Motorcycle not found');
      res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
      return;
    }

    if (moto.verificada) {
      console.log('[VERIFY] Already verified');
      res.status(400).json(createErrorResponse('BAD_REQUEST', 'Motorcycle already verified'));
      return;
    }

    // Get user
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!user) {
      console.log('[VERIFY] User not found');
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    // Validate plate format
    const plateResult = validatePlate(moto.licensePlate);
    console.log('[VERIFY] Plate:', moto.licensePlate, '→ valid:', plateResult.valid, 'format:', plateResult.format);
    if (!plateResult.valid) {
      res.status(400).json(createErrorResponse('INVALID_PLATE', 'Invalid license plate format'));
      return;
    }

    // Run external checks (non-blocking)
    console.log('[VERIFY] Running vehicle checks for plate:', plateResult.normalized);
    const [rtCheck, theftCheck] = await Promise.all([
      checkTechnicalReview(plateResult.normalized),
      checkTheftHistory(plateResult.normalized),
    ]);
    console.log('[VERIFY] RT check:', rtCheck, 'Theft check:', theftCheck);

    // Validate padrón back PPU if provided
    let ppuMatch = true;
    if (extractedPatente) {
      const normalizedExtracted = extractedPatente.replace(/[\s-]/g, '').toUpperCase();
      const normalizedRegistered = moto.licensePlate.replace(/[\s-]/g, '').toUpperCase();
      ppuMatch = normalizedExtracted === normalizedRegistered;
      console.log('[VERIFY] PPU match:', ppuMatch, '(extracted:', normalizedExtracted, 'registered:', normalizedRegistered, ')');
    }

    const warnings: string[] = [];
    if (!rtCheck.vigente) warnings.push('Revisión técnica no vigente');
    if (theftCheck.encargo) warnings.push('Este vehículo tiene encargo por robo');
    if (extractedPatente && !ppuMatch) warnings.push('La patente del dorso no coincide con la registrada');

    // For now, accept padrón-only verification for all users
    // ClaveÚnica identity verification will be enabled later
    await db.update(motorcycles).set({
      verificada: true,
      verificadaEn: new Date(),
      verificadaPor: 'padron',
      fotoConPatente: padronUrl,
      padronBackUrl: padronBackUrl ?? null,
      rutTitular: extractedRut ?? null,
      rtVigente: rtCheck.vigente,
      encargoRobo: theftCheck.encargo,
      updatedAt: new Date(),
    }).where(eq(motorcycles.id, motorcycleId));

    res.json({
      success: true,
      data: {
        verificada: true,
        verificadaPor: 'padron',
        rtVigente: rtCheck.vigente,
        encargoRobo: theftCheck.encargo,
        ppuMatch,
        warnings,
      },
    });
  } catch (err) {
    console.error('Verify motorcycle error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to verify motorcycle'));
  }
});

// --- POST /api/motorcycles/:id/unlink ---
router.post('/:id/unlink', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const motorcycleId = getMotorcycleId(req);

    const moto = await db
      .select()
      .from(motorcycles)
      .where(and(eq(motorcycles.id, motorcycleId), eq(motorcycles.userId, userId)))
      .get();

    if (!moto) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'Motorcycle not found'));
      return;
    }

    await db.update(motorcycles).set({
      desvinculada: true,
      desvinculadaEn: new Date(),
      updatedAt: new Date(),
    }).where(eq(motorcycles.id, motorcycleId));

    res.json({ success: true, message: 'Motorcycle unlinked' });
  } catch (err) {
    console.error('Unlink motorcycle error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to unlink motorcycle'));
  }
});

export default router;

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { activeMotos, motorcycles } from '../db/schema';
import { authenticate, AuthPayload } from '../middleware/auth';

const router = Router();

// Get user's active motorcycle
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [active] = await db
      .select()
      .from(activeMotos)
      .where(eq(activeMotos.userId, userId))
      .limit(1);

    if (!active) {
      return res.json(null);
    }

    res.json({
      id: active.id,
      motorcycleId: active.motorcycleId,
      activatedAt: active.activatedAt,
      activationLat: active.activationLat,
      activationLon: active.activationLon,
    });
  } catch (error) {
    console.error('Error getting active moto:', error);
    res.status(500).json({ error: 'Failed to get active moto' });
  }
});

// Activate a motorcycle
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { motorcycleId, activationLat, activationLon } = req.body;

    if (!motorcycleId) {
      return res.status(400).json({ error: 'motorcycleId is required' });
    }

    // Verify motorcycle belongs to user
    const [motorcycle] = await db
      .select()
      .from(motorcycles)
      .where(eq(motorcycles.id, motorcycleId))
      .limit(1);

    if (!motorcycle || motorcycle.userId !== userId) {
      return res.status(404).json({ error: 'Motorcycle not found' });
    }

    // Delete any existing active moto for this user
    await db
      .delete(activeMotos)
      .where(eq(activeMotos.userId, userId));

    // Create new active moto
    const now = new Date();
    const id = `active-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const [created] = await db
      .insert(activeMotos)
      .values({
        id,
        userId,
        motorcycleId,
        activatedAt: now,
        activationLat: activationLat || null,
        activationLon: activationLon || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json({
      id: created.id,
      motorcycleId: created.motorcycleId,
      activatedAt: created.activatedAt,
      activationLat: created.activationLat,
      activationLon: created.activationLon,
    });
  } catch (error) {
    console.error('Error activating moto:', error);
    res.status(500).json({ error: 'Failed to activate moto' });
  }
});

// Deactivate user's active motorcycle
router.delete('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await db
      .delete(activeMotos)
      .where(eq(activeMotos.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating moto:', error);
    res.status(500).json({ error: 'Failed to deactivate moto' });
  }
});

export default router;

import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { gpsTrackers } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get user's GPS trackers
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const trackers = await db
      .select()
      .from(gpsTrackers)
      .where(eq(gpsTrackers.userId, userId))
      .orderBy(desc(gpsTrackers.createdAt));

    res.json(trackers);
  } catch (error) {
    console.error('[GPS TRACKERS] Error:', error);
    res.status(500).json({ error: 'Failed to get GPS trackers' });
  }
});

// Add GPS tracker
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { imei, name, motorcycleId } = req.body;

    if (!imei || !name) {
      return res.status(400).json({ error: 'IMEI and name are required' });
    }

    if (imei.length !== 15 || !/^\d{15}$/.test(imei)) {
      return res.status(400).json({ error: 'IMEI must be 15 digits' });
    }

    // Check if IMEI already exists for this user
    const existing = await db
      .select()
      .from(gpsTrackers)
      .where(and(eq(gpsTrackers.userId, userId), eq(gpsTrackers.imei, imei)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This IMEI is already registered' });
    }

    const id = `gps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const [created] = await db
      .insert(gpsTrackers)
      .values({
        id,
        userId,
        motorcycleId: motorcycleId || null,
        imei,
        name,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json(created);
  } catch (error) {
    console.error('[GPS TRACKERS] Error creating:', error);
    res.status(500).json({ error: 'Failed to create GPS tracker' });
  }
});

// Update GPS tracker
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = req.params.id as string;
    const { name, motorcycleId } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (motorcycleId !== undefined) updates.motorcycleId = motorcycleId || null;

    const [updated] = await db
      .update(gpsTrackers)
      .set(updates)
      .where(and(eq(gpsTrackers.id, id), eq(gpsTrackers.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'GPS tracker not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('[GPS TRACKERS] Error updating:', error);
    res.status(500).json({ error: 'Failed to update GPS tracker' });
  }
});

// Delete GPS tracker
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = req.params.id as string;

    const deleted = await db
      .delete(gpsTrackers)
      .where(and(eq(gpsTrackers.id, id), eq(gpsTrackers.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'GPS tracker not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[GPS TRACKERS] Error deleting:', error);
    res.status(500).json({ error: 'Failed to delete GPS tracker' });
  }
});

export default router;

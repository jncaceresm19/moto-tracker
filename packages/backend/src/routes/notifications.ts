import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userNotifications = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        motorcycleId: notifications.motorcycleId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        userName: users.name,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.userId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json(userNotifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    res.json({ count: result?.count || 0 });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Create notification (internal use)
export async function createNotification(data: {
  userId: string;
  motorcycleId?: string;
  type: string;
  title: string;
  message: string;
}) {
  const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const [created] = await db
    .insert(notifications)
    .values({
      id,
      userId: data.userId,
      motorcycleId: data.motorcycleId || null,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
      createdAt: new Date(),
    })
    .returning();

  return created;
}

// Notify all users including sender
export async function notifyAllUsers(
  senderUserId: string,
  data: {
    motorcycleId?: string;
    type: string;
    title: string;
    message: string;
  }
) {
  // Get all users
  const allUsers = await db
    .select({ id: users.id })
    .from(users);

  const notificationsToCreate = allUsers.map(u => ({
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: u.id,
    motorcycleId: data.motorcycleId || null,
    type: data.type,
    title: data.title,
    message: data.message,
    isRead: false,
    createdAt: new Date(),
  }));

  if (notificationsToCreate.length > 0) {
    await db.insert(notifications).values(notificationsToCreate);
  }

  return notificationsToCreate.length;
}

export default router;

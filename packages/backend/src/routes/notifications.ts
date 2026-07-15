import { Router } from 'express';
import { eq, desc, and, sql, lt, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// Send push notification via Expo
async function sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });
    const result = await response.json();
    if (result.errors?.length) {
      console.error('[PUSH] Expo errors:', result.errors);
    }
    return result;
  } catch (error) {
    console.error('[PUSH] Failed to send:', error);
  }
}

// Send push to multiple tokens
async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
  try {
    const userRows = await db
      .select({ pushToken: users.pushToken })
      .from(users)
      .where(sql`${users.id} IN ${userIds}`);

    const tokens = userRows
      .map(u => u.pushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) return;

    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await response.json();
    if (result.errors?.length) {
      console.error('[PUSH] Expo batch errors:', result.errors);
    }
  } catch (error) {
    console.error('[PUSH] Failed to send batch:', error);
  }
}

// Auto-delete notifications older than 30 days
async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await db.delete(notifications)
      .where(lt(notifications.createdAt, thirtyDaysAgo));
  } catch (error) {
    console.error('Error cleaning old notifications:', error);
  }
}

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Clean old notifications on each fetch
    await cleanupOldNotifications();

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
        senderName: users.name,
        senderAvatar: users.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.userId, users.id))
      .where(
        and(
          eq(notifications.userId, userId),
          or(
            isNull(notifications.showAt),
            lt(notifications.showAt, new Date())
          )
        )
      )
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

    // Clean old notifications (same as list endpoint)
    await cleanupOldNotifications();

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          or(
            isNull(notifications.showAt),
            lt(notifications.showAt, new Date())
          )
        )
      );

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

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Save push token
router.post('/push-token', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ error: 'Missing userId or token' });
    }

    await db
      .update(users)
      .set({ pushToken: token })
      .where(eq(users.id, userId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// Create notification (internal use) + push
export async function createNotification(data: {
  userId: string;
  motorcycleId?: string;
  type: string;
  title: string;
  message: string;
  showAt?: Date; // when to show (null = immediately)
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
      showAt: data.showAt || null,
      createdAt: new Date(),
    })
    .returning();

  // Only send push if showAt is null (immediate) or in the past
  if (!data.showAt || data.showAt <= new Date()) {
    sendPushToUsers([data.userId], data.title, data.message, {
      notificationId: id,
      type: data.type,
    });
  }

  return created;
}

// Haversine formula: distance in km between two lat/lng points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Notify nearby users (within radiusKm) or all users if no location
export async function notifyAllUsers(
  senderUserId: string,
  data: {
    motorcycleId?: string;
    type: string;
    title: string;
    message: string;
    latitude?: number;
    longitude?: number;
  },
  radiusKm: number = 5
) {
  // Get all users with their locations
  const allUsers = await db
    .select({ id: users.id, lastLatitude: users.lastLatitude, lastLongitude: users.lastLongitude })
    .from(users);

  // Filter by proximity if location is provided
  const targetUsers = data.latitude != null && data.longitude != null
    ? allUsers.filter(u => {
        if (u.lastLatitude == null || u.lastLongitude == null) return false; // no location = no notification
        const dist = haversineDistance(data.latitude!, data.longitude!, u.lastLatitude, u.lastLongitude);
        return dist <= radiusKm;
      })
    : allUsers; // fallback: notify all if no location

  const notificationsToCreate = targetUsers.map(u => ({
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

  // Send push to filtered users
  const targetUserIds = targetUsers.map(u => u.id);
  sendPushToUsers(targetUserIds, data.title, data.message, {
    type: data.type,
  });

  console.log(`[NOTIFICATIONS] Sent to ${targetUsers.length}/${allUsers.length} users (radius: ${radiusKm}km)`);
  return notificationsToCreate.length;
}

export default router;

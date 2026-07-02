import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { notifications } from '../db/schema';
import { createAuthenticate, AuthPayload } from '../middleware/auth';
import { validateParams } from '../middleware/validate';
import { z } from 'zod';
import { createErrorResponse } from '@moto-tracker/shared';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema';

const notificationIdParamSchema = z.object({
  id: z.string().min(1),
});

export function createNotificationRouter(db: BetterSQLite3Database<typeof schema>, jwtSecret: string) {
  const router = Router();
  const authenticate = createAuthenticate(jwtSecret);

  // All notification routes require authentication
  router.use(authenticate);

  // GET /api/notifications — list user notifications
  router.get('/', (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;

      const items = db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, authPayload.userId))
        .orderBy(desc(notifications.createdAt))
        .all();

      res.json({ notifications: items });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  // PUT /api/notifications/:id/read — mark notification as read
  router.put(
    '/:id/read',
    validateParams(notificationIdParamSchema),
    (req: Request, res: Response) => {
      try {
        const authPayload = req.user as AuthPayload;
        const notificationId = req.params.id as string;

        const existing = db
          .select()
          .from(notifications)
          .where(eq(notifications.id, notificationId))
          .get();

        if (!existing) {
          res.status(404).json(createErrorResponse('NOT_FOUND', 'Notification not found'));
          return;
        }

        if (existing.userId !== authPayload.userId) {
          res.status(403).json(createErrorResponse('FORBIDDEN', 'Not your notification'));
          return;
        }

        db.update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, notificationId))
          .run();

        const updated = db
          .select()
          .from(notifications)
          .where(eq(notifications.id, notificationId))
          .get();

        res.json({ notification: updated });
      } catch (error) {
        res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
      }
    }
  );

  // PUT /api/notifications/read-all — mark all user notifications as read
  router.put('/read-all', (req: Request, res: Response) => {
    try {
      const authPayload = req.user as AuthPayload;

      db.update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, authPayload.userId),
            eq(notifications.isRead, false)
          )
        )
        .run();

      res.json({ success: true });
    } catch (error) {
      res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  });

  return router;
}

// Default export for production use (reads from env)
import { db } from '../db';
const defaultRouter = createNotificationRouter(db, process.env.JWT_SECRET!);
export default defaultRouter;

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createNotificationRouter } from './notifications';
import * as schema from '../db/schema';

// Set env vars
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-bytes-long!!';

// Create in-memory test database
const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS motorcycle_catalog_brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT
  );
  CREATE TABLE IF NOT EXISTS motorcycle_catalog_models (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES motorcycle_catalog_brands(id),
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    image_url TEXT
  );
  CREATE TABLE IF NOT EXISTS motorcycles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    brand_id TEXT REFERENCES motorcycle_catalog_brands(id),
    model_id TEXT REFERENCES motorcycle_catalog_models(id),
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT NOT NULL UNIQUE,
    current_kilometers REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    motorcycle_id TEXT REFERENCES motorcycles(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source_type TEXT,
    source_id TEXT,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, is_read);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source ON notifications(user_id, type, source_id);
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const notificationRouter = createNotificationRouter(db, JWT_SECRET);

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationRouter);
  return app;
}

// Helper to generate auth token
function generateAuthToken(userId: string = 'test-user-id'): string {
  return jwt.sign({ userId, email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
}

// Seed test data
function seedTestData(userId: string = 'test-user-id', email?: string) {
  const userEmail = email || `${userId}@example.com`;
  sqlite.exec(`INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${userId}', '${userEmail}', 'hash', 'Test User', ${Date.now()}, ${Date.now()})`);
}

function seedMotorcycle(userId: string = 'test-user-id', motorcycleId: string = 'test-motorcycle-id') {
  const plate = `NOT-${motorcycleId.slice(0, 8).toUpperCase()}`;
  sqlite.exec(`INSERT OR IGNORE INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${motorcycleId}', '${userId}', 'Honda', 'CBR600RR', 2022, '${plate}', 10000, ${Date.now()}, ${Date.now()})`);
}

function seedNotification(params: {
  userId?: string;
  motorcycleId?: string;
  type?: string;
  title?: string;
  message?: string;
  sourceType?: string;
  sourceId?: string;
  isRead?: boolean;
} = {}) {
  const id = uuidv4();
  const sourceId = params.sourceId || uuidv4();
  const now = Date.now();
  sqlite.exec(
    `INSERT INTO notifications (id, user_id, motorcycle_id, type, title, message, source_type, source_id, is_read, created_at) VALUES ('${id}', '${params.userId || 'test-user-id'}', ${params.motorcycleId ? `'${params.motorcycleId}'` : 'NULL'}, '${params.type || 'document_expiry'}', '${params.title || 'Test Notification'}', '${params.message || 'Test message'}', '${params.sourceType || 'document'}', '${sourceId}', ${params.isRead ? 1 : 0}, ${now})`
  );
  return id;
}

describe('Notification Endpoints', () => {
  const app = createTestApp();
  const userId = 'test-user-id';
  const motorcycleId = 'test-motorcycle-id';
  let token: string;

  beforeEach(() => {
    sqlite.exec('DELETE FROM notifications');
    sqlite.exec('DELETE FROM motorcycles');
    sqlite.exec('DELETE FROM users');
    seedTestData(userId);
    seedMotorcycle(userId, motorcycleId);
    token = generateAuthToken(userId);
  });

  describe('GET /api/notifications', () => {
    it('should list notifications for authenticated user', async () => {
      seedNotification({ userId });
      seedNotification({ userId, title: 'Second Notification' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
    });

    it('should return empty array when no notifications exist', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(0);
    });

    it('should not return other users notifications', async () => {
      seedNotification({ userId });
      const otherUserId = 'other-user-id';
      seedTestData(otherUserId, 'other@example.com');
      seedNotification({ userId: otherUserId, title: 'Other User Notification' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].title).toBe('Test Notification');
    });

    it('should return notifications ordered by createdAt descending', async () => {
      const id1 = seedNotification({ userId, title: 'Older' });
      const id2 = seedNotification({ userId, title: 'Newer' });

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications[0].title).toBe('Newer');
      expect(res.body.notifications[1].title).toBe('Older');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/notifications');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const notifId = seedNotification({ userId });

      const res = await request(app)
        .put(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.isRead).toBe(true);
    });

    it('should return 404 for non-existent notification', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .put(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 when marking other users notification', async () => {
      const otherUserId = 'other-user-id';
      seedTestData(otherUserId, 'other2@example.com');
      const notifId = seedNotification({ userId: otherUserId });

      const res = await request(app)
        .put(`/api/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 401 without token', async () => {
      const notifId = seedNotification({ userId });
      const res = await request(app)
        .put(`/api/notifications/${notifId}/read`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all user notifications as read', async () => {
      seedNotification({ userId, isRead: false });
      seedNotification({ userId, isRead: false });
      seedNotification({ userId, isRead: true }); // already read

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all are marked as read
      const listRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      const unread = listRes.body.notifications.filter((n: any) => !n.isRead);
      expect(unread).toHaveLength(0);
    });

    it('should not mark other users notifications as read', async () => {
      seedNotification({ userId, isRead: false });
      const otherUserId = 'other-user-id';
      seedTestData(otherUserId, 'other3@example.com');
      seedNotification({ userId: otherUserId, isRead: false });

      await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      // Verify other user's notification is still unread
      const otherToken = generateAuthToken(otherUserId);
      const otherRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);

      const unread = otherRes.body.notifications.filter((n: any) => !n.isRead);
      expect(unread).toHaveLength(1);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all');

      expect(res.status).toBe(401);
    });
  });
});

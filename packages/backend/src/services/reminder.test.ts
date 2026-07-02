import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { ReminderEngine } from './reminder';
import * as schema from '../db/schema';

// Create in-memory test database
const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables (including reminder_state)
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
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    motorcycle_id TEXT NOT NULL REFERENCES motorcycles(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    expiry_date INTEGER,
    notes TEXT,
    image_path TEXT,
    ocr_raw_text TEXT,
    ocr_confidence REAL,
    status TEXT DEFAULT 'valid',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS maintenance_records (
    id TEXT PRIMARY KEY,
    motorcycle_id TEXT NOT NULL REFERENCES motorcycles(id),
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    kilometers_at_service REAL NOT NULL,
    service_date INTEGER NOT NULL,
    cost REAL,
    notes TEXT,
    next_service_kilometers REAL,
    next_service_date INTEGER,
    oil_type_id TEXT,
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
  CREATE TABLE IF NOT EXISTS reminder_state (
    id TEXT PRIMARY KEY,
    last_checked_at INTEGER NOT NULL
  );
`);

const db = drizzle(sqlite, { schema });

// Helper functions
function seedUser(userId: string = 'test-user-id') {
  sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${userId}', 'test@example.com', 'hash', 'Test User', ${Date.now()}, ${Date.now()})`);
}

function seedMotorcycle(userId: string = 'test-user-id', motorcycleId: string = 'test-motorcycle-id', currentKm: number = 10000) {
  const plate = `REM-${motorcycleId.slice(0, 8).toUpperCase()}`;
  sqlite.exec(`INSERT OR IGNORE INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${motorcycleId}', '${userId}', 'Honda', 'CBR600RR', 2022, '${plate}', ${currentKm}, ${Date.now()}, ${Date.now()})`);
}

function seedDocument(params: {
  motorcycleId: string;
  type?: string;
  title?: string;
  expiryDate?: Date;
}) {
  const id = params.type || uuidv4();
  const now = Date.now();
  sqlite.exec(
    `INSERT INTO documents (id, motorcycle_id, type, title, file_url, expiry_date, status, created_at, updated_at) VALUES ('${id}', '${params.motorcycleId}', '${params.type || 'permiso_circulacion'}', '${params.title || 'Test Document'}', '', ${params.expiryDate ? params.expiryDate.getTime() : 'NULL'}, 'valid', ${now}, ${now})`
  );
  return id;
}

function seedMaintenanceRecord(params: {
  motorcycleId: string;
  type?: string;
  description?: string;
  nextServiceDate?: Date;
  nextServiceKilometers?: number;
}) {
  const id = params.type || uuidv4();
  const now = Date.now();
  sqlite.exec(
    `INSERT INTO maintenance_records (id, motorcycle_id, type, description, kilometers_at_service, service_date, next_service_kilometers, next_service_date, created_at, updated_at) VALUES ('${id}', '${params.motorcycleId}', '${params.type || 'oil_change'}', '${params.description || 'Oil change'}', 10000, ${now}, ${params.nextServiceKilometers || 'NULL'}, ${params.nextServiceDate ? params.nextServiceDate.getTime() : 'NULL'}, ${now}, ${now})`
  );
  return id;
}

function getNotifications(userId: string = 'test-user-id') {
  return sqlite.prepare('SELECT * FROM notifications WHERE user_id = ?').all(userId) as any[];
}

function clearTables() {
  sqlite.exec('DELETE FROM notifications');
  sqlite.exec('DELETE FROM documents');
  sqlite.exec('DELETE FROM maintenance_records');
  sqlite.exec('DELETE FROM motorcycles');
  sqlite.exec('DELETE FROM users');
  sqlite.exec('DELETE FROM reminder_state');
}

describe('ReminderEngine', () => {
  let engine: ReminderEngine;

  beforeEach(() => {
    clearTables();
    seedUser();
    engine = new ReminderEngine(db, { checkIntervalMs: 60 * 60 * 1000 });
  });

  afterEach(() => {
    engine.stop();
  });

  describe('Document expiry checks', () => {
    it('should create notification for document expiring within 30 days', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 15); // 15 days from now
      const docId = seedDocument({ motorcycleId: motorcycleId, expiryDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document_expiring');
      expect(notifications[0].source_type).toBe('document');
      expect(notifications[0].source_id).toBe(docId);
    });

    it('should create urgent notification for document expiring within 7 days', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 5); // 5 days from now
      const docId = seedDocument({ motorcycleId, expiryDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('document_expiry');
      expect(notifications[0].title).toContain('5 días');
    });

    it('should not create notification for document expiring after 30 days', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 45); // 45 days from now
      seedDocument({ motorcycleId, expiryDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should not create notification for expired documents', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - 10); // 10 days ago
      seedDocument({ motorcycleId, expiryDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should not duplicate notifications for same document', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 15);
      seedDocument({ motorcycleId, expiryDate });

      await engine.runCheck();
      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
    });
  });

  describe('Maintenance due checks', () => {
    it('should create notification for maintenance due by date', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const nextServiceDate = new Date();
      nextServiceDate.setDate(nextServiceDate.getDate() + 5);
      const recordId = seedMaintenanceRecord({ motorcycleId, nextServiceDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('maintenance_due');
      expect(notifications[0].source_type).toBe('maintenance');
      expect(notifications[0].source_id).toBe(recordId);
    });

    it('should create notification for maintenance due by kilometers', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId, 10000); // current km: 10000
      const recordId = seedMaintenanceRecord({ motorcycleId, nextServiceKilometers: 10300 }); // 300km away

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('maintenance_km_due');
      expect(notifications[0].message).toContain('300');
    });

    it('should not create notification for maintenance far in the future', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const nextServiceDate = new Date();
      nextServiceDate.setDate(nextServiceDate.getDate() + 30); // 30 days away
      seedMaintenanceRecord({ motorcycleId, nextServiceDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should not create notification for maintenance km far away', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId, 10000); // current km: 10000
      seedMaintenanceRecord({ motorcycleId, nextServiceKilometers: 15000 }); // 5000km away

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(0);
    });

    it('should not duplicate maintenance notifications', async () => {
      const motorcycleId = 'test-motorcycle-id';
      seedMotorcycle('test-user-id', motorcycleId);

      const nextServiceDate = new Date();
      nextServiceDate.setDate(nextServiceDate.getDate() + 5);
      seedMaintenanceRecord({ motorcycleId, nextServiceDate });

      await engine.runCheck();
      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(1);
    });
  });

  describe('Reminder state tracking', () => {
    it('should update last_checked_at after check', async () => {
      await engine.runCheck();

      const state = sqlite.prepare('SELECT * FROM reminder_state WHERE id = ?').get('singleton') as any;
      expect(state).toBeDefined();
      expect(state.last_checked_at).toBeGreaterThan(0);
    });

    it('should update timestamp on subsequent checks', async () => {
      await engine.runCheck();
      const firstCheck = sqlite.prepare('SELECT * FROM reminder_state WHERE id = ?').get('singleton') as any;
      const firstTime = firstCheck.last_checked_at;

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      await engine.runCheck();
      const secondCheck = sqlite.prepare('SELECT * FROM reminder_state WHERE id = ?').get('singleton') as any;

      expect(secondCheck.last_checked_at).toBeGreaterThanOrEqual(firstTime);
    });
  });

  describe('Engine lifecycle', () => {
    it('should start and stop without errors', () => {
      engine.start();
      expect(engine).toBeDefined();
      engine.stop();
    });

    it('should not start twice', () => {
      engine.start();
      engine.start(); // should not throw
      engine.stop();
    });
  });

  describe('Multiple motorcycles and users', () => {
    it('should check all users motorcycles', async () => {
      const userId = 'test-user-id';
      const motoId1 = 'moto-1';
      const motoId2 = 'moto-2';
      seedMotorcycle(userId, motoId1);
      seedMotorcycle(userId, motoId2, 20000);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 10);
      seedDocument({ motorcycleId: motoId1, expiryDate });
      seedDocument({ motorcycleId: motoId2, expiryDate });

      await engine.runCheck();

      const notifications = getNotifications();
      expect(notifications).toHaveLength(2);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createKilometerRouter } from './kilometers';
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
  CREATE TABLE IF NOT EXISTS motorcycles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    brand_id TEXT,
    model_id TEXT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT NOT NULL UNIQUE,
    current_kilometers REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kilometer_history (
    id TEXT PRIMARY KEY,
    motorcycle_id TEXT NOT NULL REFERENCES motorcycles(id),
    reading_km REAL NOT NULL,
    recorded_at INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kilometer_motorcycle_id ON kilometer_history(motorcycle_id);
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const kilometerRouter = createKilometerRouter(db, JWT_SECRET);

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/motorcycles', kilometerRouter);
  return app;
}

// Helper to generate auth token
function generateAuthToken(userId: string = 'test-user-id'): string {
  return jwt.sign({ userId, email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
}

// Seed test data
function seedTestData(userId: string = 'test-user-id') {
  sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${userId}', 'test@example.com', 'hash', 'Test User', ${Date.now()}, ${Date.now()})`);
}

function createTestMotorcycle(userId: string = 'test-user-id'): string {
  const motorcycleId = uuidv4();
  sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${motorcycleId}', '${userId}', 'Honda', 'CBR600RR', 2022, 'KIL-${Date.now()}', 0, ${Date.now()}, ${Date.now()})`);
  return motorcycleId;
}

describe('Kilometer Endpoints', () => {
  const app = createTestApp();
  const userId = 'test-user-id';
  let token: string;
  let motorcycleId: string;

  beforeEach(() => {
    sqlite.exec('DELETE FROM kilometer_history');
    sqlite.exec('DELETE FROM motorcycles');
    sqlite.exec('DELETE FROM users');
    seedTestData(userId);
    token = generateAuthToken(userId);
    motorcycleId = createTestMotorcycle(userId);
  });

  describe('POST /api/motorcycles/:motorcycleId/kilometers', () => {
    it('should create a kilometer entry', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          readingKm: 15000,
          notes: 'First service',
        });

      expect(res.status).toBe(201);
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.readingKm).toBe(15000);
      expect(res.body.entry.motorcycleId).toBe(motorcycleId);
      expect(res.body.entry.notes).toBe('First service');
    });

    it('should update motorcycle current kilometers when reading is higher', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 5000 });

      const motorcycle = db.select().from(schema.motorcycles).where(eq(schema.motorcycles.id, motorcycleId)).get();
      expect(motorcycle?.currentKilometers).toBe(5000);

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 10000 });

      const updated = db.select().from(schema.motorcycles).where(eq(schema.motorcycles.id, motorcycleId)).get();
      expect(updated?.currentKilometers).toBe(10000);
    });

    it('should not update motorcycle current kilometers when reading is lower', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 10000 });

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 5000 });

      const motorcycle = db.select().from(schema.motorcycles).where(eq(schema.motorcycles.id, motorcycleId)).get();
      expect(motorcycle?.currentKilometers).toBe(10000);
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .post(`/api/motorcycles/${fakeId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 1000 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for other users motorcycle', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      const otherMotoId = createTestMotorcycle('other-user-id');

      const res = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 1000 });

      expect(res.status).toBe(404);
    });

    it('should return 400 for negative reading', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: -100 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/motorcycles/:motorcycleId/kilometers', () => {
    it('should return kilometer entries', async () => {
      // Create entries with different timestamps
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 5000, recordedAt: '2024-01-01T00:00:00.000Z' });

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ readingKm: 10000, recordedAt: '2024-06-01T00:00:00.000Z', notes: 'Second entry' });

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toBeDefined();
      expect(res.body.entries.length).toBe(2);
      // Should be ordered by recordedAt desc
      expect(res.body.entries[0].readingKm).toBe(10000);
      expect(res.body.entries[1].readingKm).toBe(5000);
    });

    it('should return empty array for motorcycle with no entries', async () => {
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBe(0);
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/motorcycles/${fakeId}/kilometers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should not return other users motorcycle entries', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      const otherMotoId = createTestMotorcycle('other-user-id');

      await request(app)
        .post(`/api/motorcycles/${otherMotoId}/kilometers`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ readingKm: 9999 });

      const res = await request(app)
        .get(`/api/motorcycles/${otherMotoId}/kilometers`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createMotorcycleRouter } from './motorcycles';
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
  CREATE INDEX IF NOT EXISTS idx_motorcycles_user_id ON motorcycles(user_id);
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const motorcycleRouter = createMotorcycleRouter(db, JWT_SECRET);

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/motorcycles', motorcycleRouter);
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

describe('Motorcycle Endpoints', () => {
  const app = createTestApp();
  const userId = 'test-user-id';
  let token: string;

  beforeEach(() => {
    sqlite.exec('DELETE FROM motorcycles');
    sqlite.exec('DELETE FROM users');
    seedTestData(userId);
    token = generateAuthToken(userId);
  });

  describe('POST /api/motorcycles', () => {
    it('should create a new motorcycle', async () => {
      const res = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'ABC-1234',
        });

      expect(res.status).toBe(201);
      expect(res.body.motorcycle).toBeDefined();
      expect(res.body.motorcycle.brand).toBe('Honda');
      expect(res.body.motorcycle.model).toBe('CBR600RR');
      expect(res.body.motorcycle.year).toBe(2022);
      expect(res.body.motorcycle.licensePlate).toBe('ABC-1234');
      expect(res.body.motorcycle.userId).toBe(userId);
      expect(res.body.motorcycle.currentKilometers).toBe(0);
    });

    it('should inherit image_url from catalog model', async () => {
      // Insert catalog data
      const brandId = uuidv4();
      const modelId = uuidv4();
      sqlite.exec(`INSERT INTO motorcycle_catalog_brands (id, name) VALUES ('${brandId}', 'Honda')`);
      sqlite.exec(`INSERT INTO motorcycle_catalog_models (id, brand_id, name, year, image_url) VALUES ('${modelId}', '${brandId}', 'CBR600RR', 2022, 'https://example.com/cbr.png')`);

      const res = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandId,
          modelId,
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'CAT-0001',
        });

      expect(res.status).toBe(201);
      expect(res.body.motorcycle.imageUrl).toBe('https://example.com/cbr.png');
    });

    it('should return 409 for duplicate license plate', async () => {
      await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'DUP-0001',
        });

      const res = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Yamaha',
          model: 'YZF-R6',
          year: 2023,
          licensePlate: 'DUP-0001',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/motorcycles')
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'NO-AUTH',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/motorcycles', () => {
    it('should return user motorcycles', async () => {
      // Create a motorcycle first
      await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'GET-0001',
        });

      const res = await request(app)
        .get('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.motorcycles).toBeDefined();
      expect(res.body.motorcycles.length).toBe(1);
      expect(res.body.motorcycles[0].brand).toBe('Honda');
    });

    it('should not return other users motorcycles', async () => {
      // Create motorcycle for user 1
      await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'ISO-0001',
        });

      // Create motorcycle for user 2
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other User', ${Date.now()}, ${Date.now()})`);
      await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          brand: 'Yamaha',
          model: 'YZF-R6',
          year: 2023,
          licensePlate: 'ISO-0002',
        });

      const res = await request(app)
        .get('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.motorcycles.length).toBe(1);
      expect(res.body.motorcycles[0].brand).toBe('Honda');
    });
  });

  describe('GET /api/motorcycles/:id', () => {
    it('should return motorcycle detail', async () => {
      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'DET-0001',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.motorcycle.id).toBe(motorcycleId);
      expect(res.body.motorcycle.brand).toBe('Honda');
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/motorcycles/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for other users motorcycle', async () => {
      // Create motorcycle for other user
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other User', ${Date.now()}, ${Date.now()})`);
      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          brand: 'Yamaha',
          model: 'YZF-R6',
          year: 2023,
          licensePlate: 'OWN-0001',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/motorcycles/:id', () => {
    it('should update motorcycle', async () => {
      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'UPD-0001',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          model: 'CBR650R',
          year: 2023,
        });

      expect(res.status).toBe(200);
      expect(res.body.motorcycle.model).toBe('CBR650R');
      expect(res.body.motorcycle.year).toBe(2023);
      expect(res.body.motorcycle.brand).toBe('Honda'); // unchanged
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .put(`/api/motorcycles/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ model: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 409 when updating to duplicate plate', async () => {
      await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'PLT-0001',
        });

      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Yamaha',
          model: 'YZF-R6',
          year: 2023,
          licensePlate: 'PLT-0002',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ licensePlate: 'PLT-0001' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/motorcycles/:id', () => {
    it('should delete motorcycle', async () => {
      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Honda',
          model: 'CBR600RR',
          year: 2022,
          licensePlate: 'DEL-0001',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .delete(`/api/motorcycles/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 when deleting other users motorcycle', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other User', ${Date.now()}, ${Date.now()})`);
      const createRes = await request(app)
        .post('/api/motorcycles')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          brand: 'Yamaha',
          model: 'YZF-R6',
          year: 2023,
          licensePlate: 'NOD-0001',
        });

      const motorcycleId = createRes.body.motorcycle.id;

      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

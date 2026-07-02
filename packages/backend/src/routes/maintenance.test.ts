import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createMaintenanceRouter } from './maintenance';
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
  CREATE INDEX IF NOT EXISTS idx_maintenance_motorcycle_id ON maintenance_records(motorcycle_id);
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const maintenanceRouter = createMaintenanceRouter(db, JWT_SECRET);

// Create test app — mount at /api/motorcycles for nested routes and /api/maintenance for top-level
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/motorcycles', maintenanceRouter);
  app.use('/api/maintenance', maintenanceRouter);
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
  sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${motorcycleId}', '${userId}', 'Honda', 'CBR600RR', 2022, 'MNT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}', 15000, ${Date.now()}, ${Date.now()})`);
  return motorcycleId;
}

describe('Maintenance Endpoints', () => {
  const app = createTestApp();
  const userId = 'test-user-id';
  let token: string;
  let motorcycleId: string;

  beforeEach(() => {
    sqlite.exec('DELETE FROM maintenance_records');
    sqlite.exec('DELETE FROM motorcycles');
    sqlite.exec('DELETE FROM users');
    seedTestData(userId);
    token = generateAuthToken(userId);
    motorcycleId = createTestMotorcycle(userId);
  });

  describe('POST /api/motorcycles/:motorcycleId/maintenance', () => {
    it('should create a maintenance record', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Regular oil change',
          kilometersAtService: 15000,
          serviceDate: '2024-06-15T10:00:00.000Z',
          cost: 5000,
          notes: 'Used Motul 7100',
        });

      expect(res.status).toBe(201);
      expect(res.body.record).toBeDefined();
      expect(res.body.record.type).toBe('oil_change');
      expect(res.body.record.description).toBe('Regular oil change');
      expect(res.body.record.kilometersAtService).toBe(15000);
      expect(res.body.record.motorcycleId).toBe(motorcycleId);
      expect(res.body.record.cost).toBe(5000);
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .post(`/api/motorcycles/${fakeId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Test',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(404);
    });

    it('should return 404 for other users motorcycle', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      const otherMotoId = createTestMotorcycle('other-user-id');

      const res = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Test',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'invalid_type',
          description: 'Test',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/motorcycles/:motorcycleId/maintenance', () => {
    it('should return maintenance records', async () => {
      // Create records
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Oil change',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'tire_change',
          description: 'Tire change',
          kilometersAtService: 12000,
          serviceDate: '2024-06-01T00:00:00.000Z',
        });

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.records).toBeDefined();
      expect(res.body.records.length).toBe(2);
      // Should be ordered by serviceDate desc
      expect(res.body.records[0].type).toBe('tire_change');
      expect(res.body.records[1].type).toBe('oil_change');
    });

    it('should filter by type', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Oil change',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'tire_change',
          description: 'Tire change',
          kilometersAtService: 12000,
          serviceDate: '2024-06-01T00:00:00.000Z',
        });

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/maintenance?type=oil_change`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(1);
      expect(res.body.records[0].type).toBe('oil_change');
    });

    it('should return empty array for motorcycle with no records', async () => {
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.records.length).toBe(0);
    });
  });

  describe('PUT /api/maintenance/:id', () => {
    it('should update maintenance record', async () => {
      const createRes = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Oil change',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
          cost: 5000,
        });

      const recordId = createRes.body.record.id;

      const res = await request(app)
        .put(`/api/maintenance/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Updated oil change with filter',
          cost: 7500,
        });

      expect(res.status).toBe(200);
      expect(res.body.record.description).toBe('Updated oil change with filter');
      expect(res.body.record.cost).toBe(7500);
      expect(res.body.record.type).toBe('oil_change'); // unchanged
    });

    it('should return 404 for non-existent record', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .put(`/api/maintenance/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 403 when updating other users record', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      const otherMotoId = createTestMotorcycle('other-user-id');

      const createRes = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/maintenance`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          type: 'oil_change',
          description: 'Other user record',
          kilometersAtService: 5000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      const recordId = createRes.body.record.id;

      const res = await request(app)
        .put(`/api/maintenance/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Hacked' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/maintenance/:id', () => {
    it('should delete maintenance record', async () => {
      const createRes = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'oil_change',
          description: 'Oil change',
          kilometersAtService: 10000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      const recordId = createRes.body.record.id;

      const res = await request(app)
        .delete(`/api/maintenance/${recordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.body.records.length).toBe(0);
    });

    it('should return 404 for non-existent record', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .delete(`/api/maintenance/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 403 when deleting other users record', async () => {
      const otherToken = generateAuthToken('other-user-id');
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('other-user-id', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      const otherMotoId = createTestMotorcycle('other-user-id');

      const createRes = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/maintenance`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          type: 'oil_change',
          description: 'Other user record',
          kilometersAtService: 5000,
          serviceDate: '2024-01-01T00:00:00.000Z',
        });

      const recordId = createRes.body.record.id;

      const res = await request(app)
        .delete(`/api/maintenance/${recordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

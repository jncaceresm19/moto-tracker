import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createDocumentRouter } from './documents';
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
  CREATE INDEX IF NOT EXISTS idx_documents_motorcycle_id ON documents(motorcycle_id);
  CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expiry_date);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_motorcycle_type ON documents(motorcycle_id, type);
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const documentRouter = createDocumentRouter(db, JWT_SECRET);

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/motorcycles', documentRouter);
  app.use('/api/documents', documentRouter);
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

function seedMotorcycle(userId: string = 'test-user-id', motorcycleId: string = 'test-motorcycle-id') {
  sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${motorcycleId}', '${userId}', 'Honda', 'CBR600RR', 2022, 'DOC-0001', 10000, ${Date.now()}, ${Date.now()})`);
}

describe('Document Endpoints', () => {
  const app = createTestApp();
  const userId = 'test-user-id';
  const motorcycleId = 'test-motorcycle-id';
  let token: string;

  beforeEach(() => {
    sqlite.exec('DELETE FROM documents');
    sqlite.exec('DELETE FROM motorcycles');
    sqlite.exec('DELETE FROM users');
    seedTestData(userId);
    seedMotorcycle(userId, motorcycleId);
    token = generateAuthToken(userId);
  });

  describe('POST /api/motorcycles/:motorcycleId/documents', () => {
    it('should create a new document', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'Permiso de Circulación 2026',
          expiryDate: '2026-12-31T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.document).toBeDefined();
      expect(res.body.document.type).toBe('permiso_circulacion');
      expect(res.body.document.title).toBe('Permiso de Circulación 2026');
      expect(res.body.document.motorcycleId).toBe(motorcycleId);
      expect(res.body.document.status).toBe('valid');
    });

    it('should return 409 for duplicate document type on same motorcycle', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'First document',
        });

      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'Second document',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should allow different document types on same motorcycle', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'Permiso',
        });

      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'revision_tecnica',
          title: 'Revisión Técnica',
        });

      expect(res.status).toBe(201);
    });

    it('should set status to expiring when expiry is within 30 days', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);

      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'seguro',
          title: 'Seguro',
          expiryDate: soon.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('expiring');
    });

    it('should set status to expired when expiry is in the past', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);

      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'libre_deuda',
          title: 'Libre Deuda',
          expiryDate: past.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.document.status).toBe('expired');
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .post(`/api/motorcycles/${fakeId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'Test',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .send({
          type: 'permiso_circulacion',
          title: 'Test',
        });

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Missing type',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should store OCR data when provided', async () => {
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'permiso_circulacion',
          title: 'OCR Document',
          ocrRawText: 'Vencimiento: 31/12/2026',
          ocrConfidence: 0.85,
        });

      expect(res.status).toBe(201);
      expect(res.body.document.ocrRawText).toBe('Vencimiento: 31/12/2026');
      expect(res.body.document.ocrConfidence).toBe(0.85);
    });
  });

  describe('GET /api/motorcycles/:motorcycleId/documents', () => {
    it('should list documents for a motorcycle', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'permiso_circulacion', title: 'Permiso' });

      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'revision_tecnica', title: 'Revisión' });

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(2);
    });

    it('should return empty array when no documents exist', async () => {
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(0);
    });

    it('should return 404 for non-existent motorcycle', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/motorcycles/${fakeId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should not return other users documents', async () => {
      await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'permiso_circulacion', title: 'My doc' });

      // Create other user's motorcycle and document
      const otherUserId = 'other-user-id';
      const otherMotoId = 'other-motorcycle-id';
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${otherUserId}', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${otherMotoId}', '${otherUserId}', 'Yamaha', 'YZF-R6', 2023, 'OTH-0001', 5000, ${Date.now()}, ${Date.now()})`);

      const otherToken = generateAuthToken(otherUserId);
      await request(app)
        .post(`/api/motorcycles/${otherMotoId}/documents`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ type: 'permiso_circulacion', title: 'Other doc' });

      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.documents[0].title).toBe('My doc');
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should update document', async () => {
      const createRes = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'seguro', title: 'Seguro Original' });

      const docId = createRes.body.document.id;

      const res = await request(app)
        .put(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Seguro Updated' });

      expect(res.status).toBe(200);
      expect(res.body.document.title).toBe('Seguro Updated');
    });

    it('should recompute status when updating expiryDate', async () => {
      const createRes = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'libre_deuda', title: 'Libre Deuda' });

      const docId = createRes.body.document.id;
      const past = new Date();
      past.setDate(past.getDate() - 5);

      const res = await request(app)
        .put(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ expiryDate: past.toISOString() });

      expect(res.status).toBe(200);
      expect(res.body.document.status).toBe('expired');
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .put(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 403 when updating other users document', async () => {
      const otherUserId = 'other-user-id';
      const otherMotoId = 'other-motorcycle-id';
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${otherUserId}', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${otherMotoId}', '${otherUserId}', 'Yamaha', 'YZF-R6', 2023, 'OTH-0002', 5000, ${Date.now()}, ${Date.now()})`);

      const otherToken = generateAuthToken(otherUserId);
      const createRes = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/documents`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ type: 'seguro', title: 'Other doc' });

      const docId = createRes.body.document.id;

      const res = await request(app)
        .put(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete document', async () => {
      const createRes = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'permiso_circulacion', title: 'To Delete' });

      const docId = createRes.body.document.id;

      const res = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.body.documents).toHaveLength(0);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .delete(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 403 when deleting other users document', async () => {
      const otherUserId = 'other-user-id';
      const otherMotoId = 'other-motorcycle-id';
      sqlite.exec(`INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES ('${otherUserId}', 'other@example.com', 'hash', 'Other', ${Date.now()}, ${Date.now()})`);
      sqlite.exec(`INSERT INTO motorcycles (id, user_id, brand, model, year, license_plate, current_kilometers, created_at, updated_at) VALUES ('${otherMotoId}', '${otherUserId}', 'Yamaha', 'YZF-R6', 2023, 'OTH-0003', 5000, ${Date.now()}, ${Date.now()})`);

      const otherToken = generateAuthToken(otherUserId);
      const createRes = await request(app)
        .post(`/api/motorcycles/${otherMotoId}/documents`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ type: 'seguro', title: 'Protected' });

      const docId = createRes.body.document.id;

      const res = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});

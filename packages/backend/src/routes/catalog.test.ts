import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { createCatalogRouter } from './catalog';
import * as schema from '../db/schema';

// Set env vars
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-bytes-long!!';

// Create in-memory test database
const sqlite = new Database(':memory:');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
sqlite.exec(`
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
  CREATE TABLE IF NOT EXISTS oil_catalog_brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS oil_catalog_products (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES oil_catalog_brands(id),
    name TEXT NOT NULL,
    viscosity TEXT NOT NULL,
    type TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS maintenance_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_km_interval REAL,
    default_month_interval INTEGER,
    category TEXT NOT NULL
  );
`);

const db = drizzle(sqlite, { schema });
const JWT_SECRET = process.env.JWT_SECRET!;
const catalogRouter = createCatalogRouter(db, JWT_SECRET);

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/catalog', catalogRouter);
  return app;
}

// Helper to generate auth token
function generateAuthToken(userId: string = 'test-user-id'): string {
  return jwt.sign({ userId, email: 'test@example.com' }, JWT_SECRET, { expiresIn: '1h' });
}

// Seed test data
function seedTestData() {
  // Insert motorcycle brands
  const brand1Id = uuidv4();
  const brand2Id = uuidv4();
  sqlite.exec(`INSERT INTO motorcycle_catalog_brands (id, name, logo_url) VALUES ('${brand1Id}', 'Honda', 'https://example.com/honda.png')`);
  sqlite.exec(`INSERT INTO motorcycle_catalog_brands (id, name, logo_url) VALUES ('${brand2Id}', 'Yamaha', 'https://example.com/yamaha.png')`);

  // Insert motorcycle models
  const model1Id = uuidv4();
  const model2Id = uuidv4();
  const model3Id = uuidv4();
  sqlite.exec(`INSERT INTO motorcycle_catalog_models (id, brand_id, name, year, image_url) VALUES ('${model1Id}', '${brand1Id}', 'CBR600RR', 2022, 'https://example.com/cbr600rr.png')`);
  sqlite.exec(`INSERT INTO motorcycle_catalog_models (id, brand_id, name, year, image_url) VALUES ('${model2Id}', '${brand1Id}', 'CB500F', 2021, 'https://example.com/cb500f.png')`);
  sqlite.exec(`INSERT INTO motorcycle_catalog_models (id, brand_id, name, year, image_url) VALUES ('${model3Id}', '${brand2Id}', 'YZF-R6', 2023, 'https://example.com/r6.png')`);

  // Insert oil brands
  const oilBrand1Id = uuidv4();
  const oilBrand2Id = uuidv4();
  sqlite.exec(`INSERT INTO oil_catalog_brands (id, name) VALUES ('${oilBrand1Id}', 'Motul')`);
  sqlite.exec(`INSERT INTO oil_catalog_brands (id, name) VALUES ('${oilBrand2Id}', 'Castrol')`);

  // Insert oil products
  const product1Id = uuidv4();
  const product2Id = uuidv4();
  const product3Id = uuidv4();
  sqlite.exec(`INSERT INTO oil_catalog_products (id, brand_id, name, viscosity, type) VALUES ('${product1Id}', '${oilBrand1Id}', '7100 4T', '10W-40', 'synthetic')`);
  sqlite.exec(`INSERT INTO oil_catalog_products (id, brand_id, name, viscosity, type) VALUES ('${product2Id}', '${oilBrand1Id}', '5100 4T', '10W-40', 'semi-synthetic')`);
  sqlite.exec(`INSERT INTO oil_catalog_products (id, brand_id, name, viscosity, type) VALUES ('${product3Id}', '${oilBrand2Id}', 'Power1', '10W-40', 'synthetic')`);
}

describe('Catalog Endpoints', () => {
  const app = createTestApp();
  let token: string;

  beforeEach(() => {
    // Clear tables before each test
    sqlite.exec('DELETE FROM oil_catalog_products');
    sqlite.exec('DELETE FROM oil_catalog_brands');
    sqlite.exec('DELETE FROM motorcycle_catalog_models');
    sqlite.exec('DELETE FROM motorcycle_catalog_brands');
    sqlite.exec('DELETE FROM maintenance_types');
    // Seed fresh data
    seedTestData();
    token = generateAuthToken();
  });

  describe('GET /api/catalog/brands', () => {
    it('should return all motorcycle brands', async () => {
      const res = await request(app)
        .get('/api/catalog/brands')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brands).toBeDefined();
      expect(res.body.brands.length).toBe(2);
      expect(res.body.brands[0].name).toBe('Honda');
      expect(res.body.brands[1].name).toBe('Yamaha');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/catalog/brands');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should filter brands by search query', async () => {
      const res = await request(app)
        .get('/api/catalog/brands?search=Hon')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brands.length).toBe(1);
      expect(res.body.brands[0].name).toBe('Honda');
    });

    it('should return empty array for non-matching search', async () => {
      const res = await request(app)
        .get('/api/catalog/brands?search=Kawasaki')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brands.length).toBe(0);
    });
  });

  describe('GET /api/catalog/brands/:id/models', () => {
    it('should return models for a brand', async () => {
      // First get brand id
      const brandsRes = await request(app)
        .get('/api/catalog/brands')
        .set('Authorization', `Bearer ${token}`);
      const hondaId = brandsRes.body.brands.find((b: any) => b.name === 'Honda').id;

      const res = await request(app)
        .get(`/api/catalog/brands/${hondaId}/models`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brand).toBeDefined();
      expect(res.body.brand.name).toBe('Honda');
      expect(res.body.models).toBeDefined();
      expect(res.body.models.length).toBe(2);
      expect(res.body.models[0].imageUrl).toBeDefined();
    });

    it('should return 404 for non-existent brand', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/catalog/brands/${fakeId}/models`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should filter models by search query', async () => {
      const brandsRes = await request(app)
        .get('/api/catalog/brands')
        .set('Authorization', `Bearer ${token}`);
      const hondaId = brandsRes.body.brands.find((b: any) => b.name === 'Honda').id;

      const res = await request(app)
        .get(`/api/catalog/brands/${hondaId}/models?search=CBR`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.models.length).toBe(1);
      expect(res.body.models[0].name).toBe('CBR600RR');
    });
  });

  describe('GET /api/catalog/oil-brands', () => {
    it('should return all oil brands', async () => {
      const res = await request(app)
        .get('/api/catalog/oil-brands')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brands).toBeDefined();
      expect(res.body.brands.length).toBe(2);
      expect(res.body.brands[0].name).toBe('Motul');
      expect(res.body.brands[1].name).toBe('Castrol');
    });

    it('should filter oil brands by search query', async () => {
      const res = await request(app)
        .get('/api/catalog/oil-brands?search=Mot')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brands.length).toBe(1);
      expect(res.body.brands[0].name).toBe('Motul');
    });
  });

  describe('GET /api/catalog/oil-brands/:id/products', () => {
    it('should return products for an oil brand', async () => {
      const brandsRes = await request(app)
        .get('/api/catalog/oil-brands')
        .set('Authorization', `Bearer ${token}`);
      const motulId = brandsRes.body.brands.find((b: any) => b.name === 'Motul').id;

      const res = await request(app)
        .get(`/api/catalog/oil-brands/${motulId}/products`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.brand).toBeDefined();
      expect(res.body.brand.name).toBe('Motul');
      expect(res.body.products).toBeDefined();
      expect(res.body.products.length).toBe(2);
      expect(res.body.products[0].viscosity).toBe('10W-40');
      expect(res.body.products[0].type).toBe('synthetic');
    });

    it('should return 404 for non-existent oil brand', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/catalog/oil-brands/${fakeId}/products`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should filter products by search query', async () => {
      const brandsRes = await request(app)
        .get('/api/catalog/oil-brands')
        .set('Authorization', `Bearer ${token}`);
      const motulId = brandsRes.body.brands.find((b: any) => b.name === 'Motul').id;

      const res = await request(app)
        .get(`/api/catalog/oil-brands/${motulId}/products?search=7100`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].name).toBe('7100 4T');
    });

    it('should filter products by viscosity', async () => {
      const brandsRes = await request(app)
        .get('/api/catalog/oil-brands')
        .set('Authorization', `Bearer ${token}`);
      const motulId = brandsRes.body.brands.find((b: any) => b.name === 'Motul').id;

      const res = await request(app)
        .get(`/api/catalog/oil-brands/${motulId}/products?viscosity=10W-40`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(2);
    });

    it('should filter products by type', async () => {
      const brandsRes = await request(app)
        .get('/api/catalog/oil-brands')
        .set('Authorization', `Bearer ${token}`);
      const motulId = brandsRes.body.brands.find((b: any) => b.name === 'Motul').id;

      const res = await request(app)
        .get(`/api/catalog/oil-brands/${motulId}/products?type=synthetic`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(1);
      expect(res.body.products[0].name).toBe('7100 4T');
    });
  });
});
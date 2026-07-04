import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Set test environment before importing app
process.env.NODE_ENV = 'test';

// Import app once — index.ts will NOT call listen() when NODE_ENV=test
const appPromise = import('./index').then((m) => m.default);

let authToken: string;
let motorcycleId: string;
let maintenanceId: string;
let documentId: string;
let kilometerId: string;

const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: 'Test1234!',
  name: 'Test User',
};

const testMotorcycle = {
  brand: 'Honda',
  model: 'CBR600RR',
  year: 2024,
  licensePlate: `TEST-${Date.now()}`,
  currentKilometers: 5000,
};

// --- Full E2E flow ---
describe('Moto Tracker API — Integration', () => {
  // ============================================================
  // SETUP — register user + create motorcycle (runs once, slow)
  // ============================================================
  beforeAll(async () => {
    const app = await appPromise;

    // Register — bcryptjs with 4 rounds in test, still ~1-3s
    const regRes = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .timeout(30000);

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    authToken = regRes.body.data.accessToken;
    expect(authToken).toBeDefined();

    // Create motorcycle
    const motoRes = await request(app)
      .post('/api/motorcycles')
      .set('Authorization', `Bearer ${authToken}`)
      .send(testMotorcycle);

    expect(motoRes.status).toBe(201);
    motorcycleId = motoRes.body.data.id;
    expect(motorcycleId).toBeDefined();
  }, 60000); // 60s for bcrypt setup

  // ============================================================
  // AUTH
  // ============================================================
  describe('Auth', () => {
    it('POST /api/auth/login — returns token for valid credentials', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('POST /api/auth/login — rejects wrong password', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('POST /api/auth/register — rejects duplicate email', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
    });
  });

  // ============================================================
  // MOTORCYCLES
  // ============================================================
  describe('Motorcycles', () => {
    it('GET /api/motorcycles — lists user motorcycles', async () => {
      const app = await appPromise;
      const res = await request(app)
        .get('/api/motorcycles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(motorcycleId);
    });

    it('GET /api/motorcycles/:id — gets single motorcycle', async () => {
      const app = await appPromise;
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brand).toBe('Honda');
    });

    it('GET /api/motorcycles/:id — rejects unauthorized', async () => {
      const app = await appPromise;
      const res = await request(app).get(`/api/motorcycles/${motorcycleId}`);
      expect(res.status).toBe(401);
    });

    it('PUT /api/motorcycles/:id — updates motorcycle', async () => {
      const app = await appPromise;
      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ model: 'CBR650RR' });

      expect(res.status).toBe(200);
      expect(res.body.data.model).toBe('CBR650RR');
    });
  });

  // ============================================================
  // MAINTENANCE
  // ============================================================
  describe('Maintenance Records', () => {
    it('POST /api/motorcycles/:id/maintenance — creates record', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'oil_change',
          description: 'Changed oil',
          kilometersAtService: 5000,
          serviceDate: new Date().toISOString(),
          cost: 8500,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('oil_change');
      maintenanceId = res.body.data.id;
    });

    it('GET /api/motorcycles/:id/maintenance — lists records', async () => {
      const app = await appPromise;
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/maintenance`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/motorcycles/:id/maintenance/:recordId — updates record', async () => {
      const app = await appPromise;
      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}/maintenance/${maintenanceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Used Castrol 10W-40' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Used Castrol 10W-40');
    });

    it('DELETE /api/motorcycles/:id/maintenance/:recordId — deletes record', async () => {
      const app = await appPromise;
      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}/maintenance/${maintenanceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // DOCUMENTS
  // ============================================================
  describe('Documents', () => {
    it('POST /api/motorcycles/:id/documents — creates document', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'insurance',
          title: 'Policy 2024',
          fileUrl: 'https://example.com/policy.pdf',
          expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('insurance');
      documentId = res.body.data.id;
    });

    it('GET /api/motorcycles/:id/documents — lists documents', async () => {
      const app = await appPromise;
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/documents`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/motorcycles/:id/documents/:docId — updates document', async () => {
      const app = await appPromise;
      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'expiring' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('expiring');
    });

    it('DELETE /api/motorcycles/:id/documents/:docId — deletes document', async () => {
      const app = await appPromise;
      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // KILOMETERS
  // ============================================================
  describe('Kilometer History', () => {
    it('POST /api/motorcycles/:id/kilometers — creates entry', async () => {
      const app = await appPromise;
      const res = await request(app)
        .post(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          readingKm: 6000,
          recordedAt: new Date().toISOString(),
          notes: 'After oil change',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.readingKm).toBe(6000);
      kilometerId = res.body.data.id;
    });

    it('GET /api/motorcycles/:id/kilometers — lists entries', async () => {
      const app = await appPromise;
      const res = await request(app)
        .get(`/api/motorcycles/${motorcycleId}/kilometers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/motorcycles/:id/kilometers/:entryId — updates entry', async () => {
      const app = await appPromise;
      const res = await request(app)
        .put(`/api/motorcycles/${motorcycleId}/kilometers/${kilometerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Updated notes' });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated notes');
    });

    it('DELETE /api/motorcycles/:id/kilometers/:entryId — deletes entry', async () => {
      const app = await appPromise;
      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}/kilometers/${kilometerId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // CLEANUP — delete motorcycle last
  // ============================================================
  describe('Cleanup', () => {
    it('DELETE /api/motorcycles/:id — deletes motorcycle', async () => {
      const app = await appPromise;
      const res = await request(app)
        .delete(`/api/motorcycles/${motorcycleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});

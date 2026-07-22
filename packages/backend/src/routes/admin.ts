import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authenticate, adminOnly } from '../middleware/auth';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, adminOnly);

// GET /api/admin/stats — admin dashboard stats
router.get('/stats', async (_req, res) => {
  try {
    const allUsers = db.select().from(users).all();
    const totalUsers = allUsers.length;
    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const recentUsers = allUsers.filter(u => (u.createdAt as number) > thirtyDaysAgo).length;

    res.json({
      success: true,
      data: { totalUsers, adminCount, recentUsers },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to fetch stats'));
  }
});

// GET /api/admin/users — list all users with search
router.get('/users', async (req, res) => {
  try {
    const { search } = req.query;

    let allRows = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        rut: users.rut,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .all();

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      allRows = allRows.filter(u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.rut && u.rut.includes(q))
      );
    }

    res.json({ success: true, data: allRows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to fetch users'));
  }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      res.status(400).json(createErrorResponse('BAD_REQUEST', 'Role must be "user" or "admin"'));
      return;
    }

    const user = db.select().from(users).where(eq(users.id, id)).get();
    if (!user) {
      res.status(404).json(createErrorResponse('NOT_FOUND', 'User not found'));
      return;
    }

    // Prevent self-demotion
    if (id === req.user?.userId && role === 'user') {
      res.status(400).json(createErrorResponse('BAD_REQUEST', 'Cannot remove your own admin role'));
      return;
    }

    db.update(users).set({ role, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(users.id, id)).run();

    res.json({ success: true, data: { id, role } });
  } catch (err) {
    console.error('Admin role update error:', err);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to update role'));
  }
});

export default router;

const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { pool, isPostgresAvailable } = require('../config/database');
const { listUsers, getUserById } = require('../data/inMemoryStore');

const router = express.Router();
router.use(auth, authorize('admin'));

router.get('/users', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC');
      return res.json({ success: true, users: result.rows });
    }
    const users = listUsers().map(({ id, name, email, role, created_at }) => ({ id, name, email, role, created_at }));
    return res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = z.object({
      role: z.enum(['student', 'admin', 'inventory_manager']),
    }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role,created_at',
        [role, req.params.id]
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, user: result.rows[0] });
    }
    const user = getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.role = role;
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

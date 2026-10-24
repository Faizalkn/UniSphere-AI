const express = require('express');
const z = require('zod');
const AuthService = require('../services/authService');
const auth = require('../middleware/auth');
const { pool, isPostgresAvailable } = require('../config/database');
const { getUserByEmail, getUserById, createUser } = require('../data/inMemoryStore');

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie('unisphere_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function ensureDatabaseAvailable() {
  return isPostgresAvailable();
}

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);

    if (await ensureDatabaseAvailable()) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [payload.email]);
      if (existing.rows.length) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      const passwordHash = await AuthService.hashPassword(payload.password);
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, name, email, role, created_at`,
        [payload.name, payload.email, passwordHash, 'student']
      );

      const user = result.rows[0];
      const token = AuthService.issueToken(user);
      setAuthCookie(res, token);
      return res.status(201).json({ success: true, user });
    }

    const existing = getUserByEmail(payload.email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await AuthService.hashPassword(payload.password);
    const user = createUser({
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: 'student',
    });

    const token = AuthService.issueToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    });

    setAuthCookie(res, token);
    return res.status(201).json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);

    if (await ensureDatabaseAvailable()) {
      const result = await pool.query(
        'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
        [payload.email]
      );

      if (!result.rows.length) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const matches = await AuthService.comparePassword(payload.password, user.password_hash);
      if (!matches) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = AuthService.issueToken(user);
      setAuthCookie(res, token);
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at } });
    }

    const user = getUserByEmail(payload.email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const matches = await AuthService.comparePassword(payload.password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = AuthService.issueToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    });

    setAuthCookie(res, token);
    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    if (await ensureDatabaseAvailable()) {
      const result = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
      if (!result.rows.length) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, user: result.rows[0] });
    }

    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at } });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', auth, async (req, res, next) => {
  try {
    const payload = z.object({ name: z.string().trim().min(2).max(120) }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email,role,created_at',
        [payload.name, req.user.id]
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, user: result.rows[0] });
    }
    const user = getUserById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.name = payload.name;
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at } });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', auth, async (req, res, next) => {
  try {
    const payload = z.object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(8),
    }).parse(req.body);
    let user;
    if (await isPostgresAvailable()) {
      const result = await pool.query('SELECT id,password_hash FROM users WHERE id=$1', [req.user.id]);
      user = result.rows[0];
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (!(await AuthService.comparePassword(payload.currentPassword, user.password_hash))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      const passwordHash = await AuthService.hashPassword(payload.newPassword);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, user.id]);
    } else {
      user = getUserById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (!(await AuthService.comparePassword(payload.currentPassword, user.password_hash))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      user.password_hash = await AuthService.hashPassword(payload.newPassword);
    }
    res.clearCookie('unisphere_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
    return res.json({ success: true, message: 'Password updated. Please sign in again.' });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', auth, async (req, res) => {
  res.clearCookie('unisphere_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;

const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const { pool, isPostgresAvailable } = require('../config/database');
const store = require('../data/inMemoryStore');
const appwrite = require('../integrations/appwrite');

const router = express.Router();
const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  category: z.string().max(100).optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed']).default('todo'),
  dueDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = req.query.status ? String(req.query.status) : null;
    if (appwrite.configured) {
      const tasks = (await appwrite.listTasks(req.user.email)).filter((task) =>
        (!search || `${task.title} ${task.description}`.toLowerCase().includes(search))
        && (!status || task.status === status)
      );
      return res.json({ success: true, tasks, provider: 'appwrite-tablesdb' });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT id, user_id, title, description, category, priority, status, due_date, tags, created_at
         FROM tasks WHERE user_id = $1
         AND ($2 = '' OR title ILIKE $3 OR description ILIKE $3)
         AND ($4::text IS NULL OR status = $4)
         ORDER BY due_date ASC NULLS LAST, created_at DESC`,
        [req.user.id, search, `%${search}%`, status]
      );
      return res.json({ success: true, tasks: result.rows });
    }
    const tasks = store.tasks.filter((task) =>
      Number(task.user_id) === Number(req.user.id)
      && (!search || `${task.title} ${task.description}`.toLowerCase().includes(search))
      && (!status || task.status === status)
    );
    return res.json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const task = taskSchema.parse(req.body);
    if (appwrite.configured) {
      const created = await appwrite.createTask(req.user.email, task);
      return res.status(201).json({ success: true, task: created });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO tasks (user_id, title, description, category, priority, status, due_date, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, user_id, title, description, category, priority, status, due_date, tags, completed_at, created_at`,
        [req.user.id, task.title, task.description, task.category, task.priority, task.status, task.dueDate || null, task.tags]
      );
      return res.status(201).json({ success: true, task: result.rows[0] });
    }
    const created = { ...task, id: `task-${Date.now()}`, user_id: Number(req.user.id), due_date: task.dueDate || null, created_at: new Date().toISOString() };
    delete created.dueDate;
    store.tasks.unshift(created);
    return res.status(201).json({ success: true, task: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const task = taskSchema.partial().parse(req.body);
    if (!Object.keys(task).length) {
      return res.status(400).json({ success: false, message: 'At least one task field is required' });
    }
    if (appwrite.configured) {
      const updated = await appwrite.updateTask(req.user.email, req.params.id, task);
      if (!updated) return res.status(404).json({ success: false, message: 'Task not found' });
      return res.json({ success: true, task: updated });
    }
    if (await isPostgresAvailable()) {
      const fields = { title: 'title', description: 'description', category: 'category', priority: 'priority', status: 'status', dueDate: 'due_date', tags: 'tags' };
      const keys = Object.keys(task);
      const values = keys.map((key) => key === 'dueDate' ? task[key] || null : task[key]);
      const assignments = keys.map((key, index) => `${fields[key]} = $${index + 1}`);
      if (Object.hasOwn(task, 'status')) {
        assignments.push(`completed_at = CASE WHEN $${keys.indexOf('status') + 1} = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END`);
      }
      values.push(req.params.id, req.user.id);
      const result = await pool.query(
        `UPDATE tasks SET ${assignments.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING id, user_id, title, description, category, priority, status, due_date, tags, completed_at, created_at`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Task not found' });
      return res.json({ success: true, task: result.rows[0] });
    }
    const found = store.tasks.find((item) => item.id === req.params.id && Number(item.user_id) === Number(req.user.id));
    if (!found) return res.status(404).json({ success: false, message: 'Task not found' });
    for (const [key, value] of Object.entries(task)) found[key === 'dueDate' ? 'due_date' : key] = value;
    if (task.status === 'completed') found.completed_at = new Date().toISOString();
    if (task.status && task.status !== 'completed') found.completed_at = null;
    return res.json({ success: true, task: found });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (appwrite.configured) {
      const deleted = await appwrite.deleteTask(req.user.email, req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Task not found' });
      return res.json({ success: true });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Task not found' });
    } else {
      const index = store.tasks.findIndex((item) => item.id === req.params.id && Number(item.user_id) === Number(req.user.id));
      if (index < 0) return res.status(404).json({ success: false, message: 'Task not found' });
      store.tasks.splice(index, 1);
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

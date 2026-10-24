const express = require('express');
const auth = require('../middleware/auth');
const { pool, isPostgresAvailable } = require('../config/database');
const store = require('../data/inMemoryStore');
const appwrite = require('../integrations/appwrite');

const router = express.Router();
router.use(auth);

function dayKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

router.get('/', async (req, res, next) => {
  try {
    const inventoryAllowed = ['admin', 'inventory_manager'].includes(req.user.role);
    let tasks;
    let notes;
    let sessions;
    let products = [];
    if (await isPostgresAvailable()) {
      [tasks, notes, sessions] = await Promise.all([
        pool.query('SELECT status, due_date, completed_at, created_at FROM tasks WHERE user_id = $1', [req.user.id]),
        pool.query('SELECT id FROM notes WHERE user_id = $1 AND archived = false', [req.user.id]),
        pool.query("SELECT duration_minutes, started_at FROM study_sessions WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '7 days'", [req.user.id]),
      ]);
      tasks = tasks.rows;
      notes = notes.rows;
      sessions = sessions.rows;
      if (inventoryAllowed) {
        const result = await pool.query('SELECT quantity, min_stock, cost_price FROM inventory_items WHERE archived = false');
        products = result.rows;
      }
    } else if (appwrite.configured) {
      [tasks, notes] = await Promise.all([
        appwrite.listTasks(req.user.email),
        appwrite.listNotes(req.user.email),
      ]);
      sessions = await appwrite.listSessions(req.user.email);
      if (inventoryAllowed) products = store.inventory.filter((product) => !product.archived);
    } else {
      tasks = store.tasks.filter((task) => Number(task.user_id) === Number(req.user.id));
      notes = store.notes.filter((note) => Number(note.user_id) === Number(req.user.id) && !note.archived);
      sessions = store.studySessions.filter((session) => Number(session.user_id) === Number(req.user.id)
        && new Date(session.started_at || session.startedAt) >= new Date(Date.now() - 7 * 86400000));
      if (inventoryAllowed) products = store.inventory.filter((product) => !product.archived);
    }
    const now = Date.now();
    const today = dayKey(now);
    const pending = tasks.filter((task) => task.status !== 'completed');
    const overdue = pending.filter((task) => task.due_date && new Date(task.due_date).getTime() < now);
    const completed = tasks.filter((task) => task.status === 'completed');
    const studyMinutes = sessions.reduce((sum, session) => sum + Number(session.duration_minutes || session.durationMinutes || 0), 0);
    const result = {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      pendingTasks: pending.length,
      overdueTasks: overdue.length,
      completionPercent: tasks.length ? Math.round(completed.length / tasks.length * 100) : 0,
      completedToday: completed.filter((task) => task.completed_at && dayKey(task.completed_at) === today).length,
      upcomingDeadlines: pending.filter((task) => task.due_date && new Date(task.due_date).getTime() >= now
        && new Date(task.due_date).getTime() <= now + 7 * 86400000).length,
      studyMinutesWeek: studyMinutes,
      savedResources: notes.length,
      inventory: inventoryAllowed ? {
        totalProducts: products.length,
        lowStock: products.filter((product) => Number(product.quantity) > 0 && Number(product.quantity) <= Number(product.min_stock)).length,
        outOfStock: products.filter((product) => Number(product.quantity) === 0).length,
        inventoryValue: products.reduce((sum, product) => sum + Number(product.quantity) * Number(product.cost_price), 0),
      } : null,
      taskDistribution: [
        { name: 'To do', value: tasks.filter((task) => task.status === 'todo').length },
        { name: 'In progress', value: tasks.filter((task) => task.status === 'in_progress').length },
        { name: 'Completed', value: completed.length },
      ],
      studySessions: sessions.map((session) => ({
        day: dayKey(session.started_at || session.startedAt),
        minutes: Number(session.duration_minutes || session.durationMinutes || 0),
      })),
      taskCompletionByDay: Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = dayKey(date);
        return {
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          completed: completed.filter((task) => task.completed_at && dayKey(task.completed_at) === key).length,
        };
      }),
    };
    return res.json({ success: true, dashboard: result });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().slice(0, 120);
    if (query.length < 2) return res.json({ success: true, results: [] });
    const pattern = query.toLowerCase();
    const results = [];
    const owns = (item) => Number(item.user_id) === Number(req.user.id);
    if (await isPostgresAvailable()) {
      const [tasks, notes] = await Promise.all([
        pool.query('SELECT id, title, description, status FROM tasks WHERE user_id=$1 AND (title ILIKE $2 OR description ILIKE $2) LIMIT 10', [req.user.id, `%${query}%`]),
        pool.query('SELECT id, title, content, category FROM notes WHERE user_id=$1 AND archived=false AND (title ILIKE $2 OR content ILIKE $2) LIMIT 10', [req.user.id, `%${query}%`]),
      ]);
      results.push(...tasks.rows.map((item) => ({ type: 'task', id: item.id, title: item.title, excerpt: item.description, status: item.status })));
      results.push(...notes.rows.map((item) => ({ type: item.category === 'study-material' ? 'study' : 'note', id: item.id, title: item.title, excerpt: item.content?.slice(0, 160) })));
      if (['admin', 'inventory_manager'].includes(req.user.role)) {
        const products = await pool.query('SELECT id, name, sku, category, quantity FROM inventory_items WHERE archived=false AND (name ILIKE $1 OR sku ILIKE $1) LIMIT 10', [`%${query}%`]);
        results.push(...products.rows.map((item) => ({ type: 'product', id: item.id, title: item.name, excerpt: `${item.sku} · ${item.quantity} in stock` })));
      }
    } else if (appwrite.configured) {
      const [tasks, notes, materials] = await Promise.all([
        appwrite.listTasks(req.user.email),
        appwrite.listNotes(req.user.email),
        appwrite.listMaterials(req.user.email),
      ]);
      results.push(...tasks.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'task', id: item.id, title: item.title, excerpt: item.description })));
      results.push(...notes.filter((item) => !item.archived && `${item.title} ${item.content}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'note', id: item.$id, title: item.title, excerpt: item.content.slice(0, 160) })));
      results.push(...materials.filter((item) => `${item.title} ${item.content}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'study', id: item.$id, title: item.title, excerpt: item.content.slice(0, 160) })));
      if (['admin', 'inventory_manager'].includes(req.user.role)) {
        results.push(...store.inventory.filter((item) => !item.archived && `${item.name} ${item.sku}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'product', id: item.id, title: item.name, excerpt: `${item.sku} · ${item.quantity} in stock` })));
      }
    } else {
      results.push(...store.tasks.filter((item) => owns(item) && `${item.title} ${item.description}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'task', id: item.id, title: item.title, excerpt: item.description })));
      results.push(...store.notes.filter((item) => owns(item) && !item.archived && `${item.title} ${item.content}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'note', id: item.id, title: item.title, excerpt: item.content.slice(0, 160) })));
      results.push(...store.materials.filter((item) => owns(item) && `${item.title} ${item.content}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'study', id: item.id, title: item.title, excerpt: item.content.slice(0, 160) })));
      if (['admin', 'inventory_manager'].includes(req.user.role)) {
        results.push(...store.inventory.filter((item) => !item.archived && `${item.name} ${item.sku}`.toLowerCase().includes(pattern)).slice(0, 10).map((item) => ({ type: 'product', id: item.id, title: item.name, excerpt: `${item.sku} · ${item.quantity} in stock` })));
      }
    }
    return res.json({ success: true, results: results.slice(0, 30) });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const hasPostgres = await isPostgresAvailable();
    const tasks = hasPostgres
      ? (await pool.query('SELECT id, title, due_date FROM tasks WHERE user_id=$1 AND status != $2 AND due_date IS NOT NULL', [req.user.id, 'completed'])).rows
      : appwrite.configured
        ? (await appwrite.listTasks(req.user.email)).filter((task) => task.status !== 'completed')
        : store.tasks.filter((task) => Number(task.user_id) === Number(req.user.id) && task.status !== 'completed');
    const now = Date.now();
    const notifications = tasks
      .filter((task) => task.due_date && new Date(task.due_date).getTime() <= now + 24 * 60 * 60 * 1000)
      .map((task) => ({
        id: `deadline-${task.id}`,
        type: 'deadline',
        title: task.title,
        message: new Date(task.due_date).getTime() < now ? 'Task is overdue' : 'Deadline is within 24 hours',
        dueDate: task.due_date,
      }));
    if (['admin', 'inventory_manager'].includes(req.user.role)) {
      const products = hasPostgres
        ? (await pool.query('SELECT id, name, quantity, min_stock FROM inventory_items WHERE archived=false AND quantity <= min_stock')).rows
        : store.inventory.filter((product) => !product.archived && product.quantity <= product.min_stock);
      notifications.push(...products.map((product) => ({
        id: `stock-${product.id}`,
        type: 'low-stock',
        title: product.name,
        message: Number(product.quantity) === 0 ? 'Out of stock' : 'Stock is below its minimum threshold',
      })));
    }
    const readKeys = hasPostgres
      ? (await pool.query('SELECT notification_key FROM notification_reads WHERE user_id=$1', [req.user.id])).rows.map((row) => row.notification_key)
      : store.notifications.filter((item) => Number(item.user_id) === Number(req.user.id)).map((item) => item.notification_key);
    return res.json({
      success: true,
      notifications: notifications.map((item) => ({ ...item, read: readKeys.includes(item.id) })),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const notificationKey = String(req.params.id).slice(0, 200);
    if (await isPostgresAvailable()) {
      await pool.query(
        `INSERT INTO notification_reads (user_id, notification_key) VALUES ($1,$2)
         ON CONFLICT (user_id, notification_key) DO UPDATE SET read_at=NOW()`,
        [req.user.id, notificationKey]
      );
    } else {
      const current = store.notifications.find((item) =>
        Number(item.user_id) === Number(req.user.id) && item.notification_key === notificationKey
      );
      if (!current) store.notifications.push({ user_id: Number(req.user.id), notification_key: notificationKey });
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

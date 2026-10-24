const express = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const { pool, isPostgresAvailable } = require('../config/database');
const store = require('../data/inMemoryStore');
const appwrite = require('../integrations/appwrite');

const router = express.Router();
const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(50000).default(''),
  category: z.string().max(100).default(''),
  tags: z.array(z.string().max(40)).max(30).default([]),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  sourceUrl: z.string().url().nullable().optional(),
});

router.use(auth);

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const includeArchived = req.query.archived === 'true';
    if (appwrite.configured) {
      const documents = await appwrite.listNotes(req.user.email);
      const notes = documents
        .filter((note) => (includeArchived || !note.archived)
          && (!search || `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned));
      return res.json({ success: true, notes, provider: 'appwrite-documentsdb' });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT id, user_id, title, content, category, tags, pinned, archived, source_url, created_at
         FROM notes WHERE user_id = $1
         AND ($2 = '' OR title ILIKE $3 OR content ILIKE $3)
         AND ($4::boolean OR archived = false)
         ORDER BY pinned DESC, created_at DESC`,
        [req.user.id, search, `%${search}%`, includeArchived]
      );
      return res.json({ success: true, notes: result.rows });
    }
    const notes = store.notes.filter((note) =>
      Number(note.user_id) === Number(req.user.id)
      && (includeArchived || !note.archived)
      && (!search || `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return res.json({ success: true, notes });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const note = noteSchema.parse(req.body);
    if (appwrite.configured) {
      const created = await appwrite.storeNote(req.user.email, { ...note, created_at: new Date().toISOString() });
      return res.status(201).json({ success: true, note: created });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO notes (user_id, title, content, category, tags, pinned, archived, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, user_id, title, content, category, tags, pinned, archived, source_url, created_at`,
        [req.user.id, note.title, note.content, note.category, note.tags, note.pinned, note.archived, note.sourceUrl || null]
      );
      return res.status(201).json({ success: true, note: result.rows[0] });
    }
    const created = { ...note, id: `note-${Date.now()}`, user_id: Number(req.user.id), created_at: new Date().toISOString() };
    store.notes.unshift(created);
    return res.status(201).json({ success: true, note: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const note = noteSchema.partial().parse(req.body);
    if (!Object.keys(note).length) return res.status(400).json({ success: false, message: 'At least one note field is required' });
    if (appwrite.configured) {
      const updated = await appwrite.updateNote(req.user.email, req.params.id, note);
      if (!updated) return res.status(404).json({ success: false, message: 'Note not found' });
      return res.json({ success: true, note: updated });
    }
    if (await isPostgresAvailable()) {
      const fields = { title: 'title', content: 'content', category: 'category', tags: 'tags', pinned: 'pinned', archived: 'archived', sourceUrl: 'source_url' };
      const keys = Object.keys(note);
      const values = keys.map((key) => key === 'sourceUrl' ? note[key] || null : note[key]);
      const assignments = keys.map((key, i) => `${fields[key]} = $${i + 1}`);
      values.push(req.params.id, req.user.id);
      const result = await pool.query(
        `UPDATE notes SET ${assignments.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}
         RETURNING id, user_id, title, content, category, tags, pinned, archived, source_url, created_at`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Note not found' });
      return res.json({ success: true, note: result.rows[0] });
    }
    const found = store.notes.find((item) => item.id === req.params.id && Number(item.user_id) === Number(req.user.id));
    if (!found) return res.status(404).json({ success: false, message: 'Note not found' });
    Object.assign(found, note);
    return res.json({ success: true, note: found });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (appwrite.configured) {
      const deleted = await appwrite.deleteNote(req.user.email, req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Note not found' });
      return res.json({ success: true });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Note not found' });
    } else {
      const index = store.notes.findIndex((item) => item.id === req.params.id && Number(item.user_id) === Number(req.user.id));
      if (index < 0) return res.status(404).json({ success: false, message: 'Note not found' });
      store.notes.splice(index, 1);
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

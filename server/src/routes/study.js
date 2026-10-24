const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const auth = require('../middleware/auth');
const store = require('../data/inMemoryStore');
const ai = require('../services/aiService');
const { pool, isPostgresAvailable } = require('../config/database');
const appwrite = require('../integrations/appwrite');

const router = express.Router();
router.use(auth);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extensionAllowed = /\.(txt|md)$/i.test(file.originalname);
    const mimeAllowed = ['text/plain', 'text/markdown', 'application/octet-stream'].includes(file.mimetype);
    if (!extensionAllowed || !mimeAllowed) {
      const error = new Error('Only plain text (.txt) and Markdown (.md) files are supported');
      error.statusCode = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});

const materialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(20).max(50000),
  subject: z.string().max(100).optional().default(''),
  tags: z.array(z.string().max(40)).max(30).default([]),
});

function chunksOf(content, size = 1200) {
  const paragraphs = content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > size) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
    while (current.length > size) {
      chunks.push(current.slice(0, size));
      current = current.slice(size);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wordScore(query, content) {
  const words = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) || [])];
  if (!words.length) return 0;
  const lower = content.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0) / words.length;
}

function parseUploadTags(value) {
  if (!value) return [];
  try {
    const tags = JSON.parse(value);
    if (!Array.isArray(tags)) throw new Error();
    return tags;
  } catch {
    const error = new Error('Tags must be a JSON array');
    error.statusCode = 400;
    throw error;
  }
}

async function recordQuery(userId, question, answer) {
  if (await isPostgresAvailable()) {
    const result = await pool.query(
      'INSERT INTO study_queries (user_id, question, answer) VALUES ($1,$2,$3) RETURNING id, question, answer, created_at',
      [userId, question, answer]
    );
    return result.rows[0];
  }
  const record = { id: `query-${Date.now()}`, user_id: Number(userId), question, answer, created_at: new Date().toISOString() };
  store.studyQueries.unshift(record);
  return record;
}

async function saveMaterial(userId, appwriteUserId, material) {
  const contentChunks = chunksOf(material.content);
  const created = {
    id: `material-${Date.now()}`,
    user_id: Number(userId),
    title: material.title,
    content: material.content,
    subject: material.subject,
    tags: material.tags,
    created_at: new Date().toISOString(),
    chunks: contentChunks.map((content) => ({ content, embedding: null })),
  };
  if (process.env.OPENAI_API_KEY) {
    for (const chunk of created.chunks) chunk.embedding = await ai.embed(chunk.content);
  }
  if (appwrite.configured) {
    const saved = await appwrite.storeMaterial(appwriteUserId, created, created.chunks);
    return { material: saved, chunks: contentChunks.length, embedded: Boolean(process.env.OPENAI_API_KEY) };
  }
  if (await isPostgresAvailable()) {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, content, category, tags, pinned, archived)
       VALUES ($1, $2, $3, 'study-material', $4, false, false)
       RETURNING id, user_id, title, content, category AS subject, tags, created_at`,
      [userId, material.title, material.content, material.tags]
    );
    return { material: result.rows[0], chunks: contentChunks.length, embedded: Boolean(process.env.OPENAI_API_KEY) };
  }
  store.materials.unshift(created);
  return {
    material: { ...created, chunks: undefined },
    chunks: contentChunks.length,
    embedded: Boolean(process.env.OPENAI_API_KEY),
  };
}

router.get('/materials', async (req, res, next) => {
  try {
    if (appwrite.configured) {
      const materials = await appwrite.listMaterials(req.user.email);
      return res.json({ success: true, materials, provider: 'appwrite-documentsdb' });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT id, title, content, category AS subject, tags, created_at
         FROM notes WHERE user_id = $1 AND category = 'study-material' ORDER BY created_at DESC`,
        [req.user.id]
      );
      return res.json({ success: true, materials: result.rows });
    }
    return res.json({
      success: true,
      materials: store.materials.filter((material) => Number(material.user_id) === Number(req.user.id)),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/materials', async (req, res, next) => {
  try {
    const material = materialSchema.parse(req.body);
    const saved = await saveMaterial(req.user.id, req.user.email, material);
    return res.status(201).json({ success: true, ...saved });
  } catch (error) {
    next(error);
  }
});

router.post('/materials/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Choose a text or Markdown file to upload' });
    const content = req.file.buffer.toString('utf8');
    if (!content.trim() || content.includes('\u0000')) {
      return res.status(400).json({ success: false, message: 'The uploaded file does not contain valid text' });
    }
    const material = materialSchema.parse({
      title: req.body.title || req.file.originalname.replace(/\.(txt|md)$/i, ''),
      subject: req.body.subject || '',
      content,
      tags: parseUploadTags(req.body.tags),
    });
    const saved = await saveMaterial(req.user.id, req.user.email, material);
    return res.status(201).json({ success: true, ...saved });
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const query = z.object({ query: z.string().trim().min(2).max(1000) }).parse(req.body).query;
    if (appwrite.configured && process.env.OPENAI_API_KEY) {
      const embedding = await ai.embed(query);
      const documents = await appwrite.searchMaterials(req.user.email, embedding);
      return res.json({
        success: true,
        mode: 'appwrite-vector-cosine',
        results: documents.map((document) => ({
          title: document.metadata?.title || '',
          subject: document.metadata?.subject || '',
          content: document.metadata?.content || '',
          distance: document.$distance ?? null,
        })),
      });
    }
    const materialList = appwrite.configured
      ? (await appwrite.listMaterials(req.user.email))
      : (await isPostgresAvailable())
      ? (await pool.query(
        `SELECT id, title, content, category AS subject FROM notes
         WHERE user_id = $1 AND category = 'study-material'`,
        [req.user.id]
      )).rows
      : store.materials.filter((material) => Number(material.user_id) === Number(req.user.id));
    const ranked = materialList
      .flatMap((material) => chunksOf(material.content).map((content) => ({
        title: material.title,
        subject: material.subject || '',
        content,
        score: wordScore(query, content),
      })))
      .filter((source) => source.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return res.json({
      success: true,
      mode: 'keyword',
      results: ranked.map(({ score, ...source }) => ({ ...source, relevance: score })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/ask', async (req, res, next) => {
  try {
    const query = z.object({ question: z.string().trim().min(5).max(2000) }).parse(req.body).question;
    if (appwrite.configured && process.env.OPENAI_API_KEY) {
      const embedding = await ai.embed(query);
      const vectorSources = await appwrite.searchMaterials(req.user.email, embedding, 4);
      if (!vectorSources.length) {
        return res.json({
          success: true,
          grounded: false,
          answer: 'Your saved study materials do not contain enough relevant information to answer this question.',
          sources: [],
        });
      }
      const sources = vectorSources.map((source) => ({
        title: source.metadata?.title || '',
        subject: source.metadata?.subject || '',
        content: source.metadata?.content || '',
      }));
      const answer = await ai.answer(query, sources);
      await recordQuery(req.user.id, query, answer);
      return res.json({ success: true, grounded: true, answer, sources });
    }
    const materialList = appwrite.configured
      ? (await appwrite.listMaterials(req.user.email))
      : (await isPostgresAvailable())
      ? (await pool.query(
        `SELECT id, title, content, category AS subject FROM notes
         WHERE user_id = $1 AND category = 'study-material'`,
        [req.user.id]
      )).rows
      : store.materials.filter((material) => Number(material.user_id) === Number(req.user.id));
    const sources = materialList
      .flatMap((material) => chunksOf(material.content).map((content) => ({
        title: material.title,
        subject: material.subject || '',
        content,
        score: wordScore(query, content),
      })))
      .filter((source) => source.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (!sources.length || sources[0].score < 0.2) {
      const answer = 'Your saved study materials do not contain enough relevant information to answer this question.';
      await recordQuery(req.user.id, query, answer);
      return res.json({ success: true, grounded: false, answer, sources: [] });
    }

    const answer = await ai.answer(query, sources);
    const response = { success: true, grounded: true, answer, sources: sources.map(({ score, ...source }) => source) };
    await recordQuery(req.user.id, query, answer);
    return res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const payload = z.object({
      materialId: z.string().optional(),
      action: z.enum(['summary', 'practice']),
    }).parse(req.body);
    let materials;
    if (appwrite.configured) {
      materials = await appwrite.listMaterials(req.user.email);
    } else if (await isPostgresAvailable()) {
      const result = await pool.query(
        `SELECT id, title, content, category AS subject FROM notes
         WHERE user_id=$1 AND category='study-material'`,
        [req.user.id]
      );
      materials = result.rows;
    } else {
      materials = store.materials.filter((material) => Number(material.user_id) === Number(req.user.id));
    }
    const selected = payload.materialId
      ? materials.filter((material) => material.id === payload.materialId)
      : materials;
    if (!selected.length) return res.status(404).json({ success: false, message: 'No study material found for this user' });
    const sources = selected.map((material) => ({ title: material.title, content: material.content.slice(0, 12000) }));
    const prompt = payload.action === 'summary'
      ? 'Create a concise study summary with key concepts and important details.'
      : 'Create five practice questions with concise answer keys.';
    const result = await ai.answer(prompt, sources, payload.action === 'summary' ? 'Summarize the source material.' : 'Create practice questions from the source material.');
    return res.json({ success: true, type: payload.action, result, sources: sources.map(({ title }) => ({ title })) });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'SELECT id, question, answer, created_at FROM study_queries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30',
        [req.user.id]
      );
      return res.json({ success: true, queries: result.rows });
    }
    const queries = store.studyQueries.filter((item) => Number(item.user_id) === Number(req.user.id)).slice(0, 30);
    return res.json({ success: true, queries });
  } catch (error) {
    next(error);
  }
});

router.get('/answers', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        'SELECT id, question, answer, sources, created_at FROM saved_study_answers WHERE user_id=$1 ORDER BY created_at DESC',
        [req.user.id]
      );
      return res.json({ success: true, answers: result.rows });
    }
    const answers = store.savedAnswers.filter((item) => Number(item.user_id) === Number(req.user.id));
    return res.json({ success: true, answers });
  } catch (error) {
    next(error);
  }
});

router.post('/answers', async (req, res, next) => {
  try {
    const payload = z.object({
      question: z.string().trim().min(1).max(2000),
      answer: z.string().trim().min(1).max(10000),
      sources: z.array(z.object({ title: z.string(), content: z.string().optional() })).default([]),
    }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO saved_study_answers (user_id, question, answer, sources)
         VALUES ($1,$2,$3,$4) RETURNING id, question, answer, sources, created_at`,
        [req.user.id, payload.question, payload.answer, JSON.stringify(payload.sources)]
      );
      return res.status(201).json({ success: true, answer: result.rows[0] });
    }
    const saved = {
      ...payload,
      id: `answer-${Date.now()}`,
      user_id: Number(req.user.id),
      created_at: new Date().toISOString(),
    };
    store.savedAnswers.unshift(saved);
    return res.status(201).json({ success: true, answer: saved });
  } catch (error) {
    next(error);
  }
});

router.get('/goals', async (req, res, next) => {
  try {
    if (await isPostgresAvailable()) {
      const [goalResult, sessionResult] = await Promise.all([
        pool.query('SELECT daily_minutes,weekly_minutes,updated_at FROM study_goals WHERE user_id=$1', [req.user.id]),
        pool.query(
          `SELECT
             COALESCE(SUM(duration_minutes) FILTER (WHERE started_at >= CURRENT_DATE),0)::int AS today_minutes,
             COALESCE(SUM(duration_minutes),0)::int AS week_minutes
           FROM study_sessions WHERE user_id=$1 AND started_at >= NOW() - INTERVAL '7 days'`,
          [req.user.id]
        ),
      ]);
      const goal = goalResult.rows[0] || { daily_minutes: 30, weekly_minutes: 300 };
      return res.json({
        success: true,
        goals: {
          dailyMinutes: Number(goal.daily_minutes),
          weeklyMinutes: Number(goal.weekly_minutes),
          todayMinutes: sessionResult.rows[0].today_minutes,
          weekMinutes: sessionResult.rows[0].week_minutes,
        },
      });
    }
    const goals = store.studyGoals.find((goal) => Number(goal.user_id) === Number(req.user.id));
    const sessions = appwrite.configured
      ? await appwrite.listSessions(req.user.email)
      : store.studySessions.filter((session) => Number(session.user_id) === Number(req.user.id));
    const now = new Date();
    const todayMinutes = sessions.filter((session) => new Date(session.started_at || session.startedAt).toDateString() === now.toDateString())
      .reduce((sum, session) => sum + Number(session.duration_minutes || session.durationMinutes || 0), 0);
    const weekMinutes = sessions.filter((session) => new Date(session.started_at || session.startedAt).getTime() >= Date.now() - 7 * 86400000)
      .reduce((sum, session) => sum + Number(session.duration_minutes || session.durationMinutes || 0), 0);
    return res.json({
      success: true,
      goals: {
        dailyMinutes: goals?.daily_minutes || 30,
        weeklyMinutes: goals?.weekly_minutes || 300,
        todayMinutes,
        weekMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/goals', async (req, res, next) => {
  try {
    const goals = z.object({
      dailyMinutes: z.number().int().min(1).max(1440),
      weeklyMinutes: z.number().int().min(1).max(10080),
    }).parse(req.body);
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO study_goals (user_id,daily_minutes,weekly_minutes)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id) DO UPDATE SET daily_minutes=EXCLUDED.daily_minutes,weekly_minutes=EXCLUDED.weekly_minutes,updated_at=NOW()
         RETURNING daily_minutes,weekly_minutes,updated_at`,
        [req.user.id, goals.dailyMinutes, goals.weeklyMinutes]
      );
      return res.json({
        success: true,
        goals: {
          dailyMinutes: Number(result.rows[0].daily_minutes),
          weeklyMinutes: Number(result.rows[0].weekly_minutes),
        },
      });
    }
    let current = store.studyGoals.find((goal) => Number(goal.user_id) === Number(req.user.id));
    if (!current) {
      current = { user_id: Number(req.user.id) };
      store.studyGoals.push(current);
    }
    current.daily_minutes = goals.dailyMinutes;
    current.weekly_minutes = goals.weeklyMinutes;
    current.updated_at = new Date().toISOString();
    return res.json({
      success: true,
      goals: { dailyMinutes: current.daily_minutes, weeklyMinutes: current.weekly_minutes },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const session = z.object({
      subject: z.string().trim().min(1).max(100),
      durationMinutes: z.number().int().min(1).max(1440),
      notes: z.string().max(1000).optional().default(''),
      startedAt: z.string().datetime().optional(),
    }).parse(req.body);
    if (appwrite.configured) {
      const created = await appwrite.createSession(req.user.email, session);
      return res.status(201).json({ success: true, session: created });
    }
    if (await isPostgresAvailable()) {
      const result = await pool.query(
        `INSERT INTO study_sessions (user_id, subject, duration_minutes, notes, started_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, subject, duration_minutes, notes, started_at`,
        [req.user.id, session.subject, session.durationMinutes, session.notes, session.startedAt || new Date().toISOString()]
      );
      return res.status(201).json({ success: true, session: result.rows[0] });
    }
    const created = { ...session, id: `session-${Date.now()}`, user_id: Number(req.user.id), started_at: session.startedAt || new Date().toISOString() };
    store.studySessions.unshift(created);
    return res.status(201).json({ success: true, session: created });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

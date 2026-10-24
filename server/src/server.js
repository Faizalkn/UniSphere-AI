const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const taskRoutes = require('./routes/tasks');
const knowledgeRoutes = require('./routes/knowledge');
const studyRoutes = require('./routes/study');
const inventoryRoutes = require('./routes/inventory');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { pool, isPostgresAvailable } = require('./config/database');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts' },
});

app.use('/api/v1/auth', loginLimiter, authRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/knowledge/notes', knowledgeRoutes);
app.use('/api/v1/study', studyRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    app: 'UniSphere AI',
    version: '1.0.0',
    message: 'API ready',
  });
});

app.use(notFound);
app.use(errorHandler);

const initializeDatabase = async () => {
  try {
    const hasDatabase = await isPostgresAvailable();
    if (!hasDatabase) {
      console.warn('PostgreSQL unavailable; falling back to in-memory demo data. Configure POSTGRES_* variables for full persistence.');
      return false;
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(40) NOT NULL DEFAULT 'student',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(30) DEFAULT 'medium',
        status VARCHAR(30) DEFAULT 'todo',
        due_date TIMESTAMPTZ,
        tags TEXT[] DEFAULT '{}',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        category VARCHAR(100),
        tags TEXT[] DEFAULT '{}',
        pinned BOOLEAN DEFAULT FALSE,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        source_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS source_url TEXT;

      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR(200) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(100),
        description TEXT,
        cost_price NUMERIC(12,2) DEFAULT 0,
        sale_price NUMERIC(12,2) DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        supplier VARCHAR(200),
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE TABLE IF NOT EXISTS inventory_categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        UNIQUE (user_id, name)
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, name)
      );
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id);
      ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES inventory_categories(id);

      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES inventory_items(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject VARCHAR(100) NOT NULL,
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
        notes TEXT NOT NULL DEFAULT '',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS study_queries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS saved_study_answers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS study_goals (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        daily_minutes INTEGER NOT NULL DEFAULT 30 CHECK (daily_minutes > 0),
        weekly_minutes INTEGER NOT NULL DEFAULT 300 CHECK (weekly_minutes > 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notification_reads (
        user_id INTEGER NOT NULL REFERENCES users(id),
        notification_key VARCHAR(200) NOT NULL,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, notification_key)
      );

      CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON tasks (user_id, due_date);
      CREATE INDEX IF NOT EXISTS notes_user_created_idx ON notes (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements (created_at DESC);
    `);

    const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    if (Number(userCount.rows[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, NOW()), ($5, $6, $7, $8, NOW())`,
        [
          'Alicia Admin',
          'admin@unisphere.ai',
          await bcrypt.hash('Password123!', 10),
          'admin',
          'Sam Student',
          'student@unisphere.ai',
          await bcrypt.hash('Password123!', 10),
          'student',
        ]
      );
    }

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.warn('Database initialization unavailable:', error.message);
    return false;
  }
};

initializeDatabase();

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`UniSphere AI server listening on http://localhost:${env.port}`);
  });
}

module.exports = app;

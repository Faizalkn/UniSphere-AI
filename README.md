# UniSphere AI

UniSphere AI combines a study assistant, student task manager, personal knowledge base, and role-protected inventory management in one responsive workspace.

## Features implemented

- Student registration/login with bcrypt password hashes, short-lived JWTs in HttpOnly cookies, rate limiting, profile editing, password change, and administrator role assignment.
- User-owned task CRUD, priorities, due dates, status workflow, search, list/Kanban/calendar views, and study session tracking.
- Daily and weekly study-minute goals with live progress from logged sessions.
- Private Markdown notes and resource links, pinning, search, archive, and CRUD.
- Study material text entry and `.txt`/`.md` upload, chunking, optional OpenAI embeddings, keyword search fallback, and source-grounded RAG when the AI provider is configured.
- Role-protected inventory product, category, and supplier operations, safe stock movements, low/out-of-stock alerts, valuation, recent movement history, and CSV export.
- Real dashboard metrics, task/study charts, global search, and derived notifications with read state.
- PostgreSQL migrations and Appwrite TablesDB/DocumentsDB/VectorsDB adapters using the Appwrite Node server SDK.
- Responsive layout with loading, empty, and error states.

## Requirements

- Node.js 20.19+ (Vite 8 requirement)
- npm
- PostgreSQL for durable relational storage
- Appwrite project/database IDs and API key for Appwrite persistence
- OpenAI API key for embeddings, summaries, practice questions, and generated RAG answers

The front end and API can run in demo mode without external credentials. Demo mode uses in-memory records, which are reset on server restart. The sample PostgreSQL values are not production defaults and must be replaced.

## Setup

```powershell
Copy-Item .env.example .env
npm install
npm --prefix client install
```

Edit `.env` with your credentials. The server also reads `server/.env` for compatibility, but root `.env` takes precedence.

### PostgreSQL

Create the database named in `POSTGRES_DB` and provide valid connection values. The API creates/migrates the schema on startup; the equivalent baseline migration is `database/migrations/001_initial_schema.sql`.

### Appwrite

Set the Appwrite endpoint, project, server API key, and distinct database IDs for TablesDB, DocumentsDB, and VectorsDB. Create the tables, collections, columns, indexes, and vector field in the Console before using the API. The required schema is documented in [database-design.md](./docs/database-design.md). Use an API key with only the database read/write scopes the server needs. Never place the API key in the client environment.

### AI provider

Set `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_EMBEDDING_MODEL`. The default embedding model produces 1,536-dimensional vectors. If no key is configured, study keyword search still works but AI generation returns a clear unavailable-provider error rather than a fabricated answer.

## Run locally

```powershell
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/v1
- Health: http://localhost:4000/api/v1/health

Demo accounts are only available when PostgreSQL is unavailable:

- Student: `student@unisphere.ai` / `Password123!`
- Administrator: `admin@unisphere.ai` / `Password123!`

Change or remove demo credentials before any shared or production deployment.

## Validate

```powershell
npm test
npm run build
```

API routes and request shapes are described in [api-documentation.md](./docs/api-documentation.md). External provider integrations require valid credentials and the matching Appwrite schema; the API reports integration failures instead of presenting successful fake writes.

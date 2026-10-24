# Database design

## Data ownership

| Store | Data |
| --- | --- |
| Appwrite TablesDB | Tasks and study-session rows |
| Appwrite DocumentsDB | Personal notes and study-material documents |
| Appwrite VectorsDB | Embedding chunks used for private semantic retrieval |
| PostgreSQL | Users, suppliers, inventory, stock movements, study goals/query history/saved answers, session analytics, and fallback task/notes storage |
| In-memory development store | Demo-only fallback when PostgreSQL/Appwrite are not configured; data is lost on restart |

Configure a separate Appwrite database ID for each product in `.env`. The backend uses the official `node-appwrite` SDK. Collections, tables, columns, indexes, and vector dimensions must be created in the Appwrite Console before enabling those integrations; the server does not silently invent a schema.

## Appwrite schema expected by the API

### TablesDB `tasks`

Create columns:

- `userId` (string, indexed)
- `title` (string, 200)
- `description` (string, 5,000)
- `category` (string, 100)
- `priority` (string, 20)
- `status` (string, 20)
- `dueDate` (datetime, optional)
- `completedAt` (datetime, optional)
- `tags` (string, 2,000; JSON-encoded string array)

### TablesDB `study_sessions`

Create columns:

- `userId` (string, indexed)
- `subject` (string, 100)
- `durationMinutes` (integer)
- `notes` (string, 1,000)
- `startedAt` (datetime)

### DocumentsDB collections

Create `notes` and `study_materials` collections with `userId` (indexed string), title, content, category/subject, tags, timestamps, and note metadata fields (pinned, archived, sourceUrl). Appwrite's server API key bypasses end-user permissions, so every read/update/delete is scoped by the user ID from the validated application JWT.

Study-goal settings, saved answers, and question history use PostgreSQL when available and the development in-memory store otherwise; they are not stored in Appwrite.

### VectorsDB collection `study_chunks`

Create a VectorsDB database and a `study_chunks` collection. VectorsDB collections use fixed `embeddings` and `metadata` fields; metadata is a JSON object.

- `embeddings`: vector with dimension 1,536 when using `text-embedding-3-small`
- `metadata.userId`, `metadata.title`, `metadata.subject`, and `metadata.content`
- An HNSW cosine index on `embeddings`

The API combines `Query.equal('metadata.userId', ...)` with `Query.vectorCosine('embeddings', ...)` and checks returned owner metadata before returning sources. Configure the same embedding model and dimension for inserts and queries.

## PostgreSQL

`database/migrations/001_initial_schema.sql` contains the relational schema and constraints. On server startup, the app also creates/migrates the current schema for convenience. Inventory stock movements lock the product row with `SELECT ... FOR UPDATE`, reject negative resulting stock, and commit the stock update and audit row in one SQL transaction.

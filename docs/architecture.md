# UniSphere AI Architecture

## Goals

UniSphere AI is designed as a single, unified productivity platform for students and operations teams. The product intentionally combines multiple domains behind a shared auth model and dashboard.

## Layers

### Frontend

- React + Vite for the SPA shell
- Tailwind CSS for responsive SaaS styling
- React Router for navigation
- Recharts for analytics and dashboard charts

### Backend

- Express API with versioned routes under `/api/v1`
- JWT-based auth and role checks
- Zod validation on request payloads
- Rate limiting and centralized error handling

### Persistence

- PostgreSQL for relational inventory records and analytics
- Appwrite for flexible documents and metadata
- Vector-store integration for semantic search over notes and documents
- Demo in-memory fallback used when external integrations are unavailable

## Module boundaries

- Auth and profile APIs handle login, registration, and token validation.
- Task and study modules manage due dates, priorities, tagging, and study-session tracking.
- Knowledge modules store notes, bookmarks, documentation, and semantic-search metadata.
- Inventory modules manage products, suppliers, stock movements, and low-stock alerts.

## Data flow

1. User authenticates through `/api/v1/auth`.
2. Protected API routes verify the JWT and enforce role checks.
3. Service modules read or write data in the configured backing store.
4. Dashboard endpoints aggregate metrics from the same data source.
5. AI modules rely on retrieved context before generating a response.

## Security model

- Password hashing via bcrypt
- JWT access tokens with expiration
- Protected routes using auth middleware
- No secrets exposed in browser code
- Input validation and rate limiting for auth flows

## Deployment posture

The project supports local development immediately and provides a clear path to production by wiring real credentials into `.env` and backend integrations.

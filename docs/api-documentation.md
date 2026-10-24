# API overview

All routes use the `/api/v1` prefix and JSON responses with a `success` boolean. Authenticated endpoints accept the HttpOnly `unisphere_token` cookie. The API also accepts a Bearer JWT for non-browser clients.

## Authentication

- `POST /auth/register` — create a student account
- `POST /auth/login` — establish an HttpOnly JWT cookie
- `POST /auth/logout` — clear the cookie
- `GET /auth/me` — read the current profile
- `PATCH /auth/me` — update profile name
- `POST /auth/change-password` — change password and invalidate current browser session
- `GET /admin/users` — administrator-only user list
- `PATCH /admin/users/:id/role` — administrator-only role assignment

## Tasks and study

- `GET|POST /tasks`, `PATCH|DELETE /tasks/:id` — task CRUD with owner filtering
- `GET|POST /study/materials` — list/create study material
- `POST /study/materials/upload` — upload `.txt` or `.md` (maximum 1 MiB)
- `POST /study/search` — search study content; uses Appwrite vector cosine search when configured, otherwise labeled keyword search
- `POST /study/ask` — grounded RAG response (requires an AI provider when relevant sources are found)
- `POST /study/generate` — summarize material or generate practice questions (requires an AI provider)
- `GET /study/history`, `GET|POST /study/answers`
- `POST /study/sessions` — record a study session
- `GET|PUT /study/goals` — view study progress and set daily/weekly minute goals

## Knowledge, inventory, dashboard

- `GET|POST /knowledge/notes`, `PATCH|DELETE /knowledge/notes/:id` — private notes and resources
- `GET|POST /inventory/products`, `PATCH|DELETE /inventory/products/:id` — role-protected product operations
- `GET|POST /inventory/categories`, `GET|POST /inventory/suppliers` — manage product classification and supplier records
- `POST /inventory/products/:id/movements` — atomic stock-in/out/adjustment
- `GET /inventory/movements`, `/inventory/analytics`, `/inventory/export.csv`
- `GET /dashboard` — live metrics for the signed-in user; inventory metrics are omitted for unauthorized roles
- `GET /dashboard/search?q=...` — authorized global keyword search
- `GET /dashboard/notifications`, `PATCH /dashboard/notifications/:id/read`

Zod validation errors return HTTP 400. Unauthorized requests return 401, role violations return 403, and missing owned records return 404.

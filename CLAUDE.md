# CLAUDE.md

## Project Overview
REST API (CRUD) for "Primeira Certificação" Google Spreadsheet. Two sheets: `tickets` (single column) and `pedidos` (9 columns).

## Tech Stack
- Node.js + TypeScript + Express.js
- Google Sheets API v4 (googleapis) — Service Account auth
- Zod validation, CORS, Basic Auth, rate limiting
- Dual deploy: Docker (VPS) + Vercel (serverless)

## Commands
- `pnpm dev` — dev server with hot reload (tsx watch)
- `pnpm build` — compile TypeScript to dist/
- `pnpm start` — run compiled JS
- `docker-compose up --build` — Docker deploy

## Architecture
- `src/app.ts` — Express app (shared between VPS and Vercel)
- `src/index.ts` — VPS/Docker entry point (app.listen + graceful shutdown)
- `api/index.ts` — Vercel serverless entry point
- `src/config/sheets.ts` — Google Auth (supports file + JSON env var)
- `src/middleware/` — Basic Auth (timing-safe), rate limiting (100 req/min, block after 5 auth failures)
- `src/services/` — Business logic with 5-min cache TTL, write lock mutex
- `src/routes/` — Express routers for /api/tickets and /api/pedidos
- `src/schemas/` — Zod validation schemas
- `src/utils/` — Response helpers, write lock

## Spreadsheet
- ID: `1_EsiaEyJZKKmfpyWU2cwC7D6YkkP1v4OH_127n5Zpj8`
- Sheet "tickets": column A (Ticket)
- Sheet "pedidos": columns A-I (UUID, Ticket, Número da OAB, Nome completo, Subseção, Data Solicitação, Data Liberação, Status, Anotações)

## Environment Variables
- `GOOGLE_APPLICATION_CREDENTIALS` — path to credentials.json (Docker/VPS)
- `GOOGLE_CREDENTIALS_JSON` — stringified JSON credentials (Vercel)
- `SPREADSHEET_ID` — Google Spreadsheet ID
- `PORT` — server port (default 3000)
- `API_USERS` — Basic Auth users (format: user1:pass1,user2:pass2)

## Code Conventions
- TypeScript strict mode
- CommonJS module system (for compatibility)
- Zod for request validation
- Standardized JSON responses: `{ success, data }` or `{ success, count, data }` or `{ success, error }`

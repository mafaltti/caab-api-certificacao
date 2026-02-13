# Plan: REST API CRUD — Primeira Certificação

## Context

Build a REST API (CRUD) that uses the Google Spreadsheet "Primeira Certificação" as the database. The spreadsheet has two sheets:

- **tickets:** 1 column (`Ticket`) with ~60 rows of 11-digit numbers
- **pedidos:** 9 columns (`UUID`, `Ticket`, `Número da OAB`, `Nome completo`, `Subseção`, `Data Solicitação`, `Data Liberação`, `Status`, `Anotações`) — empty (headers only), API generates UUID for each new record

**Spreadsheet ID:** `1_EsiaEyJZKKmfpyWU2cwC7D6YkkP1v4OH_127n5Zpj8`

---

## Stack

- Node.js + TypeScript + Express.js (`tsx` for dev, `tsc` for build)
- `googleapis` — Google Sheets API v4, scope `spreadsheets` (read/write)
- `zod` — schema validation
- `cors` — CORS enabled
- `dotenv` — environment variables
- Auth: Google Service Account (`credentials.json`) + Basic Auth on endpoints
- Security: Rate limiting (100 req/min), block after 5 auth failures
- Dual-deploy: Docker (VPS) + Vercel (serverless)

---

## File Structure

```
caab-api-certificacao/
├── .dockerignore
├── .env.example
├── .gitignore
├── CLAUDE.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vercel.json
├── README.md
├── postman/
│   └── caab-api-certificacao.postman_collection.json
├── api/
│   └── index.ts                    # Vercel serverless entry point
└── src/
    ├── index.ts                    # Docker/VPS entry point (app.listen + graceful shutdown)
    ├── app.ts                      # Express app (shared between VPS and Vercel)
    ├── config/
    │   └── sheets.ts               # Google Auth (Service Account), client caching
    ├── middleware/
    │   ├── basicAuth.ts            # Basic Auth (timing-safe)
    │   └── rateLimiter.ts          # Rate limiting
    ├── routes/
    │   ├── tickets.ts              # CRUD /api/tickets
    │   └── pedidos.ts              # CRUD /api/pedidos
    ├── services/
    │   ├── ticketsService.ts       # Business logic — "tickets" sheet
    │   └── pedidosService.ts       # Business logic — "pedidos" sheet
    ├── schemas/
    │   ├── ticket.ts               # Zod schemas for tickets
    │   └── pedido.ts               # Zod schemas for pedidos
    └── utils/
        ├── response.ts             # Standardized response helpers
        └── writeLock.ts            # Mutex to serialize writes
```

### App vs Server Separation (dual-deploy)

- `src/app.ts` — creates and configures Express app (middleware, CORS, routes, error handler). Exports `app`.
- `src/index.ts` — imports `app`, calls `app.listen()` + graceful shutdown. Used in Docker/VPS.
- `api/index.ts` — imports `app`, exports as serverless handler. Used on Vercel.

---

## API Endpoints

### Health Check (no auth)

`GET /health` → `{ status: "ok", timestamp }`

### Tickets (`/api/tickets`) — "tickets" sheet

| Method | Route | Description |
|---|---|---|
| GET | `/api/tickets` | List all tickets |
| GET | `/api/tickets/:ticket` | Check if specific ticket exists |
| POST | `/api/tickets` | Add new ticket `{ "ticket": "12345678900" }` |
| PUT | `/api/tickets/:ticket` | Update ticket value `{ "ticket": "new_value" }` |
| DELETE | `/api/tickets/:ticket` | Remove ticket from spreadsheet |

### Pedidos (`/api/pedidos`) — "pedidos" sheet

| Method | Route | Description |
|---|---|---|
| GET | `/api/pedidos` | List all (filters: `?status=`, `?ticket=`, `?oab=`) |
| GET | `/api/pedidos/:uuid` | Get pedido by UUID |
| POST | `/api/pedidos` | Create pedido (generates UUID, appends row) |
| PUT | `/api/pedidos/:uuid` | Update pedido (partial) |
| DELETE | `/api/pedidos/:uuid` | Remove row from spreadsheet |

### Response Format (standard)

```json
{ "success": true, "data": { ... } }
{ "success": true, "count": 5, "data": [ ... ] }
{ "success": false, "error": "message" }
```

### POST/PUT Body for Pedidos

```json
{
  "ticket": "68637750800",
  "numero_oab": "123456",
  "nome_completo": "João da Silva",
  "subsecao": "São Paulo",
  "data_solicitacao": "2026-02-13",
  "data_liberacao": "2026-02-20",
  "status": "aprovado",
  "anotacoes": "Primeira certificação"
}
```

- **POST required:** `ticket`, `nome_completo`
- **PUT:** any subset of fields, `uuid` cannot be changed

---

## Zod Schemas (`src/schemas/`)

### `pedido.ts`

```ts
const createPedidoSchema = z.object({
  ticket: z.string().min(1),
  nome_completo: z.string().min(1),
  numero_oab: z.string().optional().default(""),
  subsecao: z.string().optional().default(""),
  data_solicitacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(""),
  data_liberacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default(""),
  status: z.string().optional().default(""),
  anotacoes: z.string().optional().default(""),
});

const updatePedidoSchema = createPedidoSchema.partial();
```

### `ticket.ts`

```ts
const createTicketSchema = z.object({ ticket: z.string().min(1) });
const updateTicketSchema = z.object({ ticket: z.string().min(1) });
```

---

## Service Layer Logic

### `ticketsService.ts`

- `getAllTickets()` — reads `tickets!A:A`, skips header, returns array
- `getTicket(ticket)` — searches cache, returns if exists
- `createTicket(ticket)` — `values.append()` to tickets sheet
- `updateTicket(oldTicket, newTicket)` — resolves row, `values.update()`
- `deleteTicket(ticket)` — resolves row, `batchUpdate()` with `deleteDimension`

### `pedidosService.ts`

- `getAllPedidos()` — reads `pedidos!A:I`, skips header, returns records
- `getPedidoById(uuid)` — searches cache by UUID
- `createPedido(data)` — generates UUID (`crypto.randomUUID()`), `values.append()` new row
- `updatePedido(uuid, data)` — resolves row (fresh read), merges fields, `values.update()`
- `deletePedido(uuid)` — resolves row, `batchUpdate()` with `deleteDimension` (removes row)

### Column Mapping (pedidos)

| Column | Field |
|---|---|
| A | UUID (generated by API via `crypto.randomUUID()`) |
| B | Ticket |
| C | Número da OAB |
| D | Nome completo |
| E | Subseção |
| F | Data Solicitação |
| G | Data Liberação |
| H | Status |
| I | Anotações |

### Cache

- 5-minute TTL for reads (one cache per sheet)
- Invalidated immediately after any write
- Writes always read fresh data (bypass cache) to resolve row numbers

### Write Lock

- Simple promise-chain mutex to serialize writes within the same process

---

## Deploy Configuration

### `.env.example`

```env
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
SPREADSHEET_ID=1_EsiaEyJZKKmfpyWU2cwC7D6YkkP1v4OH_127n5Zpj8
PORT=3000
API_USERS=admin:changeme
```

### Vercel — `vercel.json`

```json
{
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.ts" }]
}
```

On Vercel, env vars (`SPREADSHEET_ID`, `API_USERS`, `GOOGLE_CREDENTIALS_JSON`) are set in the dashboard. Instead of a `credentials.json` file, Vercel uses an env var with the stringified JSON. `src/config/sheets.ts` detects the environment and reads from `GOOGLE_CREDENTIALS_JSON` (JSON string) OR `GOOGLE_APPLICATION_CREDENTIALS` (file path).

### Dockerfile (multi-stage)

- Build stage: `node:20-alpine`, `npm ci`, `npm run build` (compiles TS to JS in `dist/`)
- Run stage: copies `dist/` + production `node_modules`, runs `node dist/index.js`
- Non-root user `nodejs` (UID 1001)
- Health check: `wget --spider http://localhost:3000/health`

### `docker-compose.yml`

- Volume: `./credentials.json:/app/credentials.json:ro`
- Env file: `.env`
- Port: `${PORT:-3000}:3000`

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `package.json` — scripts & dependencies

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "googleapis": "^129.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Reference — Sibling Project (adapt to TypeScript)

| Original File | Action |
|---|---|
| `caab-api-totalpass/src/middleware/basicAuth.js` | Rewrite in TS |
| `caab-api-totalpass/src/middleware/rateLimiter.js` | Rewrite in TS |
| `caab-api-totalpass/src/utils/response.js` | Rewrite in TS |
| `caab-api-totalpass/src/config/sheets.js` | Rewrite in TS, scope `spreadsheets`, support JSON env var (Vercel) |
| `caab-api-totalpass/Dockerfile` | Adapt: multi-stage build with TS compilation |
| `caab-api-totalpass/.gitignore` | Copy, add `dist/` |

---

## Implementation Order

1. `package.json`, `tsconfig.json`
2. `.env.example`, `.gitignore`, `.dockerignore`
3. `src/config/sheets.ts`
4. `src/utils/response.ts`, `src/utils/writeLock.ts`
5. `src/schemas/ticket.ts`, `src/schemas/pedido.ts`
6. `src/middleware/basicAuth.ts`, `src/middleware/rateLimiter.ts`
7. `src/services/ticketsService.ts`
8. `src/services/pedidosService.ts`
9. `src/routes/tickets.ts`, `src/routes/pedidos.ts`
10. `src/app.ts` (shared Express app)
11. `src/index.ts` (VPS/Docker server)
12. `api/index.ts` (Vercel entry point)
13. `vercel.json`
14. `Dockerfile`, `docker-compose.yml`
15. `postman/caab-api-certificacao.postman_collection.json`
16. `README.md` (sections: Google Cloud setup, run locally, Docker deploy, Vercel deploy, curl examples)
17. `CLAUDE.md`

---

## Verification

1. **Setup:** `npm install` → place `credentials.json` → copy `.env.example` to `.env`
2. **Dev:** `npm run dev` → test health, CRUD tickets, CRUD pedidos via curl
3. **Build:** `npm run build` → `npm start` → repeat tests
4. **Check spreadsheet:** Confirm data appears in Google Spreadsheet after each operation
5. **Docker:** `docker-compose up --build` → repeat tests
6. **Vercel:** `vercel dev` → repeat tests (confirm JSON env var works)
7. **Postman:** Import collection and run all requests

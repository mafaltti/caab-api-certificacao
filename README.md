# CAAB API Certificacao

REST API for managing the **"Primeira Certificacao"** workflow, using a Google Spreadsheet as database. Provides full CRUD operations on two sheets — **tickets** and **pedidos** — with Basic Auth, rate limiting, request validation, and interactive API docs.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Google Cloud Setup](#google-cloud-setup)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript (strict mode) |
| Framework | Express.js 4 |
| Database | Google Sheets API v4 (`googleapis`) |
| Validation | Zod |
| Documentation | Swagger UI + swagger-jsdoc (OpenAPI 3.0) |
| Auth | HTTP Basic Auth (timing-safe comparison) |
| Security | Rate limiting (100 req/min), auth failure blocking (5 attempts / 15 min) |
| Linting | ESLint 9 + typescript-eslint |
| Package Manager | pnpm |
| Deploy | Docker (VPS) / Vercel (serverless) |

## Project Structure

```
caab-api-certificacao/
├── api/
│   └── index.ts                  # Vercel serverless entry point
├── postman/
│   └── *.postman_collection.json # Postman collection (all endpoints)
├── src/
│   ├── index.ts                  # VPS/Docker entry point (server + graceful shutdown)
│   ├── app.ts                    # Express app (shared between VPS and Vercel)
│   ├── config/
│   │   ├── sheets.ts             # Google Sheets auth + client caching
│   │   └── swagger.ts            # OpenAPI spec definition
│   ├── middleware/
│   │   ├── basicAuth.ts          # Basic Auth (timing-safe)
│   │   └── rateLimiter.ts        # Rate limiting + auth failure blocking
│   ├── routes/
│   │   ├── tickets.ts            # /api/tickets router
│   │   └── pedidos.ts            # /api/pedidos router
│   ├── schemas/
│   │   ├── ticket.ts             # Zod schemas for tickets
│   │   └── pedido.ts             # Zod schemas for pedidos
│   ├── services/
│   │   ├── ticketsService.ts     # Business logic — tickets sheet
│   │   └── pedidosService.ts     # Business logic — pedidos sheet
│   └── utils/
│       ├── response.ts           # Standardized JSON response helpers
│       └── writeLock.ts          # Mutex to serialize writes
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── eslint.config.mjs
├── package.json
├── tsconfig.json
└── vercel.json
```

## Prerequisites

- **Node.js** >= 18
- **pnpm** (install via `corepack enable && corepack prepare pnpm@latest --activate`)
- A **Google Cloud** project with the Sheets API enabled
- A **Google Service Account** with Editor access to the spreadsheet

## Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Go to **APIs & Services > Library**, search for **Google Sheets API** and enable it
3. Go to **IAM & Admin > Service Accounts**, click **Create Service Account** and give it a name
4. On the Service Accounts list, click your new account, go to the **Keys** tab
5. Click **Add Key > Create new key > JSON** — this downloads the `credentials.json` file
6. Place `credentials.json` in the project root (it is git-ignored)
7. Open the Google Spreadsheet, click **Share**, and add the service account email (found in the JSON as `client_email`) with **Editor** role

## Installation

```bash
# Clone the repository
git clone https://github.com/mafaltti/caab-api-certificacao.git
cd caab-api-certificacao

# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your values

# Place credentials.json in the project root
```

## Usage

### Development (hot reload)

```bash
pnpm dev
```

### Production build

```bash
pnpm build
pnpm start
```

### Linting

```bash
pnpm lint        # check for issues
pnpm lint:fix    # auto-fix
```

### API Documentation

Once the server is running, open the interactive Swagger UI:

```
http://localhost:3000/docs
```

The raw OpenAPI JSON spec is also available at `/docs.json`.

## API Reference

All examples use `admin:changeme` as credentials (Base64: `YWRtaW46Y2hhbmdlbWU=`).

### Health Check (no auth)

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "timestamp": "2026-02-13T12:00:00.000Z" }
```

### Response Format

All endpoints return a standardized JSON structure:

```json
{ "success": true, "data": { ... } }
{ "success": true, "count": 5, "data": [ ... ] }
{ "success": false, "error": "message" }
```

### Tickets (`/api/tickets`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets` | List all tickets |
| GET | `/api/tickets/:ticket` | Check if ticket exists |
| POST | `/api/tickets` | Create ticket |
| PUT | `/api/tickets/:ticket` | Update ticket value |
| DELETE | `/api/tickets/:ticket` | Remove ticket |

```bash
# List all tickets
curl http://localhost:3000/api/tickets \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU="

# Create a ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{"ticket": "12345678900"}'

# Delete a ticket
curl -X DELETE http://localhost:3000/api/tickets/12345678900 \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU="
```

### Pedidos (`/api/pedidos`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pedidos` | List all (filters: `?status=`, `?ticket=`, `?oab=`) |
| GET | `/api/pedidos/:uuid` | Get by UUID |
| POST | `/api/pedidos` | Create (UUID auto-generated) |
| PUT | `/api/pedidos/:uuid` | Partial update |
| DELETE | `/api/pedidos/:uuid` | Remove |

**POST required fields:** `ticket`, `nome_completo`

```bash
# Create a pedido
curl -X POST http://localhost:3000/api/pedidos \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": "68637750800",
    "nome_completo": "Joao da Silva",
    "numero_oab": "123456",
    "subsecao": "Sao Paulo",
    "data_solicitacao": "2026-02-13",
    "status": "pendente",
    "anotacoes": "Primeira certificacao"
  }'

# List pedidos filtered by status
curl "http://localhost:3000/api/pedidos?status=pendente" \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU="

# Update a pedido (partial)
curl -X PUT http://localhost:3000/api/pedidos/<uuid> \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{"status": "aprovado", "data_liberacao": "2026-02-20"}'
```

## Deployment

### Docker

```bash
docker-compose up --build
```

The `credentials.json` file is mounted as a read-only volume. Environment variables are loaded from `.env.local`.

The Dockerfile uses a multi-stage build (build with TypeScript, run with production deps only) and runs as a non-root user.

### Vercel

Set the following environment variables in the Vercel dashboard:

- `SPREADSHEET_ID`
- `API_USERS` (format: `user:pass`)
- `GOOGLE_CREDENTIALS_JSON` (the full JSON content of `credentials.json`, as a string)

```bash
vercel deploy
```

The API auto-detects the environment: on Vercel it reads credentials from `GOOGLE_CREDENTIALS_JSON` env var; on Docker/VPS it reads from the `credentials.json` file.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to `credentials.json` | Yes (Docker/local) |
| `GOOGLE_CREDENTIALS_JSON` | Stringified JSON of service account credentials | Yes (Vercel) |
| `SPREADSHEET_ID` | Google Spreadsheet ID | Yes |
| `PORT` | Server port (default: `3000`) | No |
| `API_USERS` | Basic Auth credentials (format: `user:pass,user2:pass2`) | Yes |

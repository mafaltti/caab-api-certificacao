# CAAB API Certificacao

REST API (CRUD) that uses Google Spreadsheet **"Primeira Certificacao"** as database.

## Stack

- Node.js + TypeScript + Express.js
- Google Sheets API v4 (`googleapis`)
- Zod validation, CORS, Basic Auth
- Dual deploy: Docker (VPS) + Vercel (serverless)

## Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Sheets API**
3. Create a **Service Account** and download `credentials.json`
4. Share the spreadsheet with the service account email (Editor role)

## Run Locally

```bash
pnpm install
cp .env.example .env
# Edit .env with your values
# Place credentials.json in project root
pnpm dev
```

## Build & Run

```bash
pnpm build
pnpm start
```

## Docker Deploy

```bash
docker-compose up --build
```

Volume mounts `credentials.json` as read-only. Configure `.env` file.

## Vercel Deploy

Set environment variables in the Vercel dashboard:

- `SPREADSHEET_ID`
- `API_USERS` (format: `user:pass`)
- `GOOGLE_CREDENTIALS_JSON` (stringified JSON of credentials)

```bash
vercel deploy
```

## API Endpoints

### Health Check (no auth)

```
GET /health
```

### Tickets (`/api/tickets`) - Basic Auth required

| Method | Path                   | Description      |
|--------|------------------------|------------------|
| GET    | `/api/tickets`         | List all         |
| GET    | `/api/tickets/:ticket` | Check if exists  |
| POST   | `/api/tickets`         | Create `{ticket}`|
| PUT    | `/api/tickets/:ticket` | Update `{ticket}`|
| DELETE | `/api/tickets/:ticket` | Remove           |

### Pedidos (`/api/pedidos`) - Basic Auth required

| Method | Path                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/api/pedidos`        | List all (filters: `?status=`, `?ticket=`, `?oab=`) |
| GET    | `/api/pedidos/:uuid`  | Get by UUID                                      |
| POST   | `/api/pedidos`        | Create (generates UUID)                          |
| PUT    | `/api/pedidos/:uuid`  | Partial update                                   |
| DELETE | `/api/pedidos/:uuid`  | Remove                                           |

## curl Examples

The examples below use `admin:changeme` as credentials. The Base64 encoding of `admin:changeme` is `YWRtaW46Y2hhbmdlbWU=`.

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. List Tickets (with auth)

```bash
curl http://localhost:3000/api/tickets \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU="
```

### 3. Create Ticket

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{"ticket": "TICKET-001"}'
```

### 4. List Pedidos with Filter

```bash
curl "http://localhost:3000/api/pedidos?status=pendente&oab=12345" \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU="
```

### 5. Create Pedido

```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": "TICKET-001",
    "oab": "12345",
    "nome": "Joao Silva",
    "status": "pendente"
  }'
```

### 6. Update Pedido

```bash
curl -X PUT http://localhost:3000/api/pedidos/some-uuid-here \
  -H "Authorization: Basic YWRtaW46Y2hhbmdlbWU=" \
  -H "Content-Type: application/json" \
  -d '{"status": "aprovado"}'
```

## Environment Variables

| Variable                       | Description                                       | Required           |
|--------------------------------|---------------------------------------------------|--------------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to `credentials.json` file (Docker/local)   | Yes (Docker/local) |
| `GOOGLE_CREDENTIALS_JSON`      | Stringified JSON of service account credentials   | Yes (Vercel)       |
| `SPREADSHEET_ID`               | ID of the Google Spreadsheet                      | Yes                |
| `PORT`                         | Server port (default: `3000`)                     | No                 |
| `API_USERS`                    | Basic Auth credentials (format: `user:pass`)      | Yes                |

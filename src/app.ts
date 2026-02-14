import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerSpec from "./generated/swagger-spec.js";
import { rateLimiter, authRateLimiter } from "./middleware/rateLimiter.js";
import basicAuth from "./middleware/basicAuth.js";
import ticketsRouter from "./routes/tickets.js";
import ordersRouter from "./routes/orders.js";
import { error } from "./utils/response.js";
import { AppError } from "./utils/errors.js";

const app = express();

// Trust proxy for rate limiting (when behind nginx/load balancer)
app.set("trust proxy", parseInt(process.env.TRUST_PROXY || "1"));

// Security headers — relax CSP for Swagger UI CDN resources and inline script
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);

// Request ID
app.use((req, res, next) => {
  const id = crypto.randomUUID();
  (req as express.Request & { id: string }).id = id;
  res.setHeader("X-Request-ID", id);
  next();
});

// CORS
const corsOrigins = process.env.CORS_ORIGINS;
app.use(
  cors(
    corsOrigins
      ? { origin: corsOrigins.split(",") }
      : undefined,
  ),
);

// Body parser with size limit
app.use(express.json({ limit: "10kb" }));

// Rate limiting
app.use(rateLimiter);

// HTTPS enforcement in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.status(403).json(error("HTTPS required"));
    }
    next();
  });
}

// Swagger UI HTML (SRI omitted — @5 resolves to latest 5.x so hashes change on each release)
const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CAAB API Certificação</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
    });
  </script>
</body>
</html>`;

// Swagger docs — protected in production, open in development
if (process.env.NODE_ENV !== "production") {
  app.get("/docs", (_req, res) => res.send(swaggerHtml));
  app.get("/docs.json", (_req, res) => res.json(swaggerSpec));
} else {
  app.get("/docs", basicAuth, (_req, res) => res.send(swaggerHtml));
  app.get("/docs.json", basicAuth, (_req, res) => res.json(swaggerSpec));
}

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// API routes (protected)
app.use("/api/tickets", authRateLimiter, basicAuth, ticketsRouter);
app.use("/api/orders", authRateLimiter, basicAuth, ordersRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json(error("Endpoint not found"));
});

// Global error handler
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(error(err.message));
    }

    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      console.error("Unhandled error:", err.message);
      console.error(err.stack);
    } else {
      console.error("Unhandled error:", err.message);
    }

    res.status(err.status || 500).json(error(isDev ? err.message : "Internal server error"));
  },
);

export default app;

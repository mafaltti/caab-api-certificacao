import express from "express";
import cors from "cors";
import swaggerSpec from "./config/swagger.js";
import { rateLimiter, authRateLimiter } from "./middleware/rateLimiter.js";
import basicAuth from "./middleware/basicAuth.js";
import ticketsRouter from "./routes/tickets.js";
import ordersRouter from "./routes/orders.js";
import { error } from "./utils/response.js";

const app = express();

// Trust proxy for rate limiting (when behind nginx/load balancer)
app.set("trust proxy", 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

// Swagger docs (no auth) — CDN-based to work on Vercel serverless
app.get("/docs", (_req, res) => {
  res.send(`<!DOCTYPE html>
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
</html>`);
});
app.get("/docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

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
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err.message);
    console.error(err.stack);

    const isDev = process.env.NODE_ENV === "development";

    res.status(err.status || 500).json(error(isDev ? err.message : "Internal server error"));
  }
);

export default app;

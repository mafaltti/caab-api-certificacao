import "./env.js";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Tickets API: http://localhost:${PORT}/api/tickets`);
  console.log(`Orders API: http://localhost:${PORT}/api/orders`);
});

function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error("Error during shutdown:", err.message);
      process.exit(1);
    }
    console.log("Server closed successfully");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

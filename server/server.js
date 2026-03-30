require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const app = require("./app");
const connectDB = require("./config/db");
const env = require("./config/env");
const { warmupLocalModel } = require("./services/aiLLM.service");
const { validateRuntimeConfig } = require("./services/runtime.service");

const http = require("http");
const { Server } = require("socket.io");

async function startServer() {
  global.startedAt = new Date().toISOString();
  global.dbReady = false;
  global.runtimeWarnings = [];

  const runtimeValidation = validateRuntimeConfig(env);
  global.runtimeWarnings = runtimeValidation.warnings;

  if (!runtimeValidation.ok) {
    runtimeValidation.errors.forEach((message) => {
      console.error(`[startup:error] ${message}`);
    });
    process.exit(1);
  }

  runtimeValidation.warnings.forEach((message) => {
    console.warn(`[startup:warning] ${message}`);
  });

  try {
    await connectDB();
    global.dbReady = true;
  } catch (err) {
    console.error("Database unavailable, starting in degraded mode.");
  }

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: "*" },
  });

  global.io = io;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
  });

  server.listen(env.PORT, () => {
    console.log(`Server running on ${env.PORT} in ${env.NODE_ENV} mode`);
    if ((env.AI_PROVIDER === "ollama" || env.AI_PROVIDER === "auto") && env.OLLAMA_URL) {
      warmupLocalModel().catch((err) => {
        console.error("Ollama warmup skipped:", err?.message || err);
      });
    }
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

startServer().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});

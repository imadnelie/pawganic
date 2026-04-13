import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { connectDb, initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import customersRoutes from "./routes/customers.js";
import ordersRoutes from "./routes/orders.js";
import expensesRoutes from "./routes/expenses.js";
import balanceRoutes from "./routes/balance.js";
import dashboardRoutes from "./routes/dashboard.js";
import usersRoutes from "./routes/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Needed so express-rate-limit accepts proxied requests (e.g. Vite dev server → API)
// that send X-Forwarded-For. Use 1 hop, not `true`, to satisfy rate-limit validation.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/balance", balanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", usersRoutes);

const distPath = path.join(__dirname, "..", "dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function start() {
  await connectDb();
  await initDb();
  app.listen(PORT, () => {
    console.log(`[pawganic-api] http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[pawganic-api] Failed to start:", err);
  process.exit(1);
});

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "pawganic.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      display_name TEXT NOT NULL,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      two_factor_secret TEXT,
      two_factor_temp_secret TEXT,
      reset_token TEXT,
      reset_token_expiry TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      lat REAL,
      lng REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      meal_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'delivered')),
      created_by TEXT NOT NULL,
      delivered_by TEXT,
      paid_to TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      delivered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_per_unit REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by TEXT NOT NULL CHECK(paid_by IN ('elie', 'jimmy'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  `);

  migrateUsersTable();
  backfillLegacyOrderItems();
  seedUsersIfEmpty();
}

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function migrateUsersTable() {
  if (!hasColumn("users", "email")) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT;`);
  }
  if (!hasColumn("users", "two_factor_enabled")) {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!hasColumn("users", "two_factor_secret")) {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT;`);
  }
  if (!hasColumn("users", "two_factor_temp_secret")) {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_temp_secret TEXT;`);
  }
  if (!hasColumn("users", "reset_token")) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT;`);
  }
  if (!hasColumn("users", "reset_token_expiry")) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token_expiry TEXT;`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);`);

  const fillEmailStmt = db.prepare("UPDATE users SET email = ? WHERE id = ? AND (email IS NULL OR email = '')");
  const existing = db.prepare("SELECT id, username FROM users").all();
  for (const u of existing) {
    fillEmailStmt.run(`${String(u.username).toLowerCase()}@pawganic.local`, u.id);
  }
}

function backfillLegacyOrderItems() {
  const rows = db
    .prepare(
      `SELECT o.id, o.meal_type, o.quantity, o.total_price
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.id IS NULL`
    )
    .all();
  if (!rows.length) return;
  const insert = db.prepare(
    `INSERT INTO order_items (order_id, meal_type, quantity, price_per_unit, subtotal)
     VALUES (?, ?, ?, ?, ?)`
  );
  const trx = db.transaction((items) => {
    for (const r of items) {
      const qty = Number(r.quantity) > 0 ? Number(r.quantity) : 1;
      const subtotal = Number(r.total_price) || 0;
      const ppu = qty > 0 ? subtotal / qty : subtotal;
      insert.run(r.id, r.meal_type, qty, ppu, subtotal);
    }
  });
  trx(rows);
}

function seedUsersIfEmpty() {
  const row = db.prepare("SELECT id FROM users LIMIT 1").get();
  if (row) return;

  const password = process.env.PAWGANIC_PASSWORD || "pawganic1";
  const hash = bcrypt.hashSync(password, 10);
  const insert = db.prepare(
    "INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)"
  );
  insert.run("elie", "elie.imad@gmail.com", hash, "admin", "Elie");
  insert.run("jimmy", "jimmymakdissy@gmail.com", hash, "user", "Jimmy");
  console.log("[db] Seeded users elie (admin) and jimmy (user). Password:", password);
}

export { db };

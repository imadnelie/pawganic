import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { db } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { encryptText, decryptText } from "../lib/crypto.js";

const r = Router();
r.use(requireAuth);
r.use(requireSuperAdmin);

r.get("/", (req, res) => {
  const rows = db
    .prepare(`SELECT id, username, email, role, display_name, two_factor_enabled FROM users ORDER BY username ASC`)
    .all();
  res.json(
    rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      displayName: u.display_name,
      twoFactorEnabled: Number(u.two_factor_enabled) === 1,
    }))
  );
});

r.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { email } = req.body || {};
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (!emailNorm) return res.status(400).json({ error: "Email is required" });
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "User not found" });
  const duplicate = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?")
    .get(emailNorm, id);
  if (duplicate) return res.status(400).json({ error: "Email already in use" });
  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(emailNorm, id);
  return res.json({ ok: true });
});

r.put("/:id/password", (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};
  const pwd = String(newPassword || "");
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (!pwd || pwd.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
  return res.json({ ok: true });
});

r.post("/:id/2fa/setup", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid user id" });
  const user = db.prepare("SELECT id, email, username FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const secret = speakeasy.generateSecret({
    name: `Pawganic (${user.username})`,
    issuer: "Pawganic",
    length: 20,
  });
  const encrypted = encryptText(secret.base32);
  db.prepare(
    `UPDATE users
     SET two_factor_temp_secret = ?, two_factor_enabled = 0
     WHERE id = ?`
  ).run(encrypted, id);
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
  return res.json({
    otpauthUrl: secret.otpauth_url,
    qrCodeDataUrl,
  });
});

r.post("/:id/2fa/confirm", (req, res) => {
  const id = Number(req.params.id);
  const code = String(req.body?.code || "").trim();
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid user id" });
  if (!code) return res.status(400).json({ error: "Code is required" });
  const user = db
    .prepare("SELECT id, two_factor_temp_secret FROM users WHERE id = ?")
    .get(id);
  if (!user || !user.two_factor_temp_secret) {
    return res.status(400).json({ error: "2FA setup was not started" });
  }
  const secret = decryptText(user.two_factor_temp_secret);
  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code.replace(/\s+/g, ""),
    window: 1,
  });
  if (!ok) return res.status(400).json({ error: "Invalid verification code" });
  db.prepare(
    `UPDATE users
     SET two_factor_enabled = 1,
         two_factor_secret = ?,
         two_factor_temp_secret = NULL
     WHERE id = ?`
  ).run(encryptText(secret), id);
  return res.json({ ok: true });
});

r.post("/:id/2fa/disable", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: "Invalid user id" });
  db.prepare(
    `UPDATE users
     SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_temp_secret = NULL
     WHERE id = ?`
  ).run(id);
  return res.json({ ok: true });
});

export default r;

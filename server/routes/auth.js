import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import { signToken, signTwoFactorToken, requireAuth, verifyTwoFactorToken } from "../middleware/auth.js";
import { decryptText } from "../lib/crypto.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { sendResetPasswordEmail } from "../lib/mailer.js";

const r = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
});

r.use(authLimiter);

r.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const user = db
    .prepare("SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?")
    .get(String(username).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (Number(user.two_factor_enabled) === 1 && user.two_factor_secret) {
    const twoFactorToken = signTwoFactorToken(user);
    return res.json({ requiresTwoFactor: true, twoFactorToken });
  }
  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    },
  });
});

r.post("/verify-2fa", (req, res) => {
  const { twoFactorToken, code } = req.body || {};
  if (!twoFactorToken || !code) {
    return res.status(400).json({ error: "twoFactorToken and code are required" });
  }
  let decoded;
  try {
    decoded = verifyTwoFactorToken(twoFactorToken);
  } catch {
    return res.status(401).json({ error: "Invalid or expired 2FA token" });
  }
  const user = db
    .prepare("SELECT id, username, email, role, display_name, two_factor_secret, two_factor_enabled FROM users WHERE id = ?")
    .get(decoded.sub);
  if (!user || Number(user.two_factor_enabled) !== 1 || !user.two_factor_secret) {
    return res.status(401).json({ error: "2FA not configured for user" });
  }
  const secret = decryptText(user.two_factor_secret);
  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(code).replace(/\s+/g, ""),
    window: 1,
  });
  if (!ok) return res.status(401).json({ error: "Invalid 2FA code" });
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    },
  });
});

r.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, email, role, display_name, two_factor_enabled FROM users WHERE id = ?")
    .get(req.user.sub);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
    twoFactorEnabled: Number(user.two_factor_enabled) === 1,
  });
});

r.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return res.json({
      ok: true,
      message: "If the email exists, a reset link has been sent.",
    });
  }
  const user = db
    .prepare("SELECT id, email FROM users WHERE LOWER(email) = ?")
    .get(normalized);
  if (user) {
    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?").run(
      tokenHash,
      expiry,
      user.id
    );
    const appBase = process.env.APP_BASE_URL || "http://localhost:5173";
    const resetLink = `${appBase}/reset-password?token=${rawToken}`;
    await sendResetPasswordEmail({ to: user.email, resetLink });
  }
  return res.json({
    ok: true,
    message: "If the email exists, a reset link has been sent.",
  });
});

r.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  const rawToken = String(token || "").trim();
  const pwd = String(newPassword || "");
  if (!rawToken || !pwd || pwd.length < 8) {
    return res.status(400).json({ error: "Token and new password (min 8 chars) are required" });
  }
  const tokenHash = sha256(rawToken);
  const user = db
    .prepare(
      `SELECT id, reset_token_expiry
       FROM users WHERE reset_token = ?`
    )
    .get(tokenHash);
  if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });
  const expiryMs = new Date(user.reset_token_expiry || 0).getTime();
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }
  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare(
    `UPDATE users
     SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL
     WHERE id = ?`
  ).run(hash, user.id);
  return res.json({ ok: true });
});

export default r;

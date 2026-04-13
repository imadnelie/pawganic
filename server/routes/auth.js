import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import mongoose from "mongoose";
import { User } from "../db.js";
import { signToken, signTwoFactorToken, requireAuth, verifyTwoFactorToken } from "../middleware/auth.js";
import { decryptText } from "../lib/crypto.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { sendResetPasswordEmail } from "../lib/mailer.js";

const r = Router();

/** Stable client key when `req.ip` is missing (some proxies / Node versions). */
function rateLimitKey(request) {
  const raw =
    request.ip ||
    request.socket?.remoteAddress?.replace(/^::ffff:/, "") ||
    "127.0.0.1";
  return ipKeyGenerator(raw, 56);
}

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
});

r.use(authLimiter);

function userPayload(userDoc) {
  if (!userDoc?._id) {
    throw new Error("Invalid user record");
  }
  return {
    id: String(userDoc._id),
    username: String(userDoc.username || ""),
    email: String(userDoc.email ?? ""),
    role: String(userDoc.role || ""),
    displayName: String(userDoc.display_name ?? ""),
  };
}

function passwordMatches(storedHash, plainPassword) {
  if (typeof storedHash !== "string" || !storedHash) return false;
  try {
    return bcrypt.compareSync(plainPassword, storedHash);
  } catch {
    return false;
  }
}

r.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = await User.findOne({
      username: String(username).toLowerCase().trim(),
    }).lean();
    if (!user || !passwordMatches(user.password_hash, password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.two_factor_enabled && user.two_factor_secret) {
      const twoFactorToken = signTwoFactorToken({ id: String(user._id), username: user.username, role: user.role });
      return res.json({ requiresTwoFactor: true, twoFactorToken });
    }
    const token = signToken({ id: String(user._id), username: user.username, role: user.role });
    res.json({
      token,
      user: userPayload(user),
    });
  } catch (e) {
    console.error("[auth] login:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/verify-2fa", async (req, res) => {
  try {
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
    if (!mongoose.isValidObjectId(decoded.sub)) {
      return res.status(401).json({ error: "Invalid or expired 2FA token" });
    }
    const user = await User.findById(decoded.sub).lean();
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
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
    const token = signToken({ id: String(user._id), username: user.username, role: user.role });
    return res.json({
      token,
      user: userPayload(user),
    });
  } catch (e) {
    console.error("[auth] verify-2fa:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.get("/me", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.user.sub)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await User.findById(req.user.sub).lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.json({
      ...userPayload(user),
      twoFactorEnabled: Boolean(user.two_factor_enabled),
    });
  } catch (e) {
    console.error("[auth] /me:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
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
  try {
    const user = await User.findOne({
      $expr: { $eq: [{ $toLower: { $trim: { input: { $ifNull: ["$email", ""] } } } }, normalized] },
    }).lean();
    if (user) {
      const rawToken = randomToken(32);
      const tokenHash = sha256(rawToken);
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await User.findByIdAndUpdate(user._id, {
        reset_token: tokenHash,
        reset_token_expiry: expiry,
      });
      const appBase = process.env.APP_BASE_URL || "http://localhost:5173";
      const resetLink = `${appBase}/reset-password?token=${rawToken}`;
      await sendResetPasswordEmail({ to: user.email, resetLink });
    }
  } catch (err) {
    console.error("[auth] forgot-password:", err);
  }
  return res.json({
    ok: true,
    message: "If the email exists, a reset link has been sent.",
  });
});

r.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const rawToken = String(token || "").trim();
    const pwd = String(newPassword || "");
    if (!rawToken || !pwd || pwd.length < 8) {
      return res.status(400).json({ error: "Token and new password (min 8 chars) are required" });
    }
    const tokenHash = sha256(rawToken);
    const user = await User.findOne({ reset_token: tokenHash }).lean();
    if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });
    const expiryMs = new Date(user.reset_token_expiry || 0).getTime();
    if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const hash = bcrypt.hashSync(pwd, 10);
    await User.findByIdAndUpdate(user._id, {
      password_hash: hash,
      reset_token: null,
      reset_token_expiry: null,
    });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;

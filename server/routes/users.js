import { Router } from "express";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import mongoose from "mongoose";
import { User } from "../db.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { encryptText, decryptText } from "../lib/crypto.js";

const r = Router();
r.use(requireAuth);
r.use(requireSuperAdmin);

r.get("/", async (req, res) => {
  try {
    const rows = await User.find()
      .select("username email role display_name two_factor_enabled")
      .sort({ username: 1 })
      .lean();
    res.json(
      rows.map((u) => ({
        id: String(u._id),
        username: u.username,
        email: u.email,
        role: u.role,
        displayName: u.display_name,
        twoFactorEnabled: Boolean(u.two_factor_enabled),
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.body || {};
    const emailNorm = String(email || "").trim().toLowerCase();
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (!emailNorm) return res.status(400).json({ error: "Email is required" });
    const exists = await User.findById(id).select("_id").lean();
    if (!exists) return res.status(404).json({ error: "User not found" });
    const duplicate = await User.findOne({
      email: emailNorm,
      _id: { $ne: id },
    })
      .select("_id")
      .lean();
    if (duplicate) return res.status(400).json({ error: "Email already in use" });
    await User.findByIdAndUpdate(id, { email: emailNorm });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.put("/:id/password", async (req, res) => {
  try {
    const id = req.params.id;
    const { newPassword } = req.body || {};
    const pwd = String(newPassword || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    if (!pwd || pwd.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const user = await User.findById(id).select("_id").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    const hash = bcrypt.hashSync(pwd, 10);
    await User.findByIdAndUpdate(id, { password_hash: hash });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/:id/2fa/setup", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid user id" });
    const user = await User.findById(id).select("email username").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const secret = speakeasy.generateSecret({
      name: `Pawganic (${user.username})`,
      issuer: "Pawganic",
      length: 20,
    });
    const encrypted = encryptText(secret.base32);
    await User.findByIdAndUpdate(id, {
      two_factor_temp_secret: encrypted,
      two_factor_enabled: false,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    return res.json({
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/:id/2fa/confirm", async (req, res) => {
  try {
    const id = req.params.id;
    const code = String(req.body?.code || "").trim();
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid user id" });
    if (!code) return res.status(400).json({ error: "Code is required" });
    const user = await User.findById(id).select("two_factor_temp_secret").lean();
    if (!user || !user.two_factor_temp_secret) {
      return res.status(400).json({ error: "2FA setup was not started" });
    }
    const secretPlain = decryptText(user.two_factor_temp_secret);
    const ok = speakeasy.totp.verify({
      secret: secretPlain,
      encoding: "base32",
      token: code.replace(/\s+/g, ""),
      window: 1,
    });
    if (!ok) return res.status(400).json({ error: "Invalid verification code" });
    await User.findByIdAndUpdate(id, {
      two_factor_enabled: true,
      two_factor_secret: encryptText(secretPlain),
      two_factor_temp_secret: null,
    });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

r.post("/:id/2fa/disable", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid user id" });
    await User.findByIdAndUpdate(id, {
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_temp_secret: null,
    });
    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

export default r;

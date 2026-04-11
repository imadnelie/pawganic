import crypto from "crypto";

const KEY_TEXT = process.env.TWO_FACTOR_ENCRYPTION_KEY || "pawganic-dev-2fa-key-change-me";
const KEY = crypto.createHash("sha256").update(KEY_TEXT).digest();

export function encryptText(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptText(cipherText) {
  const buf = Buffer.from(String(cipherText), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

export function randomToken(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}

export function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

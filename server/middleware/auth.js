import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "pawganic-dev-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: String(user?.username || "").toLowerCase().trim(),
      role: String(user?.role || ""),
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function signTwoFactorToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: String(user?.username || "").toLowerCase().trim(),
      role: String(user?.role || ""),
      purpose: "2fa",
    },
    JWT_SECRET,
    { expiresIn: "10m" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const sub = decoded?.sub != null ? String(decoded.sub) : "";
    const username = String(decoded?.username || "").toLowerCase().trim();
    const role = String(decoded?.role || "");
    if (!sub) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = { ...decoded, sub, username, role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function verifyTwoFactorToken(token) {
  const decoded = jwt.verify(String(token || ""), JWT_SECRET);
  if (decoded?.purpose !== "2fa") {
    throw new Error("Invalid 2FA token");
  }
  return decoded;
}

/** Any account with role `admin` (backend must enforce; do not rely on the UI alone). */
export function requireAdmin(req, res, next) {
  if (String(req.user?.role || "") === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Forbidden: admin access required" });
}

/**
 * Admin or staff (`role` === `user`): shared access for dashboard, customers, orders read/create, etc.
 * Apply per-route with stricter `requireAdmin` where only admins may mutate.
 */
export function requireAdminOrUser(req, res, next) {
  const role = String(req.user?.role || "");
  if (role === "admin" || role === "user") {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}

/** @deprecated alias for `requireAdminOrUser` (customer routes use the same gate). */
export const requireAdminOrCustomerStaff = requireAdminOrUser;

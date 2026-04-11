import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!token) {
      setErr("Missing reset token.");
      return;
    }
    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
      });
      setMsg("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Reset password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div>
            <label className="block text-xs font-medium text-slate-600">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Confirm password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-forest py-2.5 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-60"
          >
            {loading ? "Updating…" : "Reset password"}
          </button>
        </form>
        <Link to="/login" className="mt-6 block text-center text-sm text-slate-500 hover:text-forest">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}

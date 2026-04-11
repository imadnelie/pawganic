import { useState } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { user, login, verifyTwoFactor, loading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [code, setCode] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (needs2FA) {
        await verifyTwoFactor(twoFactorToken, code.trim());
      } else {
        const result = await login(username.trim(), password);
        if (result?.requiresTwoFactor) {
          setNeeds2FA(true);
          setTwoFactorToken(result.twoFactorToken);
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Pawganic</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to the management console</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}
          {!needs2FA ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600">Username</label>
                <input
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Password</label>
                <input
                  type="password"
                  className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600">Authenticator code</label>
              <input
                className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-forest py-2.5 text-sm font-semibold text-white transition hover:bg-forest/90 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : needs2FA ? "Verify code" : "Sign in"}
          </button>
          {!needs2FA ? (
            <Link to="/forgot-password" className="block text-center text-xs text-slate-500 hover:text-forest">
              Forgot password?
            </Link>
          ) : null}
        </form>

        <Link to="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-forest">
          ← Back to website
        </Link>
      </div>
    </div>
  );
}

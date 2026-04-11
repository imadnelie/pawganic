import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const data = await api("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMsg(data?.message || "If the email exists, a reset link has been sent.");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your email to receive a reset link.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div>
            <label className="block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm shadow-sm focus:border-forest focus:ring-forest"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-forest py-2.5 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link to="/login" className="mt-6 block text-center text-sm text-slate-500 hover:text-forest">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}

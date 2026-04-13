import { useEffect, useState } from "react";
import { api } from "../../api.js";
import Modal from "../components/Modal.jsx";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const [editUser, setEditUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "", email: "" });

  const [setup2faUser, setSetup2faUser] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [code, setCode] = useState("");

  const load = () =>
    api("/users")
      .then(setUsers)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openPasswordModal = (u) => {
    setErr("");
    setEditUser(u);
    setForm({ newPassword: "", confirmPassword: "", email: u.email || "" });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr("");
    setSuccess("");
    if (!form.email) return setErr("Email is required.");
    if (!form.newPassword || form.newPassword.length < 8) {
      return setErr("Password must be at least 8 characters.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setErr("Passwords do not match.");
    }
    try {
      await api(`/users/${editUser.id}`, { method: "PUT", body: { email: form.email } });
      await api(`/users/${editUser.id}/password`, {
        method: "PUT",
        body: { newPassword: form.newPassword },
      });
      setEditUser(null);
      setShowPassword(false);
      setSuccess("User email and password updated successfully.");
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const start2FA = async (u) => {
    setErr("");
    setSuccess("");
    try {
      const data = await api(`/users/${u.id}/2fa/setup`, { method: "POST" });
      setSetup2faUser(u);
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setCode("");
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const confirm2FA = async (e) => {
    e.preventDefault();
    if (!setup2faUser) return;
    setErr("");
    try {
      await api(`/users/${setup2faUser.id}/2fa/confirm`, { method: "POST", body: { code } });
      setSetup2faUser(null);
      setQrCodeDataUrl("");
      setCode("");
      setSuccess("Two-factor authentication enabled.");
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const disable2FA = async (u) => {
    if (!confirm(`Disable 2FA for ${u.username}?`)) return;
    setErr("");
    try {
      await api(`/users/${u.id}/2fa/disable`, { method: "POST" });
      setSuccess("Two-factor authentication disabled.");
      setLoading(true);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="hidden text-2xl font-semibold text-slate-900 lg:block">Users</h1>
          <p className="mt-0 text-sm leading-relaxed text-slate-500 lg:mt-1">
            Admin-only user and authentication management
          </p>
        </div>
      </div>

      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}
      {err && !editUser && !setup2faUser ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[540px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Username</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">2FA</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.username}</td>
                  <td className="px-4 py-3 text-slate-700">{u.email || "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{u.role}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.twoFactorEnabled ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        Enabled
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openPasswordModal(u)}
                        className="text-sm font-semibold text-forest hover:underline"
                      >
                        Edit Password
                      </button>
                      {!u.twoFactorEnabled ? (
                        <button
                          type="button"
                          onClick={() => start2FA(u)}
                          className="text-sm font-semibold text-forest hover:underline"
                        >
                          Enable 2FA
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => disable2FA(u)}
                          className="text-sm font-semibold text-rose-700 hover:underline"
                        >
                          Disable 2FA
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editUser}
        title={`Edit Credentials: ${editUser?.username || ""}`}
        onClose={() => setEditUser(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="edit-password-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        {err && editUser ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        <form id="edit-password-form" onSubmit={submitPassword} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">New Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Show passwords
          </label>
        </form>
      </Modal>

      <Modal
        open={!!setup2faUser}
        title={`Enable 2FA: ${setup2faUser?.username || ""}`}
        onClose={() => setSetup2faUser(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSetup2faUser(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              form="confirm-2fa-form"
              type="submit"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              Confirm 2FA
            </button>
          </div>
        }
      >
        {err && setup2faUser ? <p className="mb-3 text-sm text-red-600">{err}</p> : null}
        {qrCodeDataUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">Scan this QR code using Google Authenticator, then enter the 6-digit code.</p>
            <img src={qrCodeDataUrl} alt="2FA QR Code" className="mx-auto h-48 w-48" />
          </div>
        ) : null}
        <form id="confirm-2fa-form" onSubmit={confirm2FA} className="mt-3">
          <label className="text-xs font-medium text-slate-600">6-digit code</label>
          <input
            required
            className="mt-1 block w-full rounded-lg border-slate-300 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}

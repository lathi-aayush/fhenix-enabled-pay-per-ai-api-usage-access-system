import React from "react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";

export default function DevDashboard() {
  const [secret, setSecret] = useState(import.meta.env.VITE_DEV_ADMIN_SECRET || "");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (secret) {
      fetchUsers(secret);
    }
  }, []);

  const fetchUsers = async (key) => {
    setLoading(true);
    try {
      const res = await api.get("/api/dev/users", {
        headers: { "x-dev-secret": key },
      });
      setUsers(res.data);
      setAuthenticated(true);
    } catch (e) {
      setAuthenticated(false);
      if (key !== import.meta.env.VITE_DEV_ADMIN_SECRET) {
         toast.error("Invalid Dev Secret");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!secret.trim()) return;
    fetchUsers(secret);
  };

  const handleDeleteUser = async (user) => {
    const confirmDelete = window.confirm(
      `Are you ABSOLUTELY sure you want to delete ${user.displayName || user.walletAddress || user.email}? This removes them from MongoDB permanently.`
    );
    if (!confirmDelete) return;

    setDeletingId(user._id);
    try {
      await api.delete(`/api/dev/users/${user._id}`, {
        headers: { "x-dev-secret": secret },
      });
      toast.success("User deleted from database.");
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-body">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl border border-surface-variant shadow-lg max-w-sm w-full">
          <h2 className="text-xl font-headline font-bold text-primary mb-4 text-center">Developer Login</h2>
          <input
            type="password"
            placeholder="Enter Dev Secret Key"
            className="w-full px-4 py-2 border border-outline-variant rounded-md text-sm mb-4"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-md transition-colors"
          >
            {loading ? "Authenticating..." : "Access Dashboard"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500">admin_panel_settings</span>
              Developer Console
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">Manage and sync registered user profiles.</p>
          </div>
          <button
            onClick={() => {
              setAuthenticated(false);
              setSecret("");
              setUsers([]);
            }}
            className="text-sm font-semibold text-primary underline"
          >
            Lock Console
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse flex flex-col gap-4">
            <div className="h-16 bg-surface-container-low rounded-xl w-full"></div>
            <div className="h-16 bg-surface-container-low rounded-xl w-full"></div>
            <div className="h-16 bg-surface-container-low rounded-xl w-full"></div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-surface-variant overflow-x-auto shadow-sm w-full">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
              <thead className="bg-surface-container-lowest border-b border-surface-variant text-on-surface-variant uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">User ID</th>
                  <th className="px-6 py-4">Wallet</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant text-primary">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <img
                        src={u.photoURL || "https://lh3.googleusercontent.com/a/default-user"}
                        alt={u.displayName}
                        className="w-8 h-8 rounded-full border border-slate-200"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold">{u.displayName || "Unknown"}</span>
                        <span className="text-[11px] text-on-surface-variant">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${u.role === "creator" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-on-surface-variant">
                      {u._id?.slice(-8) || "N/A"}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px]">
                      {u.walletAddress ? `${u.walletAddress.slice(0,6)}...${u.walletAddress.slice(-4)}` : <span className="text-slate-400">Unlinked</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={deletingId === u._id}
                        className="flex items-center gap-1 ml-auto text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {deletingId === u._id ? "hourglass_empty" : "delete_forever"}
                        </span>
                        {deletingId === u._id ? "Deleting..." : "Delete User"}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-on-surface-variant">
                      No users found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

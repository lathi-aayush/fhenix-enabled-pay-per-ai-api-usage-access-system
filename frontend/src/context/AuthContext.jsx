import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../api/client.js";
import { parseJwtPayload } from "../utils/jwt.js";
import { fetchBurnerWallet } from "../wallet/burner.js";
import { reconnectPera } from "../wallet/pera.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "sentinal_token";

/** Always build the user object from the JWT so the shape is identical
 *  whether the user just logged in or refreshed the page. */
function userFromToken(token) {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload?.role) return null;
  return {
    id: payload.sub,
    walletAddress: payload.walletAddress || null,
    role: payload.role,
    displayName: payload.displayName || null,
    email: payload.email || null,
    photoURL: payload.photoURL || null,
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(() => userFromToken(localStorage.getItem(STORAGE_KEY)));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reconnectPera().catch((err) => console.warn("Pera auto-reconnect failed:", err));
  }, []);

  useEffect(() => {
    async function syncProfile() {
      if (token) {
        setAuthToken(token);
        const derived = userFromToken(token);
        if (derived) {
          setUser(derived);
          try {
            const { data } = await api.get("/api/profile/summary");
            if (data?.profile) {
              setUser({
                id: data.profile.id,
                walletAddress: data.profile.walletAddress,
                role: data.profile.role,
                displayName: data.profile.displayName,
                email: data.profile.email,
                photoURL: data.profile.photoURL,
              });
            }
            fetchBurnerWallet().catch((err) => console.warn("Burner sync error:", err));
          } catch (err) {
            console.warn("Failed to refetch latest profile data:", err.message);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
          setAuthToken(null);
        }
      } else {
        setAuthToken(null);
        setUser(null);
      }
      setLoading(false);
    }
    syncProfile();
  }, [token]);

  const persistSession = useCallback((incoming) => {
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Auth response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return derived;
  }, []);

  const login = useCallback(async (walletAddress, role) => {
    const { data } = await api.post("/api/auth/login", { walletAddress, role });
    const user = persistSession(data.token);
    return {
      user,
      isNewUser: Boolean(data.isNewUser),
      needsProfile: Boolean(data.needsProfile),
    };
  }, [persistSession]);

  const register = useCallback(async (walletAddress, role, displayName) => {
    const { data } = await api.post("/api/auth/register", { walletAddress, role, displayName });
    return persistSession(data.token);
  }, [persistSession]);

  const linkWallet = useCallback(async (walletAddress) => {
    const { data } = await api.post("/api/auth/link-wallet", { walletAddress });
    return persistSession(data.token);
  }, [persistSession]);

  const updateProfile = useCallback(async (displayName) => {
    const { data } = await api.put("/api/profile", { displayName });
    return persistSession(data.token);
  }, [persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      register,
      linkWallet,
      updateProfile,
      logout,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, loading, login, register, linkWallet, updateProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

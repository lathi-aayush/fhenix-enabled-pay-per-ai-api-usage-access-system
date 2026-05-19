import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../api/client.js";
import { parseJwtPayload } from "../utils/jwt.js";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase.js";

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
    async function syncProfile() {
      if (token) {
        setAuthToken(token);
        const derived = userFromToken(token);
        if (derived) {
          setUser(derived);
          try {
            // Refetch latest fresh data from MongoDB to stay in sync!
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
          } catch (err) {
            console.warn("Failed to refetch latest profile data:", err.message);
          }
        } else {
          // Token exists but is malformed – force logout
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

  const login = useCallback(async (walletAddress, role) => {
    const { data } = await api.post("/api/auth/login", { walletAddress, role });
    const incoming = data.token;
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Login response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return derived;
  }, []);

  const firebaseLogin = useCallback(async (idToken, role) => {
    const { data } = await api.post("/api/auth/firebase-login", { idToken, role });
    if (data.isNewUser) {
      return {
        isNewUser: true,
        firebaseUid: data.firebaseUid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
      };
    }
    const incoming = data.token;
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Firebase login response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return { isNewUser: false, user: derived };
  }, []);

  const register = useCallback(async (idToken, role, displayName, walletAddress) => {
    const { data } = await api.post("/api/auth/register", { idToken, role, displayName, walletAddress });
    const incoming = data.token;
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Registration response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return derived;
  }, []);

  const linkWallet = useCallback(async (walletAddress) => {
    const { data } = await api.post("/api/auth/link-wallet", { walletAddress });
    const incoming = data.token;
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Linking response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return derived;
  }, []);

  const updateProfile = useCallback(async (displayName) => {
    const { data } = await api.put("/api/profile", { displayName });
    const incoming = data.token;
    const derived = userFromToken(incoming);
    if (!derived) throw new Error("Profile update response contained an invalid token.");
    localStorage.setItem(STORAGE_KEY, incoming);
    setAuthToken(incoming);
    setToken(incoming);
    setUser(derived);
    return derived;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Firebase signout failed:", e.message);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      firebaseLogin,
      register,
      linkWallet,
      updateProfile,
      logout,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, loading, login, firebaseLogin, register, linkWallet, updateProfile, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { auth, googleProvider } from "./firebase.js";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import axios from "axios";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

const STORAGE_KEY = "sentinal_chat_token";
const SENTINAL_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Chat backend API instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_CHAT_API_URL || "http://localhost:4000/api", // Chat Backend URL
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirectHandling, setRedirectHandling] = useState(true);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const idToken = await result.user.getIdToken();
          
          const res = await axios.post(`${SENTINAL_API_URL}/api/auth/firebase-login`, {
            idToken,
            role: "user"
          });
          
          if (res.data.isNewUser) {
            toast.error("Please create an account on the main Sentinel website first.");
          } else {
            const jwtToken = res.data.token;
            localStorage.setItem(STORAGE_KEY, jwtToken);
            setToken(jwtToken);
            toast.success("Successfully logged in");
          }
        }
      } catch (err) {
        console.error("Redirect login failed:", err);
        toast.error("Failed to login via redirect");
      } finally {
        setRedirectHandling(false);
      }
    };
    
    handleRedirectResult();
  }, []);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      // Decode JWT to get user info (simple base64 decode for frontend)
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          window.atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        setUser({
          id: payload.sub,
          walletAddress: payload.walletAddress,
          displayName: payload.displayName,
          email: payload.email,
          photoURL: payload.photoURL,
        });
      } catch (e) {
        console.error("Invalid token:", e);
        setToken(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      delete api.defaults.headers.common.Authorization;
      setUser(null);
    }
    
    if (!redirectHandling) {
      setLoading(false);
    }
  }, [token, redirectHandling]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      // Get Sentinal JWT by authenticating with main Sentinal API
      const res = await axios.post(`${SENTINAL_API_URL}/api/auth/firebase-login`, {
        idToken,
        role: "user"
      });
      
      if (res.data.isNewUser) {
        toast.error("Please create an account on the main Sentinel website first.");
        return;
      }
      
      const jwtToken = res.data.token;
      localStorage.setItem(STORAGE_KEY, jwtToken);
      setToken(jwtToken);
      toast.success("Successfully logged in");
    } catch (err) {
      console.error("Login failed:", err);
      
      // Fallback to redirect if popup is cancelled or blocked
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
         toast.loading("Popup blocked. Redirecting to login...", { duration: 2000 });
         await signInWithRedirect(auth, googleProvider);
      } else {
         toast.error("Failed to login");
      }
    }
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    loginWithGoogle,
    logout,
    isAuthenticated: Boolean(user)
  }), [user, token, loading, loginWithGoogle, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

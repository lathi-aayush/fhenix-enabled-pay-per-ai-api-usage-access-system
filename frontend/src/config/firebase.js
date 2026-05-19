import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Check if configuration is present in environment variables
const hasEnvConfig = !!import.meta.env.VITE_FIREBASE_API_KEY;

// If missing, use a valid-format dummy fallback configuration to prevent the SDK from crashing on startup.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForMockLocalDevelopment",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock-app.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

if (!hasEnvConfig) {
  console.warn(
    "[Firebase Config] No Firebase API keys found in frontend/.env! Engaging mock credentials for local development. Landing page & mock logins will load seamlessly."
  );
}

// Initialize Firebase App dynamically
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Google provider setup
googleProvider.setCustomParameters({ prompt: "select_account" });

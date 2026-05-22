import admin from "firebase-admin";

let initialized = false;

/**
 * Initializes Firebase Admin SDK using environment variables.
 * Mirrors the same pattern used in the main Sentinel backend.
 * Returns the admin instance, or null if credentials are unavailable.
 */
export function getFirebaseAdmin() {
  if (initialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (projectId || serviceAccountJson) {
    try {
      let credential;
      if (serviceAccountJson) {
        credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      }
      admin.initializeApp({ projectId: projectId || undefined, credential });
      initialized = true;
      console.log("[Chat Firebase Admin] Initialized.");
      return admin;
    } catch (e) {
      console.error("[Chat Firebase Admin] Initialization failed:", e.message);
      return null;
    }
  }

  console.warn("[Chat Firebase Admin] No credentials set — running in JWT-only mode.");
  initialized = true;
  return null;
}

// Convenience: default export still exposes auth if initialized
export const auth = { getFirebaseAdmin };


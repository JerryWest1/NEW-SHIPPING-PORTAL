import express from "express";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin lazily
let adminInitialized = false;
let initError: string | null = null;

function initAdmin() {
  if (adminInitialized || getApps().length > 0) {
    adminInitialized = true;
    return { success: true };
  }
  
  // Set flag early to prevent concurrent initialization attempts
  adminInitialized = true;
  
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  // Debug log
  console.log("Checking FIREBASE_SERVICE_ACCOUNT:", serviceAccountStr ? "Present (length: " + serviceAccountStr.length + ")" : "Missing");

  if (!serviceAccountStr) {
    initError = "FIREBASE_SERVICE_ACCOUNT is not set.";
    console.warn(initError);
    adminInitialized = false; // Reset on failure
    return { success: false, error: initError };
  }
  try {
    // If the JSON contains actual newlines (often happens when pasting into UI),
    // replace them with literal \n so JSON.parse can handle them.
    const sanitizedStr = serviceAccountStr.replace(/\n/g, '\\n');
    const serviceAccount = JSON.parse(sanitizedStr);
    
    if (getApps().length === 0) {
      try {
        initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (e: any) {
        if (e.code !== 'app/duplicate-app') {
          throw e;
        }
      }
    }
    
    return { success: true };
  } catch (e: any) {
    initError = "Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: " + e.message;
    console.error(initError);
    adminInitialized = false; // Reset on failure
    return { success: false, error: initError };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/delete-user", async (req, res) => {
    const initResult = initAdmin();
    if (!initResult.success) {
      return res.status(500).json({ error: "Firebase Admin not configured on server: " + initResult.error });
    }
    
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "Missing uid" });
    }

    try {
      // Delete from Auth
      try {
        await getAuth().deleteUser(uid);
      } catch (authError: any) {
        // If user is already deleted from Auth, we can still proceed to delete from Firestore
        if (authError.code !== 'auth/user-not-found') {
          throw authError;
        }
        console.log(`User ${uid} already deleted from Auth or not found.`);
      }

      // Delete from Firestore
      // Note: We try to delete by UID first, but in this app documents might be stored by email as well.
      // However, the frontend handles the Firestore deletion for the specific record it's looking at.
      // We'll keep this here as a backup for UID-based documents.
      await getFirestore().collection('users').doc(uid).delete();
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

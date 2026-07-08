import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzg4EcnoTV4KUaCewuHfKB91PPXDJeLdw",
  authDomain: "new-shipping-portal.firebaseapp.com",
  projectId: "new-shipping-portal",
  storageBucket: "new-shipping-portal.firebasestorage.app",
  messagingSenderId: "445779154925",
  appId: "1:445779154925:web:bf92f4a9c40b2c06a379e4",
};

let app;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
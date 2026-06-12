import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Replace these values with your Firebase project config
export const firebaseConfig = {
  apiKey: "AIzaSyDpW3N2V-ff0gfP3fnfoIUHOGNUZMzNvqg",
  authDomain: "consolapp-bed08.firebaseapp.com",
  projectId: "consolapp-bed08",
  storageBucket: "consolapp-bed08.firebasestorage.app",
  messagingSenderId: "65641430488",
  appId: "1:65641430488:web:96dfda21a66e9d910746ad",
  measurementId: "G-HS3403FE35"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Persistent IndexedDB cache so pages render instantly from local data.
// initializeFirestore throws if Firestore was already initialized (e.g. hot reload),
// so fall back to the existing instance.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

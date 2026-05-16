import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);

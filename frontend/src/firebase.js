import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions"; // <-- Add this

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDNaeD-b1S0OwRKlqCTAGzupFhvLP8bPtc",
  authDomain: "wildwatch23.firebaseapp.com",
  projectId: "wildwatch23",
  storageBucket: "wildwatch23.firebasestorage.app",
  messagingSenderId: "345373996171",
  appId: "1:345373996171:web:7ff05622d7fedfa2c3d08e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // Keep auth export
export const db = getFirestore(app);
export const functions = getFunctions(app); // <-- Add this
export { httpsCallable }; // <-- Add this
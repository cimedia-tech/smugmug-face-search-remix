import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDzQJxrO2sGPqOQZhEGGhtQkaPcYPQwpLk",
  authDomain: "smugmug-face-search.firebaseapp.com",
  projectId: "smugmug-face-search",
  storageBucket: "smugmug-face-search.firebasestorage.app",
  messagingSenderId: "89590767825",
  appId: "1:89590767825:web:e5abf614413102ee5aa5f0",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

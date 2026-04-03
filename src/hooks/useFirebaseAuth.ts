import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/src/lib/firebase";
import { toast } from "sonner";

export interface FirebaseAuthState {
  firebaseUser: User | null;
  isFirebaseLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutFirebase: () => Promise<void>;
}

export function useFirebaseAuth(): FirebaseAuthState {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== "auth/popup-closed-by-user") {
        toast.error("Sign-in failed. Please try again.");
      }
    }
  };

  const signOutFirebase = async () => {
    await signOut(auth);
    toast.success("Signed out.");
  };

  return { firebaseUser, isFirebaseLoading, signInWithGoogle, signOutFirebase };
}

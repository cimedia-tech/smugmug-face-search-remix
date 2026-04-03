import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/src/lib/firebase";

export interface SearchRecord {
  id: string;
  galleryName: string;
  galleryUri: string;
  referenceThumbnail: string;
  matchCount: number;
  totalScanned: number;
  createdAt: Timestamp | null;
}

export interface SearchHistoryState {
  history: SearchRecord[];
  saveSearch: (record: Omit<SearchRecord, "id" | "createdAt">) => Promise<void>;
  deleteSearch: (id: string) => Promise<void>;
}

export function useSearchHistory(firebaseUser: User | null): SearchHistoryState {
  const [history, setHistory] = useState<SearchRecord[]>([]);

  const load = async (uid: string) => {
    const q = query(
      collection(db, "users", uid, "searches"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setHistory(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as SearchRecord))
    );
  };

  useEffect(() => {
    if (firebaseUser) load(firebaseUser.uid);
    else setHistory([]);
  }, [firebaseUser]);

  const saveSearch = async (record: Omit<SearchRecord, "id" | "createdAt">) => {
    if (!firebaseUser) return;
    const ref = await addDoc(collection(db, "users", firebaseUser.uid, "searches"), {
      ...record,
      createdAt: serverTimestamp(),
    });
    setHistory((prev) => [
      { id: ref.id, ...record, createdAt: null },
      ...prev,
    ]);
  };

  const deleteSearch = async (id: string) => {
    if (!firebaseUser) return;
    await deleteDoc(doc(db, "users", firebaseUser.uid, "searches", id));
    setHistory((prev) => prev.filter((s) => s.id !== id));
  };

  return { history, saveSearch, deleteSearch };
}

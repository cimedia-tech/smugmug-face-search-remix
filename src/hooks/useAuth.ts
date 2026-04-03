import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { doc, getDoc, setDoc, deleteField, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/src/lib/firebase";
import { smugmug } from "@/src/services/smugmug";
import type { SmugMugUser, SmugMugGallery, SmugMugCredentials } from "@/src/types";

// --- Firestore helpers ---

async function loadCredentialsFromFirestore(uid: string): Promise<Partial<SmugMugCredentials>> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return {};
  const data = snap.data();
  return {
    apiKey: data.smugmugApiKey ?? "",
    apiSecret: data.smugmugApiSecret ?? "",
    accessToken: data.smugmugAccessToken ?? "",
    accessTokenSecret: data.smugmugAccessTokenSecret ?? "",
  };
}

async function saveCredentialsToFirestore(uid: string, creds: SmugMugCredentials) {
  await setDoc(
    doc(db, "users", uid),
    {
      smugmugApiKey: creds.apiKey,
      smugmugApiSecret: creds.apiSecret,
      smugmugAccessToken: creds.accessToken ?? "",
      smugmugAccessTokenSecret: creds.accessTokenSecret ?? "",
    },
    { merge: true }
  );
}

async function clearTokensInFirestore(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    smugmugAccessToken: deleteField(),
    smugmugAccessTokenSecret: deleteField(),
  });
}

// --- Hook ---

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SmugMugUser | null;
  galleries: SmugMugGallery[];
  credentials: SmugMugCredentials;
  setCredentials: (creds: Partial<SmugMugCredentials>) => void;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  saveSettings: () => void;
  checkAuth: (overrideCreds?: Partial<SmugMugCredentials>) => Promise<void>;
}

export function useAuth(firebaseUser: User | null): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<SmugMugUser | null>(null);
  const [galleries, setGalleries] = useState<SmugMugGallery[]>([]);
  const [credentials, setCredentialsState] = useState<SmugMugCredentials>({
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  });

  const setCredentials = (partial: Partial<SmugMugCredentials>) =>
    setCredentialsState((prev) => ({ ...prev, ...partial }));

  const checkAuth = useCallback(
    async (overrideCreds?: Partial<SmugMugCredentials>) => {
      const apiKey = overrideCreds?.apiKey ?? credentials.apiKey;
      const apiSecret = overrideCreds?.apiSecret ?? credentials.apiSecret;
      const accessToken = overrideCreds?.accessToken ?? credentials.accessToken;
      const accessTokenSecret = overrideCreds?.accessTokenSecret ?? credentials.accessTokenSecret;

      if (!accessToken || !apiKey || !apiSecret) {
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }

      const creds: SmugMugCredentials = { apiKey, apiSecret, accessToken, accessTokenSecret };

      try {
        const userData = await smugmug.getUser(creds);
        if (!userData?.NickName) throw new Error("Invalid user data from SmugMug.");

        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);

        // Persist override tokens to Firestore
        if (overrideCreds?.accessToken && firebaseUser) {
          setCredentials({ accessToken, accessTokenSecret });
          await saveCredentialsToFirestore(firebaseUser.uid, creds);
        }

        // Fetch galleries in background
        try {
          if (userData.Galleries) {
            setGalleries(userData.Galleries);
          } else {
            const uri =
              userData.Uris?.Galleries?.Uri ??
              (userData.Uri ? `${userData.Uri}!galleries` : userData.NickName);
            const galleryData = await smugmug.getGalleries(uri, creds);
            setGalleries(galleryData || []);
          }
        } catch (err: any) {
          toast.error(`Connected, but failed to load galleries: ${err.message}`);
        }
      } catch (error: any) {
        const msg = error.response?.data?.Message || error.message || "Authentication failed";
        if (error.response?.status === 401 || error.response?.status === 404) {
          toast.error("SmugMug session expired. Please reconnect.");
          if (firebaseUser) await clearTokensInFirestore(firebaseUser.uid);
          setCredentials({ accessToken: "", accessTokenSecret: "" });
          setIsAuthenticated(false);
        } else {
          toast.error(`Connection error: ${msg}`);
        }
        setIsLoading(false);
      }
    },
    [credentials, firebaseUser]
  );

  const saveSettings = async () => {
    setIsLoading(true);
    if (firebaseUser) {
      await saveCredentialsToFirestore(firebaseUser.uid, credentials);
    }
    toast.success("Settings saved");
    checkAuth();
  };

  const handleConnect = async () => {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;

    if (!apiKey || !apiSecret) {
      toast.error("Please enter your SmugMug API Key and Secret first.");
      return;
    }

    if (firebaseUser) {
      await saveCredentialsToFirestore(firebaseUser.uid, credentials);
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to initiate connection");
        return;
      }

      if (data.oauthToken && data.oauthTokenSecret) {
        localStorage.setItem(`oauth_secret_${data.oauthToken}`, data.oauthTokenSecret);
      }

      window.open(data.url, "smugmug_oauth", "width=600,height=700");
    } catch {
      toast.error("Failed to initiate connection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (firebaseUser) await clearTokensInFirestore(firebaseUser.uid);
    setCredentials({ accessToken: "", accessTokenSecret: "" });
    setIsAuthenticated(false);
    setUser(null);
    setGalleries([]);
  };

  const hasInitialLoaded = useRef(false);

  // When Firebase user changes, load their credentials from Firestore
  useEffect(() => {
    if (!firebaseUser) {
      setIsAuthenticated(false);
      setIsLoading(false);
      setUser(null);
      setGalleries([]);
      return;
    }

    if (hasInitialLoaded.current) return;
    hasInitialLoaded.current = true;

    setIsLoading(true);

    const boot = async () => {
      // Try loading server-side pre-configured keys first
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const config = await res.json();
          if (config.hasServerKeys && config.smugmugApiKey) {
            const snap = await getDoc(doc(db, "users", firebaseUser.uid));
            if (!snap.exists() || !snap.data()?.smugmugApiKey) {
              await saveCredentialsToFirestore(firebaseUser.uid, {
                apiKey: config.smugmugApiKey,
                apiSecret: "__server__",
                accessToken: "",
                accessTokenSecret: "",
              });
            }
          }
        }
      } catch {
        // silently ignore
      }

      // Load credentials from Firestore
      const stored = await loadCredentialsFromFirestore(firebaseUser.uid);
      const merged = { apiKey: "", apiSecret: "", accessToken: "", accessTokenSecret: "", ...stored };
      setCredentialsState(merged);

      if (merged.accessToken) {
        checkAuth(merged);
      } else {
        setIsLoading(false);
      }
    };

    boot();
  }, [firebaseUser]);

  // OAuth popup listener
  useEffect(() => {
    if (!firebaseUser) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "OAUTH_AUTH_SUCCESS") return;
      const { accessToken, accessTokenSecret } = event.data;
      if (!accessToken || !accessTokenSecret) {
        toast.error("Connection failed: missing tokens");
        return;
      }
      setCredentials({ accessToken, accessTokenSecret });
      checkAuth({ ...credentials, accessToken, accessTokenSecret });
      toast.success("Successfully connected to SmugMug");
    };

    const pollInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem("sm_oauth_result");
        if (!raw) return;
        const result = JSON.parse(raw);
        if (result.type === "OAUTH_AUTH_SUCCESS" && Date.now() - result.timestamp < 60000) {
          localStorage.removeItem("sm_oauth_result");
          const { accessToken, accessTokenSecret } = result;
          if (accessToken && accessTokenSecret) {
            setCredentials({ accessToken, accessTokenSecret });
            checkAuth({ ...credentials, accessToken, accessTokenSecret });
            toast.success("Successfully connected to SmugMug");
          }
        }
      } catch {
        // ignore
      }
    }, 2000);

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(pollInterval);
    };
  }, [firebaseUser, credentials, checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    user,
    galleries,
    credentials,
    setCredentials,
    handleConnect,
    handleDisconnect,
    saveSettings,
    checkAuth,
  };
}

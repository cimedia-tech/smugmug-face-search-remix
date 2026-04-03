import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { smugmug } from "@/src/services/smugmug";
import type { SmugMugUser, SmugMugGallery, SmugMugCredentials } from "@/src/types";

// --- Storage helpers (cookie + localStorage fallback for iframe compat) ---

export function getStoredValue(name: string): string {
  const cookieValue = `; ${document.cookie}`.split(`; ${name}=`).pop()?.split(";").shift();
  if (cookieValue) return cookieValue;
  return localStorage.getItem(name) || "";
}

export function setStoredValue(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=None; Secure`;
  localStorage.setItem(name, value);
}

function clearStoredTokens() {
  ["sm_access_token", "sm_access_token_secret"].forEach((key) => {
    document.cookie = `${key}=; path=/; max-age=0`;
    localStorage.removeItem(key);
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

export function useAuth(): AuthState {
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

  const setCredentials = (partial: Partial<SmugMugCredentials>) => {
    setCredentialsState((prev) => ({ ...prev, ...partial }));
  };

  const checkAuth = useCallback(
    async (overrideCreds?: Partial<SmugMugCredentials>) => {
      const apiKey = overrideCreds?.apiKey ?? credentials.apiKey ?? getStoredValue("sm_api_key");
      const apiSecret = overrideCreds?.apiSecret ?? credentials.apiSecret ?? getStoredValue("sm_api_secret");
      const accessToken = overrideCreds?.accessToken ?? credentials.accessToken ?? getStoredValue("sm_access_token");
      const accessTokenSecret = overrideCreds?.accessTokenSecret ?? credentials.accessTokenSecret ?? getStoredValue("sm_access_token_secret");

      if (!accessToken || accessToken === "undefined" || accessToken === "null") {
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }
      if (!apiKey || !apiSecret) {
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

        if (overrideCreds?.accessToken) {
          setStoredValue("sm_access_token", accessToken);
          setStoredValue("sm_access_token_secret", accessTokenSecret);
          setCredentials({ accessToken, accessTokenSecret });
        }

        // Fetch galleries in background
        try {
          if (userData.Galleries) {
            setGalleries(userData.Galleries);
          } else {
            const galleriesUri =
              userData.Uris?.Galleries?.Uri ?? (userData.Uri ? `${userData.Uri}!galleries` : userData.NickName);
            const galleryData = await smugmug.getGalleries(galleriesUri, creds);
            setGalleries(galleryData || []);
          }
        } catch (err: any) {
          toast.error(`Connected, but failed to load galleries: ${err.message}`);
        }
      } catch (error: any) {
        const msg = error.response?.data?.Message || error.message || "Authentication failed";
        if (error.response?.status === 401 || error.response?.status === 404) {
          toast.error("SmugMug session expired. Please reconnect.");
          clearStoredTokens();
          setCredentials({ accessToken: "", accessTokenSecret: "" });
          setIsAuthenticated(false);
        } else {
          toast.error(`Connection error: ${msg}`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [credentials]
  );

  const saveSettings = () => {
    setIsLoading(true);
    setStoredValue("sm_api_key", credentials.apiKey ?? "");
    setStoredValue("sm_api_secret", credentials.apiSecret ?? "");
    toast.success("Settings saved");
    checkAuth();
  };

  const handleConnect = async () => {
    const apiKey = credentials.apiKey || getStoredValue("sm_api_key");
    const apiSecret = credentials.apiSecret || getStoredValue("sm_api_secret");

    if (!apiKey || !apiSecret) {
      toast.error("Please enter your SmugMug API Key and Secret first.");
      return;
    }

    setStoredValue("sm_api_key", apiKey);
    setStoredValue("sm_api_secret", apiSecret);
    setCredentials({ apiKey, apiSecret });
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

  const handleDisconnect = () => {
    clearStoredTokens();
    setCredentials({ accessToken: "", accessTokenSecret: "" });
    setIsAuthenticated(false);
    setUser(null);
    setGalleries([]);
  };

  const hasInitialLoaded = useRef(false);

  // Boot: load server config, restore session, set up OAuth listeners
  useEffect(() => {
    if (hasInitialLoaded.current) return;
    hasInitialLoaded.current = true;

    // Try loading pre-configured server keys
    const loadServerConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const config = await res.json();
        if (config.hasServerKeys && config.smugmugApiKey && !getStoredValue("sm_api_key")) {
          setStoredValue("sm_api_key", config.smugmugApiKey);
          setStoredValue("sm_api_secret", "__server__");
          setCredentials({ apiKey: config.smugmugApiKey, apiSecret: "__server__" });
        }
      } catch {
        // Silently fail — user can enter keys manually
      }
    };

    loadServerConfig().then(() => {
      const storedApiKey = getStoredValue("sm_api_key");
      const storedApiSecret = getStoredValue("sm_api_secret");
      const storedAccessToken = getStoredValue("sm_access_token");
      const storedAccessTokenSecret = getStoredValue("sm_access_token_secret");

      setCredentialsState({
        apiKey: storedApiKey,
        apiSecret: storedApiSecret,
        accessToken: storedAccessToken,
        accessTokenSecret: storedAccessTokenSecret,
      });

      if (storedAccessToken && storedAccessToken !== "undefined" && storedAccessToken !== "null") {
        checkAuth({
          apiKey: storedApiKey,
          apiSecret: storedApiSecret,
          accessToken: storedAccessToken,
          accessTokenSecret: storedAccessTokenSecret,
        });
      } else {
        setIsLoading(false);
      }
    });

    // postMessage listener (OAuth popup success)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "OAUTH_AUTH_SUCCESS") return;
      const { accessToken, accessTokenSecret } = event.data;
      if (!accessToken || !accessTokenSecret) {
        toast.error("Connection failed: missing tokens");
        return;
      }
      setStoredValue("sm_access_token", accessToken);
      setStoredValue("sm_access_token_secret", accessTokenSecret);
      setCredentials({ accessToken, accessTokenSecret });
      checkAuth({
        accessToken,
        accessTokenSecret,
        apiKey: getStoredValue("sm_api_key"),
        apiSecret: getStoredValue("sm_api_secret"),
      });
      toast.success("Successfully connected to SmugMug");
    };

    // localStorage poll fallback (for when postMessage is blocked by iframe)
    const pollInterval = setInterval(() => {
      try {
        const raw = localStorage.getItem("sm_oauth_result");
        if (!raw) return;
        const result = JSON.parse(raw);
        if (result.type === "OAUTH_AUTH_SUCCESS" && Date.now() - result.timestamp < 60000) {
          localStorage.removeItem("sm_oauth_result");
          const { accessToken, accessTokenSecret } = result;
          if (accessToken && accessTokenSecret) {
            setStoredValue("sm_access_token", accessToken);
            setStoredValue("sm_access_token_secret", accessTokenSecret);
            setCredentials({ accessToken, accessTokenSecret });
            checkAuth({ accessToken, accessTokenSecret });
            toast.success("Successfully connected to SmugMug");
          }
        }
      } catch {
        // ignore parse errors
      }
    }, 2000);

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(pollInterval);
    };
  }, [checkAuth]);

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

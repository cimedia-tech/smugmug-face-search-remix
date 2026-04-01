/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  Search, 
  Upload, 
  Image as ImageIcon, 
  User, 
  LogOut, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  ShieldCheck,
  ScanFace,
  Settings as SettingsIcon,
  Key
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Toaster, toast } from "sonner";
import { cn } from "@/src/lib/utils";
import { smugmug, SmugMugUser, SmugMugGallery, SmugMugImage } from "@/src/services/smugmug";
import { gemini, FaceMatchResult } from "@/src/services/gemini";

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = "primary", 
  isLoading = false, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline", isLoading?: boolean }) => {
  const variants = {
    primary: "bg-white text-black hover:bg-white/90",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700",
    outline: "border border-zinc-700 text-white hover:bg-zinc-800"
  };

  return (
    <button 
      className={cn(
        "relative flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6", className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SmugMugUser | null>(null);
  const [galleries, setGalleries] = useState<SmugMugGallery[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<SmugMugGallery | null>(null);
  const [images, setImages] = useState<SmugMugImage[]>([]);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FaceMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessTokenSecret, setAccessTokenSecret] = useState("");

  // --- Storage Helpers ---
  const getStoredValue = (name: string) => {
    // Try cookie first, then localStorage
    const cookieValue = `; ${document.cookie}`.split(`; ${name}=`).pop()?.split(';').shift();
    if (cookieValue) return cookieValue;
    return localStorage.getItem(name) || "";
  };

  const setStoredValue = (name: string, value: string) => {
    // Set cookie
    document.cookie = `${name}=${value}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=None; Secure`;
    // Set localStorage as fallback for iframes
    localStorage.setItem(name, value);
  };

  const checkAuth = useCallback(async (overrideCreds?: { accessToken: string; accessTokenSecret: string; apiKey?: string; apiSecret?: string }) => {
    const currentApiKey = overrideCreds?.apiKey || apiKey || getStoredValue("sm_api_key");
    const currentApiSecret = overrideCreds?.apiSecret || apiSecret || getStoredValue("sm_api_secret");
    const currentAccessToken = overrideCreds?.accessToken || accessToken || getStoredValue("sm_access_token");
    const currentAccessTokenSecret = overrideCreds?.accessTokenSecret || accessTokenSecret || getStoredValue("sm_access_token_secret");

    console.log("Checking Auth with:", { 
      hasApiKey: !!currentApiKey, 
      hasAccessToken: !!currentAccessToken,
      isOverride: !!overrideCreds
    });

    if (!currentAccessToken || currentAccessToken === "undefined" || currentAccessToken === "null") {
      console.log("No valid access token found, staying on landing page.");
      setIsLoading(false);
      setIsAuthenticated(false);
      return;
    }

    if (!currentApiKey || !currentApiSecret) {
      console.log("Missing API Key or Secret, cannot authenticate.");
      setIsLoading(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      const creds = {
        apiKey: currentApiKey,
        apiSecret: currentApiSecret,
        accessToken: currentAccessToken,
        accessTokenSecret: currentAccessTokenSecret
      };
      
      console.log("Fetching user data with credentials...");
      const userData = await smugmug.getUser(creds);
      
      if (!userData || !userData.NickName) {
        console.error("Invalid user data received:", userData);
        throw new Error("Invalid user data received from SmugMug. Please check your API credentials.");
      }
      
      console.log("User authenticated successfully:", userData.NickName);
      setUser(userData);
      setIsAuthenticated(true);
      setIsLoading(false); // Advance to next screen immediately
      
      // Persist tokens if they were overrides
      if (overrideCreds) {
        setStoredValue("sm_access_token", currentAccessToken);
        setStoredValue("sm_access_token_secret", currentAccessTokenSecret);
        setAccessToken(currentAccessToken);
        setAccessTokenSecret(currentAccessTokenSecret);
      }
      
      // Fetch galleries in the background
      try {
        if (userData.Galleries) {
          console.log(`Using ${userData.Galleries.length} expanded galleries`);
          setGalleries(userData.Galleries);
        } else {
          console.log("Fetching galleries for:", userData.NickName);
          const galleriesUri = userData.Uris?.Galleries?.Uri || (userData.Uri ? `${userData.Uri}!galleries` : userData.NickName);
          const galleryData = await smugmug.getGalleries(galleriesUri, creds);
          console.log(`Found ${galleryData?.length || 0} galleries`);
          setGalleries(galleryData || []);
        }
      } catch (galleryError: any) {
        console.error("Failed to fetch galleries:", galleryError);
        const galleryMsg = galleryError.response?.data?.Message || galleryError.message || "Failed to load galleries";
        toast.error(`Connected, but failed to load galleries: ${galleryMsg}`);
      }
    } catch (error: any) {
      console.error("Auth Check Failed:", error);
      const errorMsg = error.response?.data?.Message || error.message || "Authentication failed";
      
      // Only reset auth if it's a clear auth or routing error
      if (error.response?.status === 401 || error.response?.status === 404) {
        toast.error("SmugMug session expired or route not found. Please reconnect.");
        setAccessToken("");
        setAccessTokenSecret("");
        localStorage.removeItem("sm_access_token");
        localStorage.removeItem("sm_access_token_secret");
        setIsAuthenticated(false);
      } else {
        toast.error(`Connection error: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, apiSecret, accessToken, accessTokenSecret]);

  const saveSettings = () => {
    setIsLoading(true);
    setStoredValue("sm_api_key", apiKey);
    setStoredValue("sm_api_secret", apiSecret);
    setShowSettings(false);
    toast.success("Settings saved successfully");
    checkAuth();
  };

  const hasInitialLoaded = React.useRef(false);

  useEffect(() => {
    if (hasInitialLoaded.current) return;
    hasInitialLoaded.current = true;

    const storedApiKey = getStoredValue("sm_api_key");
    const storedApiSecret = getStoredValue("sm_api_secret");
    const storedAccessToken = getStoredValue("sm_access_token");
    const storedAccessTokenSecret = getStoredValue("sm_access_token_secret");

    setApiKey(storedApiKey);
    setApiSecret(storedApiSecret);
    setAccessToken(storedAccessToken);
    setAccessTokenSecret(storedAccessTokenSecret);
    
    // Initial auth check to restore session
    if (storedAccessToken && storedAccessToken !== "undefined" && storedAccessToken !== "null") {
      console.log("Restoring session with stored token...");
      checkAuth({ 
        accessToken: storedAccessToken, 
        accessTokenSecret: storedAccessTokenSecret,
        apiKey: storedApiKey,
        apiSecret: storedApiSecret
      });
    } else {
      console.log("No stored session found.");
      setIsLoading(false);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { accessToken: newAccessToken, accessTokenSecret: newAccessTokenSecret } = event.data;
        console.log("OAuth Success Message Received", { hasToken: !!newAccessToken });
        
        if (newAccessToken && newAccessTokenSecret) {
          setAccessToken(newAccessToken);
          setAccessTokenSecret(newAccessTokenSecret);
          setStoredValue("sm_access_token", newAccessToken);
          setStoredValue("sm_access_token_secret", newAccessTokenSecret);
          
          // Pass tokens directly to avoid race condition with state updates
          checkAuth({ 
            accessToken: newAccessToken, 
            accessTokenSecret: newAccessTokenSecret,
            apiKey: apiKey || getStoredValue("sm_api_key"),
            apiSecret: apiSecret || getStoredValue("sm_api_secret")
          });
          toast.success("Successfully connected to SmugMug");
        } else {
          console.error("OAuth success message missing tokens");
          toast.error("Connection failed: Missing tokens from SmugMug");
        }
      }
    };

    // Fallback: poll localStorage for OAuth result in case postMessage fails
    const pollInterval = setInterval(() => {
      try {
        const storedResult = localStorage.getItem('sm_oauth_result');
        if (storedResult) {
          const result = JSON.parse(storedResult);
          // Only process if it's a recent result (within 1 minute)
          if (result.type === 'OAUTH_AUTH_SUCCESS' && Date.now() - result.timestamp < 60000) {
            console.log("OAuth Success from localStorage fallback");
            localStorage.removeItem('sm_oauth_result');
            
            const { accessToken: newAccessToken, accessTokenSecret: newAccessTokenSecret } = result;
            if (newAccessToken && newAccessTokenSecret) {
              setAccessToken(newAccessToken);
              setAccessTokenSecret(newAccessTokenSecret);
              setStoredValue("sm_access_token", newAccessToken);
              setStoredValue("sm_access_token_secret", newAccessTokenSecret);
              checkAuth({ accessToken: newAccessToken, accessTokenSecret: newAccessTokenSecret });
              toast.success("Successfully connected to SmugMug");
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }, 2000);

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(pollInterval);
    };
  }, [checkAuth]);

  const handleConnect = async () => {
    const currentApiKey = apiKey || getStoredValue("sm_api_key");
    const currentApiSecret = apiSecret || getStoredValue("sm_api_secret");

    if (!currentApiKey || !currentApiSecret) {
      toast.error("Please enter your SmugMug API Key and Secret first.");
      setShowSettings(true);
      return;
    }

    // Save keys to storage so they persist
    setStoredValue("sm_api_key", currentApiKey);
    setStoredValue("sm_api_secret", currentApiSecret);
    setApiKey(currentApiKey);
    setApiSecret(currentApiSecret);

    setIsLoading(true);
    try {
      // Send keys in body to bypass potential cookie blocking in iframes
      const response = await fetch('/api/auth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: currentApiKey, apiSecret: currentApiSecret }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        let errorMsg = data.error || "Failed to initiate connection";
        toast.error(errorMsg);
        if (data.details) {
          console.error("OAuth Details:", data.details);
          // If it's a configuration error, show settings
          if (response.status === 400) setShowSettings(true);
        }
        return;
      }
      
      window.open(data.url, 'smugmug_oauth', 'width=600,height=700');
    } catch (error) {
      toast.error("Failed to initiate connection");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Search Logic ---

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const handleSearch = async () => {
    if (!referenceImage || !selectedGallery) return;

    setIsSearching(true);
    setResults([]);
    
    try {
      const creds = { apiKey, apiSecret, accessToken, accessTokenSecret };
      const imagesUri = selectedGallery.Uris?.GalleryImages?.Uri || selectedGallery.Uri;
      const galleryImages = await smugmug.getGalleryImages(imagesUri, creds);
      setImages(galleryImages);

      // Process in batches of 5 for Gemini
      const batchSize = 5;
      const allResults: FaceMatchResult[] = [];

      for (let i = 0; i < galleryImages.length; i += batchSize) {
        const batch = galleryImages.slice(i, i + batchSize);
        
        // Convert gallery images to base64 (proxying through server to avoid CORS)
        const candidateImages = await Promise.all(batch.map(async (img) => {
          // We need to fetch the image as base64. 
          // For simplicity in this demo, we'll assume the server can handle this or we use a proxy.
          // Actually, SmugMug images are public if the gallery is public, but we should proxy.
          const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(img.LargeImageUrl)}`);
          const blob = await res.blob();
          return new Promise<{ id: string, base64: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ id: img.Uri, base64: reader.result as string });
            reader.readAsDataURL(blob);
          });
        }));

        const batchResults = await gemini.compareFaces(referenceImage, candidateImages);
        allResults.push(...batchResults);
        setResults([...allResults]); // Update UI incrementally
      }

      const matches = allResults.filter(r => r.isMatch).length;
      toast.success(`Search complete. Found ${matches} potential matches.`);
    } catch (error) {
      console.error(error);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // --- Render Helpers ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Toaster position="top-center" theme="dark" />
      
      {!isAuthenticated ? (
        <div className="overflow-hidden">
          {/* Header for Landing Page */}
          <header className="relative z-50 h-20 flex items-center justify-end px-6 max-w-7xl mx-auto w-full">
            <button 
              onClick={() => setShowSettings(true)} 
              className="p-3 rounded-full bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 transition-all group"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </button>
          </header>

          {/* Background Atmosphere */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-800/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-700/10 rounded-full blur-[120px]" />
          </div>

          <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-8">
                <ShieldCheck className="w-3 h-3 text-zinc-500" />
                AI-POWERED FACIAL RECOGNITION
              </div>
              
              <h1 className="text-6xl md:text-8xl font-light tracking-tight mb-8 leading-[0.9]">
                Search your <span className="italic serif">memories</span> <br />
                with precision.
              </h1>
              
              <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light">
                Connect your SmugMug account to instantly find specific faces across thousands of photos using advanced neural networks.
              </p>

              <div className="flex flex-col gap-4">
                <Button onClick={handleConnect} className="text-lg px-10 py-4">
                  Connect SmugMug
                  <ChevronRight className="w-5 h-5" />
                </Button>
                
                {getStoredValue("sm_access_token") && (
                  <button 
                    onClick={() => checkAuth()}
                    className="text-zinc-500 hover:text-white text-sm transition-colors"
                  >
                    Already connected? Click here to refresh.
                  </button>
                )}
              </div>

              {/* Setup Instructions */}
              <div className="mt-16 max-w-xl mx-auto text-left bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  Setup Required
                </h3>
                <ol className="space-y-4 text-sm text-zinc-500 font-light list-decimal list-inside">
                  <li>
                    Go to the <a href="https://api.smugmug.com/api/developer/apply" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">SmugMug Developer Dashboard</a>.
                  </li>
                  <li>
                    Click the <strong>Settings</strong> button below or the gear icon in the top right and enter your <strong>API Key</strong> and <strong>Secret</strong>.
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => setShowSettings(true)} className="text-xs py-2 h-auto">
                        <SettingsIcon className="w-3 h-3 mr-2" />
                        Open Settings
                      </Button>
                    </div>
                  </li>
                  <li>
                    Ensure your SmugMug App has the following <strong>Callback URL</strong> registered:
                    <div className="mt-2 p-3 bg-black rounded-xl font-mono text-[10px] text-zinc-400 break-all border border-zinc-800">
                      {window.location.origin}/auth/callback
                    </div>
                  </li>
                </ol>
              </div>
            </motion.div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full">
              {[
                { icon: ScanFace, title: "Face Analysis", desc: "Upload a reference photo to start searching." },
                { icon: ShieldCheck, title: "Private & Secure", desc: "Your data never leaves the secure cloud environment." },
                { icon: Search, title: "Deep Search", desc: "Scans every gallery and image with pixel-perfect accuracy." }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <Card className="h-full text-left group hover:border-zinc-700 transition-colors">
                    <feature.icon className="w-8 h-8 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
                    <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
                    <p className="text-zinc-500 font-light">{feature.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </main>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <ScanFace className="w-6 h-6 text-black" />
                </div>
                <span className="font-medium tracking-tight text-xl">SmugMug Search</span>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-3 text-sm text-zinc-400">
                  <User className="w-4 h-4" />
                  {user?.RealName || user?.NickName}
                </div>
                <button 
                  onClick={() => setShowSettings(true)} 
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                  title="Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-zinc-500" />
                </button>
                <button 
                  onClick={() => {
                    setAccessToken("");
                    setAccessTokenSecret("");
                    localStorage.removeItem("sm_access_token");
                    localStorage.removeItem("sm_access_token_secret");
                    setIsAuthenticated(false);
                  }} 
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Sidebar: Controls */}
              <div className="lg:col-span-4 space-y-8">
                <section>
                  <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">1. Target Face</h2>
                  <div 
                    {...getRootProps()} 
                    className={cn(
                      "relative aspect-square rounded-3xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group",
                      isDragActive ? "border-white bg-zinc-900" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30",
                      referenceImage ? "border-none" : ""
                    )}
                  >
                    <input {...getInputProps()} />
                    {referenceImage ? (
                      <>
                        <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-8 h-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        <Camera className="w-10 h-10 text-zinc-600 mb-4" />
                        <p className="text-zinc-500 text-sm">Drag & drop or click to upload target face</p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">2. Select Gallery</h2>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {galleries.map((gallery) => (
                      <button
                        key={gallery.Uri}
                        onClick={() => setSelectedGallery(gallery)}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                          selectedGallery?.Uri === gallery.Uri 
                            ? "bg-white text-black border-white" 
                            : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <ImageIcon className={cn("w-4 h-4", selectedGallery?.Uri === gallery.Uri ? "text-black" : "text-zinc-600")} />
                          <span className="font-medium truncate max-w-[200px]">{gallery.Name}</span>
                        </div>
                        <ChevronRight className={cn("w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity", selectedGallery?.Uri === gallery.Uri ? "text-black opacity-100" : "")} />
                      </button>
                    ))}
                  </div>
                </section>

                <Button 
                  onClick={handleSearch} 
                  className="w-full py-4 text-lg"
                  isLoading={isSearching}
                  disabled={!referenceImage || !selectedGallery || isSearching}
                >
                  Start Search
                </Button>
              </div>

              {/* Main Content: Results */}
              <div className="lg:col-span-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-light tracking-tight">
                    {isSearching ? "Searching..." : results.length > 0 ? "Search Results" : "Select a gallery to begin"}
                  </h2>
                  {results.length > 0 && (
                    <div className="text-sm text-zinc-500">
                      Found {results.filter(r => r.isMatch).length} matches in {results.length} photos
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {images.map((img) => {
                      const result = results.find(r => r.imageId === img.Uri);
                      if (results.length > 0 && !result?.isMatch && !isSearching) return null;

                      return (
                        <motion.div
                          layout
                          key={img.Uri}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group"
                        >
                          <img 
                            src={img.ThumbnailUrl} 
                            alt={img.FileName} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          
                          {result && (
                            <div className={cn(
                              "absolute top-3 right-3 p-1.5 rounded-full backdrop-blur-md",
                              result.isMatch ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                            )}>
                              {result.isMatch ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <p className="text-xs text-zinc-300 truncate mb-2">{img.FileName}</p>
                            <a 
                              href={img.WebUri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] uppercase tracking-widest font-bold text-white hover:underline"
                            >
                              View on SmugMug
                            </a>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {images.length === 0 && !isSearching && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center text-zinc-600">
                      <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                      <p className="max-w-xs">Select a gallery and upload a face to start your search.</p>
                    </div>
                  )}

                  {isSearching && results.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
                      <Loader2 className="w-12 h-12 text-zinc-700 animate-spin mb-4" />
                      <p className="text-zinc-500">Analyzing gallery images...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-medium">SmugMug Settings</h3>
                  <p className="text-xs text-zinc-500">Manage your API credentials</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">API Key</label>
                  <input 
                    type="text" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your SmugMug API Key"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-white transition-colors outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">API Secret</label>
                  <input 
                    type="password" 
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter your SmugMug API Secret"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-white transition-colors outline-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowSettings(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={saveSettings} className="flex-1">
                    Save Settings
                  </Button>
                </div>
                
                {isAuthenticated && (
                  <Button 
                    variant="outline" 
                    className="w-full text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/50"
                    onClick={() => {
                      setAccessToken("");
                      setAccessTokenSecret("");
                      localStorage.removeItem("sm_access_token");
                      localStorage.removeItem("sm_access_token_secret");
                      setIsAuthenticated(false);
                      setShowSettings(false);
                      toast.success("Disconnected from SmugMug");
                    }}
                  >
                    Disconnect Account
                  </Button>
                )}
              </div>
              
              <p className="mt-6 text-[10px] text-zinc-600 text-center">
                These keys are stored locally in your browser. You can also set <code>SMUGMUG_API_KEY</code> and <code>SMUGMUG_API_SECRET</code> in the AI Studio environment variables.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}

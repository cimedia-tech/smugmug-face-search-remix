/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Loader2, User, LogOut, ScanFace, Settings as SettingsIcon } from "lucide-react";
import { Toaster } from "sonner";

import { useFirebaseAuth } from "@/src/hooks/useFirebaseAuth";
import { useAuth } from "@/src/hooks/useAuth";
import { useGalleries } from "@/src/hooks/useGalleries";
import { useSearch } from "@/src/hooks/useSearch";
import { useSearchHistory } from "@/src/hooks/useSearchHistory";

import { SignInScreen } from "@/src/components/SignInScreen";
import { ConnectScreen } from "@/src/components/ConnectScreen";
import { SettingsModal } from "@/src/components/SettingsModal";
import { GalleryPicker } from "@/src/components/GalleryPicker";
import { FaceUploader } from "@/src/components/FaceUploader";
import { SearchResults } from "@/src/components/SearchResults";
import { SearchHistory } from "@/src/components/SearchHistory";
import { Button } from "@/src/components/ui/Button";
import type { SearchRecord } from "@/src/hooks/useSearchHistory";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Layer 1: Firebase (who are you?)
  const { firebaseUser, isFirebaseLoading, signInWithGoogle, signOutFirebase } = useFirebaseAuth();

  // Layer 2: SmugMug (are you connected?)
  const auth = useAuth(firebaseUser);

  // Layer 3: App state
  const { selectedGallery, setSelectedGallery } = useGalleries();
  const search = useSearch();
  const { history, saveSearch, deleteSearch } = useSearchHistory(firebaseUser);

  // --- Loading: waiting for Firebase to restore session ---
  if (isFirebaseLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // --- Not signed in: show Google sign-in ---
  if (!firebaseUser) {
    return (
      <>
        <Toaster position="top-center" theme="dark" />
        <SignInScreen onSignIn={signInWithGoogle} />
      </>
    );
  }

  // --- Signed in but SmugMug not connected ---
  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const handleRerun = (record: SearchRecord) => {
    const gallery = auth.galleries.find((g) => g.Uri === record.galleryUri);
    if (!gallery) return;
    setSelectedGallery(gallery);
    search.setReferenceImage(record.referenceThumbnail);
    search.handleSearch(gallery, auth.credentials);
  };

  const handleSearchComplete = async () => {
    if (!selectedGallery || !search.referenceImage) return;
    await saveSearch({
      galleryName: selectedGallery.Name,
      galleryUri: selectedGallery.Uri,
      referenceThumbnail: search.referenceImage,
      matchCount: search.results.filter((r) => r.isMatch).length,
      totalScanned: search.results.length,
    });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Toaster position="top-center" theme="dark" />

      {!auth.isAuthenticated ? (
        <ConnectScreen
          isLoading={auth.isLoading}
          hasStoredToken={!!auth.credentials.accessToken}
          onConnect={auth.handleConnect}
          onRefresh={() => auth.checkAuth()}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <>
          <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <ScanFace className="w-6 h-6 text-black" />
                </div>
                <span className="font-medium tracking-tight text-xl">SmugMug Search</span>
              </div>

              <div className="flex items-center gap-4">
                {/* Firebase user avatar */}
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={firebaseUser.displayName ?? ""}
                    className="w-8 h-8 rounded-full hidden md:block"
                  />
                ) : (
                  <div className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
                    <User className="w-4 h-4" />
                    {auth.user?.RealName || auth.user?.NickName}
                  </div>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                  title="Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-zinc-500" />
                </button>
                <button
                  onClick={signOutFirebase}
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Sidebar */}
              <div className="lg:col-span-4 space-y-8">
                <FaceUploader
                  referenceImage={search.referenceImage}
                  onImageSelected={search.setReferenceImage}
                />

                <GalleryPicker
                  galleries={auth.galleries}
                  selectedGallery={selectedGallery}
                  onSelect={setSelectedGallery}
                />

                <Button
                  onClick={async () => {
                    await search.handleSearch(selectedGallery!, auth.credentials);
                    await handleSearchComplete();
                  }}
                  className="w-full py-4 text-lg"
                  isLoading={search.isSearching}
                  disabled={!search.referenceImage || !selectedGallery || search.isSearching}
                >
                  Start Search
                </Button>

                <SearchHistory
                  history={history}
                  galleries={auth.galleries}
                  onRerun={handleRerun}
                  onDelete={deleteSearch}
                />
              </div>

              {/* Results */}
              <SearchResults
                images={search.images}
                results={search.results}
                isSearching={search.isSearching}
                progress={search.progress}
              />
            </div>
          </main>
        </>
      )}

      <SettingsModal
        open={showSettings}
        credentials={auth.credentials}
        isAuthenticated={auth.isAuthenticated}
        onChange={auth.setCredentials}
        onSave={() => { auth.saveSettings(); setShowSettings(false); }}
        onClose={() => setShowSettings(false)}
        onDisconnect={() => { auth.handleDisconnect(); setShowSettings(false); }}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </div>
  );
}

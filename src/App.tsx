/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Loader2, User, LogOut, ScanFace, Settings as SettingsIcon } from "lucide-react";
import { Toaster } from "sonner";

import { useAuth, getStoredValue } from "@/src/hooks/useAuth";
import { useGalleries } from "@/src/hooks/useGalleries";
import { useSearch } from "@/src/hooks/useSearch";

import { ConnectScreen } from "@/src/components/ConnectScreen";
import { SettingsModal } from "@/src/components/SettingsModal";
import { GalleryPicker } from "@/src/components/GalleryPicker";
import { FaceUploader } from "@/src/components/FaceUploader";
import { SearchResults } from "@/src/components/SearchResults";
import { Button } from "@/src/components/ui/Button";

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  const auth = useAuth();
  const { selectedGallery, setSelectedGallery } = useGalleries();
  const search = useSearch();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Toaster position="top-center" theme="dark" />

      {!auth.isAuthenticated ? (
        <ConnectScreen
          isLoading={auth.isLoading}
          hasStoredToken={!!getStoredValue("sm_access_token")}
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

              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-3 text-sm text-zinc-400">
                  <User className="w-4 h-4" />
                  {auth.user?.RealName || auth.user?.NickName}
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                  title="Settings"
                >
                  <SettingsIcon className="w-5 h-5 text-zinc-500" />
                </button>
                <button
                  onClick={auth.handleDisconnect}
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
                  onClick={() => search.handleSearch(selectedGallery!, auth.credentials)}
                  className="w-full py-4 text-lg"
                  isLoading={search.isSearching}
                  disabled={!search.referenceImage || !selectedGallery || search.isSearching}
                >
                  Start Search
                </Button>
              </div>

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

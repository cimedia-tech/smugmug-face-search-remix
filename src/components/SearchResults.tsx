import React from "react";
import { AnimatePresence } from "motion/react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { MatchCard } from "@/src/components/MatchCard";
import type { SmugMugImage, FaceMatchResult } from "@/src/types";

interface SearchResultsProps {
  images: SmugMugImage[];
  results: FaceMatchResult[];
  isSearching: boolean;
  progress: { current: number; total: number };
}

export const SearchResults = ({ images, results, isSearching, progress }: SearchResultsProps) => {
  const matchCount = results.filter((r) => r.isMatch).length;
  const hasResults = results.length > 0;

  const heading = isSearching
    ? progress.total > 0
      ? `Scanning batch ${progress.current} of ${progress.total}…`
      : "Searching…"
    : hasResults
    ? "Search Results"
    : "Select a gallery to begin";

  return (
    <div className="lg:col-span-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-light tracking-tight">{heading}</h2>
        {hasResults && (
          <div className="text-sm text-zinc-500">
            {matchCount} match{matchCount !== 1 ? "es" : ""} in {results.length} photos
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {images.map((img) => {
            const result = results.find((r) => r.imageId === img.Uri);
            // While searching: show all loaded images. After search: show only matches.
            if (hasResults && !isSearching && !result?.isMatch) return null;
            return <MatchCard key={img.Uri} image={img} result={result} />;
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
            <p className="text-zinc-500">Analyzing gallery images…</p>
          </div>
        )}
      </div>
    </div>
  );
};

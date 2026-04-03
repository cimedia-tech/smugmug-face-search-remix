import React, { useState } from "react";
import { Image as ImageIcon, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { SmugMugGallery } from "@/src/types";

interface GalleryPickerProps {
  galleries: SmugMugGallery[];
  selectedGallery: SmugMugGallery | null;
  onSelect: (gallery: SmugMugGallery) => void;
}

export const GalleryPicker = ({ galleries, selectedGallery, onSelect }: GalleryPickerProps) => {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? galleries.filter((g) => g.Name.toLowerCase().includes(filter.toLowerCase()))
    : galleries;

  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">2. Select Gallery</h2>

      {galleries.length > 8 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter galleries..."
          className="w-full mb-3 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:border-zinc-600 outline-none transition-colors"
        />
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {filtered.map((gallery) => {
          const isSelected = selectedGallery?.Uri === gallery.Uri;
          return (
            <button
              key={gallery.Uri}
              onClick={() => onSelect(gallery)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                isSelected
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-3">
                <ImageIcon className={cn("w-4 h-4", isSelected ? "text-black" : "text-zinc-600")} />
                <span className="font-medium truncate max-w-[200px]">{gallery.Name}</span>
              </div>
              <ChevronRight
                className={cn(
                  "w-4 h-4 transition-opacity",
                  isSelected ? "text-black opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              />
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">No galleries match "{filter}"</p>
        )}
      </div>
    </section>
  );
};

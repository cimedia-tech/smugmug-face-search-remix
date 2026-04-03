import React from "react";
import { History, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { SearchRecord } from "@/src/hooks/useSearchHistory";
import type { SmugMugGallery } from "@/src/types";

interface SearchHistoryProps {
  history: SearchRecord[];
  galleries: SmugMugGallery[];
  onRerun: (record: SearchRecord) => void;
  onDelete: (id: string) => void;
}

export const SearchHistory = ({ history, galleries, onRerun, onDelete }: SearchHistoryProps) => {
  if (history.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <History className="w-4 h-4" />
        Past Searches
      </h2>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
        {history.map((record) => {
          const gallery = galleries.find((g) => g.Uri === record.galleryUri);
          const date = record.createdAt
            ? new Date(record.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "Just now";

          return (
            <div
              key={record.id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800 group"
            >
              {/* Reference thumbnail */}
              <img
                src={record.referenceThumbnail}
                alt="Reference"
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{record.galleryName}</p>
                <p className="text-xs text-zinc-500">
                  {record.matchCount} match{record.matchCount !== 1 ? "es" : ""} · {date}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onRerun(record)}
                  disabled={!gallery}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    gallery
                      ? "hover:bg-zinc-700 text-zinc-400 hover:text-white"
                      : "text-zinc-700 cursor-not-allowed"
                  )}
                  title={gallery ? "Re-run this search" : "Gallery no longer available"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(record.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { SmugMugImage, FaceMatchResult } from "@/src/types";

interface MatchCardProps {
  image: SmugMugImage;
  result?: FaceMatchResult;
}

export const MatchCard = ({ image, result }: MatchCardProps) => (
  <motion.div
    layout
    key={image.Uri}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group"
  >
    <img
      src={image.ThumbnailUrl}
      alt={image.FileName}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      referrerPolicy="no-referrer"
    />

    {result && (
      <div
        className={cn(
          "absolute top-3 right-3 p-1.5 rounded-full backdrop-blur-md",
          result.isMatch ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}
        title={result.reasoning}
      >
        {result.isMatch ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      </div>
    )}

    {result?.isMatch && (
      <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-green-400 font-medium">
        {Math.round(result.confidence * 100)}% match
      </div>
    )}

    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
      <p className="text-xs text-zinc-300 truncate mb-2">{image.FileName}</p>
      <a
        href={image.WebUri}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] uppercase tracking-widest font-bold text-white hover:underline"
      >
        View on SmugMug
      </a>
    </div>
  </motion.div>
);

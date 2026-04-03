import { useState, useCallback } from "react";
import { toast } from "sonner";
import { smugmug } from "@/src/services/smugmug";
import { gemini } from "@/src/services/gemini";
import type { SmugMugGallery, SmugMugImage, SmugMugCredentials, FaceMatchResult } from "@/src/types";

export interface SearchState {
  referenceImage: string | null;
  setReferenceImage: (img: string | null) => void;
  isSearching: boolean;
  results: FaceMatchResult[];
  images: SmugMugImage[];
  progress: { current: number; total: number };
  handleSearch: (gallery: SmugMugGallery, credentials: SmugMugCredentials) => Promise<void>;
  resetSearch: () => void;
}

const BATCH_SIZE = 5;

async function imageToBase64(url: string): Promise<string> {
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export function useSearch(): SearchState {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FaceMatchResult[]>([]);
  const [images, setImages] = useState<SmugMugImage[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const resetSearch = () => {
    setResults([]);
    setImages([]);
    setProgress({ current: 0, total: 0 });
  };

  const handleSearch = useCallback(
    async (gallery: SmugMugGallery, credentials: SmugMugCredentials) => {
      if (!referenceImage) return;

      setIsSearching(true);
      resetSearch();

      try {
        const imagesUri = gallery.Uris?.GalleryImages?.Uri || gallery.Uri;
        const galleryImages = await smugmug.getGalleryImages(imagesUri, credentials);
        setImages(galleryImages);

        const totalBatches = Math.ceil(galleryImages.length / BATCH_SIZE);
        setProgress({ current: 0, total: totalBatches });

        const allResults: FaceMatchResult[] = [];

        for (let i = 0; i < galleryImages.length; i += BATCH_SIZE) {
          const batch = galleryImages.slice(i, i + BATCH_SIZE);

          const candidateImages = await Promise.all(
            batch.map(async (img) => ({
              id: img.Uri,
              base64: await imageToBase64(img.LargeImageUrl),
            }))
          );

          const batchResults = await gemini.compareFaces(referenceImage, candidateImages);
          allResults.push(...batchResults);
          setResults([...allResults]);

          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          setProgress({ current: batchNumber, total: totalBatches });
        }

        const matchCount = allResults.filter((r) => r.isMatch).length;
        toast.success(`Search complete — ${matchCount} match${matchCount !== 1 ? "es" : ""} found.`);
      } catch (error) {
        console.error(error);
        toast.error("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
      }
    },
    [referenceImage]
  );

  return {
    referenceImage,
    setReferenceImage,
    isSearching,
    results,
    images,
    progress,
    handleSearch,
    resetSearch,
  };
}

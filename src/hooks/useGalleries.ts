import { useState } from "react";
import type { SmugMugGallery } from "@/src/types";

export interface GalleriesState {
  selectedGallery: SmugMugGallery | null;
  setSelectedGallery: (gallery: SmugMugGallery | null) => void;
}

export function useGalleries(): GalleriesState {
  const [selectedGallery, setSelectedGallery] = useState<SmugMugGallery | null>(null);

  return {
    selectedGallery,
    setSelectedGallery,
  };
}

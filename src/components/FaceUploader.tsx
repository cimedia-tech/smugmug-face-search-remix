import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, Upload } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface FaceUploaderProps {
  referenceImage: string | null;
  onImageSelected: (base64: string) => void;
}

export const FaceUploader = ({ referenceImage, onImageSelected }: FaceUploaderProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onImageSelected(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  } as any);

  return (
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
            <img src={referenceImage} alt="Reference face" className="w-full h-full object-cover" />
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
  );
};

import React from "react";
import { cn } from "@/src/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className }: CardProps) => (
  <div className={cn("bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6", className)}>
    {children}
  </div>
);

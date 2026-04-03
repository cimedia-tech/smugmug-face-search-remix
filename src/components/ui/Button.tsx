import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

type Variant = "primary" | "secondary" | "outline";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-white text-black hover:bg-white/90",
  secondary: "bg-zinc-800 text-white hover:bg-zinc-700",
  outline: "border border-zinc-700 text-white hover:bg-zinc-800",
};

export const Button = ({ children, className, variant = "primary", isLoading = false, ...props }: ButtonProps) => (
  <button
    className={cn(
      "relative flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
      variants[variant],
      className
    )}
    disabled={isLoading || props.disabled}
    {...props}
  >
    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
  </button>
);

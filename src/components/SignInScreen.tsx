import React from "react";
import { motion } from "motion/react";
import { ScanFace, ShieldCheck } from "lucide-react";
import { Button } from "@/src/components/ui/Button";

interface SignInScreenProps {
  onSignIn: () => void;
}

export const SignInScreen = ({ onSignIn }: SignInScreenProps) => (
  <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
    {/* Background atmosphere */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-800/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-700/10 rounded-full blur-[120px]" />
    </div>

    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="relative z-10 flex flex-col items-center text-center max-w-sm"
    >
      {/* Logo */}
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-8">
        <ScanFace className="w-9 h-9 text-black" />
      </div>

      <h1 className="text-4xl font-light tracking-tight mb-3">SmugMug Search</h1>
      <p className="text-zinc-500 text-base font-light mb-10">
        AI-powered face search across your SmugMug galleries.
      </p>

      <Button onClick={onSignIn} className="w-full text-base py-4 gap-3">
        <GoogleIcon />
        Continue with Google
      </Button>

      <p className="mt-8 text-xs text-zinc-600 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Your data is private and only accessible to you.
      </p>
    </motion.div>
  </div>
);

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

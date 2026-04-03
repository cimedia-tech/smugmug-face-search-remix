import React from "react";
import { motion } from "motion/react";
import { ChevronRight, ShieldCheck, ScanFace, Search, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";

interface ConnectScreenProps {
  isLoading: boolean;
  hasStoredToken: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

const FEATURES = [
  { icon: ScanFace, title: "Face Analysis", desc: "Upload a reference photo to start searching." },
  { icon: ShieldCheck, title: "Private & Secure", desc: "Your data never leaves the secure cloud environment." },
  { icon: Search, title: "Deep Search", desc: "Scans every gallery and image with pixel-perfect accuracy." },
];

export const ConnectScreen = ({
  isLoading,
  hasStoredToken,
  onConnect,
  onRefresh,
  onOpenSettings,
}: ConnectScreenProps) => (
  <div className="overflow-hidden">
    <header className="relative z-50 h-20 flex items-center justify-end px-6 max-w-7xl mx-auto w-full">
      <button
        onClick={onOpenSettings}
        className="p-3 rounded-full bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 transition-all group"
        title="Settings"
      >
        <SettingsIcon className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
      </button>
    </header>

    {/* Background atmosphere */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-800/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-700/10 rounded-full blur-[120px]" />
    </div>

    <main className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-8">
          <ShieldCheck className="w-3 h-3 text-zinc-500" />
          AI-POWERED FACIAL RECOGNITION
        </div>

        <h1 className="text-6xl md:text-8xl font-light tracking-tight mb-8 leading-[0.9]">
          Search your <span className="italic">memories</span> <br />
          with precision.
        </h1>

        <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light">
          Connect your SmugMug account to instantly find specific faces across thousands of photos using advanced neural
          networks.
        </p>

        <div className="flex flex-col gap-4">
          <Button onClick={onConnect} isLoading={isLoading} className="text-lg px-10 py-4">
            Connect SmugMug
            <ChevronRight className="w-5 h-5" />
          </Button>

          {hasStoredToken && (
            <button onClick={onRefresh} className="text-zinc-500 hover:text-white text-sm transition-colors">
              Already connected? Click here to refresh.
            </button>
          )}
        </div>

        {/* Setup instructions */}
        <div className="mt-16 max-w-xl mx-auto text-left bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Setup Required
          </h3>
          <ol className="space-y-4 text-sm text-zinc-500 font-light list-decimal list-inside">
            <li>
              Go to the{" "}
              <a
                href="https://api.smugmug.com/api/developer/apply"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline"
              >
                SmugMug Developer Dashboard
              </a>
              .
            </li>
            <li>
              Click the <strong>Settings</strong> button and enter your <strong>API Key</strong> and{" "}
              <strong>Secret</strong>.
              <div className="mt-4">
                <Button variant="outline" onClick={onOpenSettings} className="text-xs py-2 h-auto">
                  <SettingsIcon className="w-3 h-3 mr-2" />
                  Open Settings
                </Button>
              </div>
            </li>
            <li>
              Ensure your SmugMug App has this <strong>Callback URL</strong>:
              <div className="mt-2 p-3 bg-black rounded-xl font-mono text-[10px] text-zinc-400 break-all border border-zinc-800">
                {window.location.origin}/auth/callback
              </div>
            </li>
          </ol>
        </div>
      </motion.div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          >
            <Card className="h-full text-left group hover:border-zinc-700 transition-colors">
              <feature.icon className="w-8 h-8 text-zinc-400 mb-4 group-hover:text-white transition-colors" />
              <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
              <p className="text-zinc-500 font-light">{feature.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </main>
  </div>
);

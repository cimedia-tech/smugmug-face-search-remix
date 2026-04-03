import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Key } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import type { SmugMugCredentials } from "@/src/types";

interface SettingsModalProps {
  open: boolean;
  credentials: SmugMugCredentials;
  isAuthenticated: boolean;
  onChange: (partial: Partial<SmugMugCredentials>) => void;
  onSave: () => void;
  onClose: () => void;
  onDisconnect: () => void;
}

export const SettingsModal = ({
  open,
  credentials,
  isAuthenticated,
  onChange,
  onSave,
  onClose,
  onDisconnect,
}: SettingsModalProps) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-medium">SmugMug Settings</h3>
              <p className="text-xs text-zinc-500">Manage your API credentials</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
                API Key
              </label>
              <input
                type="text"
                value={credentials.apiKey}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder="Enter your SmugMug API Key"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-white transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">
                API Secret
              </label>
              <input
                type="password"
                value={credentials.apiSecret}
                onChange={(e) => onChange({ apiSecret: e.target.value })}
                placeholder="Enter your SmugMug API Secret"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-white transition-colors outline-none"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={onSave} className="flex-1">
                Save Settings
              </Button>
            </div>

            {isAuthenticated && (
              <Button
                variant="outline"
                className="w-full text-red-400 hover:text-red-300 border-red-900/40 hover:border-red-700/50"
                onClick={onDisconnect}
              >
                Disconnect Account
              </Button>
            )}
          </div>

          <p className="mt-6 text-[10px] text-zinc-600 text-center">
            These keys are stored locally in your browser. You can also set{" "}
            <code>SMUGMUG_API_KEY</code> and <code>SMUGMUG_API_SECRET</code> as environment variables.
          </p>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

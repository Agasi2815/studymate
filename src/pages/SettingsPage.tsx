import React, { useState } from 'react';
import { Settings, Trash2, Shield, Info, ExternalLink, AlertCircle, Moon, Sun, Save, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface SettingsPageProps {
  customRules: string;
  setCustomRules: (rules: string) => void;
  theme: 'yin' | 'yang';
  setTheme: (theme: 'yin' | 'yang') => void;
  clearData: () => void;
}

export default function SettingsPage({ customRules, setCustomRules, theme, setTheme, clearData }: SettingsPageProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [rules, setRules] = useState(customRules);
  const [isSaving, setIsSaving] = useState(false);

  const handleClear = () => {
    clearData();
    setShowConfirm(false);
    window.location.href = '/';
  };

  const handleSaveRules = async () => {
    setIsSaving(true);
    await setCustomRules(rules);
    setTimeout(() => setIsSaving(false), 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-foreground/5 flex items-center justify-center border border-foreground/10">
          <Settings className="h-5 w-5 text-accent" />
        </div>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Appearance */}
      <section className="glass p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wider">
          <Sparkles className="h-4 w-4" /> Duality
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('yin')}
            className={cn(
              "group relative flex flex-col items-center gap-4 p-8 rounded-3xl border transition-all duration-500 overflow-hidden",
              theme === 'yin' 
                ? "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.2)]" 
                : "bg-black/40 border-white/10 text-white hover:bg-black/60"
            )}
          >
            <div className={cn(
              "h-16 w-16 rounded-full border-2 flex items-center justify-center transition-transform duration-700 group-hover:rotate-180",
              theme === 'yin' ? "border-black" : "border-white"
            )}>
              <div className={cn(
                "h-8 w-8 rounded-full",
                theme === 'yin' ? "bg-black" : "bg-white"
              )} />
            </div>
            <div className="text-center">
              <span className="block font-display text-xl font-black uppercase tracking-tighter">Yin</span>
              <span className="text-[10px] opacity-60 uppercase font-bold tracking-widest">The Passive</span>
            </div>
          </button>
          
          <button
            onClick={() => setTheme('yang')}
            className={cn(
              "group relative flex flex-col items-center gap-4 p-8 rounded-3xl border transition-all duration-500 overflow-hidden",
              theme === 'yang' 
                ? "bg-black text-white border-black shadow-[0_0_30px_rgba(0,0,0,0.4)]" 
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            )}
          >
            <div className={cn(
              "h-16 w-16 rounded-full border-2 flex items-center justify-center transition-transform duration-700 group-hover:rotate-180",
              theme === 'yang' ? "border-white" : "border-white/20"
            )}>
              <div className={cn(
                "h-8 w-8 rounded-full",
                theme === 'yang' ? "bg-white" : "bg-white/20"
              )} />
            </div>
            <div className="text-center">
              <span className="block font-display text-xl font-black uppercase tracking-tighter">Yang</span>
              <span className="text-[10px] opacity-60 uppercase font-bold tracking-widest">The Active</span>
            </div>
          </button>
        </div>
      </section>

      {/* Model Info */}
      <section className="glass p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wider">
          <Shield className="h-4 w-4" /> AI Engine
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">Gemini 3 Flash</h3>
            <p className="text-sm text-muted">High-speed reasoning & planning</p>
          </div>
          <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-bold border border-accent/20">Active</span>
        </div>
      </section>

      {/* Custom Rules */}
      <section className="glass p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wider">
          <Info className="h-4 w-4" /> Custom Rules
        </div>
        <p className="text-sm text-muted">These rules are appended to every AI prompt to customize your experience.</p>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="e.g. 'Explain things like I'm 5', 'Focus on practical examples', 'Use British English'..."
          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl p-4 h-32 focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none text-sm"
        />
        <button
          onClick={handleSaveRules}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <Save className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save AI Rules
        </button>
      </section>

      {/* Setup Guide */}
      <section className="glass p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-muted text-sm font-medium uppercase tracking-wider">
          <ExternalLink className="h-4 w-4" /> Cloud Sync
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted">StudyMate uses Firebase to securely sync your study plans and progress across all your devices.</p>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="glass p-6 rounded-2xl border-red-500/20 space-y-4">
        <div className="flex items-center gap-2 text-red-400 text-sm font-medium uppercase tracking-wider">
          <AlertCircle className="h-4 w-4" /> Danger Zone
        </div>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold">Clear All Data</h3>
            <p className="text-sm text-muted">Reset your study plan and progress.</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass p-8 rounded-3xl max-w-sm w-full space-y-6 border-red-500/30"
          >
            <div className="text-center space-y-2">
              <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold">Are you sure?</h3>
              <p className="text-muted text-sm">This will permanently delete your study plan, progress, and custom rules. This action cannot be undone.</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-foreground/10 font-bold hover:bg-foreground/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-3 rounded-xl bg-red-500 font-bold hover:bg-red-600 transition-all text-white"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

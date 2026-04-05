import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PomodoroTimerProps {
  onComplete: (type: 'focus' | 'short-break' | 'long-break', duration: number) => void;
  currentTopic?: string;
}

const MODES = {
  focus: { label: 'Focus', minutes: 25, color: 'text-accent', bg: 'bg-accent/10', icon: Brain },
  short: { label: 'Short Break', minutes: 5, color: 'text-green-400', bg: 'bg-green-400/10', icon: Coffee },
  long: { label: 'Long Break', minutes: 15, color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Coffee },
};

export default function PomodoroTimer({ onComplete, currentTopic }: PomodoroTimerProps) {
  const [mode, setMode] = useState<keyof typeof MODES>('focus');
  const [timeLeft, setTimeLeft] = useState(MODES.focus.minutes * 60);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const handleComplete = () => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Play sound if possible
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play();
    } catch (e) {
      console.warn("Audio playback failed", e);
    }

    onComplete(mode === 'focus' ? 'focus' : mode === 'short' ? 'short-break' : 'long-break', MODES[mode].minutes);
    
    // Auto-switch modes
    if (mode === 'focus') {
      setMode('short');
      setTimeLeft(MODES.short.minutes * 60);
    } else {
      setMode('focus');
      setTimeLeft(MODES.focus.minutes * 60);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(MODES[mode].minutes * 60);
  };

  const switchMode = (newMode: keyof typeof MODES) => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(MODES[newMode].minutes * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = 1 - timeLeft / (MODES[mode].minutes * 60);
  const CurrentIcon = MODES[mode].icon;

  return (
    <div className="glass p-8 rounded-3xl space-y-8 relative overflow-hidden">
      {/* Background Progress Glow */}
      <div 
        className={cn(
          "absolute inset-0 opacity-5 transition-all duration-1000",
          MODES[mode].bg
        )}
        style={{ clipPath: `inset(${100 - progress * 100}% 0 0 0)` }}
      />

      <div className="flex justify-center gap-2">
        {(Object.keys(MODES) as Array<keyof typeof MODES>).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold transition-all",
              mode === m 
                ? cn(MODES[m].bg, MODES[m].color, "ring-1 ring-inset", MODES[m].color.replace('text-', 'ring-'))
                : "text-muted hover:bg-foreground/5"
            )}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>

      <div className="text-center space-y-4 relative">
        <div className="flex items-center justify-center gap-3 text-muted">
          <CurrentIcon className={cn("h-5 w-5", MODES[mode].color)} />
          <span className="text-sm font-medium uppercase tracking-widest">
            {mode === 'focus' ? (currentTopic || 'Deep Work') : MODES[mode].label}
          </span>
        </div>
        
        <div className="text-8xl font-black tracking-tighter font-mono">
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 relative">
        <button
          onClick={resetTimer}
          className="p-4 rounded-2xl bg-foreground/5 text-muted hover:bg-foreground/10 transition-all"
        >
          <RotateCcw className="h-6 w-6" />
        </button>

        <button
          onClick={toggleTimer}
          className={cn(
            "h-20 w-20 rounded-3xl flex items-center justify-center transition-all shadow-xl active:scale-95",
            isActive ? "bg-foreground/10 text-foreground" : cn(MODES[mode].bg.replace('/10', ''), "text-white")
          )}
        >
          {isActive ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current ml-1" />}
        </button>

        <button
          onClick={handleComplete}
          className="p-4 rounded-2xl bg-foreground/5 text-muted hover:bg-foreground/10 transition-all"
        >
          <CheckCircle2 className="h-6 w-6" />
        </button>
      </div>

      <div className="pt-4 text-center">
        <p className="text-xs text-muted">
          {isActive ? "Stay focused, you're doing great!" : "Ready to start your session?"}
        </p>
      </div>
    </div>
  );
}

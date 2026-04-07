import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#c8f135', '#ffffff', '#000000']
  });
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getDaysRemaining(targetDate: string): { days: number; hours: number } {
  const now = new Date();
  const target = new Date(targetDate);
  
  if (isNaN(target.getTime())) {
    return { days: 0, hours: 0 };
  }
  
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) return { days: 0, hours: 0 };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return { days, hours };
}

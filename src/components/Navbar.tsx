import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen, Calendar, Zap, MessageSquare, Settings, LogOut, User, BarChart3, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';

const navItems = [
  { name: 'Setup', path: '/', icon: BookOpen },
  { name: 'Timetable', path: '/timetable', icon: Calendar },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Panic Mode', path: '/panic', icon: Zap },
  { name: 'AI Tutor', path: '/chat', icon: MessageSquare },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/40 backdrop-blur-xl shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute -inset-1 bg-accent/50 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
                <div className="relative h-10 w-10 rounded-xl bg-background border border-accent/30 flex items-center justify-center shadow-2xl">
                  <Cpu className="h-6 w-6 text-accent animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col -space-y-1">
                <span className="text-xl font-black tracking-tighter uppercase italic">Study<span className="text-accent">You</span></span>
              </div>
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-baseline space-x-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                    location.pathname === item.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="h-6 w-[1px] bg-foreground/10 mx-2" />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full border border-foreground/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center border border-foreground/10">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                )}
                <span className="text-xs font-medium text-muted hidden lg:block">{user.displayName?.split(' ')[0]}</span>
              </div>
              <button 
                onClick={logout}
                className="p-2 text-muted hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-4">
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full border border-foreground/10" referrerPolicy="no-referrer" />
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center p-2 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 focus:outline-none"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-foreground/10 bg-background/60 backdrop-blur-2xl"
          >
            <div className="space-y-1 px-4 pb-6 pt-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium",
                    location.pathname === item.path
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={() => { logout(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

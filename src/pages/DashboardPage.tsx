import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { StudyPlan, UserStats } from '../types';
import { getDaysRemaining } from '../lib/utils';
import { 
  Calendar, Clock, BarChart3, CheckCircle2, TrendingUp, 
  BookOpen, Trophy, Star, ChevronRight, Zap, Target, Award
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface DashboardPageProps {
  studyPlans: StudyPlan[];
  activePlanId: string | null;
  setActivePlanId: (id: string) => void;
  userStats: UserStats;
}

export default function DashboardPage({ studyPlans, activePlanId, setActivePlanId, userStats }: DashboardPageProps) {
  const navigate = useNavigate();
  const studyPlan = studyPlans.find(p => p.id === activePlanId) || null;
  const [countdown, setCountdown] = useState(() => studyPlan ? getDaysRemaining(studyPlan.examDate) : { days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!studyPlan) return;
    setCountdown(getDaysRemaining(studyPlan.examDate));
    const timer = setInterval(() => {
      setCountdown(getDaysRemaining(studyPlan.examDate));
    }, 60000);
    return () => clearInterval(timer);
  }, [studyPlan?.examDate]);

  if (studyPlans.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="h-20 w-20 bg-foreground/5 rounded-full flex items-center justify-center border border-foreground/10">
          <Trophy className="h-10 w-10 text-muted" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Welcome, Scholar!</h2>
          <p className="text-muted max-w-xs mx-auto">Generate your first study plan to see your dashboard and track your progress.</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
        >
          Get Started
        </button>
      </div>
    );
  }

  const totalSessions = studyPlan ? studyPlan.days.reduce((acc, day) => acc + day.sessions.length, 0) : 0;
  const completedSessions = studyPlan ? studyPlan.days.reduce((acc, day) => acc + day.sessions.filter(s => s.completed).length, 0) : 0;
  const progressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const currentDay = studyPlan ? (studyPlan.days.find(d => !d.sessions.every(s => s.completed)) || studyPlan.days[0]) : null;
  const xpInCurrentLevel = userStats.xp % 1000;
  const xpProgress = (xpInCurrentLevel / 1000) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 md:space-y-8 pb-24"
    >
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your Dashboard</h1>
        <p className="text-muted text-[10px] md:text-sm italic font-medium uppercase tracking-widest">Rank: Master Scholar</p>
      </div>

      {/* Gamification Card */}
      <motion.div 
        className="glass p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border-accent/20 backdrop-blur-2xl bg-accent/5 space-y-4 md:space-y-6 shadow-2xl shadow-accent/5 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Trophy className="h-12 w-12 md:h-16 md:w-16 text-accent rotate-12" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-accent text-accent-foreground flex items-center justify-center font-display font-bold text-2xl md:text-3xl shadow-lg shadow-accent/20">
              {userStats.level}
            </div>
            <div>
              <h3 className="font-bold text-lg md:text-xl">Level {userStats.level}</h3>
              <div className="flex items-center gap-2 text-orange-500 font-black text-[10px] md:text-xs uppercase tracking-tighter">
                <span>🔥 {userStats.streak} Day Streak</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-accent fill-accent" /> {userStats.xp} XP</span>
            <span>Next Level: {Math.ceil((userStats.xp + 1) / 1000) * 1000}</span>
          </div>
          <div className="h-4 w-full bg-foreground/5 rounded-full overflow-hidden p-1 border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              className="h-full bg-gradient-to-r from-accent to-accent/60 rounded-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {userStats.badges.map((badge, i) => (
            <div key={i} className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center border border-accent/30">
              <Star className="h-5 w-5 text-accent fill-accent" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Active Plan Info */}
      {studyPlan && (
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          <div className="glass p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl bg-accent/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-lg md:text-xl">{studyPlan.subject}</h3>
                  <p className="text-[10px] text-muted uppercase font-bold tracking-widest">{studyPlan.difficulty} Difficulty</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/timetable')}
                className="p-2.5 rounded-xl md:rounded-2xl bg-accent/10 text-accent hover:bg-accent/20 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-foreground/5 border border-foreground/5">
                <div className="flex items-center gap-2 text-muted mb-1">
                  <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[10px] font-bold uppercase">Days Left</span>
                </div>
                <p className="text-xl md:text-2xl font-display font-bold">{countdown.days}</p>
              </div>
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-foreground/5 border border-foreground/5">
                <div className="flex items-center gap-2 text-muted mb-1">
                  <Clock className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="text-[10px] font-bold uppercase">Hours Left</span>
                </div>
                <p className="text-xl md:text-2xl font-display font-bold">{countdown.hours}</p>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] md:text-sm font-bold text-muted uppercase tracking-widest">Overall Progress</span>
                <span className="text-base md:text-lg font-bold accent-text">{progressPercent}%</span>
              </div>
              <div className="h-2.5 md:h-3 w-full bg-foreground/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-accent"
                />
              </div>
            </div>
          </div>

          {/* Today's Focus */}
          {currentDay && (
            <div className="glass p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <Zap className="h-5 w-5" />
                <h3 className="font-bold text-base md:text-lg">Today's Focus</h3>
              </div>
              <div className="p-4 md:p-6 rounded-xl md:rounded-2xl bg-accent/5 border border-accent/20">
                <p className="font-bold text-base md:text-lg">Day {currentDay.dayIndex}: {currentDay.focus}</p>
                <div className="mt-3 md:mt-4 space-y-2">
                  {currentDay.sessions.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn(
                        "h-1.5 w-1.5 md:h-2 md:w-2 rounded-full",
                        s.completed ? "bg-accent" : "bg-foreground/10"
                      )} />
                      <span className={cn(
                        "text-xs md:text-sm font-medium",
                        s.completed ? "text-accent line-through" : "text-muted"
                      )}>{s.topic}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => navigate('/timetable')}
                className="w-full py-3 md:py-4 bg-accent text-accent-foreground rounded-xl md:rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-accent/20 text-xs md:text-sm"
              >
                Go to Timetable
              </button>
            </div>
          )}

          {/* Plan Switcher */}
          <div className="glass p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-4 md:space-y-6">
            <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              Switch Study Plan
            </h3>
            <div className="space-y-2">
              {studyPlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => plan.id && setActivePlanId(plan.id)}
                  className={cn(
                    "w-full text-left px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all flex items-center justify-between",
                    activePlanId === plan.id 
                      ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
                      : "bg-foreground/5 text-muted hover:text-foreground hover:bg-foreground/10"
                  )}
                >
                  <span className="font-bold text-sm md:text-base">{plan.subject}</span>
                  {activePlanId === plan.id && <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

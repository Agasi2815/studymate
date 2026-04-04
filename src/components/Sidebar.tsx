import React, { useState, useEffect } from 'react';
import { StudyPlan, UserStats } from '../types';
import { getDaysRemaining } from '../lib/utils';
import { motion } from 'motion/react';
import { Calendar, Clock, BarChart3, CheckCircle2, TrendingUp, BookOpen, Trophy, Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  studyPlans: StudyPlan[];
  activePlanId: string | null;
  setActivePlanId: (id: string) => void;
  userStats: UserStats;
  className?: string;
}

export default function Sidebar({ studyPlans, activePlanId, setActivePlanId, userStats, className }: SidebarProps) {
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

  if (studyPlans.length === 0) return null;

  const totalSessions = studyPlan ? studyPlan.days.reduce((acc, day) => acc + day.sessions.length, 0) : 0;
  const completedSessions = studyPlan ? studyPlan.days.reduce((acc, day) => acc + day.sessions.filter(s => s.completed).length, 0) : 0;
  const progressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // Find today's focus (Day 1 for now, or first uncompleted day)
  const currentDay = studyPlan ? (studyPlan.days.find(d => !d.sessions.every(s => s.completed)) || studyPlan.days[0]) : null;

  const xpInCurrentLevel = userStats.xp % 1000;
  const xpProgress = (xpInCurrentLevel / 1000) * 100;
  const isCompleted = progressPercent === 100;

  return (
    <div className={cn("w-full lg:w-80 shrink-0 space-y-6", className)}>
      {/* Plan Selector */}
      <div className="glass p-6 rounded-[2.5rem] border-white/5 backdrop-blur-2xl bg-white/5 shadow-2xl space-y-4">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted px-2">Your Study Plans</h4>
        <div className="space-y-1">
          {studyPlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => plan.id && setActivePlanId(plan.id)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center justify-between group",
                activePlanId === plan.id 
                  ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
                  : "hover:bg-foreground/5 text-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <BookOpen className={cn("h-4 w-4 shrink-0", activePlanId === plan.id ? "text-accent-foreground" : "text-accent")} />
                <span className="text-sm font-bold truncate">{plan.subject}</span>
              </div>
              {activePlanId === plan.id && (
                <motion.div layoutId="active-indicator" className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
              )}
            </button>
          ))}
          <button 
            onClick={() => window.location.href = '/analytics'}
            className="w-full text-left px-4 py-3 rounded-2xl text-xs font-bold text-accent hover:bg-accent/10 transition-all flex items-center gap-3"
          >
            <BarChart3 className="h-4 w-4" />
            View Analytics
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full text-left px-4 py-3 rounded-2xl text-xs font-bold text-accent hover:bg-accent/10 transition-all flex items-center gap-3"
          >
            <BookOpen className="h-4 w-4" />
            Create New Plan
          </button>
        </div>
      </div>

      {studyPlan && (
        <div className="space-y-6">
          {/* Gamification Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-8 rounded-[2.5rem] border-accent/20 backdrop-blur-2xl bg-accent/5 space-y-6 shadow-2xl shadow-accent/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="h-16 w-16 text-accent rotate-12" />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center font-display font-bold text-xl shadow-lg shadow-accent/20">
                {userStats.level}
              </div>
              <div>
                <h3 className="font-bold text-lg">Level {userStats.level}</h3>
                <p className="text-xs text-muted uppercase tracking-wider font-bold">Rank: Scholar</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>XP: {userStats.xp}</span>
                <span>Next: {Math.ceil(userStats.xp / 1000) * 1000}</span>
              </div>
              <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  className="h-full bg-accent"
                />
              </div>
            </div>

            <div className="flex gap-2">
              {userStats.badges.length > 0 ? (
                userStats.badges.map((badge, i) => (
                  <div key={i} className="h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center" title={badge}>
                    <Star className="h-3 w-3 text-accent" />
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-muted italic">No badges earned yet</p>
              )}
            </div>
          </motion.div>

          {isCompleted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-8 rounded-3xl border-accent/30 text-center space-y-6 shadow-2xl shadow-accent/10"
            >
              <div className="h-20 w-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="h-10 w-10 text-accent" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Course Mastered!</h3>
                <p className="text-sm text-muted">You've completed all study sessions for {studyPlan.subject}.</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-2xl border border-accent/20">
                <p className="text-xs font-bold text-accent uppercase tracking-widest">100% Complete</p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Subject Card */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass p-8 rounded-[2.5rem] border-white/5 backdrop-blur-2xl bg-white/5 space-y-6 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-accent/20 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg truncate max-w-[160px]">{studyPlan.subject}</h3>
                    <p className="text-xs text-muted uppercase tracking-wider font-bold">{studyPlan.difficulty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-foreground/5 border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted mb-1">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase">Days</span>
                    </div>
                    <p className="text-xl font-display font-bold">{countdown.days}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-foreground/5 border border-foreground/5">
                    <div className="flex items-center gap-2 text-muted mb-1">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase">Hours</span>
                    </div>
                    <p className="text-xl font-display font-bold">{countdown.hours}</p>
                  </div>
                </div>
              </motion.div>

              {/* Progress Card */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass p-6 rounded-3xl border-foreground/10 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    <h4 className="text-sm font-bold">Overall Progress</h4>
                  </div>
                  <span className="text-xs font-bold text-accent">{progressPercent}%</span>
                </div>

                <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    className="h-full bg-accent"
                  />
                </div>

                <div className="flex justify-between text-[10px] font-bold text-muted uppercase tracking-widest">
                  <span>{completedSessions} Done</span>
                  <span>{totalSessions - completedSessions} Left</span>
                </div>
              </motion.div>

              {/* Today's Focus */}
              {currentDay && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass p-6 rounded-3xl border-foreground/10 space-y-3"
                >
                  <div className="flex items-center gap-2 text-muted">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <h4 className="text-xs font-bold uppercase tracking-widest">Current Focus</h4>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-bold text-sm">Day {currentDay.dayIndex}: {currentDay.focus}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentDay.sessions.slice(0, 3).map((s, i) => (
                        <span key={i} className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full border",
                          s.completed ? "bg-accent/10 border-accent/20 text-accent" : "bg-foreground/5 border-foreground/10 text-muted"
                        )}>
                          {s.topic}
                        </span>
                      ))}
                      {currentDay.sessions.length > 3 && <span className="text-[9px] text-muted">+{currentDay.sessions.length - 3} more</span>}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Topics List */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="glass p-6 rounded-3xl border-foreground/10"
              >
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Syllabus Overview</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                  {studyPlan.topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-accent shrink-0" />
                      <span className="text-xs truncate text-muted group-hover:text-foreground transition-colors">{topic}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

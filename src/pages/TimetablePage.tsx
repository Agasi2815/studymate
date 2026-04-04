import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, AlertCircle, MessageSquare, HelpCircle, Trophy, Calendar } from 'lucide-react';
import { StudyPlan, StudySession } from '../types';
import { cn, formatDate, getDaysRemaining } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface TimetablePageProps {
  studyPlan: StudyPlan | null;
  setStudyPlan: (plan: StudyPlan) => void;
  awardXP: (amount: number) => void;
}

export default function TimetablePage({ studyPlan, setStudyPlan, awardXP }: TimetablePageProps) {
  const navigate = useNavigate();
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [countdown, setCountdown] = useState(() => studyPlan ? getDaysRemaining(studyPlan.examDate) : { days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!studyPlan) return;
    
    setCountdown(getDaysRemaining(studyPlan.examDate));
    const timer = setInterval(() => {
      setCountdown(getDaysRemaining(studyPlan.examDate));
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [studyPlan?.examDate]);

  if (!studyPlan) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="h-20 w-20 bg-foreground/5 rounded-full flex items-center justify-center border border-foreground/10">
          <Calendar className="h-10 w-10 text-muted" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">No Study Plan Found</h2>
          <p className="text-muted max-w-xs mx-auto">You haven't generated a study plan yet. Head over to the setup page to get started.</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
        >
          Create Plan
        </button>
      </div>
    );
  }

  const toggleSession = (dayIndex: number, sessionIndex: number) => {
    const newPlan = { ...studyPlan };
    const session = newPlan.days.find(d => d.dayIndex === dayIndex)?.sessions[sessionIndex];
    if (session) {
      const wasCompleted = session.completed;
      session.completed = !session.completed;
      setStudyPlan(newPlan);
      
      if (!wasCompleted && session.completed) {
        awardXP(100);
      }
    }
  };

  const totalSessions = studyPlan.days.reduce((acc, day) => acc + day.sessions.length, 0);
  const completedSessions = studyPlan.days.reduce(
    (acc, day) => acc + day.sessions.filter(s => s.completed).length,
    0
  );
  const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const getCurrentDayIndex = () => {
    if (!studyPlan.updatedAt) return 1;
    
    // Firestore timestamp or ISO string
    const updatedDate = studyPlan.updatedAt?.seconds 
      ? new Date(studyPlan.updatedAt.seconds * 1000) 
      : new Date(studyPlan.updatedAt);
      
    const now = new Date();
    const diffTime = now.getTime() - updatedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  };

  const currentDayIndex = getCurrentDayIndex();

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {/* Header & Countdown */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
    <div>
      <h1 className="text-3xl font-bold">{studyPlan.subject}</h1>
      <p className="text-muted">Exam on {new Date(studyPlan.examDate).toLocaleDateString()}</p>
    </div>
    <div className="glass px-8 py-6 rounded-[2.5rem] flex items-center gap-8 border-white/10 backdrop-blur-2xl bg-white/5 shadow-2xl shadow-accent/5">
      <div className="text-center">
        <div className="text-4xl font-display font-bold accent-text">{countdown.days}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted font-bold">Days</div>
      </div>
      <div className="h-10 w-px bg-white/10" />
      <div className="text-center">
        <div className="text-4xl font-display font-bold accent-text">{countdown.hours}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted font-bold">Hours</div>
      </div>
      <div className="h-10 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
            <span className="text-[10px] uppercase tracking-widest text-red-500 font-bold">Remaining</span>
          </div>
        </div>
      </div>

      {/* Progress & Stats */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <span className="text-sm font-medium text-muted">Overall Progress</span>
          <span className="text-2xl font-display font-bold accent-text">{progress}%</span>
        </div>
        <div className="w-full bg-foreground/10 h-3 rounded-full overflow-hidden border border-foreground/5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full accent-bg"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="glass p-6 rounded-3xl text-center border-white/5 backdrop-blur-xl bg-white/5 shadow-xl">
            <div className="text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Total Topics</div>
            <div className="text-2xl font-bold">{totalSessions}</div>
          </div>
          <div className="glass p-6 rounded-3xl text-center border-accent/20 backdrop-blur-xl bg-accent/5 shadow-xl">
            <div className="text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Done</div>
            <div className="text-2xl font-bold accent-text">{completedSessions}</div>
          </div>
          <div className="glass p-6 rounded-3xl text-center border-white/5 backdrop-blur-xl bg-white/5 shadow-xl">
            <div className="text-muted text-[10px] font-bold uppercase tracking-widest mb-2">Remaining</div>
            <div className="text-2xl font-bold">{totalSessions - completedSessions}</div>
          </div>
        </div>
      </div>

      {/* Timetable List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Study Roadmap</h2>
          <button 
            onClick={() => setExpandedDay(expandedDay === -1 ? 0 : -1)}
            className="text-xs font-bold uppercase tracking-widest text-accent hover:text-foreground transition-colors"
          >
            {expandedDay === -1 ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
        {studyPlan.days.map((day) => {
          const isExpanded = expandedDay === day.dayIndex || expandedDay === -1;
          const isDone = day.sessions.every(s => s.completed);
          const isToday = day.dayIndex === currentDayIndex;

          return (
            <motion.div 
              key={day.dayIndex}
              layout
              className={cn(
                "glass rounded-2xl overflow-hidden transition-all",
                isToday && "ring-2 ring-accent border-accent/20 shadow-lg shadow-accent/5",
                isDone && "bg-green-500/5 border-green-500/20",
                isExpanded && "ring-1 ring-foreground/10"
              )}
            >
              <button
                onClick={() => setExpandedDay(isExpanded ? 0 : day.dayIndex)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-foreground/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center font-display font-bold text-lg shadow-sm",
                    isToday ? "bg-accent text-accent-foreground" : 
                    isDone ? "bg-green-500/20 text-green-500" : "bg-foreground/10 text-muted"
                  )}>
                    {isDone ? <Trophy className="h-6 w-6" /> : day.dayIndex}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">Day {day.dayIndex}: {day.focus}</h3>
                      {isToday && (
                        <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full uppercase tracking-widest">Today</span>
                      )}
                      {isDone && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted font-medium uppercase tracking-widest">
                      {day.sessions.length} Sessions • {day.sessions.filter(s => s.completed).length} Completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex gap-1">
                    {day.sessions.map((s, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "h-1.5 w-4 rounded-full",
                          s.completed ? "bg-green-500" : "bg-foreground/10"
                        )} 
                      />
                    ))}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-accent transition-transform" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted group-hover:text-foreground transition-transform" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 space-y-4">
                      <div className="h-px bg-foreground/10 mb-4" />
                      {day.sessions.map((session, sIdx) => (
                        <motion.div 
                          key={sIdx}
                          layout
                          initial={false}
                          animate={{ 
                            backgroundColor: session.completed ? "rgba(var(--accent-rgb), 0.05)" : "rgba(var(--foreground-rgb), 0.05)",
                            opacity: session.completed ? 0.7 : 1,
                            scale: session.completed ? 0.98 : 1
                          }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-xl transition-all border border-transparent",
                            session.completed && "border-accent/20 shadow-inner shadow-accent/5"
                          )}
                        >
                          <button 
                            onClick={() => toggleSession(day.dayIndex, sIdx)}
                            className="mt-1 relative"
                          >
                            <AnimatePresence mode="wait">
                              {session.completed ? (
                                <motion.div
                                  key="checked"
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.5, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <CheckCircle2 className="h-6 w-6 text-accent" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="unchecked"
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.5, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Circle className="h-6 w-6 text-muted" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                          <div className="flex-grow space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn(
                                "font-medium text-lg",
                                session.completed && "line-through text-muted"
                              )}>
                                {session.topic}
                              </span>
                              <div className="flex gap-2">
                                <span className="text-[10px] bg-foreground/10 text-muted px-2 py-1 rounded-full flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {session.duration}m
                                </span>
                                <span className={cn(
                                  "text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wider",
                                  getImportanceColor(session.importance)
                                )}>
                                  {session.importance}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-muted italic">"{session.tip}"</p>
                          </div>
                        </motion.div>
                      ))}

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <button 
                          onClick={() => navigate('/chat', { state: { prompt: `Give me some study tips for these topics: ${day.sessions.map(s => s.topic).join(', ')}` } })}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-all text-sm font-medium"
                        >
                          <MessageSquare className="h-4 w-4 text-accent" /> AI Tips
                        </button>
                        <button 
                          onClick={() => navigate('/chat', { state: { prompt: `Quick quiz on: ${day.sessions.map(s => s.topic).join(', ')}` } })}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-all text-sm font-medium"
                        >
                          <HelpCircle className="h-4 w-4 text-accent" /> Quick Quiz
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

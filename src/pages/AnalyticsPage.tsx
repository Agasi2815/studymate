import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, Brain, Clock, Target, Calendar, TrendingUp, 
  Award, Zap, Flame, ChevronRight, Info, Coffee
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { UserAnalytics, PomodoroSession } from '../types';
import { format, subDays, startOfDay, endOfDay, isSameDay, parseISO } from 'date-fns';

interface AnalyticsPageProps {
  analytics: UserAnalytics | null;
  sessions: PomodoroSession[];
}

export default function AnalyticsPage({ analytics, sessions }: AnalyticsPageProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // Prepare data for Focus Heatmap (Activity over last 7 days)
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const daySessions = sessions.filter(s => isSameDay(parseISO(s.startTime), date));
    const focusMinutes = daySessions
      .filter(s => s.type === 'focus' && s.completed)
      .reduce((acc, s) => acc + s.duration, 0);
    
    return {
      date: format(date, 'EEE'),
      fullDate: format(date, 'MMM dd'),
      minutes: focusMinutes,
      sessions: daySessions.length
    };
  }).reverse();

  // Prepare data for Subject Mastery Radar
  const masteryData = analytics?.mastery.map(m => ({
    subject: m.topic.length > 15 ? m.topic.substring(0, 12) + '...' : m.topic,
    fullSubject: m.topic,
    score: m.score,
    attempts: m.attempts
  })) || [];

  // Stats
  const totalFocusMinutes = sessions
    .filter(s => s.type === 'focus' && s.completed)
    .reduce((acc, s) => acc + s.duration, 0);
  
  const avgSessionLength = sessions.length > 0 
    ? Math.round(totalFocusMinutes / sessions.filter(s => s.type === 'focus' && s.completed).length || 0)
    : 0;

  const stats = [
    { label: 'Total Focus', value: `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`, icon: Clock, color: 'text-accent' },
    { label: 'Avg Session', value: `${avgSessionLength}m`, icon: Zap, color: 'text-yellow-400' },
    { label: 'Mastery', value: `${Math.round(analytics?.mastery.reduce((acc, m) => acc + m.score, 0) / (analytics?.mastery.length || 1)) || 0}%`, icon: Target, color: 'text-green-400' },
    { label: 'Sessions', value: sessions.length.toString(), icon: Award, color: 'text-blue-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-accent" />
            Study Analytics
          </h1>
          <p className="text-muted">Track your growth and optimize your focus.</p>
        </div>

        <div className="flex bg-foreground/5 p-1 rounded-xl border border-foreground/10 self-start">
          {(['7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                timeRange === range ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"
              )}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-6 rounded-2xl space-y-2 border-foreground/5"
          >
            <div className="flex items-center gap-2 text-muted text-xs font-medium uppercase tracking-wider">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              {stat.label}
            </div>
            <div className="text-2xl font-black">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Focus Activity Chart */}
        <div className="glass p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-400" />
              Focus Activity
            </h3>
            <div className="text-xs text-muted flex items-center gap-1">
              <Info className="h-3 w-3" /> Minutes per day
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last7Days}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="var(--accent)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorMinutes)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Mastery Radar */}
        <div className="glass p-8 rounded-3xl space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Subject Mastery
          </h3>
          
          <div className="h-[300px] w-full flex items-center justify-center">
            {masteryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={masteryData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Mastery"
                    dataKey="score"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.6}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: 'var(--accent)' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center space-y-2 opacity-50">
                <Target className="h-12 w-12 mx-auto text-muted" />
                <p className="text-sm">Complete quizzes to see your mastery map.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sessions List */}
      <div className="glass p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Recent Sessions
          </h3>
          <button className="text-xs font-bold text-accent flex items-center gap-1 hover:underline">
            View All <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-3">
          {sessions.slice(0, 5).map((session, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-4 rounded-xl bg-foreground/5 border border-foreground/5 hover:border-foreground/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center",
                  session.type === 'focus' ? "bg-accent/10 text-accent" : "bg-green-400/10 text-green-400"
                )}>
                  {session.type === 'focus' ? <Brain className="h-5 w-5" /> : <Coffee className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-bold text-sm">{session.topic || (session.type === 'focus' ? 'Deep Work' : 'Break')}</div>
                  <div className="text-xs text-muted">{format(parseISO(session.startTime), 'MMM dd, HH:mm')}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm">+{session.duration}m</div>
                <div className="text-[10px] text-accent font-bold uppercase tracking-widest">+{session.duration * 10} XP</div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8 opacity-50">
              <Clock className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No sessions recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

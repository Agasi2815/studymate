import React, { useState, useEffect } from 'react';
import { AlertTriangle, Zap, Loader2, Download, CheckCircle2, ChevronRight } from 'lucide-react';
import { StudyPlan, PanicPlan } from '../types';
import { generatePanicPlan } from '../lib/gemini';
import { getDaysRemaining } from '../lib/utils';
import { motion } from 'motion/react';

interface PanicPageProps {
  studyPlan: StudyPlan | null;
  customRules: string;
  panicPlan: PanicPlan | null;
  setPanicPlan: (plan: PanicPlan | null) => void;
}

export default function PanicPage({ studyPlan, customRules, panicPlan, setPanicPlan }: PanicPageProps) {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(() => studyPlan ? getDaysRemaining(studyPlan.examDate) : { days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!studyPlan) return;

    setCountdown(getDaysRemaining(studyPlan.examDate));
    const timer = setInterval(() => {
      setCountdown(getDaysRemaining(studyPlan.examDate));
    }, 60000);
    return () => clearInterval(timer);
  }, [studyPlan?.examDate]);

  if (!studyPlan) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">No Active Plan</h2>
          <p className="text-muted max-w-xs mx-auto">Panic mode requires an active study plan to prioritize topics. Please create one first.</p>
        </div>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-8 py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
        >
          Go to Setup
        </button>
      </div>
    );
  }

  useEffect(() => {
    if (panicPlan) {
      localStorage.setItem('panicPlan', JSON.stringify(panicPlan));
    }
  }, [panicPlan]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const hoursRemaining = countdown.days * 24 + countdown.hours;
      const plan = await generatePanicPlan(
        studyPlan.subject,
        hoursRemaining,
        studyPlan.topics,
        customRules
      );
      setPanicPlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportAsTxt = () => {
    if (!panicPlan) return;
    
    let content = `PANIC MODE: ${studyPlan.subject}\n`;
    content += `Time Remaining: ${countdown.days}d ${countdown.hours}h\n`;
    content += `==========================================\n\n`;
    
    panicPlan.panicTopics.forEach((t, i) => {
      content += `${i + 1}. ${t.topic.toUpperCase()}\n`;
      content += `WHY: ${t.why}\n`;
      content += `KEY POINTS:\n${t.keyPoints.map(p => `  - ${p}`).join('\n')}\n`;
      content += `LIKELY QUESTIONS:\n${t.likelyQuestions.map(q => `  ? ${q}`).join('\n')}\n`;
      content += `MEMORISE TIP: ${t.memoriseTip}\n\n`;
    });
    
    content += `EXAM DAY ADVICE: ${panicPlan.examDayAdvice}\n`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PanicList_${studyPlan.subject.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-8"
    >
      {/* Warning Banner */}
      <div className="bg-red-600 text-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl shadow-red-600/20">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">🔥 Last Night Before Exam</h2>
            <p className="text-red-100 font-medium">{studyPlan.subject} • {countdown.days}d {countdown.hours}h remaining</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-white text-red-600 px-8 py-3 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
          Generate Panic List
        </button>
      </div>

      {panicPlan ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {panicPlan.panicTopics.map((topic, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-6 rounded-2xl border-red-500/10 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-xl font-bold accent-text">{topic.topic}</h3>
                  <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-bold uppercase">Critical</span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted italic">"{topic.why}"</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Key Points</h4>
                  <ul className="space-y-1">
                    {topic.keyPoints.map((p, pi) => (
                      <li key={pi} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Likely Questions</h4>
                  <ul className="space-y-1">
                    {topic.likelyQuestions.map((q, qi) => (
                      <li key={qi} className="text-sm flex items-start gap-2 text-muted">
                        <ChevronRight className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-accent/5 border border-accent/10 rounded-lg">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Memorise Tip</h4>
                  <p className="text-sm font-medium">{topic.memoriseTip}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="glass p-6 rounded-2xl border-accent/20 text-center space-y-4">
            <h3 className="text-xl font-bold">Final Advice</h3>
            <p className="text-muted italic">"{panicPlan.examDayAdvice}"</p>
            <button
              onClick={exportAsTxt}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-foreground/10 hover:bg-foreground/5 transition-all font-bold"
            >
              <Download className="h-5 w-5" />
              Export as .txt
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 glass rounded-3xl border-dashed border-foreground/10">
          <Zap className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-bold text-muted">No panic list generated yet</h3>
          <p className="text-muted">Click the button above to focus on critical topics.</p>
        </div>
      )}
    </motion.div>
  );
}

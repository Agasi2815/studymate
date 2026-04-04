import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SetupPage from './pages/SetupPage';
import TimetablePage from './pages/TimetablePage';
import PanicPage from './pages/PanicPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PomodoroTimer from './components/PomodoroTimer';
import { StudyPlan, ChatMessage, PanicPlan, UserStats, PomodoroSession, UserAnalytics } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  updateProfile, 
  signInWithRedirect, 
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { SmokeBackgroundLayout } from './components/ui/smoke-background-layout';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import { 
  Loader2, 
  Clock, 
  Book, 
  Brain, 
  Sparkles, 
  GraduationCap, 
  Timer, 
  BookOpen, 
  Lightbulb,
  X
} from 'lucide-react';

// Contexts
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [panicPlan, setPanicPlan] = useState<PanicPlan | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    xp: 0,
    level: 1,
    badges: [],
    streak: 0
  });
  const [customRules, setCustomRules] = useState('');
  const [theme, setTheme] = useState<'yin' | 'yang'>('yin');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [isTimerOpen, setIsTimerOpen] = useState(false);

  // Auth Listener
  useEffect(() => {
    // Handle redirect result
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect Login Error:", error);
      if (error.code === 'auth/network-request-failed') {
        setGlobalError("Login failed due to a network error. This often happens in an iframe. Please try opening the app in a new tab to complete the sign-in.");
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync User Profile & Plan
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    
    // Initial profile check/create
    getDoc(userDocRef).then(async (snap) => {
      if (!snap.exists()) {
        try {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            theme: 'yin',
            customRules: '',
            createdAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
      } else {
        const data = snap.data();
        setTheme(data.theme || 'yin');
        setCustomRules(data.customRules || '');
        if (data.userStats) {
          setUserStats(data.userStats);
        }
      }
    }).catch((error) => {
      console.error("Profile Fetch Error:", error);
      setGlobalError("Failed to connect to your profile. Please check your internet connection.");
    }).finally(() => {
      setAuthLoading(false);
    });

    // Listen for plans
    const plansRef = collection(db, 'users', user.uid, 'plans');
    const plansUnsubscribe = onSnapshot(plansRef, (snap) => {
      const plans = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlan & { id: string }));
      setStudyPlans(plans);
      
      // If no active plan selected, pick the first one or most recent
      if (plans.length > 0 && !activePlanId) {
        setActivePlanId(plans[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/plans`);
    });

    // Listen for messages
    const messagesRef = collection(db, 'users', user.uid, 'messages');
    const messagesUnsubscribe = onSnapshot(messagesRef, (snap) => {
      const msgs = snap.docs.map(doc => doc.data() as ChatMessage);
      // Sort by timestamp if needed, but for now just set
      setMessages(msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/messages`);
    });

    // Listen for panic plan
    const panicPlansRef = collection(db, 'users', user.uid, 'panicPlans');
    const panicUnsubscribe = onSnapshot(panicPlansRef, (snap) => {
      if (!snap.empty) {
        const plans = snap.docs.map(doc => doc.data() as PanicPlan);
        setPanicPlan(plans[plans.length - 1]); // Get the latest one
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/panicPlans`);
    });

    // Listen for pomodoro sessions
    const sessionsRef = collection(db, 'users', user.uid, 'pomodoroSessions');
    const sessionsUnsubscribe = onSnapshot(sessionsRef, (snap) => {
      const sess = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as PomodoroSession));
      setPomodoroSessions(sess.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/pomodoroSessions`);
    });

    // Listen for analytics
    const analyticsRef = doc(db, 'users', user.uid, 'analytics', 'data');
    const analyticsUnsubscribe = onSnapshot(analyticsRef, (snap) => {
      if (snap.exists()) {
        setAnalytics(snap.data() as UserAnalytics);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/analytics/data`);
    });

    return () => {
      plansUnsubscribe();
      messagesUnsubscribe();
      panicUnsubscribe();
      sessionsUnsubscribe();
      analyticsUnsubscribe();
    };
  }, [user, activePlanId]);

  const activePlan = studyPlans.find(p => p.id === activePlanId) || null;

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.remove('yin', 'yang');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const signIn = async () => {
    setGlobalError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('User closed the sign-in popup.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Popup request was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        console.error('Popup blocked during sign-in:', err);
        setGlobalError("Popup blocked! Please allow popups for this site or try 'Sign in with Redirect' below.");
      } else if (err.code === 'auth/network-request-failed') {
        console.error('Network request failed during sign-in:', err);
        setGlobalError("Login failed due to a network error. This often happens in an iframe. Please try opening the app in a new tab to complete the sign-in.");
      } else {
        console.error('Sign-in error:', err);
        setGlobalError(`Login error: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setStudyPlans([]);
      setActivePlanId(null);
      setCustomRules('');
      setPomodoroSessions([]);
      setAnalytics(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePomodoroComplete = async (type: 'focus' | 'short-break' | 'long-break', duration: number) => {
    if (!user) return;

    const session: PomodoroSession = {
      userId: user.uid,
      startTime: new Date(Date.now() - duration * 60000).toISOString(),
      endTime: new Date().toISOString(),
      duration,
      type,
      completed: true,
      topic: activePlanId ? studyPlans.find(p => p.id === activePlanId)?.subject : undefined
    };

    try {
      // Save session
      const sessionRef = collection(db, 'users', user.uid, 'pomodoroSessions');
      await setDoc(doc(sessionRef), session);

      // Award XP
      if (type === 'focus') {
        const xpGain = duration * 10;
        await awardXP(xpGain);

        // Update analytics
        const analyticsRef = doc(db, 'users', user.uid, 'analytics', 'data');
        const currentAnalytics = analytics || {
          userId: user.uid,
          mastery: [],
          totalFocusTime: 0,
          sessionsCompleted: 0,
          lastUpdated: new Date().toISOString()
        };

        const updatedAnalytics: UserAnalytics = {
          ...currentAnalytics,
          totalFocusTime: currentAnalytics.totalFocusTime + duration,
          sessionsCompleted: currentAnalytics.sessionsCompleted + 1,
          lastUpdated: new Date().toISOString()
        };

        await setDoc(analyticsRef, updatedAnalytics);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/pomodoroSessions`);
    }
  };

  const handleQuizComplete = async (topic: string, score: number) => {
    if (!user) return;

    const analyticsRef = doc(db, 'users', user.uid, 'analytics', 'data');
    const currentAnalytics = analytics || {
      userId: user.uid,
      mastery: [],
      totalFocusTime: 0,
      sessionsCompleted: 0,
      lastUpdated: new Date().toISOString()
    };

    const existingMasteryIndex = currentAnalytics.mastery.findIndex(m => m.topic === topic);
    const updatedMastery = [...currentAnalytics.mastery];

    if (existingMasteryIndex >= 0) {
      const current = updatedMastery[existingMasteryIndex];
      updatedMastery[existingMasteryIndex] = {
        topic,
        score: Math.round((current.score * current.attempts + score) / (current.attempts + 1)),
        attempts: current.attempts + 1
      };
    } else {
      updatedMastery.push({ topic, score, attempts: 1 });
    }

    const updatedAnalytics: UserAnalytics = {
      ...currentAnalytics,
      mastery: updatedMastery,
      lastUpdated: new Date().toISOString()
    };

    await setDoc(analyticsRef, updatedAnalytics);
  };

  const updateTheme = async (newTheme: 'yin' | 'yang') => {
    setTheme(newTheme);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { theme: newTheme }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const updateCustomRules = async (rules: string) => {
    setCustomRules(rules);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { customRules: rules }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  const awardXP = async (amount: number) => {
    setUserStats(prev => {
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / 1000) + 1;
      const updated = {
        ...prev,
        xp: newXP,
        level: newLevel,
      };
      
      if (user) {
        setDoc(doc(db, 'users', user.uid), { userStats: updated }, { merge: true })
          .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
      }
      
      return updated;
    });
  };

  const updateStudyPlan = async (plan: StudyPlan | null) => {
    if (user && plan && activePlanId) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'plans', activePlanId), {
          ...plan,
          uid: user.uid,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/plans/${activePlanId}`);
      }
    }
  };

  const savePanicPlan = async (plan: PanicPlan | null) => {
    if (user && plan) {
      try {
        const planRef = doc(collection(db, 'users', user.uid, 'panicPlans'));
        await setDoc(planRef, {
          ...plan,
          createdAt: serverTimestamp()
        });
        setPanicPlan(plan);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/panicPlans`);
      }
    }
  };

  const addMessage = async (msg: ChatMessage) => {
    if (user) {
      try {
        const msgRef = doc(collection(db, 'users', user.uid, 'messages'));
        await setDoc(msgRef, {
          ...msg,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/messages`);
      }
    }
  };

  const clearData = async () => {
    if (user && activePlanId) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'plans', activePlanId), { deleted: true }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/plans/${activePlanId}`);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, signIn, logout }}>
      <Router>
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
          <Navbar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {globalError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex justify-between items-center">
                <p className="text-sm font-medium">{globalError}</p>
                <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-foreground">✕</button>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-8">
              {user && activePlan && (
                <Sidebar 
                  studyPlans={studyPlans} 
                  activePlanId={activePlanId}
                  setActivePlanId={setActivePlanId}
                  userStats={userStats} 
                  className="hidden lg:block" 
                />
              )}
              
              <main className="flex-grow min-w-0">
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={
                      user ? (
                        <SetupPage 
                          user={user} 
                          setStudyPlan={async (plan) => {
                            try {
                              const planRef = doc(collection(db, 'users', user.uid, 'plans'));
                              await setDoc(planRef, { 
                                ...plan, 
                                id: planRef.id,
                                uid: user.uid,
                                updatedAt: serverTimestamp()
                              });
                              setActivePlanId(planRef.id);
                            } catch (error) {
                              handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/plans`);
                            }
                          }} 
                          customRules={customRules} 
                        />
                      ) : <LoginPage />
                    } />
                    <Route path="/timetable" element={
                      user ? <TimetablePage studyPlan={activePlan} setStudyPlan={updateStudyPlan} awardXP={awardXP} /> : <Navigate to="/" />
                    } />
                    <Route path="/panic" element={
                      user ? <PanicPage studyPlan={activePlan} customRules={customRules} panicPlan={panicPlan} setPanicPlan={savePanicPlan} /> : <Navigate to="/" />
                    } />
                    <Route path="/chat" element={
                      user ? <ChatPage studyPlan={activePlan} customRules={customRules} messages={messages} addMessage={addMessage} awardXP={awardXP} onQuizComplete={handleQuizComplete} /> : <Navigate to="/" />
                    } />
                    <Route path="/analytics" element={
                      user ? <AnalyticsPage analytics={analytics} sessions={pomodoroSessions} /> : <Navigate to="/" />
                    } />
                    <Route path="/settings" element={
                      user ? (
                        <SettingsPage 
                          customRules={customRules} 
                          setCustomRules={updateCustomRules}
                          theme={theme}
                          setTheme={updateTheme}
                          clearData={clearData}
                        />
                      ) : <Navigate to="/" />
                    } />
                  </Routes>
                </AnimatePresence>
              </main>
            </div>
          </div>
          <footer className="w-full py-12 text-center text-[10px] uppercase tracking-[0.4em] font-bold text-muted/20 border-t border-foreground/5 mt-auto">
            Agasi Idhaya A 2026 ©
          </footer>

          {/* Pomodoro Trigger */}
          {user && (
            <div className="fixed bottom-8 right-8 z-[60]">
              <button
                onClick={() => setIsTimerOpen(!isTimerOpen)}
                className={cn(
                  "h-14 w-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                  isTimerOpen ? "bg-foreground text-background" : "bg-accent text-accent-foreground"
                )}
              >
                {isTimerOpen ? <X className="h-6 w-6" /> : <Timer className="h-6 w-6" />}
              </button>

              <AnimatePresence>
                {isTimerOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute bottom-20 right-0 w-[350px] origin-bottom-right"
                  >
                    <PomodoroTimer 
                      onComplete={handlePomodoroComplete} 
                      currentTopic={studyPlans.find(p => p.id === activePlanId)?.subject}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

function BackgroundAnimation() {
  const icons = [Clock, Book, Brain, Sparkles, GraduationCap, Timer, BookOpen, Lightbulb];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      {[...Array(20)].map((_, i) => {
        const Icon = icons[i % icons.length];
        const size = Math.random() * 40 + 20;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 10;
        
        return (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              rotate: 0,
              opacity: 0
            }}
            animate={{ 
              x: [
                Math.random() * 100 + "%", 
                Math.random() * 100 + "%", 
                Math.random() * 100 + "%"
              ],
              y: [
                Math.random() * 100 + "%", 
                Math.random() * 100 + "%", 
                Math.random() * 100 + "%"
              ],
              rotate: 360,
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "linear"
            }}
            className="absolute text-accent"
            style={{ width: size, height: size }}
          >
            <Icon size={size} strokeWidth={1} />
          </motion.div>
        );
      })}
    </div>
  );
}

function LoginPage() {
  const { signIn } = useAuth();
  const [loginMode, setLoginMode] = useState<'google' | 'email'>('google');
  const [emailData, setEmailData] = useState({ email: '', password: '', username: '', isSignUp: false });
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const words = "STUDYYOU".split("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorLog(null);
    setSuccessMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        setErrorLog("Popup blocked! Please allow popups for this site or try 'Sign in with Redirect' below.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setErrorLog("Sign-in was cancelled or another popup was opened.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorLog("Error: This domain is not authorized in Firebase. Please add your App URL to 'Authorized Domains' in the Firebase Console.");
      } else if (error.code === 'auth/network-request-failed') {
        setErrorLog("Login failed due to a network error. This often happens in an iframe. Please try opening the app in a new tab to complete the sign-in.");
      } else {
        setErrorLog(`Google Error: ${error.code || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setLoading(true);
    setErrorLog(null);
    setSuccessMsg(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Redirect Error:", error);
      setErrorLog(`Redirect Error: ${error.code || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorLog(null);
    setSuccessMsg(null);

    try {
      if (emailData.isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailData.email, emailData.password);
        if (emailData.username && userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: emailData.username
          });
        }
        setSuccessMsg("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, emailData.email, emailData.password);
      }
    } catch (error: any) {
      console.error("Email Auth Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorLog("This email is already in use. Try signing in instead.");
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorLog("Invalid email or password. If you don't have an account, please Sign Up first.");
      } else if (error.code === 'auth/invalid-email') {
        setErrorLog("Please enter a valid email address.");
      } else if (error.code === 'auth/weak-password') {
        setErrorLog("Password should be at least 6 characters.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorLog("Email/Password Auth is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorLog("Error: This domain is not authorized in Firebase. Please add your App URL to 'Authorized Domains' in the Firebase Console.");
      } else {
        setErrorLog(`Auth Error: ${error.code || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailData.email) {
      setErrorLog("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setErrorLog(null);
    setSuccessMsg(null);
    try {
      await sendPasswordResetEmail(auth, emailData.email);
      setSuccessMsg("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Reset Error:", error);
      setErrorLog(`Reset Error: ${error.code || error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SmokeBackgroundLayout title="STUDYYOU">
      <div className="relative z-10 space-y-8 w-full max-w-6xl flex flex-col items-center">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-muted max-w-xl mx-auto text-sm sm:text-lg font-medium leading-relaxed tracking-tight opacity-80"
        >
          A minimalist framework for your academic success. <br className="hidden sm:block" /> Built for focus, powered by AI.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md space-y-8 p-8 rounded-[2.5rem] backdrop-blur-2xl bg-white/5 border border-white/10 shadow-[0_0_50px_-12px_rgba(138,43,226,0.2)]"
        >
          <div className="flex p-1 bg-foreground/5 rounded-2xl border border-foreground/10">
            <button 
              onClick={() => setLoginMode('google')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                loginMode === 'google' ? "bg-background text-foreground shadow-lg" : "text-muted hover:text-foreground"
              )}
            >
              Google
            </button>
            <button 
              onClick={() => setLoginMode('email')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                loginMode === 'email' ? "bg-background text-foreground shadow-lg" : "text-muted hover:text-foreground"
              )}
            >
              Email
            </button>
          </div>

          <AnimatePresence mode="wait">
            {loginMode === 'google' ? (
              <motion.div
                key="google"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {errorLog && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center space-y-2"
                  >
                    <p>{errorLog}</p>
                    {errorLog.includes('not enabled') && (
                      <button 
                        type="button"
                        onClick={() => window.location.reload()}
                        className="text-accent underline font-bold block mx-auto"
                      >
                        Refresh App
                      </button>
                    )}
                  </motion.div>
                )}
                {successMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium text-center"
                  >
                    {successMsg}
                  </motion.div>
                )}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full relative group flex items-center justify-center gap-4 px-8 py-6 bg-foreground text-background rounded-2xl font-bold hover:bg-accent hover:text-accent-foreground transition-all duration-500 active:scale-95 shadow-2xl shadow-foreground/10 text-lg overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.16,1,0.3,1]" />
                  {loading ? (
                    <Loader2 className="relative z-10 animate-spin" size={24} />
                  ) : (
                    <>
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="relative z-10 h-6 w-6 group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <span className="relative z-10">Initialize System with Google</span>
                    </>
                  )}
                </button>

                {(errorLog?.includes('Popup blocked') || errorLog?.includes('network error') || errorLog?.includes('cancelled')) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl text-center space-y-3">
                      <p className="text-xs text-muted italic">
                        Still having trouble? The system can use a direct redirect or you can open the app in a new tab.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleGoogleRedirect}
                          disabled={loading}
                          className="w-full py-4 bg-accent text-accent-foreground rounded-2xl text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
                        >
                          Sign in with Redirect
                        </button>
                        <button
                          onClick={() => window.open(window.location.href, '_blank')}
                          className="w-full py-3 bg-foreground/5 border border-foreground/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/10 transition-all"
                        >
                          Open in New Tab
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="email"
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleEmailAuth}
                className="space-y-4 text-left"
              >
                {errorLog && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center space-y-2"
                  >
                    <p>{errorLog}</p>
                    {errorLog.includes('not enabled') && (
                      <button 
                        type="button"
                        onClick={() => window.location.reload()}
                        className="text-accent underline font-bold block mx-auto"
                      >
                        Refresh App
                      </button>
                    )}
                    {errorLog.includes('already in use') && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEmailData({...emailData, isSignUp: false});
                          setErrorLog(null);
                        }}
                        className="text-accent underline font-bold block mx-auto"
                      >
                        Switch to Sign In
                      </button>
                    )}
                  </motion.div>
                )}
                {successMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium text-center"
                  >
                    {successMsg}
                  </motion.div>
                )}
                <div className="space-y-4">
                  {emailData.isSignUp && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Username</label>
                      <input 
                        type="text" 
                        placeholder="Enter your name"
                        required
                        className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        value={emailData.username}
                        onChange={(e) => setEmailData({...emailData, username: e.target.value})}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="name@example.com"
                      required
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                      value={emailData.email}
                      onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Password</label>
                      {!emailData.isSignUp && (
                        <button 
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-[10px] uppercase tracking-widest font-bold text-accent hover:underline"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      required
                      className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                      value={emailData.password}
                      onChange={(e) => setEmailData({...emailData, password: e.target.value})}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-foreground text-background rounded-2xl font-bold hover:bg-accent hover:text-accent-foreground transition-all duration-500 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : emailData.isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailData({...emailData, isSignUp: !emailData.isSignUp});
                    setErrorLog(null);
                    setSuccessMsg(null);
                  }}
                  className="w-full py-2 text-xs font-bold text-muted hover:text-foreground transition-colors"
                >
                  {emailData.isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-muted font-bold opacity-60">
            <div className="h-px w-8 bg-muted/30" />
            <span>Secure Infrastructure</span>
            <div className="h-px w-8 bg-muted/30" />
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-24">
          {[
            { title: 'Intelligence', desc: 'Custom roadmaps generated by Gemini 3 Flash' },
            { title: 'Resilience', desc: 'Panic Mode for high-pressure exam scenarios' },
            { title: 'Ubiquity', desc: 'Real-time sync across all your devices' }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + (i * 0.1), duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="p-10 rounded-[2.5rem] backdrop-blur-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-accent/30 transition-all duration-700 group shadow-2xl shadow-black/20"
            >
              <div className="h-1 w-12 bg-accent mb-8 rounded-full group-hover:w-20 transition-all duration-700" />
              <h3 className="font-bold text-foreground text-2xl mb-3 tracking-tight">{feature.title}</h3>
              <p className="text-base text-muted leading-relaxed font-medium opacity-80">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SmokeBackgroundLayout>
  );
}


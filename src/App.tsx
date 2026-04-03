import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SetupPage from './pages/SetupPage';
import TimetablePage from './pages/TimetablePage';
import PanicPage from './pages/PanicPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import { StudyPlan, ChatMessage, PanicPlan, UserStats } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, db, googleProvider, handleFirestoreError, OperationType, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, updateProfile } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
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
  ChevronDown,
  MessageSquare,
  Copy,
  Check
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

  // Auth Listener
  useEffect(() => {
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
      setAuthLoading(false);
    }).catch((error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
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

    return () => {
      plansUnsubscribe();
      messagesUnsubscribe();
      panicUnsubscribe();
    };
  }, [user, activePlanId]);

  const activePlan = studyPlans.find(p => p.id === activePlanId) || null;

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.remove('yin', 'yang');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('User closed the sign-in popup.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        console.log('Popup request was cancelled.');
      } else {
        console.error('Sign-in error:', err);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setStudyPlans([]);
      setActivePlanId(null);
      setCustomRules('');
    } catch (err) {
      console.error(err);
    }
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
                              await setDoc(planRef, { ...plan, id: planRef.id });
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
                      user ? <ChatPage studyPlan={activePlan} customRules={customRules} messages={messages} addMessage={addMessage} awardXP={awardXP} /> : <Navigate to="/" />
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

const COUNTRIES = [
  { name: 'United States', code: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'India', code: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'Canada', code: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'France', code: 'FR', dial: '+33', flag: '🇫🇷' },
  { name: 'Japan', code: 'JP', dial: '+81', flag: '🇯🇵' },
  { name: 'Singapore', code: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971', flag: '🇦🇪' },
];

function LoginPage() {
  const { signIn } = useAuth();
  const [loginMode, setLoginMode] = useState<'google' | 'mobile'>('google');
  const [mobileData, setMobileData] = useState({ username: '', phone: '', otp: '', country: COUNTRIES[0] });
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  
  const words = "STUDYMATE".split("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorLog(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Login Error:", error);
      setErrorLog(`Google Error: ${error.code || error.message}`);
      if (error.code === 'auth/unauthorized-domain') {
        setErrorLog("Error: This domain is not authorized in Firebase. Please add your App URL to 'Authorized Domains' in the Firebase Console.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) return (window as any).recaptchaVerifier;
    
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });
    (window as any).recaptchaVerifier = verifier;
    return verifier;
  };
  
  const handleMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorLog(null);

    if (!otpSent) {
      try {
        const verifier = setupRecaptcha();
        const phoneNumber = `${mobileData.country.dial}${mobileData.phone.replace(/\D/g, '')}`;
        const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
        setConfirmationResult(result);
        setOtpSent(true);
        setLoading(false);
        
        setSimulatedCode("******");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 8000);
      } catch (error: any) {
        console.error("Error sending OTP:", error);
        setErrorLog(`Mobile Error: ${error.code || error.message}`);
        if (error.code === 'auth/operation-not-allowed') {
          setErrorLog("Error: Phone Auth is not enabled in Firebase Console.");
        }
        setLoading(false);
      }
    } else {
      try {
        if (!confirmationResult) throw new Error("No confirmation result");
        const userCredential = await confirmationResult.confirm(mobileData.otp);
        if (mobileData.username && userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: mobileData.username
          });
        }
      } catch (error: any) {
        console.error("Error verifying OTP:", error);
        setErrorLog(`Verification Error: ${error.code || error.message}`);
        setLoading(false);
      }
    }
  };
  
  return (
    <div className="relative min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center py-20 px-4 overflow-hidden">
      {/* Igloo.inc inspired grid background */}
      <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '60px 60px' 
        }} 
      />
      
      {/* Subtle radial glow */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--accent-rgb),0.05),transparent_70%)] pointer-events-none" />

      {/* reCAPTCHA Container */}
      <div id="recaptcha-container"></div>

      {/* Simulated SMS Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[320px] px-4"
          >
            <div className="bg-background/95 backdrop-blur-xl border border-foreground/10 shadow-2xl rounded-3xl p-4 flex items-start gap-4 ring-1 ring-foreground/5">
              <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <MessageSquare size={20} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">Messages</span>
                  <span className="text-[10px] text-muted/60">now</span>
                </div>
                <p className="text-xs font-bold text-foreground leading-tight">
                  StudyMate Verification
                </p>
                <p className="text-[11px] text-muted mt-1 leading-snug flex items-center justify-between gap-2">
                  <span>A security code has been sent to your phone. Please check your SMS.</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 space-y-16 w-full max-w-6xl flex flex-col items-center">
        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block px-5 py-2 rounded-full border border-accent/30 bg-accent/5 text-accent text-[11px] font-bold uppercase tracking-[0.3em] mb-4"
          >
            Intelligent Academic Companion
          </motion.div>
          
          <div className="flex justify-center overflow-hidden h-10 sm:h-20">
            {words.map((char, i) => (
              <motion.span
                key={i}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ 
                  duration: 1, 
                  delay: i * 0.05, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                className={cn(
                  "inline-block text-2xl sm:text-[4rem] font-display font-black tracking-tighter leading-[0.8]",
                  i >= 5 ? "text-accent" : "text-foreground"
                )}
              >
                {char}
              </motion.span>
            ))}
          </div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-muted max-w-xl mx-auto text-lg sm:text-2xl font-medium leading-tight tracking-tight opacity-80"
          >
            A minimalist framework for your academic success. <br className="hidden sm:block" /> Built for focus, powered by AI.
          </motion.p>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md space-y-8"
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
              onClick={() => setLoginMode('mobile')}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                loginMode === 'mobile' ? "bg-background text-foreground shadow-lg" : "text-muted hover:text-foreground"
              )}
            >
              Mobile
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
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                  >
                    {errorLog}
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
              </motion.div>
            ) : (
              <motion.form
                key="mobile"
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleMobileLogin}
                className="space-y-4 text-left"
              >
                {errorLog && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                  >
                    {errorLog}
                  </motion.div>
                )}
                <div className="space-y-4">
                  {!otpSent && (
                    <motion.div layout className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Username</label>
                        <input 
                          type="text" 
                          placeholder="Enter your name"
                          required
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                          value={mobileData.username}
                          onChange={(e) => setMobileData({...mobileData, username: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-1">Mobile Number</label>
                        <div className="flex gap-2">
                          <div className="relative group">
                            <select 
                              className="appearance-none bg-foreground/10 border border-foreground/20 text-foreground rounded-xl px-4 py-4 pr-10 focus:outline-none focus:ring-2 focus:ring-accent transition-all cursor-pointer font-bold text-sm"
                              value={mobileData.country.code}
                              onChange={(e) => {
                                const country = COUNTRIES.find(c => c.code === e.target.value) || COUNTRIES[0];
                                setMobileData({...mobileData, country});
                              }}
                            >
                              {COUNTRIES.map(c => (
                                <option key={c.code} value={c.code} className="bg-background text-foreground py-2">
                                  {c.flag} {c.dial}
                                </option>
                              ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted group-hover:text-foreground transition-colors">
                              <ChevronDown size={14} />
                            </div>
                          </div>
                          <input 
                            type="tel" 
                            placeholder="555 000-0000"
                            required
                            className="flex-1 bg-foreground/5 border border-foreground/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                            value={mobileData.phone}
                            onChange={(e) => setMobileData({...mobileData, phone: e.target.value})}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {otpSent && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 p-4 bg-accent/5 border border-accent/20 rounded-2xl"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-accent">OTP Code Sent</label>
                        <button 
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-foreground underline"
                        >
                          Change Number
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="000000"
                        required
                        autoFocus
                        className="w-full bg-background border border-accent/30 rounded-xl px-4 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all tracking-[0.5em] text-center font-bold text-xl"
                        value={mobileData.otp}
                        onChange={(e) => setMobileData({...mobileData, otp: e.target.value})}
                      />
                      <p className="text-[9px] text-muted text-center mt-2">Enter the 6-digit code sent to your device</p>
                    </motion.div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-foreground text-background rounded-2xl font-bold hover:bg-accent hover:text-accent-foreground transition-all duration-500 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : otpSent ? (
                    "Verify & Initialize"
                  ) : (
                    "Send OTP Code"
                  )}
                </button>
                {!otpSent && (
                  <p className="text-[9px] text-muted text-center opacity-60">
                    * OTP simulation: Click to reveal the verification field
                  </p>
                )}
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
              className="p-10 rounded-[2.5rem] border border-foreground/5 bg-foreground/[0.01] text-left hover:bg-foreground/[0.03] hover:border-accent/20 transition-all duration-700 group"
            >
              <div className="h-1 w-12 bg-accent mb-8 rounded-full group-hover:w-20 transition-all duration-700" />
              <h3 className="font-bold text-foreground text-2xl mb-3 tracking-tight">{feature.title}</h3>
              <p className="text-base text-muted leading-relaxed font-medium opacity-80">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}


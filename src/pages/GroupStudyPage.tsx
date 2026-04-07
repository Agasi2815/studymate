import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Link as LinkIcon, 
  Video, 
  FileText, 
  Youtube, 
  Send, 
  X, 
  Monitor, 
  User as UserIcon,
  Copy,
  Check,
  Play,
  Pause,
  Clock,
  LogOut,
  Cpu,
  Trash2,
  Loader2
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { GroupSession } from '../types';

export default function GroupStudyPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [activeSession, setActiveSession] = useState<GroupSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [copied, setCopied] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'groupSessions'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as GroupSession));
      setSessions(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeSession || !user) return;

    // Update presence
    const sessionRef = doc(db, 'groupSessions', activeSession.id);
    const path = `groupSessions/${activeSession.id}`;
    
    updateDoc(sessionRef, {
      [`participants.${user.uid}`]: {
        name: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        lastSeen: serverTimestamp()
      }
    }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GroupSession;
        setActiveSession({ ...data, id: snap.id });
        setNotesInput(data.sharedNotes || '');
      } else {
        setActiveSession(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, path));

    return () => {
      unsubscribe();
      // Clean up presence on leave
      // Only if we haven't just deleted the session
      if (activeSession) {
        const sessionRef = doc(db, 'groupSessions', activeSession.id);
        // We use getDoc to check if it still exists before trying to update
        getDoc(sessionRef).then((snap) => {
          if (snap.exists()) {
            updateDoc(sessionRef, {
              [`participants.${user.uid}`]: deleteField()
            }).catch(() => {
              // Ignore errors on cleanup as the session might have been deleted by creator
            });
          }
        }).catch(() => {});
      }
    };
  }, [activeSession?.id, user?.uid]);

  const handleCreateSession = async () => {
    if (!user || !newSessionName.trim()) return;

    const sessionRef = doc(collection(db, 'groupSessions'));
    const path = `groupSessions/${sessionRef.id}`;
    
    const newSession: Partial<GroupSession> = {
      name: newSessionName,
      creatorId: user.uid,
      creatorName: user.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
      active: true,
      participants: {
        [user.uid]: {
          name: user.displayName || 'Anonymous',
          photoURL: user.photoURL || '',
          lastSeen: serverTimestamp()
        }
      }
    };

    try {
      await setDoc(sessionRef, newSession);
      setActiveSession({ ...newSession, id: sessionRef.id } as GroupSession);
      setShowCreateModal(false);
      setNewSessionName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleJoinSession = (session: GroupSession) => {
    setActiveSession(session);
  };

  const handleLeaveSession = () => {
    if (activeSession && user) {
      const path = `groupSessions/${activeSession.id}`;
      updateDoc(doc(db, 'groupSessions', activeSession.id), {
        [`participants.${user.uid}`]: deleteField()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
    }
    setActiveSession(null);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsSharing(false);
  };

  const handleDeleteSession = async () => {
    if (!activeSession || !user || activeSession.creatorId !== user.uid) return;
    
    const sessionId = activeSession.id;
    const path = `groupSessions/${sessionId}`;
    try {
      // Set activeSession to null first to prevent cleanup effect from trying to update it
      const currentSessionId = activeSession.id;
      setActiveSession(null);
      setShowDeleteConfirm(false);
      
      await deleteDoc(doc(db, 'groupSessions', sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const copyInviteLink = () => {
    if (!activeSession) return;
    const link = `${window.location.origin}/group-study?join=${activeSession.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateVideoUrl = () => {
    if (!activeSession || !videoUrlInput.trim()) return;
    // Extract YouTube ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = videoUrlInput.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (videoId) {
      const path = `groupSessions/${activeSession.id}`;
      updateDoc(doc(db, 'groupSessions', activeSession.id), {
        sharedVideoUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
      setVideoUrlInput('');
    } else {
      setShareError("Invalid YouTube URL. Please use a direct link to a video.");
      setTimeout(() => setShareError(null), 3000);
    }
  };

  const updateNotes = (val: string) => {
    setNotesInput(val);
    if (activeSession) {
      const path = `groupSessions/${activeSession.id}`;
      updateDoc(doc(db, 'groupSessions', activeSession.id), {
        sharedNotes: val
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
    }
  };

  const toggleScreenShare = async () => {
    setShareError(null);
    if (isSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsSharing(false);
      if (activeSession && user) {
        const path = `groupSessions/${activeSession.id}`;
        updateDoc(doc(db, 'groupSessions', activeSession.id), {
          [`participants.${user.uid}.isSharingScreen`]: false
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
      }
    } else {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error("Screen sharing is not supported in this browser or device. Try using a desktop browser.");
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsSharing(true);
        if (activeSession && user) {
          const path = `groupSessions/${activeSession.id}`;
          updateDoc(doc(db, 'groupSessions', activeSession.id), {
            [`participants.${user.uid}.isSharingScreen`]: true
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
        }
        stream.getTracks()[0].onended = () => {
          setIsSharing(false);
          if (activeSession && user) {
            const path = `groupSessions/${activeSession.id}`;
            updateDoc(doc(db, 'groupSessions', activeSession.id), {
              [`participants.${user.uid}.isSharingScreen`]: false
            }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
          }
        };
      } catch (err) {
        console.error("Error sharing screen:", err);
        setShareError(err instanceof Error ? err.message : "Failed to share screen");
        setTimeout(() => setShareError(null), 5000);
      }
    }
  };

  if (activeSession) {
    return (
      <div className="min-h-[calc(100dvh-6rem)] flex flex-col gap-4 md:gap-6">
        {/* Session Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 glass rounded-2xl gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-lg truncate">{activeSession.name}</h2>
              <p className="text-xs text-muted truncate">Host: {activeSession.creatorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={copyInviteLink}
              className="flex-1 sm:flex-none p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-foreground/5"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Invite'}
            </button>
            
            {activeSession.creatorId === user?.uid ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 sm:flex-none p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                End
              </button>
            ) : (
              <button
                onClick={handleLeaveSession}
                className="flex-1 sm:flex-none p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Leave
              </button>
            )}
          </div>
        </div>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 min-h-0">
          {/* Main Content Area */}
          <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6 min-h-0">
            {/* Video / Screen Share Area */}
            <div className={cn(
              "glass rounded-2xl md:rounded-[2.5rem] overflow-hidden relative group bg-black/40 border-white/5 shadow-2xl transition-all",
              !activeSession.sharedVideoUrl && !isSharing ? "min-h-[320px] md:aspect-video" : "aspect-video"
            )}>
              {activeSession.sharedVideoUrl ? (
                <iframe
                  src={activeSession.sharedVideoUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : isSharing ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 md:p-8 space-y-4">
                  <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Video className="h-6 w-6 md:h-8 md:w-8 text-accent" />
                  </div>
                  <div className="space-y-1 md:space-y-2">
                    <h3 className="font-bold text-lg md:text-xl">No Active Stream</h3>
                    <p className="text-xs md:text-sm text-muted max-w-[240px] md:max-w-xs mx-auto">Share a YouTube video or your screen to start the session.</p>
                  </div>
                  <div className="flex gap-2 w-full max-w-[280px] md:max-w-sm">
                    <input
                      type="text"
                      placeholder="Paste YouTube URL..."
                      className="flex-grow glass bg-white/5 rounded-xl px-3 md:px-4 py-2 text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                    />
                    <button
                      onClick={updateVideoUrl}
                      className="p-2 bg-accent text-accent-foreground rounded-xl hover:scale-105 transition-all shrink-0"
                    >
                      <Youtube className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                  </div>
                  <button
                    onClick={toggleScreenShare}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background rounded-xl font-bold text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-all"
                  >
                    <Monitor className="h-4 w-4" />
                    Share Screen
                  </button>

                  {shareError && (
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-[10px] md:text-xs font-medium"
                    >
                      {shareError}
                    </motion.p>
                  )}
                </div>
              )}
              
              {/* Overlay Controls */}
              {(activeSession.sharedVideoUrl || isSharing) && (
                <div className="absolute bottom-4 right-4 flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      const path = `groupSessions/${activeSession.id}`;
                      updateDoc(doc(db, 'groupSessions', activeSession.id), {
                        sharedVideoUrl: deleteField()
                      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
                    }}
                    className="p-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-all"
                    title="Stop Video"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={toggleScreenShare}
                    className={cn(
                      "p-2 backdrop-blur-md rounded-xl shadow-lg transition-all",
                      isSharing ? "bg-accent text-accent-foreground" : "bg-black/60 text-white hover:bg-accent"
                    )}
                    title="Toggle Screen Share"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Shared Notes Area */}
            <div className="flex-grow glass rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 flex flex-col gap-4 md:gap-6 min-h-0 border-white/5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base md:text-lg">Collaborative Notes</h3>
                    <p className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-muted">Syncing with {Object.keys(activeSession.participants || {}).length} peers</p>
                  </div>
                </div>
              </div>
              <textarea
                className="flex-grow bg-foreground/5 rounded-xl md:rounded-2xl p-4 md:p-6 border-none focus:ring-1 focus:ring-accent/30 resize-none text-sm leading-relaxed scrollbar-thin placeholder:text-muted/30"
                placeholder="Start typing notes for the group..."
                value={notesInput}
                onChange={(e) => updateNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="flex flex-col gap-4 md:gap-6 min-h-0">
            {/* Participants List */}
            <div className="glass rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 flex flex-col gap-4 md:gap-6 min-h-0 border-white/5 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                  </div>
                  <h3 className="font-bold text-sm md:text-base">Study Group</h3>
                </div>
                <span className="bg-accent/20 text-accent px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black tracking-tighter">
                  {Object.keys(activeSession.participants || {}).length} LIVE
                </span>
              </div>
              <div className="flex-grow overflow-y-auto space-y-3 md:space-y-4 pr-2 custom-scrollbar max-h-[300px] lg:max-h-none">
                {Object.entries(activeSession.participants || {}).map(([uid, p]) => (
                  <div key={uid} className="flex items-center justify-between p-2 md:p-3 rounded-xl md:rounded-2xl bg-foreground/5 border border-white/5 hover:bg-foreground/10 transition-all group/item">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {p.photoURL ? (
                          <img src={p.photoURL} className="h-8 w-8 md:h-10 md:w-10 rounded-full border-2 border-accent/20" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-foreground/10 flex items-center justify-center border-2 border-accent/20">
                            <UserIcon className="h-4 w-4 md:h-5 md:w-5 text-muted" />
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 bg-green-500 border-2 border-background rounded-full shadow-sm" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs md:text-sm font-bold tracking-tight">{p.name} {uid === user?.uid && '(You)'}</span>
                        {p.isSharingScreen ? (
                          <span className="text-[8px] md:text-[10px] text-accent flex items-center gap-1 font-bold uppercase tracking-widest">
                            <Monitor className="h-2 w-2 md:h-3 md:w-3" /> Presenting
                          </span>
                        ) : (
                          <span className="text-[8px] md:text-[10px] text-muted font-medium">Active now</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Chat / Activity */}
            <div className="glass rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 space-y-4 md:space-y-6 border-white/5 shadow-xl">
              <h3 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted">Session Intelligence</h3>
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 md:gap-4 text-sm p-3 md:p-4 rounded-xl md:rounded-2xl bg-foreground/5 border border-white/5">
                  <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Clock className="h-3 w-3 md:h-4 md:w-4 text-accent" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] md:text-[10px] uppercase font-bold text-muted">Started At</span>
                    <span className="font-bold text-xs md:text-sm">{new Date(activeSession.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-accent/5 border border-accent/10 group cursor-pointer hover:bg-accent/10 transition-all" onClick={copyInviteLink}>
                  <p className="text-[8px] md:text-[10px] text-muted font-bold uppercase tracking-widest mb-1 md:mb-2 flex justify-between">
                    Invite Code
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <code className="text-xs md:text-sm font-mono text-accent font-bold tracking-wider">{activeSession.id}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="glass p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 border-red-500/30"
              >
                <div className="text-center space-y-4">
                  <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Trash2 className="h-10 w-10 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">End Session?</h3>
                    <p className="text-muted text-sm leading-relaxed">This will permanently close the study room for all participants. This action cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-4 rounded-2xl bg-foreground/10 font-bold hover:bg-foreground/20 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteSession}
                    className="flex-1 py-4 rounded-2xl bg-red-500 font-bold hover:bg-red-600 transition-all text-white shadow-lg shadow-red-500/20"
                  >
                    End Room
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Group Study Sessions</h1>
          <p className="text-sm text-muted">Collaborate with peers in real-time study rooms.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20 text-sm"
        >
          <Plus className="h-5 w-5" />
          Create Session
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              layoutId={session.id}
              className="glass p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border-white/5 hover:border-accent/30 transition-all group relative overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 right-0 p-4 md:p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                {session.creatorId === user?.uid && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSession(session);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="flex justify-between items-start">
                  <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform border border-accent/20">
                    <Users className="h-6 w-6 md:h-7 md:w-7 text-accent" />
                  </div>
                  <div className="flex -space-x-2 md:-space-x-3">
                    {Object.values(session.participants || {}).slice(0, 4).map((p, i) => (
                      <div key={i} className="relative">
                        {p.photoURL ? (
                          <img src={p.photoURL} className="h-6 w-6 md:h-8 md:w-8 rounded-full border-2 border-background shadow-sm" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-foreground/10 border-2 border-background flex items-center justify-center shadow-sm">
                            <UserIcon className="h-3 w-3 md:h-4 md:w-4 text-muted" />
                          </div>
                        )}
                      </div>
                    ))}
                    {Object.keys(session.participants || {}).length > 4 && (
                      <div className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-accent text-accent-foreground border-2 border-background flex items-center justify-center text-[8px] md:text-[10px] font-black shadow-sm">
                        +{Object.keys(session.participants || {}).length - 4}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1 md:space-y-2">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight group-hover:text-accent transition-colors truncate">{session.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-muted uppercase tracking-widest">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Host: {session.creatorName}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-foreground/5 border border-white/5 flex flex-col items-center justify-center text-center">
                    <span className="text-base md:text-lg font-black text-foreground">{Object.keys(session.participants || {}).length}</span>
                    <span className="text-[7px] md:text-[8px] uppercase font-bold text-muted tracking-widest">Online</span>
                  </div>
                  <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-foreground/5 border border-white/5 flex flex-col items-center justify-center text-center">
                    <span className="text-base md:text-lg font-black text-foreground">
                      {session.sharedVideoUrl ? '1' : '0'}
                    </span>
                    <span className="text-[7px] md:text-[8px] uppercase font-bold text-muted tracking-widest">Streams</span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinSession(session)}
                  className="w-full py-3 md:py-4 bg-foreground text-background rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-accent hover:text-accent-foreground transition-all shadow-lg shadow-black/10 active:scale-95"
                >
                  Enter Room
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass rounded-[2.5rem] border-dashed border-foreground/10">
          <div className="h-20 w-20 bg-foreground/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="h-10 w-10 text-muted" />
          </div>
          <h3 className="text-xl font-bold text-muted">No active sessions</h3>
          <p className="text-muted max-w-xs mx-auto mt-2">Start a new session and invite your friends to study together.</p>
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass p-8 rounded-[2.5rem] max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">New Study Session</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-foreground/5 rounded-full transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">Session Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Finals Prep Group"
                    className="w-full glass bg-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleCreateSession}
                  className="w-full py-4 bg-accent text-accent-foreground rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20"
                >
                  Start Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

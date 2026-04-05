import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, BookOpen, Calendar, Clock, BarChart3, FileText, ListPlus, Upload, X as CloseIcon, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import { generateStudyPlan } from '../lib/gemini';
import { StudyPlan, FilePart } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { User } from 'firebase/auth';

interface SetupPageProps {
  user: User;
  setStudyPlan: (plan: StudyPlan) => Promise<void>;
  customRules: string;
}

interface UploadedFile {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'other';
}

export default function SetupPage({ user, setStudyPlan, customRules }: SetupPageProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const [formData, setFormData] = useState({
    subject: '',
    examDate: '',
    dailyHours: 4,
    difficulty: 'Moderate',
    customTopics: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total

    const currentTotalSize = uploadedFiles.reduce((acc, f) => acc + f.file.size, 0);
    let newTotalSize = currentTotalSize;

    const validFiles: UploadedFile[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} is too large. Max 50MB per file.`);
        continue;
      }
      if (newTotalSize + file.size > MAX_TOTAL_SIZE) {
        setError(`Total upload size exceeded. Max 100MB total.`);
        break;
      }
      newTotalSize += file.size;
      validFiles.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'other'
      });
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.examDate) {
      setError("Please fill in the subject and exam date.");
      return;
    }

    const examDate = new Date(formData.examDate);
    if (examDate <= new Date()) {
      setError("Exam date must be in the future.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fileParts: FilePart[] = await Promise.all(
        uploadedFiles.map(async (u) => ({
          inlineData: {
            data: await fileToBase64(u.file),
            mimeType: u.file.type
          }
        }))
      );

      const plan = await generateStudyPlan(
        formData.subject,
        formData.examDate,
        formData.dailyHours,
        formData.difficulty,
        formData.customTopics,
        fileParts,
        customRules
      );
      setStudyPlan(plan);
      navigate('/timetable');
    } catch (err: any) {
      let displayError = err.message || "Failed to generate study plan. Please try again.";
      
      // Handle Firestore JSON error format
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          displayError = `System Error: ${parsed.error}. This might be due to security rules or connectivity.`;
        }
      } catch (e) {
        // Not a JSON error, use original message
      }
      
      setError(displayError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Welcome back, <span className="accent-text">{user.displayName?.split(' ')[0] || 'Scholar'}</span>!
        </h1>
        <p className="text-muted max-w-lg mx-auto">
          Ready to conquer your exams? Tell us about your subject, and our AI will build the perfect study roadmap for you.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-foreground">✕</button>
        </div>
      )}

      <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6 p-8 rounded-3xl glass">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Subject Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Advanced Thermodynamics"
              className="w-full glass bg-transparent text-foreground rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Exam Date
            </label>
            <input
              type="date"
              required
              className="w-full glass bg-transparent text-foreground rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
              value={formData.examDate}
              onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-muted flex items-center gap-2">
                <Clock className="h-4 w-4" /> Daily Study Hours
              </label>
              <span className="text-accent font-bold">{formData.dailyHours}h</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              className="w-full accent-accent bg-foreground/10 h-2 rounded-full appearance-none cursor-pointer"
              value={formData.dailyHours}
              onChange={(e) => setFormData({ ...formData, dailyHours: parseInt(e.target.value) })}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Difficulty Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['Easy', 'Moderate', 'Hard', 'Exam Crammer'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, difficulty: level })}
                  className={cn(
                    "px-4 py-3 rounded-xl border text-sm font-bold transition-all duration-300",
                    formData.difficulty === level 
                      ? "bg-accent text-accent-foreground border-accent shadow-lg shadow-accent/20 scale-[1.02]" 
                      : "glass border-white/5 text-muted hover:border-white/20 hover:bg-white/5"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-8 rounded-3xl glass">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <FileText className="h-4 w-4" /> Syllabus Files
            </label>
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group cursor-pointer border-2 border-dashed border-foreground/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-accent/50 hover:bg-accent/5 transition-all"
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <div className="h-10 w-10 rounded-full bg-foreground/5 flex items-center justify-center group-hover:bg-accent/20 transition-all">
                  <Upload className="h-5 w-5 text-muted group-hover:text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload syllabus files</p>
                  <p className="text-xs text-muted">PDFs or Images (Max 50MB)</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <AnimatePresence>
                  {uploadedFiles.map((file, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group h-20 w-20 rounded-lg overflow-hidden glass border-foreground/10"
                    >
                      {file.type === 'image' ? (
                        <img src={file.preview} alt="preview" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center gap-1 bg-foreground/5">
                          <FileIcon className="h-6 w-6 text-accent" />
                          <span className="text-[8px] font-bold uppercase truncate px-1 w-full text-center">PDF</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all z-10"
                        title="Remove file"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted flex items-center gap-2">
              <ListPlus className="h-4 w-4" /> Quick-add Topics
            </label>
            <textarea
              placeholder="One topic per line..."
              className="w-full glass bg-transparent text-foreground rounded-xl px-4 py-3 h-32 focus:outline-none focus:ring-1 focus:ring-accent transition-all resize-none"
              value={formData.customTopics}
              onChange={(e) => setFormData({ ...formData, customTopics: e.target.value })}
            />
          </div>
        </div>

        <div className="md:col-span-2 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full accent-bg py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Generating Your Plan...
              </>
            ) : (
              <>
                <Sparkles className="h-6 w-6" />
                Generate Study Plan
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

export interface StudySession {
  topic: string;
  duration: number;
  importance: 'high' | 'medium' | 'low';
  tip: string;
  completed?: boolean;
}

export interface StudyDay {
  dayIndex: number;
  focus: string;
  sessions: StudySession[];
}

export interface StudyPlan {
  id?: string;
  subject: string;
  examDate: string;
  dailyHours: number;
  difficulty: string;
  topics: string[];
  days: StudyDay[];
  updatedAt?: any;
}

export interface PanicTopic {
  topic: string;
  why: string;
  keyPoints: string[];
  likelyQuestions: string[];
  memoriseTip: string;
}

export interface PanicPlan {
  subject: string;
  panicTopics: PanicTopic[];
  examDayAdvice: string;
  createdAt?: any;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface UserStats {
  xp: number;
  level: number;
  badges: string[];
  streak: number;
  lastStudyDate?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export interface FilePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Loader2, Bot, User, Square, Sparkles, HelpCircle, FileText, Lightbulb, Copy, Check, Brain, Trophy, AlertTriangle } from 'lucide-react';
import { StudyPlan, ChatMessage, Quiz, QuizQuestion } from '../types';
import { getChatStream, generateQuiz } from '../lib/gemini';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ChatPageProps {
  studyPlan: StudyPlan | null;
  customRules: string;
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => Promise<void>;
  awardXP: (amount: number) => void;
  onQuizComplete?: (topic: string, score: number) => void;
}

export default function ChatPage({ studyPlan, customRules, messages, addMessage, awardXP, onQuizComplete }: ChatPageProps) {
  const location = useLocation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'quiz'>('chat');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const streamingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const promptHandled = useRef(false);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (location.state?.prompt && !promptHandled.current) {
      handleSend(location.state.prompt);
      promptHandled.current = true;
    }
  }, [location.state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [localMessages]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || streaming) return;

    const userMessage: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() };
    
    // Update local messages and history
    const newMessages = [...localMessages, userMessage];
    setLocalMessages(newMessages);
    await addMessage(userMessage);
    
    setInput('');
    setLoading(true);
    setStreaming(true);
    streamingRef.current = true;

    const history = localMessages.map(m => ({
      role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }]
    }));

    try {
      const stream = await getChatStream(
        text,
        history,
        { 
          subject: studyPlan?.subject || 'general studies', 
          topics: studyPlan?.topics || [] 
        },
        customRules
      );

      let fullContent = '';
      setLocalMessages(prev => [...prev, { role: 'model', content: '', timestamp: new Date().toISOString() }]);

      for await (const chunk of stream) {
        if (!streamingRef.current) break;
        
        const chunkText = chunk.text || "";
        fullContent += chunkText;
        
        // Update state immediately for maximum speed
        setLocalMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'model') {
            last.content = fullContent;
          }
          return updated;
        });
      }
      
      if (streamingRef.current) {
        await addMessage({ role: 'model', content: fullContent, timestamp: new Date().toISOString() });
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      
      let displayMessage = "I'm sorry, I hit a snag. Please try sending your message again.";
      const errorStr = err.message || "";

      if (errorStr.includes('AI_LIMIT_REACHED')) {
        displayMessage = "AI Daily Limit Reached. The free tier of Gemini has a limit of 20 requests per day. Please try again later or add your own API key in settings.";
      } else if (errorStr.includes('AI_HIGH_DEMAND')) {
        displayMessage = "The AI is currently experiencing high demand. Please wait a moment and try again.";
      } else {
        try {
          // Try to parse if it's a JSON string from the SDK
          let apiError = err;
          if (typeof err.message === 'string') {
            const firstLevel = JSON.parse(err.message);
            apiError = firstLevel.error || firstLevel;
            
            // Handle nested JSON in message
            if (typeof apiError.message === 'string' && apiError.message.includes('{')) {
              const secondLevel = JSON.parse(apiError.message);
              apiError = secondLevel.error || secondLevel;
            }
          }
          
          if (apiError.code === 429 || apiError.status === 'RESOURCE_EXHAUSTED' || apiError.message?.includes('quota')) {
            displayMessage = "AI Daily Limit Reached. The free tier of Gemini has a limit of 20 requests per day. Please try again later or add your own API key in settings.";
          } else if (apiError.code === 503 || apiError.status === 'UNAVAILABLE') {
            displayMessage = "The AI is currently experiencing high demand. Please wait a moment and try again.";
          } else if (apiError.message) {
            displayMessage = `I hit a snag: ${apiError.message}`;
          }
        } catch (e) {
          // Fallback to raw message if parsing fails
          displayMessage = `I'm sorry, I hit a snag: ${err.message || 'Connection lost'}. Please try again.`;
        }
      }

      const errorMessage: ChatMessage = { 
        role: 'model', 
        content: displayMessage, 
        timestamp: new Date().toISOString() 
      };
      setLocalMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreaming(false);
      streamingRef.current = false;
    }
  };

  const stopStreaming = () => {
    setStreaming(false);
    streamingRef.current = false;
    setLoading(false);
  };

  const handleStartQuiz = async () => {
    if (!studyPlan) return;
    setQuizLoading(true);
    setQuizError(null);
    setActiveTab('quiz');
    try {
      const newQuiz = await generateQuiz(studyPlan.subject, studyPlan.topics, customRules);
      setQuiz(newQuiz);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setQuizScore(0);
      setQuizFinished(false);
    } catch (err: any) {
      console.error(err);
      setQuizError(err.message || "Failed to generate quiz. Please try again.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (selectedOption !== null || !quiz) return;
    setSelectedOption(optionIndex);
    
    if (optionIndex === quiz.questions[currentQuestionIndex].correctAnswer) {
      setQuizScore(prev => prev + 1);
      awardXP(50);
    }
  };

  const handleNextQuestion = () => {
    if (!quiz) return;
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
      const finalScore = Math.round((quizScore / quiz.questions.length) * 100);
      if (onQuizComplete) {
        onQuizComplete(studyPlan?.subject || 'General', finalScore);
      }
      if (quizScore === quiz.questions.length) {
        awardXP(200); // Bonus for perfect score
      }
    }
  };

  const quickActions = [
    { label: 'Explain a concept', icon: Lightbulb, prompt: 'Can you explain a difficult concept from my syllabus in simple terms?' },
    { label: 'Quiz me', icon: HelpCircle, prompt: 'Give me a 5-question multiple choice quiz on my study topics.' },
    { label: 'Summarise today', icon: FileText, prompt: 'Can you summarise the key points I should have learned today?' },
    { label: 'Give me a mnemonic', icon: Sparkles, prompt: 'Help me remember a complex list or process using a mnemonic.' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100dvh-14rem)] md:h-[calc(100vh-12rem)] flex flex-col gap-4 overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex gap-4 border-b border-foreground/10">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "pb-2 text-sm font-bold transition-all relative",
            activeTab === 'chat' ? "text-accent" : "text-muted hover:text-foreground"
          )}
        >
          AI Tutor
          {activeTab === 'chat' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => activeTab === 'quiz' ? null : handleStartQuiz()}
          className={cn(
            "pb-2 text-sm font-bold transition-all relative flex items-center gap-2",
            activeTab === 'quiz' ? "text-accent" : "text-muted hover:text-foreground"
          )}
        >
          <Brain className="h-4 w-4" />
          Quiz Mode
          {activeTab === 'quiz' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Quick Actions */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar shrink-0">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleSend(action.prompt)}
            disabled={streaming}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass border-foreground/5 whitespace-nowrap text-xs font-medium hover:bg-foreground/5 transition-all hover:border-accent/30"
          >
            <action.icon className="h-3 w-3 text-accent" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-grow glass rounded-2xl p-4 overflow-y-auto space-y-6 no-scrollbar min-h-0"
      >
        {localMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <Bot className="h-12 w-12 text-accent" />
            <div className="space-y-1">
              <h3 className="text-xl font-bold">StudyYou AI Tutor</h3>
              <p className="text-sm max-w-xs">Ask me anything about your subject, request a quiz, or get study tips.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {localMessages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex items-end gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mb-1 shadow-sm",
                msg.role === 'user' ? "bg-accent text-accent-foreground" : "bg-foreground/10 text-accent"
              )}>
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn(
                "relative group flex flex-col",
                msg.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all duration-300",
                  msg.role === 'user' 
                    ? "bg-accent text-accent-foreground font-medium rounded-br-none" 
                    : "bg-foreground/5 text-foreground border border-foreground/5 rounded-bl-none"
                )}>
                  <div className="markdown-body prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/20 prose-pre:p-2 prose-pre:rounded-lg">
                    <ReactMarkdown
                      components={{
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 flex items-center gap-2" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        code: ({node, ...props}) => <code className="bg-foreground/10 px-1 rounded text-accent font-mono text-xs" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.role === 'model' && msg.content === '' && (
                    <div className="flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    </div>
                  )}
                </div>
                
                {msg.role === 'model' && msg.content !== '' && (
                  <button
                    onClick={() => handleCopy(msg.content, i)}
                    className="absolute -right-10 bottom-0 p-2 text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === i ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="relative flex-shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your AI Tutor..."
          disabled={streaming}
          className="w-full glass rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
            >
              <Square className="h-5 w-5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-accent text-accent-foreground hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>
        </>
      ) : (
        <div className="flex-grow glass rounded-2xl p-8 overflow-y-auto no-scrollbar flex flex-col items-center justify-center">
          {quizLoading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-accent animate-spin" />
              <p className="text-muted font-medium">Generating your custom quiz...</p>
            </div>
          ) : quizError ? (
            <div className="text-center space-y-6 max-w-md">
              <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Quiz Generation Failed</h3>
                <p className="text-muted text-sm">{quizError}</p>
              </div>
              <button
                onClick={handleStartQuiz}
                className="w-full py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : quizFinished ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 max-w-md"
            >
              <div className="h-24 w-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="h-12 w-12 text-accent" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Quiz Complete!</h2>
                <p className="text-muted">You scored {quizScore} out of {quiz?.questions.length}</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-2xl border border-accent/20">
                <p className="text-sm font-medium text-accent">+{quizScore * 50 + (quizScore === quiz?.questions.length ? 200 : 0)} XP Earned</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleStartQuiz}
                  className="flex-grow py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
                >
                  Try Another
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="flex-grow py-3 bg-foreground/5 text-foreground rounded-xl font-bold hover:bg-foreground/10 transition-all"
                >
                  Back to Chat
                </button>
              </div>
            </motion.div>
          ) : quiz ? (
            <div className="w-full max-w-2xl space-y-8">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
                <div className="h-2 w-32 bg-foreground/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-500" 
                    style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-2xl font-bold leading-tight">{quiz.questions[currentQuestionIndex].question}</h3>
                
                <div className="grid grid-cols-1 gap-3">
                  {quiz.questions[currentQuestionIndex].options.map((option, i) => {
                    const isCorrect = i === quiz.questions[currentQuestionIndex].correctAnswer;
                    const isSelected = i === selectedOption;
                    
                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        disabled={selectedOption !== null}
                        className={cn(
                          "p-4 rounded-xl text-left transition-all border-2 flex justify-between items-center group",
                          selectedOption === null ? "bg-foreground/5 border-transparent hover:border-accent/50 hover:bg-accent/5" :
                          isCorrect ? "bg-green-500/10 border-green-500 text-green-500" :
                          isSelected ? "bg-red-500/10 border-red-500 text-red-500" :
                          "bg-foreground/5 border-transparent opacity-50"
                        )}
                      >
                        <span className="font-medium">{option}</span>
                        {selectedOption !== null && isCorrect && <Check className="h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {selectedOption !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-4 bg-foreground/5 rounded-xl border border-foreground/10">
                      <p className="text-sm text-muted leading-relaxed">
                        <span className="font-bold text-foreground block mb-1">Explanation:</span>
                        {quiz.questions[currentQuestionIndex].explanation}
                      </p>
                    </div>
                    <button
                      onClick={handleNextQuestion}
                      className="w-full py-4 bg-foreground text-background rounded-xl font-bold hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                      {currentQuestionIndex === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Brain className="h-12 w-12 text-accent mx-auto" />
              <h3 className="text-xl font-bold">Ready to test your knowledge?</h3>
              <p className="text-muted max-w-xs mx-auto">I'll generate a custom quiz based on your study plan topics.</p>
              <button
                onClick={handleStartQuiz}
                className="px-8 py-3 bg-accent text-accent-foreground rounded-xl font-bold hover:scale-105 transition-all"
              >
                Start Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

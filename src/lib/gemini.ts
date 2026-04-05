import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { StudyPlan, PanicPlan, FilePart, Quiz } from "../types";

// Initialize the Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to execute a function with retries.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes('xhr error') || error.message?.includes('500') || error.message?.includes('deadline exceeded'))) {
      console.warn(`Retrying after error: ${error.message}. Retries left: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Generates a study plan based on user input and optional syllabus files.
 */
export const generateStudyPlan = async (
  subject: string,
  examDate: string,
  dailyHours: number,
  difficulty: string,
  customTopics: string,
  files: FilePart[] = [],
  customRules: string = ""
): Promise<StudyPlan> => {
  const daysUntil = Math.ceil((new Date(examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const cappedDays = Math.min(daysUntil, 30); // Cap at 30 days for speed and token limits
  
  const prompt = `Create a study plan for ${subject}.
                  Exam in ${daysUntil} days. Daily commitment: ${dailyHours}h. Difficulty: ${difficulty}.
                  Topics: ${customTopics}.
                  ${customRules}
                  
                  Generate a structured roadmap for up to ${cappedDays} days. 
                  Respond ONLY with a valid JSON object:
                  {
                    "topics": ["string"],
                    "days": [
                      {
                        "dayIndex": number,
                        "focus": "string",
                        "sessions": [
                          {
                            "topic": "string",
                            "duration": number,
                            "importance": "high" | "medium" | "low",
                            "tip": "string"
                          }
                        ]
                      }
                    ]
                  }`;

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            ...files,
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topics: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayIndex: { type: Type.INTEGER },
                    focus: { type: Type.STRING },
                    sessions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          topic: { type: Type.STRING },
                          duration: { type: Type.INTEGER },
                          importance: { type: Type.STRING, enum: ["high", "medium", "low"] },
                          tip: { type: Type.STRING }
                        },
                        required: ["topic", "duration", "importance", "tip"]
                      }
                    }
                  },
                  required: ["dayIndex", "focus", "sessions"]
                }
              }
            },
            required: ["topics", "days"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      return { ...result, subject, examDate, dailyHours, difficulty } as StudyPlan;
    } catch (error: any) {
      console.error("Gemini Study Plan Error:", error);
      throw error;
    }
  });
};

/**
 * Generates a high-intensity panic study plan for short timeframes.
 */
export const generatePanicPlan = async (
  subject: string,
  hoursRemaining: number,
  topics: string[],
  customRules: string = ""
): Promise<PanicPlan> => {
  const prompt = `EMERGENCY STUDY MODE: I have an exam in ${subject} in only ${hoursRemaining} hours.
                  Topics I need to cover: ${topics.join(", ")}.
                  ${customRules}
                  
                  Create a high-intensity "Panic Plan" focusing on the most likely exam questions and key concepts.
                  Respond ONLY with a valid JSON object following this schema:
                  {
                    "panicTopics": [
                      {
                        "topic": "string",
                        "why": "string",
                        "keyPoints": ["string"],
                        "likelyQuestions": ["string"],
                        "memoriseTip": "string"
                      }
                    ],
                    "examDayAdvice": "string"
                  }`;

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              panicTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    why: { type: Type.STRING },
                    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    likelyQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    memoriseTip: { type: Type.STRING }
                  },
                  required: ["topic", "why", "keyPoints", "likelyQuestions", "memoriseTip"]
                }
              },
              examDayAdvice: { type: Type.STRING }
            },
            required: ["panicTopics", "examDayAdvice"]
          }
        }
      });

      return JSON.parse(response.text || "{}") as PanicPlan;
    } catch (error: any) {
      console.error("Gemini Panic Plan Error:", error);
      throw error;
    }
  });
};

/**
 * Generates a quick quiz for a subject and set of topics.
 */
export const generateQuiz = async (
  subject: string,
  topics: string[],
  customRules: string = ""
): Promise<Quiz> => {
  const prompt = `Create a challenging 5-question multiple-choice quiz for ${subject}.
                  Topics: ${topics.join(", ")}.
                  ${customRules}
                  
                  Respond ONLY with a valid JSON object following this schema:
                  {
                    "title": "string",
                    "questions": [
                      {
                        "question": "string",
                        "options": ["string"],
                        "correctAnswer": number,
                        "explanation": "string"
                      }
                    ]
                  }`;

  return withRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
                    correctAnswer: { type: Type.INTEGER, description: "Index of the correct option (0-3)" },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctAnswer", "explanation"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      });

      return JSON.parse(response.text || "{}") as Quiz;
    } catch (error: any) {
      console.error("Gemini Quiz Error:", error);
      throw error;
    }
  });
};

/**
 * Handles chat interactions with the AI tutor.
 */
export const getChatStream = async (
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  context: { subject: string, topics: string[] },
  customRules: string = ""
) => {
  const chat = ai.chats.create({
    model: "gemini-flash-latest",
    history: history,
    config: {
      systemInstruction: `You are StudyYou AI Tutor for ${context.subject}. 
                          Topics: ${context.topics.join(", ")}. 
                          BE EXTREMELY CONCISE. If the user says "Hi", just say "Hi" or something very short. 
                          Do NOT elaborate unless asked. Do NOT start by summarizing the study topics unless the user explicitly asks for a summary or a plan.
                          Use markdown and emojis sparingly. Focus on concept understanding only when prompted.
                          ${customRules}`,
    },
  });

  return await chat.sendMessageStream({ message });
};

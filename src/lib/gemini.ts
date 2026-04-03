// 1. Install 'openai' if you haven't: npm install openai
import { OpenAI } from "openai";
import { StudyPlan, PanicPlan, FilePart, Quiz } from "../types";

const apiKey = "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"; // Paste your nvapi- key here

// NVIDIA NIM uses the OpenAI-compatible client
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// Helper for NVIDIA JSON calls
const generateNVIDIAJson = async (systemInstruction: string, prompt: string, model: string = "nvidia/nemotron-3-super-120b-a12b") => {
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }, // Forces valid JSON
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0].message.content || "{}");
};

export const generateQuiz = async (
  subject: string,
  topics: string[],
  customRules: string = ""
): Promise<Quiz> => {
  const systemInstruction = `You are an expert quiz creator. Respond ONLY with valid JSON. ${customRules}`;
  const prompt = `Create a 5-question MCQs for ${subject}. Topics: ${topics.join(", ")}. 
                  Use this JSON structure: { "title": "string", "questions": [{ "question": "string", "options": [], "correctAnswer": 0, "explanation": "" }] }`;

  return await generateNVIDIAJson(systemInstruction, prompt) as Quiz;
};

export const generateStudyPlan = async (
  subject: string,
  examDate: string,
  dailyHours: number,
  difficulty: string,
  customTopics: string,
  files: FilePart[] = [], // Note: NVIDIA NIM handles file text differently than Google. Pass file content as text in the prompt.
  customRules: string = ""
): Promise<StudyPlan> => {
  const daysUntil = Math.ceil((new Date(examDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const systemInstruction = `You are an expert study planner. Respond ONLY with valid JSON. ${customRules}`;
  
  const prompt = `Create a study plan for ${subject}. Exam in ${daysUntil} days. ${dailyHours} hrs/day. Difficulty: ${difficulty}. Topics: ${customTopics}.
                  JSON required: { "topics": [], "days": [{ "dayIndex": 1, "focus": "", "sessions": [{ "topic": "", "duration": 45, "importance": "high", "tip": "" }] }] }`;

  const result = await generateNVIDIAJson(systemInstruction, prompt);
  return { ...result, subject, examDate, dailyHours, difficulty } as StudyPlan;
};

export const generatePanicPlan = async (
  subject: string,
  hoursRemaining: number,
  topics: string[],
  customRules: string = ""
): Promise<PanicPlan> => {
  const systemInstruction = `You are an expert exam coach. Respond ONLY with valid JSON. ${customRules}`;
  const prompt = `High-intensity panic study list for ${subject}. ${hoursRemaining} hours left. Topics: ${topics.join(", ")}.
                  JSON: { "panicTopics": [{ "topic": "", "why": "", "keyPoints": [], "likelyQuestions": [], "memoriseTip": "" }], "examDayAdvice": "" }`;

  return await generateNVIDIAJson(systemInstruction, prompt) as PanicPlan;
};

export const getChatStream = async (
  message: string,
  history: { role: 'user' | 'assistant', content: string }[], // Adjusted roles for OpenAI standard
  context: { subject: string, topics: string[] },
  customRules: string = ""
) => {
  const systemMessage = {
    role: "system",
    content: `You are StudyMate AI Tutor for ${context.subject}. 
              Topics: ${context.topics.join(", ")}. 
              Use markdown, emojis, and energetic tone. ${customRules}`
  };

  // Convert history and add system message
  const messages = [systemMessage, ...history, { role: "user", content: message }];

  return await client.chat.completions.create({
    model: "nvidia/nemotron-3-super-120b-a12b",
    messages: messages as any,
    stream: true,
  });
};
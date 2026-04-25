'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function askGemini(prompt: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

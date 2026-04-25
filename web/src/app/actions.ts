'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function askGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("CRITICAL: GEMINI_API_KEY is not defined in environment variables");
    throw new Error("Configuración incompleta: Falta la API Key de Gemini en el servidor.");
  }
  
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    console.error("Gemini API Call failed:", err);
    throw new Error(`Error de IA: ${err.message || 'Fallo en la comunicación con Google'}`);
  }
}

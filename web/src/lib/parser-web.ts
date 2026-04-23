import { GoogleGenerativeAI } from '@google/generative-ai';

export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda' | 'bano' | 'unknown';export interface ParsedData {
  nombre?: string;
  cantidad?: number;
  unidad?: string;
  descripcion?: string;
  dosis?: string;
  actividad?: string;
  minutos?: number;
  tipo?: 'pis' | 'caca';
  evento?: string;
  hora?: string;
  duracion?: number;
}

export interface ParsedRecord {
  category: Category;
  rawText: string;
  parsedData: ParsedData;
  notificar: boolean;
  status: 'pending';
  userId?: string;
  telegramMessageId?: number;
}

export async function parseMessage(
  text: string,
  dbParams?: { getAliases: () => Promise<any[]> },
  userId?: string,
  messageId?: number
): Promise<ParsedRecord | null> {
  const trimmed = text.trim();
  const notificar = trimmed.startsWith('!');
  const isCommand = trimmed.startsWith('+') || trimmed.startsWith('!');

  let category: Category | undefined;
  let parsedData: ParsedData = {};

  if (isCommand) {
    const parts = trimmed.slice(1).trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
    case 'h2o':
      category = 'agua';
      parsedData = { cantidad: args[0] ? parseInt(args[0], 10) : undefined, unidad: 'ml' };
      break;

    case 'af': {
      category = 'actividad';
      const last = parseInt(args[args.length - 1], 10);
      const hasMin = args.length > 1 && !isNaN(last);
      parsedData = {
        nombre: hasMin ? args.slice(0, -1).join(' ') : args.join(' ') || undefined,
        minutos: hasMin ? last : undefined,
      };
      break;
    }

    case 'com':
      category = 'alimentacion';
      parsedData = { descripcion: args.join(' ') || undefined };
      break;

    case 'ban':
      category = 'bano';
      parsedData = { tipo: args[0]?.toLowerCase() === 'caca' ? 'caca' : 'pis' };
      break;

    case 'med':
      category = 'medicina';
      parsedData = {
        nombre: args.length > 1 ? args.slice(0, -1).join(' ') : args[0] || undefined,
        dosis: args.length > 1 ? args[args.length - 1] : undefined,
      };
      break;

    case 'ocio': {
      category = 'ocio';
      const last = parseInt(args[args.length - 1], 10);
      const hasMin = args.length > 1 && !isNaN(last);
      parsedData = {
        actividad: hasMin ? args.slice(0, -1).join(' ') : args.join(' ') || undefined,
        minutos: hasMin ? last : undefined,
      };
      break;
    }

    case 'cita': {
      category = 'agenda';
      const citaLast = args[args.length - 1] ?? '';
      const isHora = /^\d{1,2}:\d{2}$/.test(citaLast);
      parsedData = {
        evento: isHora ? args.slice(0, -1).join(' ') || undefined : args.join(' ') || undefined,
        hora: isHora ? citaLast : undefined,
      };
      break;
    }

    }
  }

  // Fallbacks: Exact DB rules, AI, or Heuristics
  if (!category && dbParams) {
    const rawLower = trimmed.toLowerCase();
    
    let aliases: any[] = [];
    try {
      aliases = await dbParams.getAliases();
    } catch (e) {}

    // 1. Exact match
    const exact = aliases.find(a => a.text === rawLower);
    if (exact) {
      category = exact.category as Category;
      parsedData = exact.parsedData || {};
    }

    // 2. AI Fallback (if configured)
    if (!category && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `Analyze this user log message: "${trimmed}".
Categorize it strictly into one of: agua, actividad, alimentacion, medicina, ocio, agenda, bano, unknown.
Return ONLY raw JSON, do NOT wrap in markdown.
Available fields to extract depending on category:
{
  "category": "...",
  "parsedData": {
    "cantidad": number,
    "unidad": "ml",
    "nombre": "string",
    "minutos": number,
    "descripcion": "string",
    "dosis": "string",
    "actividad": "string",
    "evento": "string",
    "hora": "HH:MM",
    "tipo": "pis" | "caca"
  }
}
Reference these user-defined rules to infer their specific terminology mapping: ${JSON.stringify(aliases)}.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json/i, '').replace(/```/i, '').trim();
        const aiParsed = JSON.parse(responseText);
        
        if (aiParsed?.category && aiParsed.category !== 'unknown') {
          category = aiParsed.category;
          parsedData = aiParsed.parsedData || {};
        }
      } catch (err) {
        console.error("AI parse failed:", err);
      }
    }

    // 3. Smart Heuristic Fallback
    if (!category) {
      const nums = rawLower.match(/\d+/g);
      const firstNum = nums ? parseInt(nums[0], 10) : undefined;
      const textOnly = rawLower.replace(/\d+/g, '').replace(/[^\w\sáéíóúüñ]/ig, '').trim();
      const tokens = textOnly.split(/\s+/).filter(t => t.length > 2); // ignore "de", "el"

      for (const alias of aliases) {
        if (!alias.text) continue;
        const aliasTokens = alias.text.replace(/\d+/g, '').split(/\s+/);
        
        const matches = tokens.some((t: string) => 
          aliasTokens.some((a: string) => a === t || (t.length >= 3 && a.startsWith(t)) || (a.length >= 3 && t.startsWith(a)))
        );
        
        if (matches) {
          category = alias.category as Category;
          if (firstNum !== undefined) {
            if (category === 'agua') parsedData.cantidad = firstNum;
            else if (category === 'actividad' || category === 'ocio') parsedData.minutos = firstNum;
            else parsedData = alias.parsedData || {};
          } else {
            parsedData = alias.parsedData || {};
          }
          break;
        }
      }

      // Hardcoded keyword shortcuts for common cases
      if (!category) {
        const raw = textOnly;
        if (tokens.some((t: string) => 'agua'.startsWith(t) || t === 'h2o' || t === 'agu')) {
          category = 'agua';
          if (firstNum) parsedData.cantidad = firstNum;
        } else if (tokens.some((t: string) =>
          ['jugando', 'jugar', 'jugué', 'jugue', 'gaming', 'game', 'games', 'hots', 'lol', 'tft', 'steam', 'juego'].includes(t) ||
          t.startsWith('jug')
        )) {
          category = 'ocio';
          parsedData = { actividad: raw.trim() || trimmed, minutos: firstNum };
        } else if (tokens.some((t: string) =>
          ['comiendo', 'comer', 'comí', 'comi', 'almorzando', 'almuerzo', 'desayuno',
           'desayunando', 'cenando', 'cena'].includes(t)
        )) {
          category = 'alimentacion';
          parsedData = { descripcion: raw.trim() || trimmed };
        } else if (tokens.some((t: string) =>
          ['ducha', 'baño', 'bano', 'tina', 'asiento', 'duchando', 'bañando', 'aseo'].includes(t)
        )) {
          category = 'bano';
          parsedData = { descripcion: raw.trim() || trimmed };
        } else if (tokens.some((t: string) =>
          ['corriendo', 'correr', 'corrí', 'corri', 'ejercicio', 'entrenando', 'entrenar',
           'gimnasio', 'gym', 'pesas', 'cardio', 'caminar', 'caminando'].includes(t)
        )) {
          category = 'actividad';
          parsedData = { nombre: raw.trim() || trimmed, minutos: firstNum };
        }
      }
    }
    
    // 4. Default Unknown
    if (!category) {
      category = 'unknown';
      parsedData = { descripcion: trimmed };
    }
  }

  // If no DB params passed, and still no category, return null
  if (!category) return null;

  return {
    category,
    rawText: trimmed,
    parsedData,
    notificar,
    status: 'pending',
    userId,
    telegramMessageId: messageId,
  };
}

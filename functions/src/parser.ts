import { Timestamp } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda' | 'bano' | 'unknown' | string;

export interface ParsedData {
  nombre?: string;
  cantidad?: number;
  unidad?: string;
  descripcion?: string;
  dosis?: string;
  actividad?: string;
  minutos?: number;
  evento?: string;
  hora?: string;
  tipo?: 'pis' | 'caca';
  duracion?: number;
}

export interface DiarioRecord {
  category: Category;
  rawText: string;
  parsedData: ParsedData;
  notificar: boolean;
  status: 'pending' | 'confirmed';
  createdAt: Timestamp;
  confirmedAt?: Timestamp;
  userId?: string;
  telegramMessageId?: number;
}

export async function parseMessage(
  text: string,
  db: FirebaseFirestore.Firestore,
  userId?: string,
  messageId?: number
): Promise<DiarioRecord | null> {
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
        parsedData = {
          cantidad: args[0] ? parseInt(args[0], 10) : undefined,
          unidad: 'ml',
        };
        break;

      case 'af':
        category = 'actividad';
        const afLast = args.length > 1 ? parseInt(args[args.length - 1], 10) : NaN;
        const afHasMinutos = !isNaN(afLast);
        parsedData = {
          nombre: afHasMinutos ? args.slice(0, -1).join(' ') : args.join(' ') || undefined,
          minutos: afHasMinutos ? afLast : undefined,
        };
        break;

      case 'com':
        category = 'alimentacion';
        parsedData = { descripcion: args.join(' ') || undefined };
        break;

      case 'med':
        category = 'medicina';
        parsedData = {
          nombre: args.length > 1 ? args.slice(0, -1).join(' ') : args[0] || undefined,
          dosis: args.length > 1 ? args[args.length - 1] : undefined,
        };
        break;

      case 'ocio':
        category = 'ocio';
        const ocioLast = args.length > 1 ? parseInt(args[args.length - 1], 10) : NaN;
        const ocioHasMinutos = !isNaN(ocioLast);
        parsedData = {
          actividad: ocioHasMinutos ? args.slice(0, -1).join(' ') : args.join(' ') || undefined,
          minutos: ocioHasMinutos ? ocioLast : undefined,
        };
        break;

      case 'cita':
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

  // If it wasn't a standard command or wasn't matched, try advanced parsing
  if (!category) {
    const rawLower = trimmed.toLowerCase();
    
    // 1. Try exact exact rule match
    try {
      const aliasQuery = userId 
        ? db.collection('aliasMappings').where('userId', '==', userId).where('text', '==', rawLower).limit(1)
        : db.collection('aliasMappings').where('text', '==', rawLower).limit(1);
      const aliasDoc = await aliasQuery.get();
      if (!aliasDoc.empty) {
        const aliasData = aliasDoc.docs[0].data();
        category = aliasData.category as Category;
        parsedData = aliasData.parsedData || {};
      }
    } catch (error) {
      console.error('Error fetching aliasMappings:', error);
    }

    // Load aliases context if we need AI/Heuristic
    if (!category) {
      let aliases: any[] = [];
      let customCategories: any[] = [];
      try {
        const [allAliasesFn, allCatsFn] = await Promise.all([
          userId ? db.collection('aliasMappings').where('userId', '==', userId).get() : db.collection('aliasMappings').get(),
          userId ? db.collection('categorias').where('userId', '==', userId).get() : db.collection('categorias').get()
        ]);
        aliases = allAliasesFn.docs.map(d => d.data());
        customCategories = allCatsFn.docs.map(d => ({ 
          id: d.id, 
          label: d.data().label, 
          hasDuration: d.data().hasDuration,
          subcategories: d.data().subcategories || []
        }));
      } catch (e) {
        console.error('Error fetching context:', e);
      }

      // 2. AI Fallback (if configured)
      if (process.env.GEMINI_API_KEY) {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          
          const prompt = `Analyze this user log message: "${trimmed}".
Categorize it into one of the built-in categories OR a custom category ID.
Built-in categories: agua, actividad, alimentacion, medicina, ocio, agenda, bano, unknown.
Custom categories available:
${JSON.stringify(customCategories, null, 2)}

Return ONLY raw JSON, do NOT wrap in markdown.
Expected JSON format:
{
  "category": "category_id_or_builtin_name",
  "subcategory": "string_matching_one_of_subcategories_if_any",
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
    "tipo": "pis" | "caca" | "ducha",
    "duracion": number
  }
}
If the identified category (like 'bano' or a custom one) has subcategories or specific 'tipo' options, fill 'subcategory' (and 'tipo' if builtin 'bano').
Special case 'bano': subcategories are [pis, caca, ducha, tina, cepillo].
If selecting a custom category, use its 'id' as the 'category' value, and extract any relevant information from the message into 'parsedData.descripcion'. If the custom category has hasDuration=true, also extract 'parsedData.duracion' in minutes if applicable.
Reference these user-defined rules to infer their specific terminology mapping: ${JSON.stringify(aliases)}.`;

          const result = await model.generateContent(prompt);
          const responseText = result.response.text().replace(/```json/i, '').replace(/```/i, '').trim();
          const aiParsed = JSON.parse(responseText);
          
          if (aiParsed?.category && aiParsed.category !== 'unknown') {
            category = aiParsed.category;
            parsedData = aiParsed.parsedData || {};
            if (aiParsed.subcategory) {
              (parsedData as any).subcategory = aiParsed.subcategory;
            }
          }
        } catch (err) {
          console.error("AI parse failed:", err);
        }
      }

      // 3. Smart Heuristic Fallback
      if (!category) {
        const nums = rawLower.match(/\\d+/g);
        const firstNum = nums ? parseInt(nums[0], 10) : undefined;
        const textOnly = rawLower.replace(/\\d+/g, '').replace(/[^\\w\\sáéíóúüñ]/ig, '').trim();
        const tokens = textOnly.split(/\\s+/).filter(t => t.length > 2); // ignore "de", "el"

        for (const alias of aliases) {
          if (!alias.text) continue;
          const aliasTokens = alias.text.replace(/\\d+/g, '').split(/\\s+/);
          
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

        // Hardcoded generic fallback for obvious keywords if still missing
        if (!category) {
          if (tokens.some((t: string) => 'agua'.startsWith(t) || t === 'h2o')) {
            category = 'agua';
            if (firstNum) parsedData.cantidad = firstNum;
          }
        }
      }
    }

    // 4. Ultimate Fallback
    if (!category) {
      category = 'unknown';
      parsedData = { descripcion: trimmed };
    }
  }

  return {
    category,
    rawText: trimmed,
    parsedData,
    notificar,
    status: 'pending',
    createdAt: Timestamp.now(),
    subcategory: parsedData.subcategory || (parsedData as any).tipo || null,
    userId,
    telegramMessageId: messageId,
  };
}

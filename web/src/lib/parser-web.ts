'use client';

import { BuiltinCategory, Category, ParsedData, ParsedRecord } from './types';

/** Helper to call Gemini AI */
async function askGemini(prompt: string) {
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error('Gemini call error:', err);
    return null;
  }
}

/** 
 * Main parser logic for the Web Inbox.
 * Uses a combination of hardcoded rules, custom user aliases, and AI.
 */
export async function parseMessage(
  text: string,
  dbParams?: { 
    getAliases: () => Promise<any[]>,
    getCategories?: () => Promise<any[]>
  },
  userId?: string,
  messageId?: number
): Promise<ParsedRecord | null> {
  const trimmed = text.trim();
  const notificar = trimmed.startsWith('!');
  const isCommand = trimmed.startsWith('+') || trimmed.startsWith('!');
  const isPrefixForce = trimmed.startsWith('-');

  let category: string | undefined;
  let parsedData: ParsedData = {};

  // ── 1. Hardcoded Commands (+h2o, +af, etc) ──
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
        const last = args[args.length - 1] || '';
        const isHora = /^\d{1,2}:\d{2}$/.test(last);
        parsedData = {
          evento: isHora ? args.slice(0, -1).join(' ') || undefined : args.join(' ') || undefined,
          hora: isHora ? last : undefined,
        };
        break;
      }
      case 'ban': {
        category = 'bano';
        const sub = args[0]?.toLowerCase();
        parsedData = { tipo: sub as any };
        break;
      }
    }
  } 
  // ── 2. Forced Prefix (-comida Pizza) ──
  else if (isPrefixForce) {
    const spaceIndex = trimmed.indexOf(' ');
    const prefix = trimmed.slice(1, spaceIndex !== -1 ? spaceIndex : undefined).toLowerCase();
    const remainingText = spaceIndex !== -1 ? trimmed.slice(spaceIndex + 1).trim() : '';

    const cats = dbParams?.getCategories ? await dbParams.getCategories() : [];
    const aliases = dbParams?.getAliases ? await dbParams.getAliases() : [];

    const matchedCat = cats.find(c => c.label.toLowerCase() === prefix || c.id === prefix);
    const matchedAlias = aliases.find(a => a.text.toLowerCase() === prefix);

    if (matchedCat) {
      const result = await parseMessage(remainingText, dbParams, userId, messageId);
      if (result) {
        result.category = matchedCat.id as any;
        return result;
      }
    } else if (matchedAlias) {
      const result = await parseMessage(remainingText, dbParams, userId, messageId);
      if (result) {
        result.category = matchedAlias.category as any;
        result.parsedData = { ...(matchedAlias.parsedData || {}), ...result.parsedData };
        return result;
      }
    }
  }

  // ── 3. Fallbacks: DB rules, AI, or Heuristics ──
  if (!category && dbParams) {
    const rawLower = trimmed.toLowerCase();
    let aliases: any[] = [];
    let customCats: any[] = [];
    try {
      aliases = await dbParams.getAliases();
      if (dbParams.getCategories) {
        customCats = await dbParams.getCategories();
      }
    } catch (e) {}

    // A. Exact match with alias
    const exact = aliases.find(a => a.text === rawLower);
    if (exact) {
      category = exact.category;
      parsedData = exact.parsedData || {};
    }

    // B. AI Fallback
    if (!category) {
      try {
        const prompt = `Analyze this user log message: "${trimmed}".
Categorize it strictly into one of: agua, actividad, alimentacion, medicina, ocio, agenda, bano, unknown.
Return ONLY raw JSON, do NOT wrap in markdown.
Available fields: { "category": "...", "subcategory": "string", "parsedData": { ... } }
Custom categories available: ${JSON.stringify(customCats.map(c => ({ id: c.id, label: c.label, subcategories: c.subcategories || [] })))}.
Rules context: ${JSON.stringify(aliases)}.`;

        const responseText = await askGemini(prompt);
        if (responseText) {
          const cleanText = responseText.replace(/```json/i, '').replace(/```/i, '').trim();
          const aiParsed = JSON.parse(cleanText);
          if (aiParsed?.category && aiParsed.category !== 'unknown') {
            category = aiParsed.category;
            parsedData = aiParsed.parsedData || {};
            if (aiParsed.subcategory) (parsedData as any).subcategory = aiParsed.subcategory;
          }
        }
      } catch (err) {
        console.error("AI parse failed:", err);
      }
    }

    // C. Heuristics
    if (!category) {
      const nums = rawLower.match(/\d+/g);
      const firstNum = nums ? parseInt(nums[0], 10) : undefined;
      const textOnly = rawLower.replace(/\d+/g, '').replace(/[^\w\sáéíóúüñ]/ig, '').trim();
      const tokens = textOnly.split(/\s+/).filter(t => t.length > 2);

      for (const alias of aliases) {
        if (!alias.text) continue;
        const aliasTokens = alias.text.replace(/\d+/g, '').split(/\s+/);
        const matches = tokens.some(t => aliasTokens.some(a => a === t || (t.length >= 3 && a.startsWith(t))));
        if (matches) {
          category = alias.category;
          parsedData = alias.parsedData || {};
          break;
        }
      }
      
      // Basic keyword fallbacks
      if (!category) {
        if (tokens.some(t => 'agua'.startsWith(t) || t === 'h2o')) {
          category = 'agua';
          if (firstNum) parsedData.cantidad = firstNum;
        } else if (tokens.some(t => t.startsWith('jug') || t === 'hots')) {
          category = 'ocio';
          parsedData = { actividad: textOnly, minutos: firstNum };
        }
      }
    }
    
    // D. Default
    if (!category) {
      category = 'unknown';
      parsedData = { descripcion: trimmed };
    }
  }

  if (!category) return null;

  return {
    category,
    rawText: trimmed,
    parsedData,
    notificar,
    status: 'pending',
    subcategory: parsedData.subcategory || (parsedData as any).tipo || null,
    userId,
    telegramMessageId: messageId,
  };
}

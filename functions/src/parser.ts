import { Timestamp } from 'firebase-admin/firestore';

export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda' | 'unknown';

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
}

export interface DiarioRecord {
  category: Category;
  rawText: string;
  parsedData: ParsedData;
  notificar: boolean;
  status: 'pending';
  createdAt: Timestamp;
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

  // If it wasn't a standard command or wasn't matched, check aliasMappings
  if (!category) {
    const rawLower = trimmed.toLowerCase();
    try {
      const aliasDoc = await db.collection('aliasMappings').where('text', '==', rawLower).limit(1).get();
      if (!aliasDoc.empty) {
        const aliasData = aliasDoc.docs[0].data();
        category = aliasData.category as Category;
        parsedData = aliasData.parsedData || {};
      } else {
        // Unrecognized fallback to 'unknown'
        category = 'unknown';
        parsedData = { descripcion: trimmed };
      }
    } catch (error) {
      console.error('Error fetching aliasMappings:', error);
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
    userId,
    telegramMessageId: messageId,
  };
}

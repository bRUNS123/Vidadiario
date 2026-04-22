export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda' | 'bano';

export interface ParsedData {
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

export function parseMessage(
  text: string,
  userId?: string,
  messageId?: number
): ParsedRecord | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('!')) return null;

  const notificar = trimmed.startsWith('!');
  const parts = trimmed.slice(1).trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  let category: Category;
  let parsedData: ParsedData = {};

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

    default:
      return null;
  }

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

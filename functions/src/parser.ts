import { Timestamp } from 'firebase-admin/firestore';

export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda';

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

export function parseMessage(
  text: string,
  userId?: string,
  messageId?: number
): DiarioRecord | null {
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
      // Last arg treated as time if it matches HH:MM pattern
      const citaLast = args[args.length - 1] ?? '';
      const isHora = /^\d{1,2}:\d{2}$/.test(citaLast);
      parsedData = {
        evento: isHora ? args.slice(0, -1).join(' ') || undefined : args.join(' ') || undefined,
        hora: isHora ? citaLast : undefined,
      };
      break;

    default:
      return null;
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

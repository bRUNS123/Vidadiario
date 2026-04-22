export type Category = 'agua' | 'actividad' | 'alimentacion' | 'medicina' | 'ocio' | 'agenda';
export type Status = 'pending' | 'confirmed';

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
  id: string;
  category: Category;
  rawText: string;
  parsedData: ParsedData;
  notificar: boolean;
  status: Status;
  createdAt: { seconds: number; nanoseconds: number };
  confirmedAt?: { seconds: number; nanoseconds: number };
  calendarEventId?: string;
  userId?: string;
}

export const CATEGORY_CONFIG: Record<
  Category,
  { label: string; color: string; glow: string; emoji: string; bg: string; border: string }
> = {
  agua: {
    label: 'Agua',
    color: '#3b82f6',
    glow: '0 0 24px rgba(59, 130, 246, 0.25)',
    emoji: '💧',
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/25',
  },
  actividad: {
    label: 'Actividad Física',
    color: '#22c55e',
    glow: '0 0 24px rgba(34, 197, 94, 0.25)',
    emoji: '💪',
    bg: 'bg-green-950/40',
    border: 'border-green-500/25',
  },
  alimentacion: {
    label: 'Alimentación',
    color: '#f97316',
    glow: '0 0 24px rgba(249, 115, 22, 0.25)',
    emoji: '🥗',
    bg: 'bg-orange-950/40',
    border: 'border-orange-500/25',
  },
  medicina: {
    label: 'Medicina',
    color: '#a855f7',
    glow: '0 0 24px rgba(168, 85, 247, 0.25)',
    emoji: '💊',
    bg: 'bg-purple-950/40',
    border: 'border-purple-500/25',
  },
  ocio: {
    label: 'Ocio',
    color: '#14b8a6',
    glow: '0 0 24px rgba(20, 184, 166, 0.25)',
    emoji: '🎮',
    bg: 'bg-teal-950/40',
    border: 'border-teal-500/25',
  },
  agenda: {
    label: 'Agenda',
    color: '#eab308',
    glow: '0 0 24px rgba(234, 179, 8, 0.25)',
    emoji: '📅',
    bg: 'bg-yellow-950/40',
    border: 'border-yellow-500/25',
  },
};

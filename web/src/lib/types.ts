export type BuiltinCategory =
  | 'agua'
  | 'actividad'
  | 'alimentacion'
  | 'medicina'
  | 'ocio'
  | 'agenda'
  | 'bano'
  | 'unknown';

/** Alias kept for convenience — custom categories are plain strings */
export type Category = BuiltinCategory;

export type Status = 'pending' | 'confirmed';

export interface ParsedData {
  nombre?: string;
  cantidad?: number;
  unidad?: string;
  descripcion?: string;
  dosis?: string;
  actividad?: string;
  minutos?: number;
  duracion?: number;   // minutos de duración para categorías sin campo propio
  evento?: string;
  hora?: string;
  tipo?: 'pis' | 'caca' | 'ducha' | 'tina';
  [key: string]: any;
}

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'toggle';
  placeholder?: string;
  options?: { value: string; label: string; emoji: string }[];
};

export const BUILTIN_FIELDS: Record<string, FieldDef[]> = {
  agua: [{ key: 'cantidad', label: 'Cantidad (ml)', type: 'number', placeholder: '500' }],
  actividad: [
    { key: 'nombre', label: 'Ejercicio', type: 'text', placeholder: 'Pesas, Correr...' },
    { key: 'minutos', label: 'Duración (min)', type: 'number', placeholder: '45' },
  ],
  alimentacion: [
    { key: 'descripcion', label: 'Qué comiste', type: 'text', placeholder: 'Ensalada César...' },
  ],
  medicina: [
    { key: 'nombre', label: 'Medicamento', type: 'text', placeholder: 'Creatina...' },
    { key: 'dosis', label: 'Dosis', type: 'text', placeholder: '5g, 10mg...' },
  ],
  ocio: [
    { key: 'actividad', label: 'Actividad', type: 'text', placeholder: 'Series, Lectura...' },
    { key: 'minutos', label: 'Duración (min)', type: 'number', placeholder: '60' },
  ],
  agenda: [
    { key: 'evento', label: 'Evento', type: 'text', placeholder: 'Dentista...' },
    { key: 'hora', label: 'Hora (HH:MM)', type: 'text', placeholder: '10:30' },
  ],
  bano: [
    {
      key: 'tipo',
      label: 'Actividad',
      type: 'toggle',
      options: [
        { value: 'pis', label: 'Pis', emoji: '💦' },
        { value: 'caca', label: 'Caca', emoji: '💩' },
        { value: 'ducha', label: 'Ducha', emoji: '🚿' },
        { value: 'tina', label: 'Tina', emoji: '🛁' },
      ],
    },
  ],
};

export interface DiarioRecord {
  id: string;
  category: string; // BuiltinCategory or custom category Firestore ID
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
  {
    label: string;
    color: string;
    glowClass: string;
    emoji: string;
    bg: string;
    border: string;
    labelColor: string;
  }
> = {
  agua: {
    label: 'Agua',
    color: '#3b82f6',
    glowClass: 'glow-agua',
    emoji: '💧',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-500/25',
    labelColor: 'text-blue-600 dark:text-blue-400',
  },
  actividad: {
    label: 'Actividad Física',
    color: '#22c55e',
    glowClass: 'glow-actividad',
    emoji: '💪',
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-500/25',
    labelColor: 'text-green-600 dark:text-green-400',
  },
  alimentacion: {
    label: 'Alimentación',
    color: '#f97316',
    glowClass: 'glow-alimentacion',
    emoji: '🥗',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-500/25',
    labelColor: 'text-orange-600 dark:text-orange-400',
  },
  medicina: {
    label: 'Medicina',
    color: '#a855f7',
    glowClass: 'glow-medicina',
    emoji: '💊',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-500/25',
    labelColor: 'text-purple-600 dark:text-purple-400',
  },
  ocio: {
    label: 'Ocio',
    color: '#14b8a6',
    glowClass: 'glow-ocio',
    emoji: '🎮',
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-500/25',
    labelColor: 'text-teal-600 dark:text-teal-400',
  },
  agenda: {
    label: 'Agenda',
    color: '#eab308',
    glowClass: 'glow-agenda',
    emoji: '📅',
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    border: 'border-yellow-200 dark:border-yellow-500/25',
    labelColor: 'text-yellow-600 dark:text-yellow-500',
  },
  bano: {
    label: 'Aseo y Baño',
    color: '#d97706',
    glowClass: 'glow-bano',
    emoji: '🧼',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-500/25',
    labelColor: 'text-amber-600 dark:text-amber-400',
  },
  unknown: {
    label: 'Sin categoría',
    color: '#71717a',
    glowClass: '',
    emoji: '❓',
    bg: 'bg-zinc-50 dark:bg-zinc-950/40',
    border: 'border-zinc-300 dark:border-zinc-600/40',
    labelColor: 'text-zinc-500 dark:text-zinc-400',
  },
};

export const ALL_CATEGORIES: Category[] = [
  'agua',
  'actividad',
  'alimentacion',
  'medicina',
  'ocio',
  'agenda',
  'bano',
  'unknown',
];

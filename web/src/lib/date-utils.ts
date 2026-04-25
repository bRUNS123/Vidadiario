import { DiarioRecord } from './types';

export interface DayGroup {
  sortKey: string;
  label: string;
  subtitle: string;
  records: DiarioRecord[];
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function groupByDate(records: DiarioRecord[]): DayGroup[] {
  const map: Record<string, DayGroup> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const record of records) {
    const ts = record.createdAt;
    const date = new Date(ts.seconds * 1000);
    const sortKey = localDateKey(date);

    if (!map[sortKey]) {
      const isToday = date.toDateString() === today.toDateString();
      const isYesterday = date.toDateString() === yesterday.toDateString();

      const fullDate = cap(
        date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
      const shortWeekday = cap(
        date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      );

      map[sortKey] = {
        sortKey,
        label: isToday ? 'Hoy' : isYesterday ? 'Ayer' : shortWeekday,
        subtitle: fullDate,
        records: [],
      };
    }
    map[sortKey].records.push(record);
  }

  for (const group of Object.values(map)) {
    group.records.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  }

  return Object.values(map).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

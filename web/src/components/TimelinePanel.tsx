'use client';

import { useState } from 'react';
import { Category, CATEGORY_CONFIG, DiarioRecord } from '@/lib/types';
import { RecordCard } from './RecordCard';

function groupByDate(records: DiarioRecord[]): [string, DiarioRecord[]][] {
  const groups: Record<string, DiarioRecord[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const record of records) {
    const ts = record.confirmedAt ?? record.createdAt;
    const date = new Date(ts.seconds * 1000);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Ayer';
    } else {
      key = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  return Object.entries(groups);
}

const ALL_CATEGORIES: Category[] = [
  'agua',
  'actividad',
  'alimentacion',
  'medicina',
  'ocio',
  'agenda',
];

interface TimelinePanelProps {
  records: DiarioRecord[];
}

export function TimelinePanel({ records }: TimelinePanelProps) {
  const [activeFilter, setActiveFilter] = useState<Category | null>(null);

  const filtered = activeFilter ? records.filter((r) => r.category === activeFilter) : records;
  const grouped = groupByDate(filtered);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-white/5 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Timeline</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">Tu historial aprobado</p>
          </div>
          <span className="text-[11px] text-zinc-600">{records.length} registros</span>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeFilter === null ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Todos
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const count = records.filter((r) => r.category === cat).length;
            if (count === 0) return null;
            const active = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(active ? null : cat)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: active ? `${cfg.color}20` : 'transparent',
                  color: cfg.color,
                  border: `1px solid ${active ? cfg.color + '40' : 'transparent'}`,
                  opacity: active ? 1 : 0.55,
                }}
              >
                {cfg.emoji} {cfg.label} · {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Records */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="mb-3 text-4xl">📋</span>
            <p className="text-sm text-zinc-500">Sin registros confirmados</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Aprueba los items del Inbox para verlos aquí
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([date, dayRecords]) => (
              <div key={date}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[11px] font-semibold capitalize text-zinc-400">{date}</span>
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[10px] text-zinc-600">{dayRecords.length}</span>
                </div>
                <div className="space-y-2">
                  {dayRecords.map((record) => (
                    <RecordCard key={record.id} record={record} pending={false} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

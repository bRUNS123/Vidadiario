'use client';

import { useState } from 'react';
import { ALL_CATEGORIES, CATEGORY_CONFIG, DiarioRecord } from '@/lib/types';
import { useCustomCategories, CatConfig } from '@/lib/custom-categories';
import { RecordCard } from './RecordCard';

// ── Date grouping ─────────────────────────────────────────────────────────────

interface DayGroup {
  sortKey: string;       // "2026-04-22" for ordering
  label: string;         // "Hoy", "Ayer", or weekday
  subtitle: string;      // "Martes, 22 de Abril de 2026"
  records: DiarioRecord[];
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function groupByDate(records: DiarioRecord[]): DayGroup[] {
  const map: Record<string, DayGroup> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const record of records) {
    const ts = record.createdAt;
    const date = new Date(ts.seconds * 1000);
    const sortKey = localDateKey(date); // usa fecha local, no UTC

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

  // Sort records within each day by createdAt descending (registration time, not approval time)
  for (const group of Object.values(map)) {
    group.records.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  }

  return Object.values(map).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

// ── Export ────────────────────────────────────────────────────────────────────

function recordSummary(r: DiarioRecord): string {
  const p = r.parsedData;
  switch (r.category) {
    case 'agua':        return `${p.cantidad ?? '?'}${p.unidad ?? 'ml'}`;
    case 'actividad':   return [p.nombre, p.minutos ? `${p.minutos}min` : null].filter(Boolean).join(' · ');
    case 'alimentacion':return p.descripcion ?? '—';
    case 'medicina':    return [p.nombre, p.dosis].filter(Boolean).join(' · ');
    case 'ocio':        return [p.actividad, p.minutos ? `${p.minutos}min` : null].filter(Boolean).join(' · ');
    case 'agenda':      return [p.evento, p.hora ? `a las ${p.hora}` : null].filter(Boolean).join(' ');
    case 'bano':        return p.tipo === 'caca' ? 'Caca' : 'Pis';
    default:            return p.descripcion ?? r.rawText ?? '—';
  }
}

function recordTime(r: DiarioRecord): string {
  const ts = r.createdAt;
  if (!ts) return '';
  const start = new Date(ts.seconds * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const dur = r.parsedData.minutos ?? r.parsedData.duracion;
  if (dur) {
    const end = new Date(ts.seconds * 1000 + dur * 60000);
    return `${fmt(start)}–${fmt(end)}`;
  }
  return fmt(start);
}

function buildExportText(group: DayGroup, getCatConfig: (id: string) => CatConfig): string {
  const lines: string[] = [
    `# Diario AG — ${group.subtitle}`,
    '',
  ];

  // Group records by category
  const byCat: Record<string, DiarioRecord[]> = {};
  for (const r of group.records) {
    if (!byCat[r.category]) byCat[r.category] = [];
    byCat[r.category].push(r);
  }

  for (const [cat, catRecords] of Object.entries(byCat)) {
    const cfg = getCatConfig(cat);
    lines.push(`${cfg.emoji} ${cfg.label.toUpperCase()}`);
    for (const r of catRecords) {
      lines.push(`  • ${recordTime(r)}  ${recordSummary(r)}`);
    }

    // Totals for agua and actividad
    if (cat === 'agua') {
      const total = catRecords.reduce((s, r) => s + (r.parsedData.cantidad ?? 0), 0);
      if (total) lines.push(`  → Total: ${total}ml`);
    }
    if (cat === 'actividad') {
      const total = catRecords.reduce((s, r) => s + (r.parsedData.minutos ?? 0), 0);
      if (total) lines.push(`  → Total: ${total}min`);
    }
    lines.push('');
  }

  lines.push(`Registros totales: ${group.records.length}`);
  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TimelinePanelProps {
  records: DiarioRecord[];
}

export function TimelinePanel({ records }: TimelinePanelProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { customCategories, getCatConfig } = useCustomCategories();

  const filtered = activeFilter 
    ? records.filter((r) => {
        if (r.category === activeFilter) return true;
        // Also match by label for custom categories
        const custom = customCategories.find(c => c.id === activeFilter);
        return custom && r.category.toLowerCase() === custom.label.toLowerCase();
      }) 
    : records;
  const grouped = groupByDate(filtered);

  async function handleExport(group: DayGroup) {
    const text = buildExportText(group, getCatConfig);
    await navigator.clipboard.writeText(text);
    setCopied(group.sortKey);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-white/5 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Timeline</h2>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">Tu historial aprobado</p>
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{records.length} registros</span>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeFilter === null
                ? 'bg-zinc-900 dark:bg-white/10 text-white'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
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
                  opacity: active ? 1 : 0.6,
                }}
              >
                {cfg.emoji} {cfg.label.split(' ')[0]} · {count}
              </button>
            );
          })}
          {customCategories.map((cat) => {
            const count = records.filter((r) => 
              r.category === cat.id || r.category.toLowerCase() === cat.label.toLowerCase()
            ).length;
            if (count === 0) return null;
            const active = activeFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveFilter(active ? null : cat.id)}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: active ? `${cat.color}20` : 'transparent',
                  color: cat.color,
                  border: `1px solid ${active ? cat.color + '40' : 'transparent'}`,
                  opacity: active ? 1 : 0.6,
                }}
              >
                {cat.emoji} {cat.label.split(' ')[0]} · {count}
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
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin registros confirmados</p>
            <p className="mt-1 text-[11px] text-zinc-300 dark:text-zinc-600">
              Aprueba los items del Inbox para verlos aquí
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.sortKey}>
                {/* Day header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">
                        {group.label}
                      </span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        · {group.subtitle.split(',').slice(0, 2).join(',')}
                      </span>
                    </div>
                  </div>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-white/5" />
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
                    {group.records.length}
                  </span>
                  {/* Export button */}
                  <button
                    onClick={() => handleExport(group)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                      copied === group.sortKey
                        ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                    title="Copiar día para IA"
                  >
                    {copied === group.sortKey ? '✓ Copiado' : '↑ Exportar'}
                  </button>
                </div>

                <div className="space-y-2">
                  {group.records.map((record) => (
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

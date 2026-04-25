'use client';

import { DiarioRecord } from '@/lib/types';
import { groupByDate } from '@/lib/date-utils';
import { RecordCard } from './RecordCard';

interface WeeklyPanelProps {
  records: DiarioRecord[];
}

export function WeeklyPanel({ records }: WeeklyPanelProps) {
  const grouped = groupByDate(records);
  // Show at most the last 7 days with data
  const last7Days = grouped.slice(0, 7).reverse();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-[#09090b]">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950 px-5 py-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Vista Semanal</h2>
        <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">Los últimos 7 días de actividad</p>
      </div>

      {/* Columns Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max p-4 gap-4">
          {last7Days.length === 0 ? (
            <div className="flex w-full items-center justify-center py-20 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Sin datos suficientes para la vista semanal</p>
            </div>
          ) : (
            last7Days.map((group) => (
              <div 
                key={group.sortKey} 
                className="flex w-72 flex-col rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 shadow-sm"
              >
                {/* Column Header */}
                <div className="sticky top-0 z-10 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] px-4 py-3 backdrop-blur-md rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {new Date(group.sortKey).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {group.records.map((record) => (
                    <div key={record.id} className="transform transition-all active:scale-[0.98]">
                      <RecordCard record={record} />
                    </div>
                  ))}
                  {group.records.length === 0 && (
                    <p className="py-8 text-center text-[10px] text-zinc-400">Sin actividad</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

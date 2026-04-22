import { DiarioRecord } from '@/lib/types';
import { RecordCard } from './RecordCard';

interface InboxPanelProps {
  records: DiarioRecord[];
}

export function InboxPanel({ records }: InboxPanelProps) {
  return (
    <div className="flex w-[360px] flex-shrink-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Inbox</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">Pendientes de aprobación</p>
        </div>
        {records.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-medium text-zinc-300">
            {records.length}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="mb-3 text-4xl">📭</span>
            <p className="text-sm text-zinc-500">Inbox vacío</p>
            <p className="mt-1 text-[11px] text-zinc-600">Envía un mensaje desde Telegram</p>
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left">
              <p className="text-[10px] text-zinc-600">Ejemplos:</p>
              {['+h2o 500', '+af Pesas 45', '+com Ensalada', '!cita Dentista 10:30'].map((ex) => (
                <p key={ex} className="mt-0.5 font-mono text-[11px] text-zinc-500">
                  {ex}
                </p>
              ))}
            </div>
          </div>
        ) : (
          records.map((record) => <RecordCard key={record.id} record={record} pending />)
        )}
      </div>
    </div>
  );
}

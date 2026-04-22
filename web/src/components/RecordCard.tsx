'use client';

import { useState } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category, CATEGORY_CONFIG, DiarioRecord, ParsedData } from '@/lib/types';

function formatSummary(record: DiarioRecord): string {
  const { parsedData, category } = record;
  switch (category) {
    case 'agua':
      return `${parsedData.cantidad ?? '?'}${parsedData.unidad ?? 'ml'}`;
    case 'actividad':
      return [parsedData.nombre, parsedData.minutos ? `${parsedData.minutos}min` : null]
        .filter(Boolean)
        .join(' · ');
    case 'alimentacion':
      return parsedData.descripcion ?? 'Sin descripción';
    case 'medicina':
      return [parsedData.nombre, parsedData.dosis].filter(Boolean).join(' · ');
    case 'ocio':
      return [parsedData.actividad, parsedData.minutos ? `${parsedData.minutos}min` : null]
        .filter(Boolean)
        .join(' · ');
    case 'agenda':
      return [parsedData.evento, parsedData.hora ? `${parsedData.hora}h` : null]
        .filter(Boolean)
        .join(' a las ');
    default:
      return record.rawText;
  }
}

function formatTime(ts: DiarioRecord['createdAt'] | undefined): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type EditField = { key: keyof ParsedData; label: string; type: 'text' | 'number' };

function getEditFields(category: Category): EditField[] {
  switch (category) {
    case 'agua':
      return [{ key: 'cantidad', label: 'ml', type: 'number' }];
    case 'actividad':
      return [
        { key: 'nombre', label: 'Ejercicio', type: 'text' },
        { key: 'minutos', label: 'Minutos', type: 'number' },
      ];
    case 'alimentacion':
      return [{ key: 'descripcion', label: 'Descripción', type: 'text' }];
    case 'medicina':
      return [
        { key: 'nombre', label: 'Nombre', type: 'text' },
        { key: 'dosis', label: 'Dosis', type: 'text' },
      ];
    case 'ocio':
      return [
        { key: 'actividad', label: 'Actividad', type: 'text' },
        { key: 'minutos', label: 'Minutos', type: 'number' },
      ];
    case 'agenda':
      return [
        { key: 'evento', label: 'Evento', type: 'text' },
        { key: 'hora', label: 'Hora (HH:MM)', type: 'text' },
      ];
  }
}

interface RecordCardProps {
  record: DiarioRecord;
  pending?: boolean;
}

export function RecordCard({ record, pending = false }: RecordCardProps) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ParsedData>>({});
  const [approving, setApproving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const config = CATEGORY_CONFIG[record.category];
  const editFields = getEditFields(record.category);

  function startEdit() {
    setEditData({ ...record.parsedData });
    setEditing(true);
  }

  async function saveEdit() {
    await updateDoc(doc(db, 'registros', record.id), {
      parsedData: { ...record.parsedData, ...editData },
    });
    setEditing(false);
  }

  async function handleApprove() {
    setApproving(true);
    try {
      if (editing) await saveEdit();
      await updateDoc(doc(db, 'registros', record.id), {
        status: 'confirmed',
        confirmedAt: Timestamp.now(),
      });
      setTimeout(() => setDismissed(true), 380);
    } catch (err) {
      console.error(err);
      setApproving(false);
    }
  }

  if (dismissed) return null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 ${config.bg} ${config.border} ${
        approving ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}
      style={{ boxShadow: pending ? config.glow : 'none' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex-shrink-0 text-xl">{config.emoji}</span>
          <div className="min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: config.color }}
            >
              {config.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {formatSummary(record)}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-zinc-600">
            {formatTime(pending ? record.createdAt : (record.confirmedAt ?? record.createdAt))}
          </span>
          {record.notificar && (
            <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-500">
              CAL
            </span>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {editFields.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <label className="w-24 flex-shrink-0 text-[11px] text-zinc-500">{field.label}</label>
              <input
                type={field.type}
                value={String(editData[field.key] ?? '')}
                onChange={(e) =>
                  setEditData((prev) => ({
                    ...prev,
                    [field.key]:
                      field.type === 'number' ? Number(e.target.value) : e.target.value,
                  }))
                }
                className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none transition-colors focus:border-white/25"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              className="rounded-md bg-white/10 px-3 py-1 text-[11px] text-white transition-colors hover:bg-white/15"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Pending actions */}
      {pending && !editing && (
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <button
            onClick={startEdit}
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Editar
          </button>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all hover:brightness-110 disabled:opacity-50"
            style={{
              backgroundColor: `${config.color}18`,
              color: config.color,
              border: `1px solid ${config.color}35`,
            }}
          >
            {approving ? '...' : '✓ Aprobar'}
          </button>
        </div>
      )}
    </div>
  );
}

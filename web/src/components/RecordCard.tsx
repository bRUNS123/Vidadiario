'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category, DiarioRecord, ParsedData, ALL_CATEGORIES, CATEGORY_CONFIG } from '@/lib/types';
import { useCustomCategories } from '@/lib/custom-categories';

function formatSummary(record: DiarioRecord): string {
  const { parsedData, category } = record;
  switch (category) {
    case 'agua':
      return `${parsedData.cantidad ?? '?'}${parsedData.unidad ?? 'ml'}`;
    case 'actividad':
      return [parsedData.nombre, parsedData.minutos ? `${parsedData.minutos}min` : null]
        .filter(Boolean).join(' · ');
    case 'alimentacion':
      return parsedData.descripcion ?? 'Sin descripción';
    case 'medicina':
      return [parsedData.nombre, parsedData.dosis].filter(Boolean).join(' · ');
    case 'ocio':
      return [parsedData.actividad, parsedData.minutos ? `${parsedData.minutos}min` : null]
        .filter(Boolean).join(' · ');
    case 'agenda':
      return [parsedData.evento, parsedData.hora ? `${parsedData.hora}h` : null]
        .filter(Boolean).join(' a las ');
    case 'bano':
      return parsedData.tipo === 'caca' ? '💩 Caca' : '💦 Pis';
    default:
      return parsedData.descripcion ?? record.rawText ?? '—';
  }
}

function formatTime(ts?: { seconds: number }, durationMins?: number): string {
  if (!ts) return '';
  const start = new Date(ts.seconds * 1000);
  const fmt = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  if (durationMins) {
    const end = new Date(ts.seconds * 1000 + durationMins * 60000);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  return fmt(start);
}

function getEffectiveDuration(record: DiarioRecord): number | undefined {
  return record.parsedData.minutos ?? record.parsedData.duracion;
}

type EditField = {
  key: keyof ParsedData;
  label: string;
  type: 'text' | 'number' | 'toggle';
  placeholder?: string;
  options?: { value: string; label: string; emoji: string }[];
};

function getEditFields(category: Category): EditField[] {
  switch (category) {
    case 'agua':
      return [{ key: 'cantidad', label: 'ml', type: 'number', placeholder: '500' }];
    case 'actividad':
      return [
        { key: 'nombre', label: 'Ejercicio', type: 'text', placeholder: 'Pesas, Correr...' },
        { key: 'minutos', label: 'Duración (min)', type: 'number', placeholder: '45' },
      ];
    case 'alimentacion':
      return [{ key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Ensalada, Pizza...' }];
    case 'medicina':
      return [
        { key: 'nombre', label: 'Nombre', type: 'text', placeholder: 'Creatina...' },
        { key: 'dosis', label: 'Dosis', type: 'text', placeholder: '5g, 10mg...' },
      ];
    case 'ocio':
      return [
        { key: 'actividad', label: 'Actividad', type: 'text', placeholder: 'Series, Juegos...' },
        { key: 'minutos', label: 'Duración (min)', type: 'number', placeholder: '60' },
      ];
    case 'agenda':
      return [
        { key: 'evento', label: 'Evento', type: 'text', placeholder: 'Dentista...' },
        { key: 'hora', label: 'Hora', type: 'text', placeholder: '10:30' },
      ];
    case 'bano':
      return [{
        key: 'tipo', label: 'Tipo', type: 'toggle',
        options: [
          { value: 'pis', label: 'Pis', emoji: '💦' },
          { value: 'caca', label: 'Caca', emoji: '💩' },
        ],
      }];
    default:
      return [
        { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Escribe algo...' },
        { key: 'duracion', label: 'Duración (min)', type: 'number', placeholder: '30' },
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editCategory, setEditCategory] = useState<Category>(record.category as Category);
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [ruleMode, setRuleMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingRule, setSelectedExistingRule] = useState('');
  const [existingRules, setExistingRules] = useState<{ id: string; text: string; category: string; parsedData: Partial<ParsedData> }[]>([]);

  useEffect(() => {
    if (!editing) return;
    getDocs(collection(db, 'aliasMappings')).then((snap) =>
      setExistingRules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)))
    );
  }, [editing]);

  const { getCatConfig, customCategories } = useCustomCategories();
  const config = getCatConfig(editing ? editCategory : record.category);
  const editFields = getEditFields(editCategory);

  function startEdit() {
    setEditData({ ...record.parsedData });
    setEditCategory(record.category as Category);
    setEditing(true);
  }

  async function saveEdit() {
    await updateDoc(doc(db, 'registros', record.id), {
      category: editCategory,
      parsedData: { ...record.parsedData, ...editData },
    });
    setEditing(false);
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const finalCategory = editing ? editCategory : record.category;
      const finalParsedData = editing ? { ...record.parsedData, ...editData } : record.parsedData;

      if (editing) await saveEdit();
      
      if (saveAsRule && record.rawText) {
        const aliasId = record.rawText.toLowerCase().trim().replace(/[^a-z0-9áéíóúüñ\s]/g, '').replace(/\s+/g, '_');
        if (ruleMode === 'existing' && selectedExistingRule) {
          const base = existingRules.find((r) => r.id === selectedExistingRule);
          if (base) {
            await setDoc(doc(db, 'aliasMappings', aliasId), {
              text: record.rawText.toLowerCase().trim(),
              category: base.category,
              parsedData: base.parsedData,
            });
          }
        } else {
          await setDoc(doc(db, 'aliasMappings', aliasId), {
            text: record.rawText.toLowerCase().trim(),
            category: finalCategory,
            parsedData: finalParsedData,
          });
        }
      }

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

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'registros', record.id));
      setDismissed(true);
    } catch (err) {
      console.error(err);
      setConfirmDelete(false);
    }
  }

  if (dismissed) return null;

  return (
    <div
      className={`group rounded-xl border p-4 transition-all duration-300 ${config.isCustom ? '' : config.bg} ${config.isCustom ? '' : config.border} ${pending && config.glowClass ? config.glowClass : ''} ${
        approving ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}
      style={config.isCustom ? {
        backgroundColor: `${config.color}45`, // ~27% opacity
        borderColor: `${config.color}80`,    // ~50% opacity
        boxShadow: `0 4px 20px -10px ${config.color}40`,
        ...(pending ? { boxShadow: `0 0 24px ${config.color}40` } : {}),
      } : undefined}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex-shrink-0 text-xl">{config.emoji}</span>
          <div className="min-w-0">
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${config.isCustom ? '' : config.labelColor}`}
              style={config.isCustom ? { color: config.color, filter: 'brightness(1.2)' } : undefined}
            >
              {config.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-white">
              {formatSummary(record)}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
            {formatTime(
              record.createdAt,
              getEffectiveDuration(record)
            )}
          </span>
          {record.notificar && (
            <span className="rounded-full bg-yellow-100 dark:bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-500">
              CAL
            </span>
          )}
          {/* Delete button — always visible on pending, hover-only on confirmed */}
          {!editing && (
            <button
              onClick={handleDelete}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all ${
                pending
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              } ${
                confirmDelete
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400'
              }`}
              title="Eliminar registro"
            >
              {confirmDelete ? '¿Seguro?' : '×'}
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-3 space-y-3 border-t border-zinc-200 dark:border-white/5 pt-3">
          {/* Category picker — shown for unknown/unresolved records */}
          {(record.category === 'unknown' || config.needsCategorization) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-400 dark:text-zinc-500">Categoría</label>
              <select
                value={editCategory === 'unknown' ? '' : editCategory}
                onChange={(e) => {
                  setEditCategory(e.target.value as Category);
                  setEditData({});
                }}
                className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="" disabled>Seleccionar categoría...</option>
                {ALL_CATEGORIES.filter(c => c !== 'unknown').map(c => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}</option>
                ))}
                {customCategories.length > 0 && (
                  <optgroup label="── Personalizadas ──">
                    {customCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Only show edit fields if category is resolved */}
          {(!(record.category === 'unknown' || config.needsCategorization) || (editCategory && editCategory !== 'unknown')) && (
          <div className="space-y-2">
            {editFields.map((field) =>
            field.type === 'toggle' && field.options ? (
              <div key={field.key} className="flex gap-2">
                {field.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditData((p) => ({ ...p, [field.key]: opt.value }))}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-all ${
                      editData[field.key] === opt.value
                        ? 'text-white'
                        : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400'
                    }`}
                    style={editData[field.key] === opt.value ? { backgroundColor: config.color } : {}}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div key={field.key} className="flex items-center gap-2">
                <label className="w-28 flex-shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={String(editData[field.key] ?? '')}
                  onChange={(e) =>
                    setEditData((p) => ({
                      ...p,
                      [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                    }))
                  }
                  className="flex-1 rounded-md border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-800 px-2 py-1 text-[13px] text-zinc-900 dark:text-white outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-white/30"
                />
              </div>
            )
          )}
          </div>
          )}

          {record.rawText && (
            <div className="space-y-2 pt-1 pb-1">
              {/* Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`rule-${record.id}`}
                  checked={saveAsRule}
                  onChange={(e) => { setSaveAsRule(e.target.checked); setRuleMode('new'); setSelectedExistingRule(''); }}
                  className="rounded border-zinc-300 dark:border-white/10"
                />
                <label htmlFor={`rule-${record.id}`} className="flex min-w-0 gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer">
                  <span className="flex-shrink-0">Guardar regla para</span>
                  <span className="truncate font-mono">"{record.rawText}"</span>
                </label>
              </div>

              {/* Mode picker */}
              {saveAsRule && (
                <div className="ml-5 space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input type="radio" name={`ruleMode-${record.id}`} checked={ruleMode === 'new'} onChange={() => setRuleMode('new')} className="accent-zinc-600" />
                    Nueva regla (con la categoría seleccionada)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input type="radio" name={`ruleMode-${record.id}`} checked={ruleMode === 'existing'} onChange={() => setRuleMode('existing')} className="accent-zinc-600" />
                    Asociar con regla existente
                  </label>
                  {ruleMode === 'existing' && (
                    <select
                      value={selectedExistingRule}
                      onChange={(e) => setSelectedExistingRule(e.target.value)}
                      className="ml-4 w-[calc(100%-1rem)] rounded-md border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">Elegir regla...</option>
                      {existingRules.map((r) => {
                        const cfg = getCatConfig(r.category);
                        return (
                          <option key={r.id} value={r.id}>
                            {cfg.emoji} {r.text}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1 border-t border-zinc-100 dark:border-white/5">
            <button
              onClick={() => setEditing(false)}
              className="mt-2 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              className="mt-2 rounded-md bg-zinc-100 dark:bg-white/10 px-3 py-1 text-[11px] text-zinc-900 dark:text-white transition-colors hover:bg-zinc-200 dark:hover:bg-white/15"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Pending actions */}
      {pending && !editing && (
        <div className="mt-3 flex items-center justify-between border-t border-zinc-200 dark:border-white/5 pt-3">
          <button
            onClick={startEdit}
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
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

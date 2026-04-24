'use client';

import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ALL_CATEGORIES, CATEGORY_CONFIG, ParsedData, FieldDef } from '@/lib/types';
import {
  COLOR_OPTIONS,
  EMOJI_OPTIONS,
  useCustomCategories,
} from '@/lib/custom-categories';

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${
        on ? 'bg-zinc-800 dark:bg-zinc-300' : 'bg-zinc-200 dark:bg-zinc-600'
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full shadow transition-transform duration-200 ${
          on ? 'translate-x-6 bg-white dark:bg-zinc-900' : 'translate-x-1 bg-white dark:bg-zinc-300'
        }`}
      />
    </div>
  );
}


const BUILTIN_DEFAULTS: Record<string, Partial<ParsedData>> = {
  agua: { unidad: 'ml' },
  bano: { tipo: 'pis' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function localNow(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Categories where duration is irrelevant (instant events)
const NO_DURATION = ['agua', 'medicina'];
// Categories that already have their own duration field (minutos)
const HAS_OWN_DURATION = ['actividad', 'ocio'];

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'select' | 'fields' | 'create';

interface AddRecordModalProps {
  onClose: () => void;
}

export function AddRecordModal({ onClose }: AddRecordModalProps) {
  const { customCategories, createCategory, getCatConfig } = useCustomCategories();

  const [step, setStep] = useState<Step>('select');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ParsedData>>({});
  const [notificar, setNotificar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState(localNow);
  const [hasDuration, setHasDuration] = useState(false);
  const [durationMins, setDurationMins] = useState('');

  // New category form state
  const [newEmoji, setNewEmoji] = useState('📝');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6'); // Default to blue instead of gray
  const [newHasDuration, setNewHasDuration] = useState(false);
  const [creating, setCreating] = useState(false);

  function pickCategory(catId: string) {
    setSelectedCategory(catId);
    setFormData(BUILTIN_DEFAULTS[catId] ?? {});
    setNotificar(false);
    setHasDuration(false);
    setDurationMins('');
    setRecordDate(localNow());
    setStep('fields');
  }

  function setField(key: keyof ParsedData, value: string | number) {
    setFormData((p) => ({ ...p, [key]: value }));
  }

  async function handleDeleteCategory(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDeleteCat !== id) {
      setConfirmDeleteCat(id);
      setTimeout(() => setConfirmDeleteCat(null), 3000);
      return;
    }
    await deleteDoc(doc(db, 'categorias', id));
    setConfirmDeleteCat(null);
  }

  async function handleCreateCategory() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const id = await createCategory(newLabel.trim(), newEmoji, newColor, newHasDuration);
      pickCategory(id);
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }

  async function handleSubmit() {
    if (!selectedCategory) return;
    setSaving(true);
    try {
      const ts = Timestamp.fromDate(new Date(recordDate));
      const extraParsed = hasDuration && durationMins ? { duracion: Number(durationMins) } : {};
      await addDoc(collection(db, 'registros'), {
        category: selectedCategory,
        rawText: '',
        parsedData: { ...formData, ...extraParsed },
        notificar: selectedCategory === 'agenda' && notificar,
        status: 'confirmed',
        createdAt: ts,
        confirmedAt: ts,
      });
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  const cfg = selectedCategory ? getCatConfig(selectedCategory) : null;
  const fields = cfg ? cfg.fields : [];
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'fields' && !saving) {
        handleSubmit();
      } else if (step === 'create' && newLabel.trim() && !creating) {
        handleCreateCategory();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {step === 'create'
              ? 'Nueva categoría'
              : step === 'fields' && cfg
              ? `${cfg.emoji} ${cfg.label}`
              : 'Nueva entrada'}
          </h2>
          <button
            onClick={onClose}
            className="text-lg leading-none text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {/* ── Step: select category ── */}
          {step === 'select' && (
            <div>
              <p className="mb-3 text-[11px] text-zinc-400 dark:text-zinc-500">Elige una categoría</p>
              <div className="grid grid-cols-4 gap-2">
                {/* Built-in categories */}
                {ALL_CATEGORIES.filter((cat) => cat !== 'unknown').map((cat) => {
                  const c = CATEGORY_CONFIG[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => pickCategory(cat)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-white/5 p-3 text-center transition-all hover:scale-105 active:scale-95"
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                        {c.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}

                {/* Custom categories */}
                {customCategories.map((cat) => (
                  <div key={cat.id} className="group relative">
                    <button
                      onClick={() => pickCategory(cat.id)}
                      className="flex w-full flex-col items-center gap-1.5 rounded-xl border bg-zinc-50 dark:bg-white/5 p-3 text-center transition-all hover:scale-105 active:scale-95"
                      style={{ borderColor: `${cat.color}40` }}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                        {cat.label.split(' ')[0]}
                      </span>
                    </button>
                    <button
                      onClick={(e) => handleDeleteCategory(cat.id, e)}
                      className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        confirmDeleteCat === cat.id
                          ? 'bg-red-500 text-white opacity-100'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100'
                      }`}
                      title={confirmDeleteCat === cat.id ? '¿Confirmar?' : 'Eliminar categoría'}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Create new */}
                <button
                  onClick={() => setStep('create')}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-white/15 p-3 text-center transition-all hover:border-zinc-400 dark:hover:border-white/30 hover:bg-zinc-50 dark:hover:bg-white/5"
                >
                  <span className="text-2xl">＋</span>
                  <span className="text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
                    Nueva
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ── Step: create category ── */}
          {step === 'create' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('select')}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                ← Volver
              </button>

              {/* Emoji picker */}
              <div>
                <label className="mb-2 block text-[11px] text-zinc-500 dark:text-zinc-400">Icono</label>
                <div className="grid grid-cols-8 gap-1 rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-white/5 p-2">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      onClick={() => setNewEmoji(em)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all ${
                        newEmoji === em
                          ? 'bg-white dark:bg-white/15 shadow-sm scale-110'
                          : 'hover:bg-white dark:hover:bg-white/10'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Nombre</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ej: Lectura, Trabajo, Mascotas..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2.5 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-white/25"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="mb-2 block text-[11px] text-zinc-500 dark:text-zinc-400">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setNewColor(col)}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        newColor === col ? 'scale-125 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: col, ...(newColor === col ? { ringColor: col } : {}) }}
                    />
                  ))}
                </div>
              </div>

              {/* Duration option */}
              <div
                onClick={() => setNewHasDuration(!newHasDuration)}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-white/5 px-3 py-2.5 select-none"
              >
                <div>
                  <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Permite duración</p>
                  <p className="text-[10px] text-zinc-400">Ej: sesión de 30 min</p>
                </div>
                <Toggle on={newHasDuration} />
              </div>

              {/* Preview */}
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2"
                style={{ borderColor: `${newColor}40`, backgroundColor: `${newColor}10` }}
              >
                <span className="text-xl">{newEmoji}</span>
                <span className="text-sm font-medium" style={{ color: newColor }}>
                  {newLabel || 'Nombre de la categoría'}
                </span>
              </div>

              <button
                onClick={handleCreateCategory}
                disabled={!newLabel.trim() || creating}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
                style={{ backgroundColor: newColor }}
              >
                {creating ? 'Creando...' : 'Crear y usar'}
              </button>
            </div>
          )}

          {/* ── Step: fill fields ── */}
          {step === 'fields' && cfg && (
            <div className="space-y-3">
              <button
                onClick={() => { setStep('select'); setSelectedCategory(null); }}
                className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                ← Cambiar categoría
              </button>

              {fields.map((field) =>
                field.type === 'toggle' && field.options ? (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-[11px] text-zinc-500 dark:text-zinc-400">{field.label}</label>
                    <div className="flex gap-2">
                      {field.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setField(field.key, opt.value)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
                            formData[field.key] === opt.value ? 'text-white' : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300'
                          }`}
                          style={formData[field.key] === opt.value ? { backgroundColor: cfg.color } : undefined}
                        >
                          {opt.emoji} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key={field.key}>
                    <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={String(formData[field.key] ?? '')}
                      onChange={(e) =>
                        setField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                      }
                      className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2.5 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-white/25"
                    />
                  </div>
                )
              )}

              {selectedCategory === 'agenda' && (
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="h-3.5 w-3.5 rounded" />
                  Agregar a Google Calendar
                </label>
              )}

              {/* Duration toggle — only for categories that support it */}
              {selectedCategory && (() => {
                const isCustom = !NO_DURATION.includes(selectedCategory) && !HAS_OWN_DURATION.includes(selectedCategory) && !(selectedCategory in CATEGORY_CONFIG);
                const customCat = customCategories.find(c => c.id === selectedCategory);
                
                // For bano, only show duration if it's ducha/tina
                const isBanoWithDur = selectedCategory === 'bano' && (formData.tipo === 'ducha' || formData.tipo === 'tina');
                
                const showDur = isBanoWithDur || (
                  !NO_DURATION.includes(selectedCategory) &&
                  !HAS_OWN_DURATION.includes(selectedCategory) &&
                  (isCustom ? customCat?.hasDuration : true)
                );
                
                if (!showDur) return null;

                return (
                  <div className="rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-white/5 px-3 py-2.5">
                    <div
                      className="flex cursor-pointer items-center justify-between select-none"
                      onClick={() => { setHasDuration(!hasDuration); setDurationMins(''); }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Duración
                      </span>
                      <Toggle on={hasDuration || isBanoWithDur} />
                    </div>
                    {hasDuration && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="30"
                          value={durationMins}
                          onChange={(e) => setDurationMins(e.target.value)}
                          className="w-20 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/25"
                        />
                        <span className="text-[11px] text-zinc-400">minutos</span>
                        {durationMins && cfg && (
                          <span className="ml-auto text-[11px] font-medium" style={{ color: cfg.color }}>
                            → {new Date(new Date(recordDate).getTime() + Number(durationMins) * 60000)
                                .toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Date/time picker */}
              <div className="rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-white/5 px-3 py-2.5">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Fecha y hora
                </label>
                <input
                  type="datetime-local"
                  value={recordDate}
                  max={localNow()}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full bg-transparent text-sm text-zinc-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: cfg.color }}
              >
                {saving ? 'Guardando...' : 'Agregar al Inbox'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

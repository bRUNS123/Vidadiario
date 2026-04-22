'use client';

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ALL_CATEGORIES, CATEGORY_CONFIG, ParsedData } from '@/lib/types';
import {
  COLOR_OPTIONS,
  EMOJI_OPTIONS,
  useCustomCategories,
} from '@/lib/custom-categories';

// ── Field definitions for built-in categories ─────────────────────────────────

type FieldDef = {
  key: keyof ParsedData;
  label: string;
  type: 'text' | 'number' | 'toggle';
  placeholder?: string;
  options?: { value: string; label: string; emoji: string }[];
};

const BUILTIN_FIELDS: Record<string, FieldDef[]> = {
  agua: [{ key: 'cantidad', label: 'Cantidad (ml)', type: 'number', placeholder: '500' }],
  actividad: [
    { key: 'nombre', label: 'Ejercicio', type: 'text', placeholder: 'Pesas, Correr...' },
    { key: 'minutos', label: 'Minutos', type: 'number', placeholder: '45' },
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
    { key: 'minutos', label: 'Minutos', type: 'number', placeholder: '60' },
  ],
  agenda: [
    { key: 'evento', label: 'Evento', type: 'text', placeholder: 'Dentista...' },
    { key: 'hora', label: 'Hora (HH:MM)', type: 'text', placeholder: '10:30' },
  ],
  bano: [
    {
      key: 'tipo',
      label: 'Tipo',
      type: 'toggle',
      options: [
        { value: 'pis', label: 'Pis', emoji: '💦' },
        { value: 'caca', label: 'Caca', emoji: '💩' },
      ],
    },
  ],
};

const CUSTOM_FIELDS: FieldDef[] = [
  { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Escribe algo...' },
];

const BUILTIN_DEFAULTS: Record<string, Partial<ParsedData>> = {
  agua: { unidad: 'ml' },
  bano: { tipo: 'pis' },
};

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

  // New category form state
  const [newEmoji, setNewEmoji] = useState('📝');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [creating, setCreating] = useState(false);

  function pickCategory(catId: string) {
    setSelectedCategory(catId);
    setFormData(BUILTIN_DEFAULTS[catId] ?? {});
    setNotificar(false);
    setStep('fields');
  }

  function setField(key: keyof ParsedData, value: string | number) {
    setFormData((p) => ({ ...p, [key]: value }));
  }

  async function handleCreateCategory() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const id = await createCategory(newLabel.trim(), newEmoji, newColor);
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
      await addDoc(collection(db, 'registros'), {
        category: selectedCategory,
        rawText: '',
        parsedData: formData,
        notificar: selectedCategory === 'agenda' && notificar,
        status: 'confirmed',
        createdAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  const cfg = selectedCategory ? getCatConfig(selectedCategory) : null;
  const fields = selectedCategory
    ? (BUILTIN_FIELDS[selectedCategory] ?? CUSTOM_FIELDS)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
                {ALL_CATEGORIES.map((cat) => {
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
                  <button
                    key={cat.id}
                    onClick={() => pickCategory(cat.id)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border bg-zinc-50 dark:bg-white/5 p-3 text-center transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: `${cat.color}40` }}
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                      {cat.label.split(' ')[0]}
                    </span>
                  </button>
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

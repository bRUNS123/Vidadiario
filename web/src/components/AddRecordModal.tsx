'use client';

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ALL_CATEGORIES, CATEGORY_CONFIG, Category, ParsedData } from '@/lib/types';

type FieldDef = {
  key: keyof ParsedData;
  label: string;
  type: 'text' | 'number' | 'toggle';
  placeholder?: string;
  options?: { value: string; label: string; emoji: string }[];
};

const FIELDS: Record<Category, FieldDef[]> = {
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

const DEFAULTS: Record<Category, Partial<ParsedData>> = {
  agua: { unidad: 'ml' },
  actividad: {},
  alimentacion: {},
  medicina: {},
  ocio: {},
  agenda: {},
  bano: { tipo: 'pis' },
};

interface AddRecordModalProps {
  onClose: () => void;
}

export function AddRecordModal({ onClose }: AddRecordModalProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<Partial<ParsedData>>({});
  const [notificar, setNotificar] = useState(false);
  const [saving, setSaving] = useState(false);

  function selectCategory(cat: Category) {
    setCategory(cat);
    setFormData(DEFAULTS[cat]);
    setNotificar(false);
  }

  function setField(key: keyof ParsedData, value: string | number) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!category) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'registros'), {
        category,
        rawText: '',
        parsedData: formData,
        notificar: category === 'agenda' && notificar,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  const cfg = category ? CATEGORY_CONFIG[category] : null;
  const fields = category ? FIELDS[category] : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-2xl mx-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {category ? `${cfg!.emoji} ${cfg!.label}` : 'Nueva entrada'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Category grid */}
        {!category ? (
          <div className="grid grid-cols-4 gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const c = CATEGORY_CONFIG[cat];
              return (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-white/5 p-3 text-center transition-all hover:scale-105 active:scale-95"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-[10px] leading-tight text-zinc-500 dark:text-zinc-400">
                    {c.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Back button */}
            <button
              onClick={() => setCategory(null)}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              ← Cambiar categoría
            </button>

            {/* Fields */}
            {fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">
                  {field.label}
                </label>

                {field.type === 'toggle' && field.options ? (
                  <div className="flex gap-2">
                    {field.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setField(field.key, opt.value)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all ${
                          formData[field.key] === opt.value
                            ? 'ring-2'
                            : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300'
                        }`}
                        style={
                          formData[field.key] === opt.value
                            ? { backgroundColor: `${cfg!.color}20`, color: cfg!.color }
                            : undefined
                        }
                      >
                        {opt.emoji} {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={String(formData[field.key] ?? '')}
                    onChange={(e) =>
                      setField(
                        field.key,
                        field.type === 'number' ? Number(e.target.value) : e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2.5 text-sm text-zinc-900 dark:text-white outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-white/25"
                  />
                )}
              </div>
            ))}

            {/* Agenda: notificar checkbox */}
            {category === 'agenda' && (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={notificar}
                  onChange={(e) => setNotificar(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                Agregar a Google Calendar
              </label>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="mt-1 w-full rounded-xl py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                backgroundColor: cfg!.color,
                color: '#fff',
              }}
            >
              {saving ? 'Guardando...' : 'Agregar al Inbox'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

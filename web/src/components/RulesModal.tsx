'use client';

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ALL_CATEGORIES, CATEGORY_CONFIG, ParsedData } from '@/lib/types';
import { useCustomCategories } from '@/lib/custom-categories';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AliasRule {
  id: string;
  text: string;
  category: string;
  parsedData: Partial<ParsedData>;
}

// ── Field config per category for the rule form ───────────────────────────────

const RULE_FIELDS: Record<string, { key: keyof ParsedData; label: string; placeholder: string; type: 'text' | 'number' }[]> = {
  agua:        [{ key: 'cantidad', label: 'ml por defecto', placeholder: '500', type: 'number' }],
  actividad:   [
    { key: 'nombre', label: 'Ejercicio', placeholder: 'Pesas...', type: 'text' },
    { key: 'minutos', label: 'Duración (min)', placeholder: '45', type: 'number' },
  ],
  alimentacion:[{ key: 'descripcion', label: 'Descripción base', placeholder: 'Ensalada...', type: 'text' }],
  medicina:    [
    { key: 'nombre', label: 'Medicamento', placeholder: 'Creatina...', type: 'text' },
    { key: 'dosis', label: 'Dosis', placeholder: '5g...', type: 'text' },
  ],
  ocio:        [
    { key: 'actividad', label: 'Actividad', placeholder: 'Series...', type: 'text' },
    { key: 'minutos', label: 'Duración (min)', placeholder: '60', type: 'number' },
  ],
  agenda:      [{ key: 'evento', label: 'Evento base', placeholder: 'Dentista...', type: 'text' }],
  bano:        [],
  unknown:     [],
};

function sanitizeId(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9áéíóúüñ\s]/g, '').replace(/\s+/g, '_');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  const [rules, setRules] = useState<AliasRule[]>([]);
  const [search, setSearch] = useState('');

  // New rule form
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newParsedData, setNewParsedData] = useState<Partial<ParsedData>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { customCategories, getCatConfig } = useCustomCategories();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'aliasMappings'), (snap) => {
      setRules(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AliasRule))
          .sort((a, b) => a.text.localeCompare(b.text))
      );
    });
    return unsub;
  }, []);

  function setField(key: keyof ParsedData, value: string | number) {
    setNewParsedData((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    if (!newText.trim() || !newCategory) return;
    setSaving(true);
    try {
      const id = sanitizeId(newText);
      await setDoc(doc(db, 'aliasMappings', id), {
        text: newText.toLowerCase().trim(),
        category: newCategory,
        parsedData: newParsedData,
      });
      setNewText('');
      setNewCategory('');
      setNewParsedData({});
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    await deleteDoc(doc(db, 'aliasMappings', id));
    setConfirmDelete(null);
  }

  const fields = newCategory ? (RULE_FIELDS[newCategory] ?? [{ key: 'descripcion' as keyof ParsedData, label: 'Descripción', placeholder: '...', type: 'text' as const }]) : [];
  const filtered = search ? rules.filter((r) => r.text.includes(search.toLowerCase()) || r.category.includes(search.toLowerCase())) : rules;

  // All available categories (builtin + custom) for the select
  const allCats = [
    ...ALL_CATEGORIES.filter((c) => c !== 'unknown'),
    ...customCategories.map((c) => c.id),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 flex h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 dark:border-white/5 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Reglas y Prefijos</h2>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              Usa <strong>-prefijo</strong> para forzar una categoría (ej: -comida Pizza).
            </p>
          </div>
          <button onClick={onClose} className="text-lg leading-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">×</button>
        </div>

        {/* Search + list */}
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          {rules.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar regla..."
              className="mb-3 w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-white/25"
            />
          )}

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="mb-2 text-3xl">🗂️</span>
                <p className="text-sm text-zinc-400">{rules.length === 0 ? 'Sin reglas aún' : 'Sin resultados'}</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {rules.length === 0 ? 'Crea la primera regla abajo' : 'Prueba otra búsqueda'}
                </p>
              </div>
            )}
            {filtered.map((rule) => {
              const cfg = getCatConfig(rule.category);
              const summary = Object.entries(rule.parsedData ?? {})
                .filter(([, v]) => v !== undefined && v !== '')
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.03] px-3 py-2.5"
                >
                  <code className="min-w-0 flex-1 truncate text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                    {rule.text}
                  </code>
                  <span className="mx-1 text-zinc-300 dark:text-zinc-600 text-xs">→</span>
                  <span className="text-base flex-shrink-0">{cfg.emoji}</span>
                  <span className="text-[11px] font-medium flex-shrink-0" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  {summary && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 truncate max-w-[120px]">
                      {summary}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className={`ml-auto flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all ${
                      confirmDelete === rule.id
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                        : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400'
                    }`}
                  >
                    {confirmDelete === rule.id ? '¿Seguro?' : '×'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add rule form */}
        <div className="flex-shrink-0 border-t border-zinc-100 dark:border-white/5 p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            + Nueva regla
          </p>

          {/* Trigger text + category on same row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Texto del mensaje..."
              className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:focus:border-white/25"
            />
            <select
              value={newCategory}
              onChange={(e) => { setNewCategory(e.target.value); setNewParsedData({}); }}
              className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none"
            >
              <option value="">Categoría...</option>
              {allCats.map((cat) => {
                const cfg = getCatConfig(cat);
                return <option key={cat} value={cat}>{cfg.emoji} {cfg.label}</option>;
              })}
            </select>
          </div>

          {/* Dynamic fields */}
          {fields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-1 min-w-[120px] items-center gap-1.5">
                  <label className="text-[10px] text-zinc-400 flex-shrink-0">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={String(newParsedData[field.key] ?? '')}
                    onChange={(e) =>
                      setField(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)
                    }
                    className="flex-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2 py-1 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/25"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!newText.trim() || !newCategory || saving}
            className="w-full rounded-xl bg-zinc-900 dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-all hover:opacity-90 disabled:opacity-30"
          >
            {saving ? 'Guardando...' : 'Guardar regla'}
          </button>
        </div>
      </div>
    </div>
  );
}

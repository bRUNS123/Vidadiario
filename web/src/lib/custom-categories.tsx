'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { addDoc, collection, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { BuiltinCategory, CATEGORY_CONFIG, FieldDef, BUILTIN_FIELDS } from './types';
import { useAuth } from './auth-context';

export interface CustomCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
  hasDuration: boolean;
  fields?: FieldDef[];
  subcategories?: string[];
}

export interface CatConfig {
  label: string;
  emoji: string;
  color: string;
  glowClass: string;
  bg: string;
  border: string;
  labelColor: string;
  isCustom: boolean;
  needsCategorization?: boolean; // true when unresolved — show category picker
  fields: FieldDef[];
}

const FALLBACK: CatConfig = {
  label: 'Sin categoría',
  emoji: '❓',
  color: '#71717a',
  glowClass: '',
  bg: '',
  border: '',
  labelColor: '',
  isCustom: true,
  needsCategorization: true,
  fields: [],
};

interface ContextValue {
  customCategories: CustomCategory[];
  createCategory: (label: string, emoji: string, color: string, hasDuration: boolean, fields?: FieldDef[], subcategories?: string[]) => Promise<string>;
  getCatConfig: (category: string) => CatConfig;
}

const Ctx = createContext<ContextValue>({
  customCategories: [],
  createCategory: async () => '',
  getCatConfig: () => FALLBACK,
});

export function CustomCategoriesProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setCustomCategories([]);
      return;
    }

    const q = query(collection(db, 'categorias'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCustomCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomCategory)));
    });
    return unsub;
  }, [user]);

  async function createCategory(
    label: string, 
    emoji: string, 
    color: string, 
    hasDuration: boolean, 
    fields: FieldDef[] = [],
    subcategories: string[] = []
  ): Promise<string> {
    if (!user) throw new Error("Usuario no autenticado");
    const ref = await addDoc(collection(db, 'categorias'), {
      label,
      emoji,
      color,
      hasDuration,
      fields,
      subcategories,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  function getCatConfig(category: string): CatConfig {
    const catLower = category.toLowerCase();
    
    // 1. Check built-in categories and aliases
    const aliases: Record<string, { cat: BuiltinCategory, label: string, emoji: string }> = {
      'ducha': { cat: 'bano', label: 'Ducha', emoji: '🚿' },
      'tina': { cat: 'bano', label: 'Baño Tina', emoji: '🛁' },
      'asiento': { cat: 'bano', label: 'Ducha Asiento', emoji: '🪑' },
      'baño': { cat: 'bano', label: 'Necesidades', emoji: '🚽' },
    };

    const alias = aliases[catLower];
    const targetCat = alias ? alias.cat : catLower;

    if (targetCat in CATEGORY_CONFIG) {
      const cfg = CATEGORY_CONFIG[targetCat as BuiltinCategory];
      return { 
        ...cfg, 
        label: alias ? alias.label : cfg.label,
        emoji: alias ? alias.emoji : cfg.emoji,
        isCustom: false,
        fields: BUILTIN_FIELDS[targetCat] || [],
      };
    }

    // 2. Check custom categories by ID or Label (case-insensitive)
    const custom = customCategories.find(
      (c) => c.id === category || c.label.toLowerCase() === catLower
    );

    if (!custom) return FALLBACK;

    return {
      label: custom.label,
      emoji: custom.emoji,
      color: custom.color,
      glowClass: '',
      bg: '', // Handled by inline styles in RecordCard
      border: '',
      labelColor: '',
      isCustom: true,
      fields: custom.fields && custom.fields.length > 0 
        ? custom.fields 
        : [{ key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Escribe algo...' }],
    };
  }

  return (
    <Ctx.Provider value={{ customCategories, createCategory, getCatConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCustomCategories() {
  return useContext(Ctx);
}

export const EMOJI_OPTIONS = [
  '🏃','🏋️','🧘','🚴','🎯','🎵','🎨','📚','💼','🌿',
  '🐕','🐱','☕','🍎','🥤','💤','🌙','✈️','🏠','💰',
  '🧹','🔧','📱','🧠','❤️','🌟','🎓','🏆','⚽','🎲',
  '📝','🌊','🎬','🛒','🌺','🍕','🧪','🎁',
];

export const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6b7280', '#d97706',
];

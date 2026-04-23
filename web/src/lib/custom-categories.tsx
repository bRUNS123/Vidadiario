'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { BuiltinCategory, CATEGORY_CONFIG } from './types';

export interface CustomCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
  hasDuration: boolean;
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
}

const FALLBACK: CatConfig = {
  label: 'Otro',
  emoji: '📝',
  color: '#6b7280',
  glowClass: '',
  bg: 'bg-zinc-100 dark:bg-zinc-800/50',
  border: 'border-zinc-200 dark:border-zinc-700/40',
  labelColor: 'text-zinc-500 dark:text-zinc-400',
  isCustom: true,
};

interface ContextValue {
  customCategories: CustomCategory[];
  createCategory: (label: string, emoji: string, color: string, hasDuration: boolean) => Promise<string>;
  getCatConfig: (category: string) => CatConfig;
}

const Ctx = createContext<ContextValue>({
  customCategories: [],
  createCategory: async () => '',
  getCatConfig: () => FALLBACK,
});

export function CustomCategoriesProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categorias'), (snap) => {
      setCustomCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CustomCategory)));
    });
    return unsub;
  }, []);

  async function createCategory(label: string, emoji: string, color: string, hasDuration: boolean): Promise<string> {
    const ref = await addDoc(collection(db, 'categorias'), {
      label,
      emoji,
      color,
      hasDuration,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  function getCatConfig(category: string): CatConfig {
    if (category in CATEGORY_CONFIG) {
      const cfg = CATEGORY_CONFIG[category as BuiltinCategory];
      return { ...cfg, isCustom: false };
    }
    const custom = customCategories.find((c) => c.id === category);
    if (!custom) return FALLBACK;
    return {
      label: custom.label,
      emoji: custom.emoji,
      color: custom.color,
      glowClass: '',
      bg: 'bg-zinc-100 dark:bg-zinc-800/50',
      border: 'border-zinc-200 dark:border-zinc-700/40',
      labelColor: 'text-zinc-500 dark:text-zinc-400',
      isCustom: true,
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

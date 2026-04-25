'use client';
// Force redeploy v2

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DiarioRecord } from '@/lib/types';
import { MOCK_CONFIRMED, MOCK_PENDING } from '@/lib/mock-data';
import { useTheme } from '@/lib/use-theme';
import { CustomCategoriesProvider } from '@/lib/custom-categories';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { Login } from './Login';
import { InboxPanel } from './InboxPanel';
import { TimelinePanel } from './TimelinePanel';
import { WeeklyPanel } from './WeeklyPanel';
import { AddRecordModal } from './AddRecordModal';
import { RulesModal } from './RulesModal';
import { SettingsModal } from './SettingsModal';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Dashboard() {
  const [pending, setPending] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_PENDING : []);
  const [confirmed, setConfirmed] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_CONFIRMED : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [showModal, setShowModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'weekly'>('timeline');
  const { isDark, toggle } = useTheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (DEMO_MODE || !user) return;

    const pendingQ = query(
      collection(db, 'registros'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const confirmedQ = query(
      collection(db, 'registros'),
      where('userId', '==', user.uid),
      where('status', '==', 'confirmed'),
      limit(200)
    );

    const unsubPending = onSnapshot(pendingQ, (snap) => {
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiarioRecord)));
      setLoading(false);
    });
    const unsubConfirmed = onSnapshot(confirmedQ, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiarioRecord));
      // Sort client-side by createdAt (registration time, not approval time)
      docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setConfirmed(docs);
    });

    return () => { unsubPending(); unsubConfirmed(); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-zinc-400">Conectando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top header */}
      <header className="relative flex flex-shrink-0 items-center justify-between border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📓</span>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-white">Diario AG <span className="text-blue-500">●</span></h1>
          {DEMO_MODE && (
            <span className="rounded-full bg-yellow-100 dark:bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
              DEMO
            </span>
          )}
        </div>

        {/* View Toggle */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center rounded-xl bg-zinc-100 dark:bg-white/5 p-1 border border-zinc-200 dark:border-white/10 z-10">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md border border-zinc-200 dark:border-white/10'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>📜</span> Timeline
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${
              viewMode === 'weekly'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md border border-zinc-200 dark:border-white/10'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>📊</span> Semanal
          </button>
        </div>

        {/* Mobile View Toggle (visible on small screens) */}
        <div className="md:hidden flex items-center rounded-lg bg-zinc-100 dark:bg-white/5 p-0.5">
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded-md ${viewMode === 'timeline' ? 'bg-white dark:bg-zinc-800 shadow-sm' : ''}`}
            title="Timeline"
          >
            📜
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`p-1.5 rounded-md ${viewMode === 'weekly' ? 'bg-white dark:bg-zinc-800 shadow-sm' : ''}`}
            title="Semanal"
          >
            📊
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 w-8 h-8 text-[12px] transition-all hover:bg-zinc-100 dark:hover:bg-white/10"
            title="Configuración y Telegram"
          >
            ⚙️
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-1.5 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 transition-all hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            🗂️ Reglas
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white px-3 py-1.5 text-[12px] font-semibold text-white dark:text-zinc-900 transition-all hover:opacity-90 active:scale-95"
          >
            <span className="text-base leading-none">+</span> Agregar
          </button>
          <button
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        <InboxPanel records={pending} onAdd={() => setShowModal(true)} />
        <div className="w-px flex-shrink-0 bg-zinc-200 dark:bg-white/5" />
        
        {viewMode === 'timeline' ? (
          <TimelinePanel records={confirmed} />
        ) : (
          <WeeklyPanel records={confirmed} />
        )}
      </div>

      {showModal && <AddRecordModal onClose={() => setShowModal(false)} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function DashboardApp() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-[#09090b]">
        <p className="animate-pulse text-sm text-zinc-400">Autenticando...</p>
      </div>
    );
  }

  if (!user && !DEMO_MODE) {
    return <Login />;
  }

  return (
    <CustomCategoriesProvider>
      <Dashboard />
    </CustomCategoriesProvider>
  );
}

export function DashboardWithProviders() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}

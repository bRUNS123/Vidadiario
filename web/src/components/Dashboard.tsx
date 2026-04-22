'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DiarioRecord } from '@/lib/types';
import { MOCK_CONFIRMED, MOCK_PENDING } from '@/lib/mock-data';
import { useTheme } from '@/lib/use-theme';
import { InboxPanel } from './InboxPanel';
import { TimelinePanel } from './TimelinePanel';
import { AddRecordModal } from './AddRecordModal';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Dashboard() {
  const [pending, setPending] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_PENDING : []);
  const [confirmed, setConfirmed] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_CONFIRMED : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [showModal, setShowModal] = useState(false);
  const { isDark, toggle } = useTheme();

  useEffect(() => {
    if (DEMO_MODE) return;

    const pendingQ = query(
      collection(db, 'registros'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    const confirmedQ = query(
      collection(db, 'registros'),
      where('status', '==', 'confirmed'),
      orderBy('confirmedAt', 'desc'),
      limit(200)
    );

    const unsubPending = onSnapshot(pendingQ, (snap) => {
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiarioRecord)));
      setLoading(false);
    });
    const unsubConfirmed = onSnapshot(confirmedQ, (snap) => {
      setConfirmed(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiarioRecord)));
    });

    return () => { unsubPending(); unsubConfirmed(); };
  }, []);

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
      <header className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📓</span>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-white">Diario AG</h1>
          {DEMO_MODE && (
            <span className="rounded-full bg-yellow-100 dark:bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
              DEMO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        <TimelinePanel records={confirmed} />
      </div>

      {showModal && <AddRecordModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DiarioRecord } from '@/lib/types';
import { MOCK_CONFIRMED, MOCK_PENDING } from '@/lib/mock-data';
import { InboxPanel } from './InboxPanel';
import { TimelinePanel } from './TimelinePanel';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function Dashboard() {
  const [pending, setPending] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_PENDING : []);
  const [confirmed, setConfirmed] = useState<DiarioRecord[]>(DEMO_MODE ? MOCK_CONFIRMED : []);
  const [loading, setLoading] = useState(!DEMO_MODE);

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

    return () => {
      unsubPending();
      unsubConfirmed();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090b]">
        <p className="animate-pulse text-sm text-zinc-600">Conectando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      {DEMO_MODE && (
        <div className="fixed right-3 top-3 z-50 rounded-full bg-yellow-500/15 px-3 py-1 text-[10px] font-medium text-yellow-400">
          DEMO
        </div>
      )}
      <InboxPanel records={pending} />
      <div className="w-px flex-shrink-0 bg-white/5" />
      <TimelinePanel records={confirmed} />
    </div>
  );
}

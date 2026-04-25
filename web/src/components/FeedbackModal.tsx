'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { DiarioRecord } from '@/lib/types';

interface FeedbackModalProps {
  onClose: () => void;
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRecords: 0,
    topCategory: '...',
    waterTotal: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchStats() {
      try {
        const q = query(
          collection(db, 'registros'), 
          where('userId', '==', user.uid),
          where('status', '==', 'confirmed'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const records = snap.docs.map(d => d.data() as DiarioRecord);

        // Simple stats logic
        const counts: Record<string, number> = {};
        let water = 0;
        records.forEach(r => {
          counts[r.category] = (counts[r.category] || 0) + 1;
          if (r.category === 'agua' || r.category.toLowerCase().includes('líquid')) {
            water += (r.parsedData.cantidad || 0);
          }
        });

        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

        setStats({
          totalRecords: records.length,
          topCategory: top,
          waterTotal: water,
          streak: 5, // Placeholder for now
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950/50 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>✨</span> Feedback & Insights
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-400">Análisis inteligente de tu actividad diaria</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center animate-pulse">
              <div className="text-4xl mb-4">🧠</div>
              <p className="text-sm text-zinc-400">Analizando tus datos...</p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.03] p-4 border border-zinc-100 dark:border-white/5">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Total Registros</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalRecords}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.03] p-4 border border-zinc-100 dark:border-white/5">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Racha Actual</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.streak} días 🔥</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.03] p-4 border border-zinc-100 dark:border-white/5">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Más frecuente</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white capitalize">{stats.topCategory}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.03] p-4 border border-zinc-100 dark:border-white/5">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Agua hoy</p>
                  <p className="text-lg font-bold text-blue-500">{stats.waterTotal} ml 💧</p>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-5 space-y-3">
                <h4 className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <span>💡</span> AI Recommendation
                </h4>
                <p className="text-sm text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">
                  Has registrado mucha actividad en la categoría <strong>Gaming</strong> últimamente. 
                  ¡Recuerda compensar con un poco de movimiento! Mañana podrías intentar una sesión de 30 min de ejercicio.
                </p>
              </div>

              {/* Quick Feedback Form (Simple placeholder) */}
              <div className="space-y-3 pt-4">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Tu Feedback para el sistema</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="¿Alguna sugerencia o bug?" 
                    className="flex-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                  <button className="rounded-xl bg-zinc-900 dark:bg-white px-4 text-sm font-bold text-white dark:text-zinc-900">Enviar</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

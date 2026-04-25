'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
  const [feedbackItems, setFeedbackItems] = useState<DiarioRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const { customCategories } = useCustomCategories();
  const feedbackCat = customCategories.find(c => c.label.toLowerCase() === 'feedback');

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
          streak: 5,
        });

        // Fetch PENDING feedback items
        const feedbackQuery = query(
          collection(db, 'registros'),
          where('userId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const fbSnap = await getDocs(feedbackQuery);
        const fbItems = fbSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as DiarioRecord))
          .filter(r => r.category === 'feedback' || r.category === feedbackCat?.id);
        
        setFeedbackItems(fbItems);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user, feedbackCat]);

  async function handleApprove(record: DiarioRecord) {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'registros', record.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
      });
      setFeedbackItems(prev => prev.filter(r => r.id !== record.id));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'registros', id));
      setFeedbackItems(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

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

              {/* Feedback Inbox Section */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>📬 Inbox de Feedback</span>
                  <span className="bg-zinc-100 dark:bg-white/10 px-2 py-0.5 rounded-full text-[9px]">{feedbackItems.length} pendientes</span>
                </h4>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {feedbackItems.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-zinc-100 dark:border-white/5 rounded-2xl">
                      <p className="text-[11px] text-zinc-400">No hay feedback pendiente de revisión</p>
                    </div>
                  ) : (
                    feedbackItems.map(item => (
                      <div key={item.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{item.subcategory || 'General'}</span>
                          <span className="text-[9px] text-zinc-400">{new Date(item.createdAt.seconds * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-200">{item.rawText}</p>
                        <div className="flex gap-2 mt-1">
                          <button 
                            onClick={() => handleApprove(item)}
                            className="flex-1 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-bold rounded-lg hover:opacity-90 transition-all"
                          >
                            Aprobar
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-1.5 border border-zinc-200 dark:border-white/10 text-zinc-400 text-[11px] rounded-lg hover:text-red-500 hover:border-red-500/20 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

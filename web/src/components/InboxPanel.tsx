import { DiarioRecord } from '@/lib/types';
import { RecordCard } from './RecordCard';
import { useState } from 'react';
import { parseMessage } from '@/lib/parser-web';
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface InboxPanelProps {
  records: DiarioRecord[];
  onAdd: () => void;
}

export function InboxPanel({ records, onAdd }: InboxPanelProps) {
  const { user } = useAuth();
  const [quickText, setQuickText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickText.trim() || !user) return;

    setIsParsing(true);
    try {
      const getAliases = async () => {
        const snap = await getDocs(query(collection(db, 'aliasMappings'), where('userId', '==', user.uid)));
        return snap.docs.map(d => d.data());
      };

      const parsed = await parseMessage(quickText, { getAliases }, user.uid);
      if (parsed) {
        // Remove undefined values for Firestore
        const cleanData = JSON.parse(JSON.stringify(parsed));
        
        await addDoc(collection(db, 'registros'), {
          ...cleanData,
          createdAt: serverTimestamp(),
        });
        setQuickText('');
      }
    } catch (error) {
      console.error('Error parsing text:', error);
      alert('Error procesando el mensaje');
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div className="flex w-[360px] flex-shrink-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/5 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Inbox</h2>
          <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">Pendientes de aprobación</p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10 px-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
              {records.length}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-3 text-4xl">📭</span>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Inbox vacío</p>
            <p className="mt-1 text-[11px] text-zinc-300 dark:text-zinc-600">
              Agrega desde aquí o envía un mensaje por Telegram
            </p>
            <button
              onClick={onAdd}
              className="mt-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              + Agregar entrada
            </button>
            <div className="mt-4 rounded-lg border border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.03] px-3 py-2 text-left">
              <p className="text-[10px] text-zinc-400">O desde Telegram (@midiariovidabot):</p>
              {['+h2o 500', '+af Pesas 45', '+ban pis', '!cita Dentista 10:30'].map((ex) => (
                <p key={ex} className="mt-0.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {ex}
                </p>
              ))}
            </div>
          </div>
        ) : (
          records.map((record) => <RecordCard key={record.id} record={record} pending />)
        )}
      </div>

      {/* Quick Add Bar */}
      <div className="border-t border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950 p-3">
        <form onSubmit={handleQuickAdd} className="relative flex items-center">
          <input
            type="text"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            disabled={isParsing}
            placeholder="Escribe como en Telegram..."
            className="w-full rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 py-2 pl-4 pr-10 text-[12px] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!quickText.trim() || isParsing}
            className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white transition-all hover:bg-blue-600 disabled:opacity-50"
          >
            {isParsing ? '...' : '↑'}
          </button>
        </form>
      </div>
    </div>
  );
}
